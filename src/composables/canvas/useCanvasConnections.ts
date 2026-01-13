
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

        deps.closeCanvasContextMenu()
        deps.closeEdgeContextMenu()
        deps.closeNodeContextMenu()
    }

    const handleConnectEnd = (_event?: MouseEvent | { nodeId?: string; handleId?: string; handleType?: string }) => {
        setTimeout(() => {
            state.isConnecting.value = false
        }, 100)
    }

    const handleConnect = deps.withVueFlowErrorBoundary('handleConnect', (connection: { source: string; target: string; sourceHandle?: string; targetHandle?: string }) => {
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
                taskStore.updateTaskWithUndo(target, { dependsOn: [...dependsOn, source] })
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

    return {
        handleConnectStart,
        handleConnectEnd,
        handleConnect,
        disconnectEdge,
        handleEdgeContextMenu,
        closeEdgeContextMenu
    }
}
