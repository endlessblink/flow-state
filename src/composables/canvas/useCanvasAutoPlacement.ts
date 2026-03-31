/**
 * Canvas Auto-Placement
 *
 * Places inbox tasks into matching smart groups when the canvas initializes.
 *
 * GEOMETRY WRITER SAFETY (TASK-255):
 * - Only places tasks that have NO canvasPosition (initial placement)
 * - Never moves tasks that are already on the canvas
 * - Once placed, only drag handlers change positions (invariant preserved)
 * - Runs ONCE per canvas mount, not on every sync cycle
 */

import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { findMatchingGroupForDueDate, calculatePositionInGroup } from './useSmartGroupMatcher'

export function useCanvasAutoPlacement() {
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()

    /**
     * Auto-place eligible tasks into matching smart groups.
     * Called ONCE after canvas initialization.
     *
     * Eligibility:
     * - No canvasPosition (not on canvas)
     * - Not canvasDismissed (user didn't explicitly remove)
     * - Has dueDate matching a smart group
     * - status !== 'done'
     */
    const autoPlaceEligibleTasks = async (): Promise<number> => {
        const allGroups = canvasStore._rawGroups || []
        if (allGroups.length === 0) return 0

        const eligible = taskStore.tasks.filter(task =>
            !task.canvasPosition &&
            !task.canvasDismissed &&
            task.dueDate &&
            task.status !== 'done'
        )

        if (eligible.length === 0) return 0

        let placedCount = 0

        for (const task of eligible) {
            const targetGroup = findMatchingGroupForDueDate(task.dueDate, allGroups)
            if (!targetGroup) continue

            const canvasPosition = calculatePositionInGroup(targetGroup, taskStore.tasks)

            // GEOMETRY WRITER: One-time initial placement
            taskStore.updateTask(task.id, {
                canvasPosition,
                parentId: targetGroup.id,
                isInInbox: false,
            }, 'USER')

            placedCount++
        }

        return placedCount
    }

    return { autoPlaceEligibleTasks }
}
