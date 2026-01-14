
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
}

interface ConnectionState {
    isConnecting: Ref<boolean>
    recentlyRemovedEdges: Ref<Set<string>>
    showEdgeContextMenu: Ref<boolean>
    edgeContextMenuX: Ref<number>
    edgeContextMenuY: Ref<number>
    selectedEdge: Ref<Edge | null>
}

export function useCanvasConnections(
    deps: ConnectionDeps,
    state: ConnectionState
) {
    const taskStore = useTaskStore()

    const handleConnectStart = (_event: { nodeId?: string; handleId?: string | null; handleType?: string }) => {
        state.isConnecting.value = true
        document.body.classList.add('connecting-active')

        deps.closeCanvasContextMenu()
        deps.closeEdgeContextMenu()
        deps.closeNodeContextMenu()
    }

    const handleConnectEnd = (_event?: MouseEvent | { nodeId?: string; handleId?: string; handleType?: string }) => {
        setTimeout(() => {
            state.isConnecting.value = false
            document.body.classList.remove('connecting-active')
        }, 100)
    }

    const handleConnect = deps.withVueFlowErrorBoundary('handleConnect', async (connection: { source: string; target: string; sourceHandle?: string; targetHandle?: string }) => {
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
            const dependsOn = targetTask.dependsOn || []
            if (!dependsOn.includes(source)) {
                // Await the async update before syncing edges
                await taskStore.updateTaskWithUndo(target, { dependsOn: [...dependsOn, source] })
                deps.syncEdges()
            }
        }
    })

    const disconnectEdge = () => {
        if (!state.selectedEdge.value) return

        const { source, target, id: edgeId } = state.selectedEdge.value
        const targetTask = taskStore.tasks.find(t => t.id === target)

        state.recentlyRemovedEdges.value.add(edgeId)

        setTimeout(() => {
            state.recentlyRemovedEdges.value.delete(edgeId)
        }, 2000)

        // Update task dependencies
        if (targetTask && targetTask.dependsOn) {
            const updatedDependsOn = targetTask.dependsOn.filter(id => id !== source)
            taskStore.updateTaskWithUndo(targetTask.id, { dependsOn: updatedDependsOn })
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

        const { source, target, id: edgeId } = edge
        const targetTask = taskStore.tasks.find(t => t.id === target)

        // Add to recently removed to prevent zombie edge reappearing
        state.recentlyRemovedEdges.value.add(edgeId)
        setTimeout(() => {
            state.recentlyRemovedEdges.value.delete(edgeId)
        }, 2000)

        // Update task dependencies
        if (targetTask && targetTask.dependsOn) {
            const updatedDependsOn = targetTask.dependsOn.filter(id => id !== source)
            await taskStore.updateTaskWithUndo(targetTask.id, { dependsOn: updatedDependsOn })
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
