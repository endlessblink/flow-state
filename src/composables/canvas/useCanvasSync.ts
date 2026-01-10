import { ref, type Ref, nextTick } from 'vue'
import { type Node, type Edge } from '@vue-flow/core'
import { useCanvasStore } from '@/stores/canvas'
import { NodeUpdateBatcher } from '@/utils/canvas/NodeUpdateBatcher'

// Imported Composables
import { useCanvasEdgeSync } from './useCanvasEdgeSync'
import { useCanvasNodeSync } from './useCanvasNodeSync'

interface SyncDependencies {
    nodes: Ref<Node[]>
    edges: Ref<Edge[]>
    filteredTasks: Ref<any[]> // Typed as any[] to match Task[] efficiently for now or explicit Task[]
    recentlyRemovedEdges: Ref<Set<string>>
    recentlyDeletedGroups: Ref<Set<string>>
    vueFlowRef: Ref<any>
    isHandlingNodeChange: Ref<boolean>
    isSyncing: Ref<boolean>
    isNodeDragging: Ref<boolean>
    isDragSettlingRef: Ref<boolean>
    resizeState: Ref<{ isResizing: boolean }>
    isResizeSettling: Ref<boolean>
    resourceManager: any
    // validateStores removed (handled logic internally or skipped)
    setOperationLoading: (op: string, loading: boolean) => void
    setOperationError: (type: string, message: string, retryable?: boolean) => void
    clearOperationError: () => void
}

export function useCanvasSync(deps: SyncDependencies) {
    const canvasStore = useCanvasStore()

    // --- Instantiate Sub-Composables ---

    const edgeSync = useCanvasEdgeSync({
        nodes: deps.nodes,
        edges: deps.edges,
        recentlyRemovedEdges: deps.recentlyRemovedEdges
    })

    const nodeSync = useCanvasNodeSync({
        nodes: deps.nodes,
        filteredTasks: deps.filteredTasks,
        recentlyDeletedGroups: deps.recentlyDeletedGroups,
        isNodeDragging: deps.isNodeDragging,
        isDragSettlingRef: deps.isDragSettlingRef,
        isSyncing: deps.isSyncing
    })

    // Optimized sync functions using the batching system
    const _nodeUpdateBatcher: NodeUpdateBatcher | null = new NodeUpdateBatcher(deps.vueFlowRef)
    deps.resourceManager.setNodeBatcher(_nodeUpdateBatcher)

    const batchedSyncNodes = (priority: 'high' | 'normal' | 'low' = 'normal') => {
        if (_nodeUpdateBatcher) {
            _nodeUpdateBatcher.schedule(() => {
                if (!deps.isHandlingNodeChange.value &&
                    !deps.isSyncing.value &&
                    !deps.isNodeDragging.value &&
                    !deps.isDragSettlingRef.value &&
                    !deps.resizeState.value.isResizing &&
                    !deps.isResizeSettling.value) {
                    nodeSync.syncNodes()
                }
            }, priority)
        } else {
            nodeSync.syncNodes()
        }
    }

    const batchedSyncEdges = (priority: 'high' | 'normal' | 'low' = 'normal') => {
        if (_nodeUpdateBatcher) {
            _nodeUpdateBatcher.schedule(() => {
                if (!deps.isHandlingNodeChange.value && !deps.isSyncing.value) {
                    edgeSync.syncEdges()
                }
            }, priority)
        } else {
            edgeSync.syncEdges()
        }
    }

    // System restart mechanism
    const performSystemRestart = async () => {
        console.log('🔄 [SYSTEM] Performing critical system restart...')
        deps.setOperationLoading('loading', true)
        deps.setOperationError('System Restart', 'Restarting application...', false)

        try {
            deps.clearOperationError()
            deps.nodes.value = []
            deps.edges.value = []
            deps.recentlyRemovedEdges.value.clear()

            // Simple check if canvasStore exists (it must if we are here)
            if (canvasStore) {
                canvasStore.setSelectedNodes([])
                canvasStore.selectedNodeIds = []
            }

            deps.isHandlingNodeChange.value = false
            deps.isSyncing.value = false

            await nextTick()
            nodeSync.syncNodes()
            edgeSync.syncEdges()

            deps.setOperationLoading('loading', false)
            console.log('✅ [SYSTEM] System restart completed successfully')

            if ((window as any).__notificationApi) {
                (window as any).__notificationApi({
                    type: 'success',
                    title: 'System Restarted',
                    content: 'Application has been successfully restarted.'
                })
            }
            return true
        } catch (error) {
            deps.setOperationError('System Restart', `Critical failure: ${error}`, true)
            deps.setOperationLoading('loading', false)
            return false
        }
    }

    // Legacy surgical removals
    const removeTaskNode = (taskId: string): boolean => {
        const nodeIndex = deps.nodes.value.findIndex(n => n.id === taskId)
        if (nodeIndex === -1) return false

        deps.nodes.value.splice(nodeIndex, 1)

        const edgesBefore = deps.edges.value.length
        deps.edges.value = deps.edges.value.filter(
            e => e.source !== taskId && e.target !== taskId
        )
        // const edgesRemoved = edgesBefore - deps.edges.value.length
        return true
    }

    const removeTaskNodes = (taskIds: string[]): number => {
        const taskIdSet = new Set(taskIds)
        const nodesBefore = deps.nodes.value.length

        deps.nodes.value = deps.nodes.value.filter(n => !taskIdSet.has(n.id))
        deps.edges.value = deps.edges.value.filter(
            e => !taskIdSet.has(e.source) && !taskIdSet.has(e.target)
        )

        return nodesBefore - deps.nodes.value.length
    }

    return {
        syncNodes: nodeSync.syncNodes,
        syncEdges: edgeSync.syncEdges,
        cleanupStaleNodes: nodeSync.cleanupStaleNodes, // Internal but exported
        batchedSyncNodes,
        batchedSyncEdges,
        performSystemRestart,
        removeTaskNode,
        removeTaskNodes
    }
}
