import { type Ref } from 'vue'
import { type Node, type Edge, type EdgeMouseEvent, type Connection, useVueFlow } from '@vue-flow/core'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'

interface InteractionHandlersDeps {
    nodes: Ref<Node[]>
    edges: Ref<Edge[]>
    canvasStore: ReturnType<typeof useCanvasStore>
    taskStore: ReturnType<typeof useTaskStore>
    isConnecting: Ref<boolean>
    resizeState: Ref<{ isResizing: boolean; sectionId: string | null }>
    withVueFlowErrorBoundary: (handlerName: string, handler: (...args: any[]) => any) => any
    syncNodes: () => void
    syncEdges: () => void
    addTimer: (id: number) => number
    closeCanvasContextMenu: () => void
    closeNodeContextMenu: () => void
    removeEdges: (ids: string | string[]) => void
    recentlyRemovedEdges: Ref<Set<string>>
    edgeContextMenuState: {
        show: Ref<boolean>
        x: Ref<number>
        y: Ref<number>
        selectedId: Ref<string | null>
    }
    canvasContextMenuState: {
        show: Ref<boolean>
        x: Ref<number>
        y: Ref<number>
    }
    canvasContextSection?: Ref<any>
    sectionSettingsState?: {
        isOpen: Ref<boolean>
        editingId: Ref<string | null>
    }
}

export function useCanvasInteractionHandlers(deps: InteractionHandlersDeps) {
    const {
        nodes,
        canvasStore,
        taskStore,
        resizeState,
        withVueFlowErrorBoundary,
        syncEdges,
        removeEdges,
        recentlyRemovedEdges,
        edgeContextMenuState,
        canvasContextMenuState,
        closeCanvasContextMenu,
        closeNodeContextMenu
    } = deps

    const { onEdgeClick, onEdgeContextMenu, onConnect, onConnectStart, onConnectEnd, onNodeContextMenu } = useVueFlow()

    const handleNodesChange = withVueFlowErrorBoundary('handleNodesChange', (changes: any[]) => {
        changes.forEach((change) => {
            // Track selection changes
            if (change.type === 'select') {
                const currentSelected = nodes.value.filter(n => (n as any).selected).map(n => n.id)
                const selectedChanged = JSON.stringify(currentSelected) !== JSON.stringify(canvasStore.selectedNodeIds)
                if (selectedChanged) {
                    canvasStore.setSelectedNodes(currentSelected)
                }
            }

            // Handle section dimensions (resize)
            if (change.type === 'dimensions' && change.id && change.id.startsWith('section-')) {
                const sectionId = change.id.replace('section-', '')
                if (resizeState.value.isResizing && resizeState.value.sectionId === sectionId) {
                    return
                }

                const node = nodes.value.find(n => n.id === change.id)
                if (node && change.dimensions) {
                    const currentSection = canvasStore.sections.find((s: any) => s.id === sectionId)
                    if (currentSection) {
                        canvasStore.updateSection(sectionId, {
                            position: {
                                ...currentSection.position,
                                width: change.dimensions.width,
                                height: change.dimensions.height
                            }
                        })
                    }
                }
            }
        })
    })

    const handleEdgeClick = (param: EdgeMouseEvent) => {
        const { event, edge } = param
        const extendedEvent = event as unknown as EdgeMouseEvent & { edge?: Edge; selected?: { edge?: Edge } }
        const actualEdge = edge || extendedEvent.edge || extendedEvent.selected?.edge

        if (!actualEdge) return

        // Shift+click for immediate disconnection
        if (event.shiftKey) {
            event.preventDefault()
            event.stopPropagation()

            recentlyRemovedEdges.value.add(actualEdge.id)
            setTimeout(() => {
                recentlyRemovedEdges.value.delete(actualEdge.id)
            }, 2000)

            removeEdges(actualEdge.id)

            const targetTask = taskStore.tasks.find(t => t.id === actualEdge.target)
            if (targetTask && targetTask.dependsOn) {
                const updatedDependsOn = targetTask.dependsOn.filter(id => id !== actualEdge.source)
                taskStore.updateTaskWithUndo(targetTask.id, { dependsOn: updatedDependsOn })
                syncEdges()
            }
        }
    }

    const handleEdgeContextMenu = (param: EdgeMouseEvent) => {
        const { event, edge } = param
        const extendedEvent = event as unknown as EdgeMouseEvent & { edge?: Edge; selected?: { edge?: Edge } }
        const actualEdge = edge || extendedEvent.edge || extendedEvent.selected?.edge

        if (!actualEdge) return

        event.preventDefault()
        event.stopPropagation()

        edgeContextMenuState.x.value = (event as MouseEvent).clientX
        edgeContextMenuState.y.value = (event as MouseEvent).clientY
        edgeContextMenuState.selectedId.value = actualEdge.id
        edgeContextMenuState.show.value = true

        closeCanvasContextMenu()
        closeNodeContextMenu()
    }

    const handleNodeContextMenu = (event: { node: Node; event: MouseEvent | TouchEvent }) => {
        event.event.preventDefault()
        event.event.stopPropagation()

        if (!event.node.id.startsWith('section-')) return

        const mouseEvent = event.event as MouseEvent
        const sectionId = event.node.id.replace('section-', '')
        const section = canvasStore.sections.find(s => s.id === sectionId)

        if (section) {
            canvasContextMenuState.x.value = mouseEvent.clientX || 0
            canvasContextMenuState.y.value = mouseEvent.clientY || 0
            if (deps.canvasContextSection) {
                deps.canvasContextSection.value = section
            }
            canvasContextMenuState.show.value = true
        }

        edgeContextMenuState.show.value = false
    }

    const handleConnectStart = (event: { nodeId?: string; handleId?: string | null; handleType?: string }) => {
        deps.isConnecting.value = true
        closeCanvasContextMenu()
        edgeContextMenuState.show.value = false
        closeNodeContextMenu()
    }

    const handleConnectEnd = (param: MouseEvent | TouchEvent | undefined) => {
        const timerId = setTimeout(() => {
            deps.isConnecting.value = false
        }, 100)
        deps.addTimer(timerId as unknown as number)
    }

    const handleConnect = withVueFlowErrorBoundary('handleConnect', (connection: Connection) => {
        const { source, target } = connection

        closeCanvasContextMenu()
        edgeContextMenuState.show.value = false
        closeNodeContextMenu()

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
        if (!edgeContextMenuState.selectedId.value) return

        const edgeId = edgeContextMenuState.selectedId.value
        const edge = deps.edges.value.find(e => e.id === edgeId)
        if (!edge) return

        const { source, target } = edge
        const targetTask = taskStore.tasks.find(t => t.id === target)

        recentlyRemovedEdges.value.add(edgeId)

        const timerId = setTimeout(() => {
            recentlyRemovedEdges.value.delete(edgeId)
        }, 2000)
        deps.addTimer(timerId as unknown as number)

        if (targetTask && targetTask.dependsOn) {
            const updatedDependsOn = targetTask.dependsOn.filter(id => id !== source)
            taskStore.updateTaskWithUndo(targetTask.id, { dependsOn: updatedDependsOn })
            deps.syncEdges()
        }

        edgeContextMenuState.show.value = false
    }

    const handlePaneClick = () => {
        canvasStore.setSelectedNodes([])
        closeCanvasContextMenu()
        closeNodeContextMenu()
        edgeContextMenuState.show.value = false
    }

    const handlePaneContextMenu = (event: MouseEvent) => {
        if (deps.isConnecting.value) {
            event.preventDefault()
            event.stopPropagation()
            return
        }
        event.preventDefault()
        canvasContextMenuState.x.value = event.clientX
        canvasContextMenuState.y.value = event.clientY
        canvasContextMenuState.show.value = true
        closeNodeContextMenu()
        edgeContextMenuState.show.value = false
    }

    const handleCanvasRightClick = (event: MouseEvent) => {
        if (deps.isConnecting.value) {
            event.preventDefault()
            event.stopPropagation()
            return
        }

        const target = event.target as HTMLElement
        // Don't show menu if clicking on a task or section node
        if (target.closest('.task-node') || target.closest('[data-id^="section-"]')) {
            return
        }

        canvasContextMenuState.x.value = event.clientX
        canvasContextMenuState.y.value = event.clientY
        canvasContextMenuState.show.value = true
    }

    const handleSectionContextMenu = (event: MouseEvent, sectionData: { id: string; name: string; color: string }) => {
        event.preventDefault()
        event.stopPropagation()
        canvasContextMenuState.x.value = event.clientX
        canvasContextMenuState.y.value = event.clientY
        const fullSection = canvasStore.sections.find((s: any) => s.id === sectionData.id)
        if (deps.canvasContextSection) {
            deps.canvasContextSection.value = fullSection || null
        }
        canvasContextMenuState.show.value = true
    }

    const handleSectionUpdate = (sectionData: Partial<{ id: string }>) => {
        if (sectionData.id) {
            canvasStore.updateSection(sectionData.id, sectionData)
        }
    }

    const collectTasksForSection = (sectionId: string) => {
        const section = canvasStore.sections.find((s: any) => s.id === sectionId)
        if (section) {
            (canvasStore as any).collectTasksIntoGroup(sectionId)
        }
    }

    const handleOpenSectionSettings = (sectionId: string) => {
        if (deps.sectionSettingsState) {
            deps.sectionSettingsState.editingId.value = sectionId
            deps.sectionSettingsState.isOpen.value = true
        }
    }

    const handleOpenSectionSettingsFromContext = (section: any) => {
        handleOpenSectionSettings(section.id)
    }

    // Register Hooks
    onEdgeClick(handleEdgeClick)
    onEdgeContextMenu(handleEdgeContextMenu)
    onNodeContextMenu(handleNodeContextMenu)
    onConnect(handleConnect as any)
    onConnectStart(handleConnectStart)
    onConnectEnd(handleConnectEnd)

    return {
        handleNodesChange,
        handleEdgeClick,
        handleEdgeContextMenu,
        handleNodeContextMenu,
        handleConnect,
        handleConnectStart,
        handleConnectEnd,
        disconnectEdge,
        handlePaneClick,
        handlePaneContextMenu,
        handleCanvasRightClick,
        handleSectionContextMenu,
        handleSectionUpdate,
        collectTasksForSection,
        handleOpenSectionSettings,
        handleOpenSectionSettingsFromContext
    }
}
