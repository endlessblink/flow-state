/**
 * useCanvasEdgeSync
 *
 * Builds Vue Flow edges from task.dependsOn arrays.
 * This is the READ PATH for edges: DB/Store → Vue Flow
 *
 * When a task has dependsOn: ['task-a', 'task-b'], we create edges:
 *   - task-a → this-task
 *   - task-b → this-task
 *
 * Edges represent dependencies: the source task must be completed before the target.
 */

import { type Ref, ref } from 'vue'
import { useTaskStore } from '@/stores/tasks'
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
     * Build edges from task.dependsOn arrays and sync to Vue Flow.
     *
     * For each task with dependsOn, creates an edge from each dependency
     * to the task. Only creates edges for tasks that are on the canvas
     * (have canvasPosition).
     */
    const syncEdges = () => {
        if (isSyncing.value) return
        isSyncing.value = true

        try {
            const newEdges: Edge[] = []
            const tasks = taskStore.tasks

            // Build a map of task IDs to tasks for fast lookup
            const taskMap = new Map(tasks.map(t => [t.id, t]))

            for (const task of tasks) {
                // Skip tasks without canvas position (not on canvas)
                if (!task.canvasPosition) continue

                // Skip tasks without dependencies
                if (!task.dependsOn || task.dependsOn.length === 0) continue

                for (const sourceId of task.dependsOn) {
                    // Check if source task exists and is on canvas
                    const sourceTask = taskMap.get(sourceId)
                    if (!sourceTask?.canvasPosition) continue

                    // Skip group nodes - edges are only between tasks
                    if (CanvasIds.isGroupNode(sourceId) || CanvasIds.isGroupNode(task.id)) continue

                    // Generate edge ID
                    const edgeId = CanvasIds.edgeId(sourceId, task.id)

                    // Skip if this edge was recently removed by user
                    // This prevents "zombie edges" from reappearing immediately
                    if (deps.recentlyRemovedEdges.value.has(edgeId)) continue

                    newEdges.push({
                        id: edgeId,
                        source: sourceId,
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
