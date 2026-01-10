import type { useTaskStore } from '@/stores/tasks'
import { type Task } from '@/stores/tasks'
import { type CanvasSection } from '@/stores/canvas'
import { shouldUseSmartGroupLogic, getSmartGroupType, detectPowerKeyword } from '../useTaskSmartGroups'
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

        // 0. TASK-130: Check for day-of-week groups first (Monday-Sunday)
        const dayOfWeekMap: Record<string, number> = {
            'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
            'thursday': 4, 'friday': 5, 'saturday': 6
        }
        const lowerName = section.name.toLowerCase().trim()
        if (dayOfWeekMap[lowerName] !== undefined) {
            const today = new Date()
            const targetDay = dayOfWeekMap[lowerName]
            // Same formula: next occurrence, same-day → next week
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

        // 2. Auto-detect from section name
        const keyword = detectPowerKeyword(section.name)
        if (keyword) {
            switch (keyword.category) {
                case 'date':
                    // For date keywords, compute the actual date
                    const today = new Date()
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
                    // TASK-144: Use centralized duration defaults
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
        }

        return updates
    }

    // Helper: Apply properties from ALL containing sections (nested group inheritance)
    const applyAllNestedSectionProperties = (taskId: string, taskX: number, taskY: number) => {
        const containingSections = getAllContainingSections(taskX, taskY)
        if (containingSections.length === 0) return

        // Collect properties from all sections (largest/parent first, then children override)
        const mergedUpdates: Partial<Task> = {}
        const appliedSections: string[] = []

        for (const section of containingSections) {
            const sectionProps = getSectionProperties(section)
            if (Object.keys(sectionProps).length > 0) {
                Object.assign(mergedUpdates, sectionProps)
                appliedSections.push(section.name)
            }
        }

        if (Object.keys(mergedUpdates).length > 0) {
            // console.log(`🎯 [NESTED-GROUPS] Applying properties from ${appliedSections.length} sections:`, {
            //     sections: appliedSections,
            //     mergedUpdates
            // })
            taskStore.updateTaskWithUndo(taskId, mergedUpdates)
        }
    }

    // Helper: Apply section properties to task (single section - legacy)
    const applySectionPropertiesToTask = (taskId: string, section: CanvasSection) => {
        const updates: Partial<Task> = {}
        // console.log(`🎯 [TASK-114] applySectionPropertiesToTask called for task ${taskId} → section "${section.name}"`)

        // 0. DAY-OF-WEEK GROUPS (Monday-Sunday)
        // TASK-130: Support all days of the week, not just Friday/Saturday
        const dayOfWeekMap: Record<string, number> = {
            'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
            'thursday': 4, 'friday': 5, 'saturday': 6
        }
        const lowerName = section.name.toLowerCase().trim()

        if (dayOfWeekMap[lowerName] !== undefined) {
            const today = new Date()
            const targetDay = dayOfWeekMap[lowerName]

            // TASK-130 FIX: Calculate next occurrence of this day
            // If today IS the target day, we want NEXT week's occurrence (7 days ahead)
            // Formula: ((7 + target - current) % 7) || 7
            // The || 7 ensures same-day returns 7 (next week) instead of 0 (today)
            const daysUntilTarget = ((7 + targetDay - today.getDay()) % 7) || 7
            const resultDate = new Date(today)
            resultDate.setDate(today.getDate() + daysUntilTarget)

            updates.dueDate = formatDateKey(resultDate)

            if (Object.keys(updates).length > 0) {
                // console.log(`📅 [DayGroup] Assigning ${lowerName} date: ${updates.dueDate} (${daysUntilTarget} days from now)`)
                taskStore.updateTaskWithUndo(taskId, updates)
                return
            }
        }

        // 1. UNIFIED APPROACH: Check for explicit assignOnDrop settings first
        if (section.assignOnDrop) {
            // console.log(`🎯 [TASK-114] Path 1: Using assignOnDrop settings:`, section.assignOnDrop)
            const settings = section.assignOnDrop

            if (settings.priority) {
                updates.priority = settings.priority
            }
            if (settings.status) {
                updates.status = settings.status
            }
            if (settings.projectId) {
                updates.projectId = settings.projectId
            }
            if (settings.dueDate) {
                // Resolve smart date values like 'today', 'tomorrow' to actual dates
                const resolvedDate = resolveDueDate(settings.dueDate)
                if (resolvedDate !== null) {
                    updates.dueDate = resolvedDate
                }
            }

            if (Object.keys(updates).length > 0) {
                taskStore.updateTaskWithUndo(taskId, updates)
                return
            }
        }

        // 2. AUTO-DETECT: If no assignOnDrop settings, try keyword detection on section name
        const keyword = detectPowerKeyword(section.name)
        // console.log(`🎯 [TASK-114] Path 2: detectPowerKeyword("${section.name}") =`, keyword)
        if (keyword) {
            // console.log(`🎯 [TASK-114] Detected keyword:`, keyword)

            switch (keyword.category) {
                case 'date':
                    // console.log(`🎯 [TASK-114] Calling moveTaskToSmartGroup(${taskId}, "${keyword.value}")`)
                    taskStore.moveTaskToSmartGroup(taskId, keyword.value)
                    return

                case 'priority':
                    updates.priority = keyword.value as 'high' | 'medium' | 'low'
                    break

                case 'status':
                    updates.status = keyword.value as Task['status']
                    break

                case 'duration':
                    // TASK-144: Use centralized duration defaults
                    updates.estimatedDuration = DURATION_DEFAULTS[keyword.value as DurationCategory] ?? 0
                    break
            }

            if (Object.keys(updates).length > 0) {
                taskStore.updateTaskWithUndo(taskId, updates)
                return
            }
        }

        // 3. LEGACY FALLBACK: Use old type-based behavior for backward compatibility
        switch (section.type) {
            case 'priority':
                if (!section.propertyValue) return
                updates.priority = section.propertyValue as 'high' | 'medium' | 'low'
                break
            case 'status':
                if (!section.propertyValue) return
                updates.status = section.propertyValue as Task['status']
                break
            case 'project':
                if (!section.propertyValue) return
                updates.projectId = section.propertyValue
                break
            case 'custom':
            case 'timeline':
                if (shouldUseSmartGroupLogic(section.name)) {
                    const smartGroupType = getSmartGroupType(section.name)
                    if (smartGroupType) {
                        taskStore.moveTaskToSmartGroup(taskId, smartGroupType)
                    } else {
                        taskStore.moveTaskToDate(taskId, section.propertyValue || section.name)
                    }
                } else {
                    taskStore.moveTaskToDate(taskId, section.propertyValue || section.name)
                }
                return
        }

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
