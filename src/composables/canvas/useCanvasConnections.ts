
import { type Ref } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import type { EdgeMouseEvent, Edge } from '@vue-flow/core'
import { CanvasIds } from '@/utils/canvas/canvasIds'
import { getViewportCoordinates } from '@/utils/contextMenuCoordinates'
import { getAllDescendantGroupIds } from '@/utils/canvas/storeHelpers'
import { getUndoSystem } from '@/composables/undoSingleton'

interface ConnectionDeps {
    syncEdges: (options?: { force?: boolean }) => void
    closeCanvasContextMenu: () => void
    closeEdgeContextMenu: () => void
    closeNodeContextMenu: () => void
    withVueFlowErrorBoundary: (name: string, fn: (...args: unknown[]) => any, options?: unknown) => ((...args: unknown[]) => any)
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
    const canvasStore = useCanvasStore()
    const undoSystem = getUndoSystem()

    const linkTaskToGroup = async (parentTaskId: string, groupNodeId: string) => {
        const { id: groupId } = CanvasIds.parseNodeId(groupNodeId)
        const group = canvasStore.groups.find(g => g.id === groupId)
        const parentTask = taskStore.tasks.find(t => t.id === parentTaskId)
        if (!group || !parentTask?.canvasPosition) return

        const linkedGroupIds = new Set(getAllDescendantGroupIds(groupId, canvasStore.groups))

        const childTasks = taskStore.tasks.filter(task =>
            task.id !== parentTaskId &&
            !!task.parentId &&
            linkedGroupIds.has(task.parentId) &&
            task.canvasPosition &&
            !task._soft_deleted &&
            !task.isCompletionRecord &&
            !task.isPinned
        )

        await undoSystem.canvasConnectionWithUndo(
            `Connect task to group: ${parentTask.title} -> ${group.name}`,
            [groupId, ...childTasks.map(task => task.id)],
            async () => {
                await canvasStore.updateGroup(groupId, { linkedParentTaskId: parentTaskId })
                await Promise.all(
                    childTasks.map(task => taskStore.updateTask(task.id, { parentTaskId }))
                )
            }
        )

        deps.syncEdges({ force: true })
    }

    const unlinkTaskFromGroup = async (groupNodeId: string, parentTaskId?: string) => {
        const { id: groupId } = CanvasIds.parseNodeId(groupNodeId)
        const group = canvasStore.groups.find(g => g.id === groupId)
        if (!group?.linkedParentTaskId) return

        const linkedParentTaskId = parentTaskId || group.linkedParentTaskId
        const linkedGroupIds = new Set(getAllDescendantGroupIds(groupId, canvasStore.groups))

        const childTasks = taskStore.tasks.filter(task =>
            !!task.parentId &&
            linkedGroupIds.has(task.parentId) &&
            task.parentTaskId === linkedParentTaskId
        )

        await undoSystem.canvasConnectionWithUndo(
            `Disconnect task from group: ${group.name}`,
            [groupId, ...childTasks.map(task => task.id)],
            async () => {
                await canvasStore.updateGroup(groupId, { linkedParentTaskId: null })
                await Promise.all(
                    childTasks.map(task => taskStore.updateTask(task.id, { parentTaskId: null }))
                )
            }
        )

        deps.syncEdges({ force: true })
    }

    const handleConnectStart = (event: { nodeId?: string; handleId?: string | null; handleType?: string }) => {
        console.log('[BUG-1407:CONNECT] Connection started from node:', event.nodeId, 'handle:', event.handleId)
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

        // Use setTimeout to ensure onConnect has time to fire first
        setTimeout(async () => {
            const wasSuccessful = state.connectionWasSuccessful?.value

            if (
                sourceTaskId &&
                !wasSuccessful &&
                event &&
                'clientX' in event
            ) {
                const elementAtDrop = document.elementFromPoint(
                    (event as MouseEvent).clientX,
                    (event as MouseEvent).clientY
                ) as HTMLElement | null
                const groupNode = elementAtDrop?.closest('[data-id^="section-"]') as HTMLElement | null
                const groupNodeId = groupNode?.dataset.id

                if (groupNodeId) {
                    await linkTaskToGroup(sourceTaskId, groupNodeId)
                    state.isConnecting.value = false
                    if (state.pendingConnectionSource) {
                        state.pendingConnectionSource.value = null
                    }
                    if (state.connectionWasSuccessful) {
                        state.connectionWasSuccessful.value = false
                    }
                    document.body.classList.remove('connecting-active')
                    return
                }
            }

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

    const handleConnect = deps.withVueFlowErrorBoundary('handleConnect', async (connection: any) => {
        const { source, target } = connection as { source: string; target: string; sourceHandle?: string; targetHandle?: string }
        // Mark connection as successful FIRST - this prevents drag-to-create from firing
        if (state.connectionWasSuccessful) {
            state.connectionWasSuccessful.value = true
        }


        console.log('[BUG-1407:CONNECT] handleConnect fired:', { source, target })

        deps.closeCanvasContextMenu()
        deps.closeEdgeContextMenu()
        deps.closeNodeContextMenu()

        // Allow immediate re-creation of recently deleted edges
        // If the user manually connects A->B, we must unblock it from the "zombie edge" protection list
        const potentialEdgeId = CanvasIds.edgeId(source, target)
        if (state.recentlyRemovedEdges.value.has(potentialEdgeId)) {
            state.recentlyRemovedEdges.value.delete(potentialEdgeId)
        }

        if (CanvasIds.isTaskNode(source) && CanvasIds.isGroupNode(target)) {
            await linkTaskToGroup(source, target)
            return
        }

        if (CanvasIds.isGroupNode(source) || CanvasIds.isGroupNode(target)) {
            console.warn('[BUG-1407:CONNECT] Rejected: unsupported group connection')
            return
        }
        if (source === target) {
            console.warn('[BUG-1407:CONNECT] Rejected: self-connection')
            return
        }

        const sourceTask = taskStore.tasks.find(t => t.id === source)
        const targetTask = taskStore.tasks.find(t => t.id === target)
        console.log('[BUG-1407:CONNECT] Found tasks:', { sourceTask: !!sourceTask, targetTask: !!targetTask, sourcePos: !!sourceTask?.canvasPosition, targetPos: !!targetTask?.canvasPosition })

        if (sourceTask && targetTask && sourceTask.canvasPosition && targetTask.canvasPosition) {
            // SUBTASK MODEL: Connection makes target a direct child of source (nested hierarchy)
            // Allow re-parenting: if target already has a parent, update to new parent
            if (targetTask.parentTaskId) {
                console.log('[BUG-1407:CONNECT] Re-parenting: target changing parent from', targetTask.parentTaskId, 'to', source)
            }
            await taskStore.updateTaskWithUndo(target, { parentTaskId: source })
            console.log('[BUG-1407:CONNECT] Success: set parentTaskId', { target, parentTaskId: source })
            deps.syncEdges({ force: true })
        } else {
            console.warn('[BUG-1407:CONNECT] Rejected: missing task or canvasPosition')
        }
    })

    const disconnectEdge = async () => {
        if (!state.selectedEdge.value) return

        const { source, target, id: edgeId } = state.selectedEdge.value
        const targetTask = taskStore.tasks.find(t => t.id === target)

        state.recentlyRemovedEdges.value.add(edgeId)

        setTimeout(() => {
            state.recentlyRemovedEdges.value.delete(edgeId)
        }, 2000)

        if (CanvasIds.isTaskNode(source) && CanvasIds.isGroupNode(target)) {
            await unlinkTaskFromGroup(target, source)
        } else if (targetTask && targetTask.parentTaskId) {
            // SUBTASK MODEL: Clear parentTaskId to remove subtask relationship
            await taskStore.updateTaskWithUndo(targetTask.id, { parentTaskId: null })
            deps.syncEdges({ force: true })
        }

        deps.closeEdgeContextMenu()
    }

    const handleEdgeContextMenu = (event: EdgeMouseEvent) => {
        const mouseEvent = event.event as MouseEvent
        event.event.preventDefault()
        event.event.stopPropagation()

        // BUG-1096: Use normalized coordinates for Tauri compatibility
        const { x, y } = getViewportCoordinates(mouseEvent)
        state.edgeContextMenuX.value = x
        state.edgeContextMenuY.value = y
        state.selectedEdge.value = event.edge
        state.showEdgeContextMenu.value = true

        deps.closeCanvasContextMenu()
        deps.closeNodeContextMenu()
    }

    const handleEdgeClick = (event: EdgeMouseEvent) => {
        const mouseEvent = event.event as MouseEvent
        event.event.preventDefault()
        event.event.stopPropagation()

        const { x, y } = getViewportCoordinates(mouseEvent)
        state.edgeContextMenuX.value = x
        state.edgeContextMenuY.value = y
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

        if (CanvasIds.isTaskNode(source) && CanvasIds.isGroupNode(target)) {
            await unlinkTaskFromGroup(target, source)
        } else if (targetTask && targetTask.parentTaskId) {
            // SUBTASK MODEL: Clear parentTaskId to remove subtask relationship
            await taskStore.updateTaskWithUndo(targetTask.id, { parentTaskId: null })
            deps.syncEdges({ force: true })
        }
    }

    return {
        handleConnectStart,
        handleConnectEnd,
        handleConnect,
        disconnectEdge,
        handleEdgeClick,
        handleEdgeContextMenu,
        handleEdgeDoubleClick,
        closeEdgeContextMenu
    }
}
