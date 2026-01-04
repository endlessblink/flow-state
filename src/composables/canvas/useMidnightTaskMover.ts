import { type Ref } from 'vue'
import type { Task, Project } from '@/stores/tasks'
import type { CanvasSection } from '@/stores/canvas'

interface TaskStore {
    tasks: Task[]
    updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>
}

interface CanvasStore {
    groups: CanvasSection[]
}

/**
 * TASK-082: Logic to move tasks from "Today" to "Overdue" at midnight
 * Extracted from CanvasView for testability
 */
export function useMidnightTaskMover(
    canvasStore: CanvasStore,
    taskStore: TaskStore
) {

    const moveTodayTasksToOverdue = async () => {
        console.log('[TASK-082] Midnight transition detected - checking for Today → Overdue task moves')

        // Find "Today" and "Overdue" groups by name (case-insensitive, partial match)
        const todayGroup = canvasStore.groups.find(g =>
            g.name?.toLowerCase().includes('today')
        )
        const overdueGroup = canvasStore.groups.find(g =>
            g.name?.toLowerCase().includes('overdue')
        )

        if (!todayGroup) {
            console.log('[TASK-082] No "Today" group found on canvas - skipping transition')
            return { movedCount: 0, reason: 'no-today-group' }
        }

        if (!overdueGroup) {
            console.log('[TASK-082] No "Overdue" group found on canvas - tasks will stay in Today')
            return { movedCount: 0, reason: 'no-overdue-group' }
        }

        // Find tasks that are visually inside the "Today" group (canvasPosition within group bounds)
        const todayBounds = todayGroup.position
        const tasksInToday = taskStore.tasks.filter(task => {
            // Skip tasks that are in inbox or have no position
            if (!task.canvasPosition || task.isInInbox) return false

            const pos = task.canvasPosition
            return (
                pos.x >= todayBounds.x &&
                pos.x <= todayBounds.x + todayBounds.width &&
                pos.y >= todayBounds.y &&
                pos.y <= todayBounds.y + todayBounds.height
            )
        })

        if (tasksInToday.length === 0) {
            console.log('[TASK-082] No tasks in "Today" group to move')
            return { movedCount: 0, reason: 'no-tasks' }
        }

        console.log(`[TASK-082] Moving ${tasksInToday.length} tasks from "Today" to "Overdue"`)

        // Calculate positions in the Overdue group
        const overdueBounds = overdueGroup.position
        const taskWidth = 220
        const taskHeight = 100
        const padding = 20
        const headerHeight = 60

        // Simple grid layout calculation
        const cols = Math.max(1, Math.floor((overdueBounds.width - padding * 2) / (taskWidth + 10)))

        // Move each task to the Overdue group
        for (let i = 0; i < tasksInToday.length; i++) {
            const task = tasksInToday[i]
            const col = i % cols
            const row = Math.floor(i / cols)
            const newX = overdueBounds.x + padding + col * (taskWidth + 10)
            const newY = overdueBounds.y + headerHeight + padding + row * (taskHeight + 10)

            try {
                await taskStore.updateTask(task.id, {
                    canvasPosition: { x: newX, y: newY }
                })
            } catch (error) {
                console.error(`[TASK-082] Failed to move task ${task.id}:`, error)
            }
        }

        console.log(`[TASK-082] Successfully moved ${tasksInToday.length} tasks to "Overdue" group`)
        return { movedCount: tasksInToday.length, reason: 'success' }
    }

    return {
        moveTodayTasksToOverdue
    }
}
