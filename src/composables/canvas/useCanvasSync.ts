import { type Ref, nextTick } from 'vue'
import { type Node, type Edge } from '@vue-flow/core'
import { type Task } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { NodeUpdateBatcher } from '@/utils/canvas/NodeUpdateBatcher'

// Import extracted composables
import { useCanvasNodeSync } from './sync/useCanvasNodeSync'
import { useCanvasEdgeSync } from './sync/useCanvasEdgeSync'

interface SyncDependencies {
    nodes: Ref<Node[]>
    edges: Ref<Edge[]>
    filteredTasks: Ref<Task[]>
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
    validateStores: () => { taskStore: boolean; canvasStore: boolean; uiStore: boolean }
    setOperationLoading: (op: string, loading: boolean) => void
    setOperationError: (type: string, message: string, retryable?: boolean) => void
    clearOperationError: () => void
}

export function useCanvasSync(deps: SyncDependencies) {
    const canvasStore = useCanvasStore()

    // --- Initialize Logic Composables ---

    // Node Sync (Tasks & Groups)
    const { syncNodes, removeTaskNode, removeTaskNodes, cleanupStaleNodes } = useCanvasNodeSync({
        nodes: deps.nodes,
        filteredTasks: deps.filteredTasks,
        recentlyDeletedGroups: deps.recentlyDeletedGroups,
        isHandlingNodeChange: deps.isHandlingNodeChange,
        isSyncing: deps.isSyncing,
        isNodeDragging: deps.isNodeDragging,
        isDragSettlingRef: deps.isDragSettlingRef,
        resizeState: deps.resizeState,
        isResizeSettling: deps.isResizeSettling
    })

    // Edge Sync (Dependencies)
    const { syncEdges } = useCanvasEdgeSync({
        nodes: deps.nodes,
        edges: deps.edges,
        recentlyRemovedEdges: deps.recentlyRemovedEdges
    })

    // --- Batching System ---

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
                    syncNodes()
                }
            }, priority)
        } else {
            syncNodes()
        }
    }

    const batchedSyncEdges = (priority: 'high' | 'normal' | 'low' = 'normal') => {
        if (_nodeUpdateBatcher) {
            _nodeUpdateBatcher.schedule(() => {
                if (!deps.isHandlingNodeChange.value && !deps.isSyncing.value) {
                    syncEdges()
                }
            }, priority)
        } else {
            syncEdges()
        }
    }

    // --- System Restart Logic ---

    const performSystemRestart = async () => {
        console.log('🔄 [SYSTEM] Performing critical system restart...')
        deps.setOperationLoading('loading', true)
        deps.setOperationError('System Restart', 'Restarting application...', false)

        try {
            deps.clearOperationError()
            deps.nodes.value = []
            deps.edges.value = []
            deps.recentlyRemovedEdges.value.clear()

            const health = deps.validateStores()
            if (health.canvasStore) {
                canvasStore.setSelectedNodes([])
                canvasStore.selectedNodeIds = []
            }

            deps.isHandlingNodeChange.value = false
            deps.isSyncing.value = false

            await nextTick()
            syncNodes()
            syncEdges()

            deps.setOperationLoading('loading', false)
            console.log('✅ [SYSTEM] System restart completed successfully')

            if ((window as any).__notificationApi) {
                (window as any).__notificationApi({
                    type: 'success',
                    title: 'System Restarted',
                    content: 'Application has been successfully restarted and all systems are operational.'
                })
            }

            return true
        } catch (error) {
            deps.setOperationError('System Restart', `Critical restart failed: ${error instanceof Error ? error.message : String(error)}`, true)
            deps.setOperationLoading('loading', false)
            console.error('❌ [SYSTEM] Critical restart failed:', error)

            if ((window as any).__notificationApi) {
                (window as any).__notificationApi({
                    type: 'error',
                    title: 'System Restart Failed',
                    content: 'Unable to restart the application. Please refresh the page manually.'
                })
            }

            return false
        }
    }

    return {
        syncNodes,
        syncEdges,
        batchedSyncNodes,
        batchedSyncEdges,
        performSystemRestart,
        cleanupStaleNodes,
        removeTaskNode,
        removeTaskNodes
    }
}
