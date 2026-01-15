import { type Task, useTaskStore } from '@/stores/tasks'
import { type CanvasSection } from '@/stores/canvas'
import { formatDateKey } from '@/utils/dateUtils'
import { resolveDueDate } from '@/composables/useGroupSettings'
import { DURATION_DEFAULTS, type DurationCategory } from '@/utils/durationCategories'
import {
    detectPowerKeyword,
    shouldUseSmartGroupLogic,
    getSmartGroupType,
    getSmartGroupDate
} from '@/composables/useTaskSmartGroups'

/**
 * Applies properties from a canvas section to a task (e.g. status, priority, due date).
 * This is used when a task is dropped into or moved within a group.
 */
// Update imports to include getSmartGroupDate
export async function applySectionPropertiesToTask(taskId: string, section: CanvasSection) {
    const taskStore = useTaskStore()
    const updates: Partial<Task> = {}
    console.log(`🎯 [CANVAS-LOGIC] applySectionPropertiesToTask: task ${taskId} → section "${section.name}"`)

    const lowerName = section.name.toLowerCase().trim()
    const dayOfWeekMap: Record<string, number> = {
        'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
        'thursday': 4, 'friday': 5, 'saturday': 6
    }

    // 1. IMPLICIT: Day-of-Week Logic (Monday-Sunday)
    if (dayOfWeekMap[lowerName] !== undefined) {
        const today = new Date()
        const targetDay = dayOfWeekMap[lowerName]
        const daysUntilTarget = ((7 + targetDay - today.getDay()) % 7) || 7
        const resultDate = new Date(today)
        resultDate.setDate(today.getDate() + daysUntilTarget)

        updates.dueDate = formatDateKey(resultDate)
    }

    // 2. IMPLICIT: Power Keyword Detection
    const keyword = detectPowerKeyword(section.name)
    if (keyword) {
        switch (keyword.category) {
            case 'date':
                // Resolve date for smart groups (Today, Tomorrow, etc.)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                updates.dueDate = getSmartGroupDate(keyword.value as any)
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
            // 'day_of_week' is handled by the explicit map above for now
        }
    }

    // 3. EXPLICIT: AsssignOnDrop Settings (Overrides Implicit)
    if (section.assignOnDrop) {
        const settings = section.assignOnDrop
        if (settings.priority) updates.priority = settings.priority
        if (settings.status) updates.status = settings.status
        if (settings.projectId) updates.projectId = settings.projectId
        if (settings.dueDate) {
            const resolvedDate = resolveDueDate(settings.dueDate)
            if (resolvedDate !== null) updates.dueDate = resolvedDate
        }
    }

    // 4. LEGACY FALLBACK (Only applied if property not already set)
    // This maintains backward compatibility for older section types
    switch (section.type) {
        case 'priority':
            if (!updates.priority && section.propertyValue) {
                updates.priority = section.propertyValue as 'high' | 'medium' | 'low'
            }
            break
        case 'status':
            if (!updates.status && section.propertyValue) {
                updates.status = section.propertyValue as Task['status']
            }
            break
        case 'project':
            if (!updates.projectId && section.propertyValue) {
                updates.projectId = section.propertyValue
            }
            break
        case 'custom':
        case 'timeline':
            // Only apply legacy date logic if date not yet set
            if (!updates.dueDate) {
                if (shouldUseSmartGroupLogic(section.name)) {
                    const smartGroupType = getSmartGroupType(section.name)
                    if (smartGroupType) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        updates.dueDate = getSmartGroupDate(smartGroupType)
                    } else {
                        // Fallback to legacy moveTaskToDate logic replication?
                        // moveTaskToDate mostly handles dateColumn strings.
                        // But if we are here, it means detectPowerKeyword failed?
                        // If detectPowerKeyword failed, smartGroup logic likely fails too.
                        // We'll leave the date update empty if we can't resolve it, 
                        // effectively doing nothing which is safer than guessing.
                    }
                } else if (section.propertyValue) {
                    // Legacy direct value check
                    // Assuming propertyValue is a date string
                    // We can try to use it if it looks like a date
                    // But strictly speaking, we shouldn't guess too much.
                    // The legacy code called taskStore.moveTaskToDate(taskId, section.propertyValue || section.name)
                    // which supported 'overdue', 'nextWeek', etc. 
                    // This is mostly covered by keywords now.
                }
            }
            break
    }

    // 5. Commit Updates
    if (Object.keys(updates).length > 0) {
        console.log(`✅ [CANVAS-LOGIC] Applying merged properties to task ${taskId.slice(0, 8)}:`, updates)
        await taskStore.updateTaskWithUndo(taskId, updates)
    }
}
