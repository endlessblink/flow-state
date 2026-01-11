import { type Ref } from 'vue'
import { type Edge, type Node } from '@vue-flow/core'
import { useTaskStore, type Task } from '@/stores/tasks'

interface EdgeSyncDeps {
    nodes: Ref<Node[]>
    edges: Ref<Edge[]>
    recentlyRemovedEdges: Ref<Set<string>>
}

export function useCanvasEdgeSync(deps: EdgeSyncDeps) {
    const taskStore = useTaskStore()

    // Internal helper for graceful store access
    // Duplicated from sync utils to avoid circular deps or complex shared file for now
    // Ideally this should be in a shared util
    const safeStoreOperation = <T>(
        operation: () => T,
        fallback: T,
        operationName: string
    ): T => {
        try {
            return operation()
        } catch (error) {
            console.error(`❌ ${operationName} failed:`, error)
            return fallback
        }
    }

    // Sync edges from store
    const syncEdges = () => {
        try {
            const allEdges: Edge[] = []

            // Get tasks with graceful degradation
            const tasks = safeStoreOperation(
                () => taskStore.tasks || [],
                [] as Task[],
                'tasks access for syncEdges'
            )

            const taskIds = new Set(tasks.map(t => t.id))

            tasks.forEach((task: Task) => {
                if (task.dependsOn && task.dependsOn.length > 0) {
                    task.dependsOn.forEach((dependencyId: string) => {
                        // Verify dependency exists and is valid
                        if (taskIds.has(dependencyId)) {
                            const edgeId = `e-${dependencyId}-${task.id}`

                            // Check if this edge was recently removed by user action
                            if (deps.recentlyRemovedEdges.value.has(edgeId)) {
                                return
                            }

                            allEdges.push({
                                id: edgeId,
                                source: dependencyId,
                                target: task.id,
                                type: 'smoothstep', // Default edge type
                                animated: false,
                                style: { stroke: '#6366f1', strokeWidth: 2 },
                                data: {
                                    sourceTask: tasks.find((t: Task) => t.id === dependencyId),
                                    targetTask: task
                                },
                                // Enable interactivity
                                updatable: true,
                                selectable: true,
                                focusable: true
                            })
                        }
                    })
                }
            })

            // Validate edges - check that source and target nodes actually exist
            // This prevents "floating edges" connecting to nodes that haven't rendered yet
            const currentNodeIds = new Set(deps.nodes.value.map(n => n.id))
            const validEdges = allEdges.filter(edge => {
                if (!edge || !edge.id || !edge.source || !edge.target) {
                    console.warn('⚠️ Invalid edge detected during sync:', edge)
                    return false
                }
                // Verify both source and target nodes exist
                if (!currentNodeIds.has(edge.source) || !currentNodeIds.has(edge.target)) {
                    // Silently filter out - don't spam console
                    return false
                }
                return true
            })

            deps.edges.value = validEdges
        } catch (error) {
            console.error('❌ Critical error in syncEdges():', error)
        }
    }

    return {
        syncEdges
    }
}
