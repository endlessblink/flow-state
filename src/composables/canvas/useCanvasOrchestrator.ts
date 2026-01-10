import { ref, computed, watch, nextTick, onMounted, type Ref } from 'vue'
import { useVueFlow, type Node, type Edge } from '@vue-flow/core'
import { storeToRefs } from 'pinia'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasUiStore } from '@/stores/canvas/canvasUi'
import { useUIStore } from '@/stores/ui'
import { useMagicKeys, useWindowSize } from '@vueuse/core'

import resourceManager from '../../utils/canvas/resourceManager'
import { getUndoSystem } from '@/composables/undoSingleton'

// Sub-composables
import { useCanvasSync } from './useCanvasSync'
import { useCanvasEvents } from './useCanvasEvents'
import { useCanvasHotkeys } from './useCanvasHotkeys'
import { useCanvasDragDrop } from './useCanvasDragDrop'
import { useCanvasActions } from './useCanvasActions'
import { useCanvasModals } from './useCanvasModals'
import { useCanvasFilteredState } from './useCanvasFilteredState'
import { useCanvasLifecycle } from './useCanvasLifecycle'
import { useCanvasResize } from './useCanvasResize'
import { useCanvasNavigation } from './useCanvasNavigation'
import { useCanvasZoom } from './useCanvasZoom'
import { useCanvasSelection } from './useCanvasSelection'
import { useCanvasAlignment } from './useCanvasAlignment'
import { useCanvasSmartGroups } from './useCanvasSmartGroups'
import { useCanvasConnections } from './useCanvasConnections'

// Helper for error boundaries
const mockErrorBoundary = (_name: string, fn: Function) => {
    if (typeof fn !== 'function') return (...args: any[]) => {
        console.warn(`[CanvasError] Attempted to call non-function "${_name}"`, { args })
        return null
    }
    return (...args: any[]) => {
        try {
            return fn(...args)
        } catch (e) {
            console.error(`[CanvasError] Error in ${_name}:`, e)
            return null
        }
    }
}

export function useCanvasOrchestrator() {
    const canvasStore = useCanvasStore()
    const taskStore = useTaskStore()
    const canvasUiStore = useCanvasUiStore()
    const uiStore = useUIStore()

    // --- 1. Core State & Vue Flow ---
    const nodes = ref<Node[]>([])
    const edges = ref<Edge[]>([])
    const vueFlowRef = ref(null)

    const {
        onPaneReady,
        viewport,
        setViewport,
        getNodes,
        setNodes,
        updateNode,
        findNode,
        screenToFlowCoordinate,
        project,
        getIntersectingNodes,
        isNodeIntersecting,
        panOnDrag,
        zoomOnScroll,
        zoomOnPinch,
        nodesDraggable,
        elementsSelectable,
        onMoveEnd,
        addEdges,
        removeEdges,
        onConnect,
        onEdgesChange,
        onNodesChange,
        toObject
    } = useVueFlow()

    const { hasInitialFit, operationLoading, operationError } = storeToRefs(canvasUiStore)
    const { setOperationLoading, setOperationError, clearOperationError } = canvasUiStore
    const { width, height } = useWindowSize()
    const { shift } = useMagicKeys()

    // --- 2. Computed Data ---
    const filteredTasks = computed(() => taskStore.filteredTasks)

    const {
        tasksWithCanvasPosition,
        dynamicNodeExtent,
        hasNoTasks,
        hasInboxTasks
    } = useCanvasFilteredState(filteredTasks, canvasStore)

    // --- 3. Feature Initialization ---

    // Navigation
    const { initialViewport, fitCanvas, zoomToSelection } = useCanvasNavigation(canvasStore)
    const { cleanupZoom } = useCanvasZoom(resourceManager)

    // Modals
    const modals = useCanvasModals()

    // Resize
    const {
        resizeState,
        isResizeSettling,
        handleSectionResizeStart,
        handleSectionResize,
        handleSectionResizeEnd
    } = useCanvasResize({
        nodes,
        findNode,
        updateNode
    })

    // Drag Drop State
    const isNodeDragging = ref(false)
    const isDragSettling = ref(false)

    // Sync Logic
    const isSyncing = ref(false)
    const isHandlingNodeChange = ref(false)
    const recentlyRemovedEdges = ref(new Set<string>())
    const recentlyDeletedGroups = ref(new Set<string>())

    // Note: useCanvasSync imports resourceManager singleton internally usually or expects it
    const sync = useCanvasSync({
        nodes,
        edges,
        filteredTasks,
        recentlyRemovedEdges,
        recentlyDeletedGroups,
        vueFlowRef,
        isHandlingNodeChange,
        isSyncing,
        isNodeDragging,
        isDragSettlingRef: isDragSettling,
        resizeState,
        isResizeSettling,
        resourceManager,
        setOperationLoading,
        setOperationError,
        clearOperationError
    })

    // Events (Selection, Connection)
    const isVueFlowReady = ref(false)
    const isVueFlowMounted = ref(false)

    const events = useCanvasEvents(sync.syncNodes)

    // Actions
    const actions = useCanvasActions({
        viewport,
        batchedSyncNodes: sync.batchedSyncNodes,
        syncNodes: sync.syncNodes,
        closeCanvasContextMenu: events.closeCanvasContextMenu,
        closeEdgeContextMenu: events.closeEdgeContextMenu,
        closeNodeContextMenu: events.closeNodeContextMenu,
        recentlyDeletedGroups
    }, {}, getUndoSystem())

    // Drag Drop (Actual Logic)
    const dragDrop = useCanvasDragDrop({
        taskStore,
        canvasStore,
        nodes,
        filteredTasks,
        syncNodes: sync.syncNodes,
        withVueFlowErrorBoundary: mockErrorBoundary
    }, { isNodeDragging })

    // Hotkeys
    const { handleKeyDown } = useCanvasHotkeys({
        isBulkDeleteModalOpen: modals.isBulkDeleteModalOpen,
        bulkDeleteItems: modals.bulkDeleteItems,
        bulkDeleteIsPermanent: modals.bulkDeleteIsPermanent,
        createGroup: actions.createGroup
    })

    // Lifecycle
    const lifecycle = useCanvasLifecycle(
        taskStore,
        canvasStore,
        uiStore,
        fitCanvas,
        cleanupZoom
    )

    // Selection
    const selection = useCanvasSelection()

    const isCanvasReady = computed(() => {
        return !operationLoading.value.loading && !operationLoading.value.syncing
    })

    // Alignment
    const alignment = useCanvasAlignment(nodes, {
        isVueFlowMounted,
        isVueFlowReady,
        isCanvasReady
    }, {
        closeCanvasContextMenu: events.closeCanvasContextMenu
    })

    // Smart Groups
    const smartGroups = useCanvasSmartGroups()

    // Connections
    const connections = useCanvasConnections({
        syncEdges: sync.syncEdges,
        closeCanvasContextMenu: events.closeCanvasContextMenu,
        closeEdgeContextMenu: events.closeEdgeContextMenu,
        closeNodeContextMenu: events.closeNodeContextMenu,
        addTimer: (id: number) => resourceManager.addTimer(id),
        withVueFlowErrorBoundary: mockErrorBoundary
    }, {
        isConnecting: ref(false),
        recentlyRemovedEdges,
        showEdgeContextMenu: ref(false),
        edgeContextMenuX: ref(0),
        edgeContextMenuY: ref(0),
        selectedEdge: ref(null)
    })

    // --- 4. Initialization & Reactivity ---

    // Initial sync on mount or as soon as stores are likely available
    onMounted(async () => {
        await nextTick()
        sync.syncNodes()
        sync.syncEdges()
    })

    // Watchers to keep canvas in sync with store changes
    watch(() => taskStore.tasks, () => {
        sync.batchedSyncNodes('low')
    }, { deep: true })

    watch(() => canvasStore.groups, () => {
        sync.batchedSyncNodes('normal')
    }, { deep: true })

    watch(() => taskStore.activeStatusFilter, () => {
        sync.syncNodes()
    })

    // Retry Logic
    const retryFailedOperation = async () => {
        if (!operationError.value?.retryable) return

        const { type } = operationError.value
        clearOperationError()

        switch (type) {
            case 'System Restart':
                await sync.performSystemRestart()
                break
            case 'Sync Operation':
                setOperationLoading('syncing', true)
                try {
                    await nextTick()
                    sync.syncNodes()
                    sync.syncEdges()
                    setOperationLoading('syncing', false)
                } catch (_error) {
                    setOperationError('Sync Operation', 'Retry failed: Unable to synchronize data', true)
                    setOperationLoading('syncing', false)
                }
                break
            default:
                console.warn(`[SYSTEM] No retry implementation for operation type: ${type}`)
        }
    }

    // --- Expose Public Interface ---
    return {
        // State
        nodes,
        edges,
        isCanvasReady,
        operationLoading,
        operationError,

        // UI
        viewport,
        hasInitialFit,
        shift,
        vueFlowRef,

        // Computed
        filteredTasks,
        tasksWithCanvasPosition,
        dynamicNodeExtent,
        hasNoTasks,
        hasInboxTasks,

        // Actions & Handlers
        ...actions,
        ...modals,
        ...events,

        // New feature re-exports
        ...selection,
        ...alignment,
        ...smartGroups,
        ...connections,

        handleNodeDragStart: dragDrop.handleNodeDragStart,
        handleNodeDragStop: dragDrop.handleNodeDragStop,
        handleKeyDown,

        handleSectionResizeStart,
        handleSectionResize,
        handleSectionResizeEnd,

        onPaneReady: (params: any) => {
            isVueFlowReady.value = true
            isVueFlowMounted.value = true
            setOperationLoading('loading', false)
            setOperationLoading('syncing', false)
            // REMOVED: onPaneReady(params) - This was registering params as a listener!
        },
        fitCanvas,
        zoomToSelection,
        retryFailedOperation,

        // Vue Flow Handlers (Wrappers to prevent register-as-handler traps)
        handleNodesChange: (changes: any) => {
            // Vue Flow handles nodes via v-model or internal state.
            // We use this mostly for debugging or local sync hooks if needed.
            if (isHandlingNodeChange.value) return
            // onNodesChange(changes) - DO NOT CALL! This is a register function.
        },
        handleEdgesChange: (changes: any) => {
            // onEdgesChange(changes) - DO NOT CALL! This is a register function.
        },
        handleConnect: (params: any) => {
            // onConnect(params) - DO NOT CALL! This is a register function.
            // Delegate to the actual connection logic from useCanvasConnections
            connections.handleConnect(params)
        },

        // For debugging/System
        syncNodes: sync.syncNodes,
        performSystemRestart: sync.performSystemRestart,

        // Validation
        storeHealth: lifecycle.storeHealth
    }
}
