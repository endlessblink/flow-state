/**
 * Canvas Tasks Composable - Task loading and conversion
 * 
 * TASK-184: Canvas Rebuild Layer 1
 */
import { useTaskStore } from '@/stores/tasks'
import { useCanvasNewStore } from '@/stores/canvasNew'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import type { Task } from '@/types/tasks'
import type { CanvasNode } from './useCanvasCore'
import type { CanvasGroup } from '@/stores/canvas/types'

export function useCanvasTasks() {
    const taskStore = useTaskStore()
    const canvasStore = useCanvasNewStore()
    const { saveTasks } = useSupabaseDatabase()

    /**
     * Convert tasks to nodes with computed containment
     */
    function tasksToNodes(
        taskToNodeFn: (task: Task, parentGroupId?: string) => CanvasNode,
        findGroupFn: (pos: { x: number, y: number }) => CanvasGroup | null
    ): CanvasNode[] {
        // Filter tasks on canvas
        const canvasTasks = taskStore.tasks.filter(t => !t.isInInbox && t.canvasPosition)

        return canvasTasks.map(task => {
            // Compute parent group based on center point
            // (Simplified containment for Layer 1.7)
            const parentGroup = findGroupFn(task.canvasPosition!)
            return taskToNodeFn(task, parentGroup?.id)
        })
    }

    async function persistTaskPosition(taskId: string, position: { x: number, y: number }) {
        if (canvasStore.isTaskPositionLocked(taskId)) return

        const task = taskStore.tasks.find(t => t.id === taskId)
        if (!task) return

        // Update task with new ABSOLUTE position
        const updatedTask = {
            ...task,
            canvasPosition: { x: position.x, y: position.y },
            isInInbox: false
        }

        // Sync to Supabase
        try {
            await saveTasks([updatedTask])
            // Internal update (if taskStore doesn't handle it automatically)
            // taskStore.updateTask(updatedTask) 
        } catch (err) {
            console.error('[canvasTasks] Save error:', err)
        }
    }

    return {
        tasksToNodes,
        persistTaskPosition
    }
}
