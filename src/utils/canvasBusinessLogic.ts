import { type Task, useTaskStore } from '@/stores/tasks'
import { type CanvasSection } from '@/stores/canvas'
import { formatDateKey } from '@/utils/dateUtils'
import { resolveDueDate } from '@/composables/useGroupSettings'
import { detectPowerKeyword } from '@/composables/useTaskSmartGroups'
import { DURATION_DEFAULTS, type DurationCategory } from '@/utils/durationCategories'
import { shouldUseSmartGroupLogic, getSmartGroupType } from '@/composables/useTaskSmartGroups'

/**
 * Applies properties from a canvas section to a task (e.g. status, priority, due date).
 * This is used when a task is dropped into or moved within a group.
 */
export async function applySectionPropertiesToTask(taskId: string, section: CanvasSection) {
    const taskStore = useTaskStore()
    const updates: Partial<Task> = {}
    console.log(`🎯 [CANVAS-LOGIC] applySectionPropertiesToTask: task ${taskId} → section "${section.name}"`)

    // 0. DAY-OF-WEEK GROUPS (Monday-Sunday)
    const dayOfWeekMap: Record<string, number> = {
        'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
        'thursday': 4, 'friday': 5, 'saturday': 6
    }
    const lowerName = section.name.toLowerCase().trim()

    if (dayOfWeekMap[lowerName] !== undefined) {
        const today = new Date()
        const targetDay = dayOfWeekMap[lowerName]
        const daysUntilTarget = ((7 + targetDay - today.getDay()) % 7) || 7
        const resultDate = new Date(today)
        resultDate.setDate(today.getDate() + daysUntilTarget)

        updates.dueDate = formatDateKey(resultDate)

        if (Object.keys(updates).length > 0) {
            console.log(`📅 [DayGroup] Assigning ${lowerName} date: ${updates.dueDate}`)
            await taskStore.updateTaskWithUndo(taskId, updates)
            return
        }
    }

    // 1. UNIFIED APPROACH: Check for explicit assignOnDrop settings
    if (section.assignOnDrop) {
        const settings = section.assignOnDrop
        if (settings.priority) updates.priority = settings.priority
        if (settings.status) updates.status = settings.status
        if (settings.projectId) updates.projectId = settings.projectId
        if (settings.dueDate) {
            const resolvedDate = resolveDueDate(settings.dueDate)
            if (resolvedDate !== null) updates.dueDate = resolvedDate
        }

        if (Object.keys(updates).length > 0) {
            await taskStore.updateTaskWithUndo(taskId, updates)
            return
        }
    }

    // 2. AUTO-DETECT: Keyword detection on section name
    const keyword = detectPowerKeyword(section.name)
    if (keyword) {
        switch (keyword.category) {
            case 'date':
                await taskStore.moveTaskToSmartGroup(taskId, keyword.value)
                return
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

        if (Object.keys(updates).length > 0) {
            await taskStore.updateTaskWithUndo(taskId, updates)
            return
        }
    }

    // 3. LEGACY FALLBACK
    switch (section.type) {
        case 'priority':
            if (section.propertyValue) updates.priority = section.propertyValue as 'high' | 'medium' | 'low'
            break
        case 'status':
            if (section.propertyValue) updates.status = section.propertyValue as Task['status']
            break
        case 'project':
            if (section.propertyValue) updates.projectId = section.propertyValue
            break
        case 'custom':
        case 'timeline':
            if (shouldUseSmartGroupLogic(section.name)) {
                const smartGroupType = getSmartGroupType(section.name)
                if (smartGroupType) {
                    await taskStore.moveTaskToSmartGroup(taskId, smartGroupType)
                } else {
                    await taskStore.moveTaskToDate(taskId, section.propertyValue || section.name)
                }
            } else {
                await taskStore.moveTaskToDate(taskId, section.propertyValue || section.name)
            }
            return
    }

    if (Object.keys(updates).length > 0) {
        await taskStore.updateTaskWithUndo(taskId, updates)
    }
}
