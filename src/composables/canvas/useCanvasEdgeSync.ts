/**
 * useCanvasEdgeSync
 *
 * Builds Vue Flow edges from task.parentTaskId (subtask relationships).
 * This is the READ PATH for edges: DB/Store → Vue Flow
 *
 * When a task has parentTaskId: 'task-a', we create an edge:
 *   - task-a → this-task (parent to child)
 *
 * Edges represent subtask relationships: the source is the parent task.
 */

import { type Ref, ref } from 'vue'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useVueFlow, type Edge } from '@vue-flow/core'
import { CanvasIds } from '@/utils/canvas/canvasIds'

interface EdgeSyncDeps {
    recentlyRemovedEdges: Ref<Set<string>>
}

export function useCanvasEdgeSync(deps: EdgeSyncDeps) {
    const taskStore = useTaskStore()
    const { setEdges, edges: currentEdges } = useVueFlow()

    const isSyncing = ref(false)

    /**
     * Build edges from task.parentTaskId and sync to Vue Flow.
     *
     * For each task with parentTaskId, creates an edge from the parent
     * to the task. Only creates edges for tasks that are on the canvas
     * (have canvasPosition).
     */
    const syncEdges = (tasksToSync?: Task[]) => {
        if (isSyncing.value) return
        isSyncing.value = true

        try {
            const newEdges: Edge[] = []
            const tasks = tasksToSync || taskStore.tasks

            // Build a map of task IDs to tasks for fast lookup
            // CRITICAL: Only include tasks that are actually being synced/displayed
            // This prevents creating edges to nodes that are filtered out (e.g. done/overdue)
            const taskMap = new Map(tasks.map((t: Task) => [t.id, t]))

            for (const task of tasks) {
                // Skip tasks without canvas position (not on canvas)
                if (!task.canvasPosition) continue

                // Skip tasks without a parent (not a subtask)
                if (!task.parentTaskId) continue

                // Check if parent task exists and is on canvas
                const parentTask = taskMap.get(task.parentTaskId)
                if (!parentTask?.canvasPosition) continue

                // Skip group nodes - edges are only between tasks
                if (CanvasIds.isGroupNode(task.parentTaskId) || CanvasIds.isGroupNode(task.id)) continue

                // Generate edge ID (parent → child)
                const edgeId = CanvasIds.edgeId(task.parentTaskId, task.id)

                // Skip if this edge was recently removed by user
                // This prevents "zombie edges" from reappearing immediately
                if (deps.recentlyRemovedEdges.value.has(edgeId)) continue

                newEdges.push({
                    id: edgeId,
                    source: task.parentTaskId,
                    target: task.id,
                    type: 'default',
                    animated: false,
                    style: {
                        stroke: 'var(--border-secondary)',
                        strokeWidth: 2
                    },
                    markerEnd: 'arrowhead'
                })
            }

            // Idempotence check: only update if edges changed
            const currentEdgeIds = new Set(currentEdges.value.map(e => e.id))
            const newEdgeIds = new Set(newEdges.map(e => e.id))

            const hasChanges =
                currentEdges.value.length !== newEdges.length ||
                [...currentEdgeIds].some(id => !newEdgeIds.has(id)) ||
                [...newEdgeIds].some(id => !currentEdgeIds.has(id))

            if (hasChanges) {
                console.debug('[EdgeSync] Syncing edges', {
                    previous: currentEdges.value.length,
                    new: newEdges.length
                })
                setEdges(newEdges)
            }
        } finally {
            isSyncing.value = false
        }
    }

    return {
        syncEdges,
        isSyncing
    }
}
