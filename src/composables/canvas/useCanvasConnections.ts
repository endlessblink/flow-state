
import { type Ref } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import type { EdgeMouseEvent } from '@vue-flow/core'

interface ConnectionDeps {
    syncEdges: () => void
    closeCanvasContextMenu: () => void
    closeEdgeContextMenu: () => void
    closeNodeContextMenu: () => void
    addTimer: (id: number) => number
    withVueFlowErrorBoundary: (name: string, fn: (...args: any[]) => any, options?: any) => ((...args: any[]) => any)
}

interface ConnectionState {
    isConnecting: Ref<boolean>
    recentlyRemovedEdges: Ref<Set<string>>
    showEdgeContextMenu: Ref<boolean>
    edgeContextMenuX: Ref<number>
    edgeContextMenuY: Ref<number>
    selectedEdge: Ref<any>
}

export function useCanvasConnections(
    deps: ConnectionDeps,
    state: ConnectionState
) {
    const taskStore = useTaskStore()

    const handleConnectStart = (event: { nodeId?: string; handleId?: string | null; handleType?: string }) => {
        console.log('🔗 Connection started:', event)
        state.isConnecting.value = true

        deps.closeCanvasContextMenu()
        deps.closeEdgeContextMenu()
        deps.closeNodeContextMenu()
    }

    const handleConnectEnd = (event?: MouseEvent | { nodeId?: string; handleId?: string; handleType?: string }) => {
        console.log('🔗 Connection ended:', event)
        const timerId = setTimeout(() => {
            state.isConnecting.value = false
        }, 100)
        deps.addTimer(timerId as unknown as number)
    }

    // Wrapped connection handler
    const handleConnect = deps.withVueFlowErrorBoundary('handleConnect', (connection: { source: string; target: string; sourceHandle?: string; targetHandle?: string }) => {
        console.log('🔗 Connection attempt:', connection)
        const { source, target } = connection

        deps.closeCanvasContextMenu()
        deps.closeEdgeContextMenu()
        deps.closeNodeContextMenu()

        if (source.startsWith('section-') || target.startsWith('section-')) return
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

        console.log('🔗 Disconnecting edge:', { edgeId, source, target })

        state.recentlyRemovedEdges.value.add(edgeId)

        const timerId = setTimeout(() => {
            state.recentlyRemovedEdges.value.delete(edgeId)
        }, 2000)
        deps.addTimer(timerId as unknown as number)

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

        console.log('🖱️ Edge context menu triggered:', event.edge.id)

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
