import { computed, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { Task, useTaskStore } from '../../stores/tasks'
import type { useCanvasStore } from '../../stores/canvas'

type TaskStore = ReturnType<typeof useTaskStore>
type CanvasStore = ReturnType<typeof useCanvasStore>

/**
 * Extracted filtering logic for CanvasView to reduce component size.
 * Handles:
 * 1. Project-based filtering (matching sidebar behavior)
 * 2. Canvas-specific filters (Hide Done, Hide Overdue)
 * 3. Performance optimization (memoization during interactions)
 */
export function useCanvasFiltering(
    taskStore: TaskStore,
    canvasStore: CanvasStore,
    isInteracting: Ref<boolean>
) {
    // CPU Optimization: Memoized filtered tasks with shallow comparison
    let lastFilteredTasks: Task[] = []
    let lastFilteredTasksHash = ''

    const { hideCanvasDoneTasks, hideCanvasOverdueTasks, filteredTasks: storeFilteredTasks } = storeToRefs(taskStore)

    const filteredTasksWithProjectFiltering = computed(() => {
        try {
            // FIX (Dec 5, 2025): Canvas now uses filteredTasks to respect sidebar smart view filters
            // Previous behavior: Used raw taskStore.tasks which ignored sidebar filters entirely
            // New behavior: Canvas respects Today, Week, etc. filters like Board and Calendar views
            if (!storeFilteredTasks.value || !Array.isArray(storeFilteredTasks.value)) {
                console.warn('⚠️ taskStore.filteredTasks not available or not an array')
                return []
            }

            const currentTasks = storeFilteredTasks.value as Task[]

            // Performance optimization: Only update if actually changed
            // Skip expensive hash calculation during drag/resize to maintain 60FPS
            if (isInteracting.value && lastFilteredTasks.length > 0) {
                return lastFilteredTasks
            }

            // FIX (Jan 8, 2026): Include canvasPosition in hash to prevent stale data during drags
            // Also include full timestamp precision
            const currentHash = currentTasks.map((t: Task) => {
                const validDate = (d: any) => (d instanceof Date) ? d.getTime() : (typeof d === 'string' ? new Date(d).getTime() : '')
                const time = validDate(t.updatedAt)
                // Use fixed precision for position to avoid floating point noise, but ensure changes are caught
                const posX = t.canvasPosition?.x?.toFixed(1) || ''
                const posY = t.canvasPosition?.y?.toFixed(1) || ''
                // TASK-123: Include visual properties, but EXCLUDE description/content to prevent editor re-renders while typing
                return `${t.id}:${t.title}:${t.isInInbox}:${t.status}:${t.priority}:${t.estimatedDuration || ''}:${t.projectId || ''}:${t.dueDate || ''}:${time}:${posX}:${posY}`
            }).join('|')

            if (currentHash === lastFilteredTasksHash && lastFilteredTasks.length > 0) {
                return lastFilteredTasks
            }

            lastFilteredTasksHash = currentHash
            // FIX (Dec 5, 2025): Create array COPY, not reference
            // Reference assignment caused stale data when multiple watchers fired simultaneously
            lastFilteredTasks = [...currentTasks]
            return currentTasks
        } catch (e) {
            console.error('❌ filteredTasks access failed:', e)
            return []
        }
    })

    const filteredTasks = computed(() => {
        let tasks = filteredTasksWithProjectFiltering.value

        // TASK-076: Filter out done tasks if hideCanvasDoneTasks is enabled
        // Use .value from storeToRefs for proper cross-browser reactivity
        if (hideCanvasDoneTasks.value) {
            tasks = tasks.filter((t: Task) => t.status !== 'done')
        }

        // TASK-082: Filter out overdue tasks (due date before today)
        if (hideCanvasOverdueTasks.value) {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            tasks = tasks.filter((t: Task) => {
                if (!t.dueDate) return true // Keep tasks without due date
                const due = new Date(t.dueDate)
                return due >= today // Keep tasks due today or later
            })
        }

        return tasks
    })

    return {
        filteredTasks
    }
}
