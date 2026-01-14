import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasUiStore } from '@/stores/canvas/canvasUi'
import { useUIStore } from '@/stores/ui'
import { useMagicKeys, useWindowSize } from '@vueuse/core'

import resourceManager from '../../utils/canvas/resourceManager'
import { getUndoSystem } from '@/composables/undoSingleton'
import { reconcileTaskParentsByContainment } from '@/utils/canvas/spatialContainment'
import { logHierarchySummary } from '@/utils/canvas/invariants'

// --- NEW COMPOSABLES (Phase 3) ---
import { useCanvasCore } from './useCanvasCore'
import { useCanvasSync } from './useCanvasSync'
import { useCanvasInteractions } from './useCanvasInteractions'

// ...
// Persistence (Sync)
// Moved inside useCanvasOrchestrator to ensure correct Vue context

import { useCanvasGroups } from './useCanvasGroups'


// Legacy/Auxiliary Composables (Still used)
import { useCanvasEvents } from './useCanvasEvents'
import { useCanvasHotkeys } from './useCanvasHotkeys'
import { useCanvasActions } from './useCanvasActions'
import { useCanvasOverdueCollector } from './useCanvasOverdueCollector'
import { useCanvasModals } from './useCanvasModals'
import { useCanvasFilteredState } from './useCanvasFilteredState'
import { useCanvasLifecycle } from './useCanvasLifecycle'
import { useCanvasNavigation } from './useCanvasNavigation' // Keeping for specialized nav if needed
import { useCanvasZoom } from './useCanvasZoom' // Keeping for cleanup hooks
import { useCanvasAlignment } from './useCanvasAlignment'
import { useCanvasConnections } from './useCanvasConnections'
import { useCanvasEdgeSync } from './useCanvasEdgeSync'

// Helper for error boundaries
const mockErrorBoundary = (_name: string, fn: (...args: unknown[]) => unknown) => {
    if (typeof fn !== 'function') return (..._args: unknown[]) => {
        return null
    }
    return (...args: unknown[]) => {
        try {
            return fn(...args)
        } catch (e) {
            console.error(`[CanvasError] Error in ${_name}:`, e)
            return null
        }
    }
}

// =============================================================================
// DRIFT FIX: Module-level flag to ensure reconciliation runs only ONCE per browser session
// =============================================================================
// This prevents parent drift when:
// - Tab visibility changes (focus/unfocus)
// - Auth token refreshes (TOKEN_REFRESHED event)
// - CanvasView remounts for any reason
// Reconciliation should only happen on FIRST load, not repeatedly.
let hasReconciledThisSession = false

export function useCanvasOrchestrator() {
    const canvasStore = useCanvasStore()
    const taskStore = useTaskStore()
    const canvasUiStore = useCanvasUiStore()
    const uiStore = useUIStore()

    // --- 1. Core State & Vue Flow (Via useCanvasCore) ---
    const {
        nodes,
        edges,
        onPaneReady,
        viewport,
        updateNode,
        findNode,
        onMoveEnd,
        applyNodeChanges,
        applyEdgeChanges
    } = useCanvasCore()

    const { hasInitialFit, operationLoading, operationError } = storeToRefs(canvasUiStore)
    const { setOperationLoading, setOperationError, clearOperationError } = canvasUiStore
    const { width: _width, height: _height } = useWindowSize()
    const { shift, control, meta } = useMagicKeys()

    // --- 2. Computed Data ---
    const filteredTasks = computed(() => taskStore.filteredTasks)

    // Pass taskStore reference so filtering can access hideCanvasDoneTasks etc.
    const canvasStoreWithTaskStore = {
        ...canvasStore,
        taskStore: {
            get hideCanvasDoneTasks() { return taskStore.hideCanvasDoneTasks },
            get hideCanvasOverdueTasks() { return taskStore.hideCanvasOverdueTasks }
        }
    }

    const {
        tasksWithCanvasPosition,
        dynamicNodeExtent,
        hasNoTasks,
        hasInboxTasks
    } = useCanvasFilteredState(filteredTasks, canvasStoreWithTaskStore)

    // --- 3. Feature Initialization ---

    // Persistence (Sync)
    // const persistence = useCanvasPersistence()

    // Persistence (Sync)
    const persistence = useCanvasSync()

    // Unified Interactions (Drag & Resize)
    const interactions = useCanvasInteractions({
        nodes,
        findNode,
        updateNode,
        applyNodeChanges
    })

    // Groups (Unified)
    useCanvasGroups()

    // Navigation & Zoom (Legacy cleanup support, transitioning to Core)
    const { initialViewport, fitCanvas: legacyFitCanvas, zoomToSelection: legacyZoomToSelection } = useCanvasNavigation(canvasStore)
    const fitCanvas = legacyFitCanvas
    const zoomToSelection = legacyZoomToSelection
    const { cleanupZoom } = useCanvasZoom(resourceManager)

    // Modals
    const modals = useCanvasModals()

    // Sync Helpers (Adapter for legacy calls)
    const syncNodes = (tasks?: any[]) => {
        // Prevent sync if explicitly unwanted (e.g. during specific interactions)
        if (canvasUiStore.operationLoading.syncing) return

        console.debug('👉 [ORCHESTRATOR] Calling syncNodes', { hasTasks: !!tasks })
        try {
            const tasksToSync = tasks || tasksWithCanvasPosition.value
            persistence.syncStoreToCanvas(tasksToSync)
        } catch (e) {
            console.error('💥 [ORCHESTRATOR] syncNodes failed:', e)
        }
    }

    // OPTIMIZATION: True batching (only runs once per tick)
    let isSyncScheduled = false
    const batchedSyncNodes = (_priority?: string) => {
        if (isSyncScheduled) return
        isSyncScheduled = true
        nextTick(() => {
            syncNodes()
            isSyncScheduled = false
        })
    }

    // Edge sync: build edges from task.dependsOn arrays
    const recentlyRemovedEdges = ref(new Set<string>())
    const edgeSync = useCanvasEdgeSync({ recentlyRemovedEdges })
    const syncEdges = () => edgeSync.syncEdges()

    // Batched edge sync to coalesce multiple updates
    let isEdgeSyncScheduled = false
    const batchedSyncEdges = () => {
        if (isEdgeSyncScheduled) return
        isEdgeSyncScheduled = true
        nextTick(() => {
            syncEdges()
            isEdgeSyncScheduled = false
        })
    }

    // Events (Selection, Connection)
    const isVueFlowReady = ref(false)
    const isVueFlowMounted = ref(false)

    const events = useCanvasEvents(syncNodes)

    // Actions
    const recentlyDeletedGroups = ref(new Set<string>())
    const actions = useCanvasActions({
        viewport,
        batchedSyncNodes: batchedSyncNodes,
        syncNodes: syncNodes,
        closeCanvasContextMenu: events.closeCanvasContextMenu,
        closeEdgeContextMenu: events.closeEdgeContextMenu,
        closeNodeContextMenu: events.closeNodeContextMenu,
        recentlyDeletedGroups
    }, modals, getUndoSystem())

    // Wrapper for createTaskHere to use stored context menu position
    // This ensures tasks are created at the exact right-click location
    const createTaskHere = () => {
        const screenPos = {
            x: events.canvasContextMenuX.value,
            y: events.canvasContextMenuY.value
        }
        actions.createTaskHere(screenPos)
    }

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


    const isCanvasReady = computed(() => {
        return !operationLoading.value.loading && !operationLoading.value.syncing
    })

    // Alignment
    const alignment = useCanvasAlignment(nodes, {
        isVueFlowMounted,
        isVueFlowReady,
        isCanvasReady
    }, {
        closeCanvasContextMenu: events.closeCanvasContextMenu,
        requestSync: batchedSyncNodes // Fix TASK-258
    })

    // Smart Groups
    const smartGroups = useCanvasOverdueCollector()

    // Events Wrapper
    const handleCanvasContainerClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement

        // Only clear selection when clicking on empty canvas (pane/viewport)
        // Don't clear when clicking on nodes, edges, or other interactive elements
        const isEmptyCanvasClick = target.classList.contains('vue-flow__pane') ||
            target.classList.contains('vue-flow__viewport') ||
            target.classList.contains('vue-flow__container') ||
            target.classList.contains('vue-flow__background')

        console.log('%c[DEBUG] handleCanvasContainerClick FIRED', 'background: purple; color: white; font-size: 16px;', {
            target: target.className,
            isEmptyCanvasClick
        })

        if (isEmptyCanvasClick) {
            interactions.clearSelection()
        }

        // Always close context menus
        events.closeCanvasContextMenu()
        events.closeEdgeContextMenu()
        events.closeNodeContextMenu()
    }

    const collectTasksForSection = (_sectionId: string) => {
        smartGroups.autoCollectOverdueTasks()
    }

    // Connections
    const connections = useCanvasConnections({
        syncEdges: syncEdges,
        closeCanvasContextMenu: events.closeCanvasContextMenu,
        closeEdgeContextMenu: events.closeEdgeContextMenu,
        closeNodeContextMenu: events.closeNodeContextMenu,
        withVueFlowErrorBoundary: mockErrorBoundary
    }, {
        isConnecting: ref(false),
        recentlyRemovedEdges, // Shared with useCanvasEdgeSync for zombie edge prevention
        showEdgeContextMenu: ref(false),
        edgeContextMenuX: ref(0),
        edgeContextMenuY: ref(0),
        selectedEdge: ref(null)
    })

    // --- 4. Initialization & Reactivity ---

    // CRITICAL: Initialization guard to prevent watchers from calling syncNodes during startup
    // Without this, watchers fire as data loads, causing multiple syncNodes() calls with different task counts
    const isInitialized = ref(false)

    // Initial sync
    onMounted(async () => {
        console.log('🚀 [ORCHESTRATOR] onMounted starting...')

        await canvasStore.loadSavedViewport()
        await nextTick()

        // Initialize Realtime
        persistence.initRealtimeSubscription()

        // CONTAINMENT RECONCILIATION: Fix legacy tasks with incorrect parentId
        // DRIFT FIX: Only run ONCE per browser session to prevent repeated parent changes
        // This guards against remounts from: tab focus, auth refresh, route changes
        if (!hasReconciledThisSession) {
            hasReconciledThisSession = true
            console.log('🔧 [ORCHESTRATOR] Starting ONE-TIME reconciliation with', taskStore.tasks.length, 'tasks')
            await reconcileTaskParentsByContainment(
                taskStore.tasks,
                canvasStore.groups,
                async (taskId, updates) => {
                    // Update store (will auto-sync to Supabase via existing persistence)
                    // GEOMETRY WRITER: One-time reconciliation only (TASK-255)
                    console.log(`🔧 [RECONCILE-WRITE] Task ${taskId.slice(0, 8)}... parentId → ${updates.parentId ?? 'none'}`)
                    taskStore.updateTask(taskId, updates, 'RECONCILE')
                },
                { writeToDb: true, silent: false }
            )
        } else {
            console.log('⏭️ [ORCHESTRATOR] Skipping reconciliation - already ran this session')
        }

        // Calculate initial task counts AFTER reconciliation (fixes 0 counters on load)
        canvasStore.recalculateAllTaskCounts(taskStore.tasks)

        // Log hierarchy summary once on load (dev only)
        if (import.meta.env.DEV) {
            logHierarchySummary(canvasStore._rawGroups || [])
        }

        // SINGLE initial sync respecting current filters
        console.log('🚀 [ORCHESTRATOR] Initial syncNodes...')
        syncNodes()

        // Sync edges from task.dependsOn arrays
        console.log('🚀 [ORCHESTRATOR] Initial syncEdges...')
        syncEdges()

        // Mark initialization complete - watchers can now fire
        isInitialized.value = true
        console.log('✅ [ORCHESTRATOR] Initialization complete')
    })

    // Persist Viewport on Change
    onMoveEnd((flow) => {
        if (flow && flow.flowTransform) {
            // Debounce viewport saves slightly to strictly avoid slamming store
            // (VueFlow handles throttling internal events, but good to be safe)
            canvasStore.setViewport(flow.flowTransform.x, flow.flowTransform.y, flow.flowTransform.zoom)
        }
    })

    // Watchers are now largely handled by persistence.initRealtimeSubscription which watches Stores
    // But we still need to watch Filter changes here as they affect WHICH tasks we show
    // CRITICAL: All watchers check isInitialized to prevent firing during startup
    // OPTIMIZATION: Use batchedSyncNodes to coalesce multiple updates
    watch(() => taskStore.activeStatusFilter, () => {
        if (!isInitialized.value) return
        batchedSyncNodes()
    })
    watch(() => taskStore.hideCanvasDoneTasks, () => {
        if (!isInitialized.value) return
        batchedSyncNodes()
    })
    watch(() => taskStore.hideCanvasOverdueTasks, () => {
        if (!isInitialized.value) return
        batchedSyncNodes()
    })

    // REACTIVITY FIX: Watch for manual sync requests from context menus
    watch(() => canvasStore.syncTrigger, () => {
        if (!isInitialized.value) return
        console.log('🔔 [ORCHESTRATOR] canvasStore.syncTrigger changed - forcing sync')
        batchedSyncNodes()
        batchedSyncEdges()
    })

    watch(() => canvasUiStore.syncTrigger, () => {
        if (!isInitialized.value) return
        console.log('🔔 [ORCHESTRATOR] canvasUiStore.syncTrigger changed - forcing sync')
        batchedSyncNodes()
    })

    // Global guard to prevent recursive watcher triggers
    let isSyncingFromWatcher = false

    // CRITICAL FIX: Watch for task data changes (e.g. after async load)
    // Only watch task count changes, not deep property changes
    watch(() => tasksWithCanvasPosition.value.length, () => {
        // Skip during initialization - onMounted handles initial sync
        if (!isInitialized.value) return
        if (isSyncingFromWatcher) return
        isSyncingFromWatcher = true
        try {
            if (persistence.isSyncing.value) return
            canvasStore.recalculateAllTaskCounts(taskStore.tasks)
            batchedSyncNodes()
            batchedSyncEdges() // Also sync edges when tasks change
        } finally {
            isSyncingFromWatcher = false
        }
    })

    // CRITICAL FIX: Watch for group changes (e.g. creation/deletion/remote sync)
    watch(() => canvasStore.groups.length, () => {
        // Skip during initialization - onMounted handles initial sync
        if (!isInitialized.value) return
        if (isSyncingFromWatcher) return
        isSyncingFromWatcher = true
        try {
            if (persistence.isSyncing.value) return
            console.log('👀 [ORCHESTRATOR] canvasStore.groups changed', { count: canvasStore.groups.length })
            canvasStore.recalculateAllTaskCounts(taskStore.tasks)
            batchedSyncNodes()
        } finally {
            isSyncingFromWatcher = false
        }
    })

    // DRIFT FIX: REMOVED watcher on taskCountByGroupId
    // This watcher was causing sync loops and is now redundant because:
    // 1. updateSingleSectionCount() directly updates Vue Flow node.data with fresh counts
    // 2. The drag handler calls bumpTaskParentVersion() + updateSectionTaskCounts()
    // 3. No need to rebuild all nodes just because counts changed
    // Keeping this comment to document why it was removed.
    // watch(() => canvasStore.taskCountByGroupId, () => { ... }, { deep: true })

    // Retry Logic
    const retryFailedOperation = async () => {
        if (!operationError.value?.retryable) return
        const { type } = operationError.value
        clearOperationError()

        if (type === 'System Restart') {
            // persistence.performSystemRestart() // Todo: implement if needed
            window.location.reload()
        } else {
            setOperationLoading('syncing', true)
            try {
                await nextTick()
                syncNodes()
                setOperationLoading('syncing', false)
            } catch (_error) {
                setOperationError('Sync Operation', 'Retry failed', true)
                setOperationLoading('syncing', false)
            }
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
        initialViewport,
        hasInitialFit,
        shift,
        control,
        meta,
        vueFlowRef: ref(null), // TODO: Do we need this ref if we use Core? CanvasView binds it.

        // Computed
        filteredTasks,
        tasksWithCanvasPosition,
        dynamicNodeExtent,
        hasNoTasks,
        hasInboxTasks,

        // Actions & Handlers
        ...actions,
        createTaskHere, // Override to use stored context menu position
        ...modals,
        closeSectionSettingsModal: actions.closeGroupEditModal,
        handleSectionSettingsSave: actions.handleGroupEditSave,

        ...events,

        // Selection Handlers
        handleMouseDown: interactions.startSelection,
        handleMouseMove: interactions.updateSelection,
        handleMouseUp: interactions.endSelection,
        handleCanvasContainerClick,

        // New feature re-exports
        ...interactions,
        ...alignment,
        ...smartGroups,
        collectTasksForSection,
        ...connections,

        // Interaction Handlers
        handleNodeDragStart: interactions.onNodeDragStart,
        handleNodeDrag: interactions.onNodeDrag,
        handleNodeDragStop: interactions.onNodeDragStop,

        handleSectionResizeStart: interactions.onSectionResizeStart,
        handleSectionResize: interactions.onSectionResize,
        handleSectionResizeEnd: interactions.onSectionResizeEnd,

        resizeState: interactions.resizeState,
        isResizeSettling: interactions.isResizeSettling,
        resizeLineStyle: interactions.resizeLineStyle,
        edgeHandleStyle: interactions.edgeHandleStyle,

        onPaneReady: (instance: any) => {
            onPaneReady(instance) // Core handler
            isVueFlowReady.value = true
            isVueFlowMounted.value = true
            setOperationLoading('loading', false)
            setOperationLoading('syncing', false)
        },
        fitCanvas,
        zoomToSelection,
        retryFailedOperation,

        // Vue Flow Handlers
        // TASK-262: Filter selection changes to prevent unwanted deselection on node click
        // Vue Flow default: clicking a node deselects all others. We only want pane click to deselect.
        handleNodesChange: (changes: any[]) => {
            // TASK-262 FIX: Allow all changes to pass through including deselection
            // Previously, deselection was blocked which prevented clicking on empty canvas
            // from clearing selection. Vue Flow's default behavior is correct - let it work.
            applyNodeChanges(changes)
        },
        handleEdgesChange: applyEdgeChanges,
        handleConnect: (params: import('@vue-flow/core').Connection) => {
            connections.handleConnect(params)
        },
        handleConnectStart: connections.handleConnectStart,
        handleConnectEnd: connections.handleConnectEnd,

        // Debug
        syncNodes,
        syncEdges,
        performSystemRestart: () => window.location.reload(), // Simple fallback
        storeHealth: lifecycle.storeHealth,

        // Hotkeys
        handleKeyDown
    }
}
