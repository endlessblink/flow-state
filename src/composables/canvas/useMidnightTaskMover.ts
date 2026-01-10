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
 * Logic to move tasks from "Today" to "Overdue" at midnight
 * Extracted from CanvasView for testability
 */
export function useMidnightTaskMover(
    canvasStore: CanvasStore,
    taskStore: TaskStore
) {

    const moveTodayTasksToOverdue = async () => {

        // Find "Today" and "Overdue" groups by name (case-insensitive, partial match)
        const todayGroup = canvasStore.groups.find(g =>
            g.name?.toLowerCase().includes('today')
        )
        const overdueGroup = canvasStore.groups.find(g =>
            g.name?.toLowerCase().includes('overdue')
        )

        if (!todayGroup) {
            return { movedCount: 0, reason: 'no-today-group' }
        }

        if (!overdueGroup) {
            return { movedCount: 0, reason: 'no-overdue-group' }
        }

        // Find tasks that are visually inside the "Today" group (canvasPosition within group bounds)
        const todayBounds = todayGroup.position
        if (!todayBounds) {
            return { movedCount: 0, reason: 'today-group-invalid' }
        }

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
            return { movedCount: 0, reason: 'no-tasks' }
        }

        const overdueBounds = overdueGroup.position
        if (!overdueBounds) {
            return { movedCount: 0, reason: 'overdue-group-invalid' }
        }

        const taskWidth = 220
        const taskHeight = 100
        const padding = 20
        const headerHeight = 60

        // Simple grid layout calculation
        // Fix: Use width/height from bounds or defaults if missing in partials
        const boundsWidth = overdueBounds.width || 400
        const cols = Math.max(1, Math.floor((boundsWidth - padding * 2) / (taskWidth + 10)))

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
            } catch {
                // Continue with other tasks on individual failure
            }
        }

        return { movedCount: tasksInToday.length, reason: 'success' }
    }

    return {
        moveTodayTasksToOverdue
    }
}
