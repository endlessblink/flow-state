
import { type Ref } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import type { EdgeMouseEvent, Edge } from '@vue-flow/core'
import { CanvasIds } from '@/utils/canvas/canvasIds'

interface ConnectionDeps {
    syncEdges: () => void
    closeCanvasContextMenu: () => void
    closeEdgeContextMenu: () => void
    closeNodeContextMenu: () => void
    withVueFlowErrorBoundary: (name: string, fn: (...args: any[]) => any, options?: any) => ((...args: any[]) => any)
    // For drag-to-create feature
    screenToFlowCoordinate?: (pos: { x: number; y: number }) => { x: number; y: number }
    createConnectedTask?: (position: { x: number; y: number }, parentTaskId: string) => void
}

interface ConnectionState {
    isConnecting: Ref<boolean>
    recentlyRemovedEdges: Ref<Set<string>>
    showEdgeContextMenu: Ref<boolean>
    edgeContextMenuX: Ref<number>
    edgeContextMenuY: Ref<number>
    selectedEdge: Ref<Edge | null>
    // For drag-to-create feature
    pendingConnectionSource?: Ref<string | null>
    connectionWasSuccessful?: Ref<boolean>
}

export function useCanvasConnections(
    deps: ConnectionDeps,
    state: ConnectionState
) {
    const taskStore = useTaskStore()

    const handleConnectStart = (event: { nodeId?: string; handleId?: string | null; handleType?: string }) => {
        state.isConnecting.value = true
        document.body.classList.add('connecting-active')

        // Track source node for drag-to-create feature
        if (state.pendingConnectionSource) {
            state.pendingConnectionSource.value = event.nodeId || null
        }
        if (state.connectionWasSuccessful) {
            state.connectionWasSuccessful.value = false
        }

        deps.closeCanvasContextMenu()
        deps.closeEdgeContextMenu()
        deps.closeNodeContextMenu()
    }

    const handleConnectEnd = (event?: MouseEvent | TouchEvent | { nodeId?: string; handleId?: string; handleType?: string }) => {
        const sourceTaskId = state.pendingConnectionSource?.value
        const wasSuccessful = state.connectionWasSuccessful?.value

        // Use setTimeout to ensure onConnect has time to fire first
        setTimeout(() => {
            // Drag-to-create: Only trigger if:
            // 1. We have a source task ID
            // 2. Connection was NOT successful (dropped on empty space)
            // 3. We have mouse coordinates
            // 4. The deps are provided
            if (
                sourceTaskId &&
                !wasSuccessful &&
                event &&
                'clientX' in event &&
                deps.screenToFlowCoordinate &&
                deps.createConnectedTask
            ) {
                const flowCoords = deps.screenToFlowCoordinate({
                    x: (event as MouseEvent).clientX,
                    y: (event as MouseEvent).clientY
                })
                deps.createConnectedTask(flowCoords, sourceTaskId)
            }

            // Cleanup
            state.isConnecting.value = false
            if (state.pendingConnectionSource) {
                state.pendingConnectionSource.value = null
            }
            if (state.connectionWasSuccessful) {
                state.connectionWasSuccessful.value = false
            }
            document.body.classList.remove('connecting-active')
        }, 50) // Small delay to let onConnect fire first
    }

    const handleConnect = deps.withVueFlowErrorBoundary('handleConnect', async (connection: { source: string; target: string; sourceHandle?: string; targetHandle?: string }) => {
        // Mark connection as successful FIRST - this prevents drag-to-create from firing
        if (state.connectionWasSuccessful) {
            state.connectionWasSuccessful.value = true
        }

        const { source, target } = connection

        deps.closeCanvasContextMenu()
        deps.closeEdgeContextMenu()
        deps.closeNodeContextMenu()

        // Allow immediate re-creation of recently deleted edges
        // If the user manually connects A->B, we must unblock it from the "zombie edge" protection list
        const potentialEdgeId = CanvasIds.edgeId(source, target)
        if (state.recentlyRemovedEdges.value.has(potentialEdgeId)) {
            state.recentlyRemovedEdges.value.delete(potentialEdgeId)
        }

        if (CanvasIds.isGroupNode(source) || CanvasIds.isGroupNode(target)) return
        if (source === target) return

        const sourceTask = taskStore.tasks.find(t => t.id === source)
        const targetTask = taskStore.tasks.find(t => t.id === target)

        if (sourceTask && targetTask && sourceTask.canvasPosition && targetTask.canvasPosition) {
            // SUBTASK MODEL: Connection makes target a direct child of source (nested hierarchy)
            // Only set if target doesn't already have a parent
            if (!targetTask.parentTaskId) {
                await taskStore.updateTaskWithUndo(target, { parentTaskId: source })
                deps.syncEdges()
            }
        }
    })

    const disconnectEdge = async () => {
        if (!state.selectedEdge.value) return

        const { target, id: edgeId } = state.selectedEdge.value
        const targetTask = taskStore.tasks.find(t => t.id === target)

        state.recentlyRemovedEdges.value.add(edgeId)

        setTimeout(() => {
            state.recentlyRemovedEdges.value.delete(edgeId)
        }, 2000)

        // SUBTASK MODEL: Clear parentTaskId to remove subtask relationship
        if (targetTask && targetTask.parentTaskId) {
            await taskStore.updateTaskWithUndo(targetTask.id, { parentTaskId: null })
            deps.syncEdges()
        }

        deps.closeEdgeContextMenu()
    }

    const handleEdgeContextMenu = (event: EdgeMouseEvent) => {
        const mouseEvent = event.event as MouseEvent
        event.event.preventDefault()
        event.event.stopPropagation()

        state.edgeContextMenuX.value = mouseEvent.clientX
        state.edgeContextMenuY.value = mouseEvent.clientY
        state.selectedEdge.value = event.edge
        state.showEdgeContextMenu.value = true

        deps.closeCanvasContextMenu()
        deps.closeNodeContextMenu()
    }

    const closeEdgeContextMenu = () => {
        state.showEdgeContextMenu.value = false
        state.selectedEdge.value = null
    }

    /**
     * Handle double-click on edge to disconnect it immediately
     */
    const handleEdgeDoubleClick = async (event: EdgeMouseEvent) => {
        event.event.preventDefault()
        event.event.stopPropagation()

        const edge = event.edge
        if (!edge) return

        const { target, id: edgeId } = edge
        const targetTask = taskStore.tasks.find(t => t.id === target)

        // Add to recently removed to prevent zombie edge reappearing
        state.recentlyRemovedEdges.value.add(edgeId)
        setTimeout(() => {
            state.recentlyRemovedEdges.value.delete(edgeId)
        }, 2000)

        // SUBTASK MODEL: Clear parentTaskId to remove subtask relationship
        if (targetTask && targetTask.parentTaskId) {
            await taskStore.updateTaskWithUndo(targetTask.id, { parentTaskId: null })
            deps.syncEdges()
        }
    }

    return {
        handleConnectStart,
        handleConnectEnd,
        handleConnect,
        disconnectEdge,
        handleEdgeContextMenu,
        handleEdgeDoubleClick,
        closeEdgeContextMenu
    }
}
