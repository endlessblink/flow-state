import type { useTaskStore } from '@/stores/tasks'
import { type Task } from '@/stores/tasks'
import { type CanvasSection } from '@/stores/canvas'
import { shouldUseSmartGroupLogic, detectPowerKeyword } from '../useTaskSmartGroups'
import { resolveDueDate } from '../useGroupSettings'
import { formatDateKey } from '@/utils/dateUtils'
import { DURATION_DEFAULTS, type DurationCategory } from '@/utils/durationCategories'

interface SectionPropertiesDeps {
    taskStore: ReturnType<typeof useTaskStore>
    getAllContainingSections: (x: number, y: number, width?: number, height?: number) => CanvasSection[]
}

export function useCanvasSectionProperties(deps: SectionPropertiesDeps) {
    const { taskStore, getAllContainingSections } = deps

    // Helper: Get properties from a single section based on its name/settings
    const getSectionProperties = (section: CanvasSection): Partial<Task> => {
        const updates: Partial<Task> = {}

        // 0. DAY-OF-WEEK GROUPS (Monday-Sunday)
        const dayOfWeekMap: Record<string, number> = {
            'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
            'thursday': 4, 'friday': 5, 'saturday': 6
        }
        const lowerName = section.name.toLowerCase().trim()
        if (dayOfWeekMap[lowerName] !== undefined) {
            const today = new Date()
            const targetDay = dayOfWeekMap[lowerName]
            // Calculate next occurrence: ((7 + target - current) % 7) || 7
            const daysUntilTarget = ((7 + targetDay - today.getDay()) % 7) || 7
            const resultDate = new Date(today)
            resultDate.setDate(today.getDate() + daysUntilTarget)
            updates.dueDate = formatDateKey(resultDate)
            return updates
        }

        // 1. Check explicit assignOnDrop settings first
        if (section.assignOnDrop) {
            const settings = section.assignOnDrop
            if (settings.priority) updates.priority = settings.priority
            if (settings.status) updates.status = settings.status
            if (settings.projectId) updates.projectId = settings.projectId
            if (settings.dueDate) {
                const resolvedDate = resolveDueDate(settings.dueDate)
                if (resolvedDate !== null) updates.dueDate = resolvedDate
            }
            return updates
        }

        // 2. Auto-detect from section name (Power Keywords)
        const keyword = detectPowerKeyword(section.name)
        if (keyword) {
            const today = new Date()
            switch (keyword.category) {
                case 'date':
                    switch (keyword.value) {
                        case 'today':
                            updates.dueDate = formatDateKey(today)
                            break
                        case 'tomorrow': {
                            const tom = new Date(today)
                            tom.setDate(today.getDate() + 1)
                            updates.dueDate = formatDateKey(tom)
                            break
                        }
                        case 'this weekend': {
                            const sat = new Date(today)
                            sat.setDate(today.getDate() + ((6 - today.getDay() + 7) % 7 || 7))
                            updates.dueDate = formatDateKey(sat)
                            break
                        }
                        case 'this week': {
                            const sun = new Date(today)
                            sun.setDate(today.getDate() + ((7 - today.getDay()) % 7 || 7))
                            updates.dueDate = formatDateKey(sun)
                            break
                        }
                        case 'later':
                            updates.dueDate = ''
                            break
                    }
                    break
                case 'priority':
                    updates.priority = keyword.value as 'high' | 'medium' | 'low'
                    break
                case 'status':
                    updates.status = keyword.value as Task['status']
                    break
                case 'duration':
                    updates.estimatedDuration = DURATION_DEFAULTS[keyword.value as DurationCategory] ?? 0
                    break
            }
            return updates
        }

        // 3. Legacy fallback - check section type
        if (section.type === 'priority' && section.propertyValue) {
            updates.priority = section.propertyValue as 'high' | 'medium' | 'low'
        } else if (section.type === 'status' && section.propertyValue) {
            updates.status = section.propertyValue as Task['status']
        } else if (section.type === 'project' && section.propertyValue) {
            updates.projectId = section.propertyValue
        } else if (section.type === 'custom' || section.type === 'timeline') {
            if (shouldUseSmartGroupLogic(section.name)) {
                // For smart group logic, we'd ideally call moveTaskToSmartGroup
                // but since this is a pure "get properties" function, we'll let
                // the keyword detection above handle it, or return the propertyValue as dueDate.
                if (section.propertyValue) updates.dueDate = section.propertyValue
            } else if (section.propertyValue) {
                updates.dueDate = section.propertyValue
            }
        }

        return updates
    }

    // Helper: Apply properties from ALL containing sections (nested group inheritance)
    const applyAllNestedSectionProperties = (taskId: string, taskX: number, taskY: number) => {
        const containingSections = getAllContainingSections(taskX, taskY)
        if (containingSections.length === 0) return

        const mergedUpdates: Partial<Task> = {}

        for (const section of containingSections) {
            const sectionProps = getSectionProperties(section)
            if (Object.keys(sectionProps).length > 0) {
                Object.assign(mergedUpdates, sectionProps)
            }
        }

        if (Object.keys(mergedUpdates).length > 0) {
            taskStore.updateTaskWithUndo(taskId, mergedUpdates)
        }
    }

    // Helper: Apply section properties to task (single section - legacy/manual)
    const applySectionPropertiesToTask = (taskId: string, section: CanvasSection) => {
        const updates = getSectionProperties(section)

        if (Object.keys(updates).length > 0) {
            taskStore.updateTaskWithUndo(taskId, updates)
        }
    }


    return {
        getSectionProperties,
        applyAllNestedSectionProperties,
        applySectionPropertiesToTask
    }
}
