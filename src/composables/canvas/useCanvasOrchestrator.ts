import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasImagesStore } from '@/stores/canvasImages'
import { useCanvasUiStore } from '@/stores/canvas/canvasUi'
import { useCanvasContextMenuStore } from '@/stores/canvas/contextMenus'
import { useUIStore } from '@/stores/ui'
import { useMagicKeys, useWindowSize } from '@vueuse/core'

import resourceManager from '../../utils/canvas/resourceManager'
import { getUndoSystem } from '@/composables/undoSingleton'
import { logHierarchySummary } from '@/utils/canvas/invariants'
import { useCanvasOperationState } from './useCanvasOperationState'

// --- NEW COMPOSABLES (Phase 3) ---
import { useCanvasCore } from './useCanvasCore'
import { useCanvasSync } from './useCanvasSync'
import { useCanvasInteractions } from './useCanvasInteractions'
import { useCanvasSelection } from './useCanvasSelection'

// ...
// Persistence (Sync)
// Moved inside useCanvasOrchestrator to ensure correct Vue context

import { useCanvasGroups } from './useCanvasGroups'
import { positionManager } from '@/services/canvas/PositionManager'
// TASK-1158: Bridge refs for cross-store communication (breaks circular dependency)
import { canvasSyncTrigger, canvasUiSyncRequest } from '@/stores/canvasTaskBridge'


// Legacy/Auxiliary Composables (Still used)
import { useCanvasEvents } from './useCanvasEvents'
import { useCanvasHotkeys } from './useCanvasHotkeys'
import { useCanvasActions } from './useCanvasActions'
import { useCanvasOverdueCollector } from './useCanvasOverdueCollector'
import { useCanvasModals } from './useCanvasModals'
import { useCanvasFilteredState } from './useCanvasFilteredState'
import { useCanvasLifecycle } from './useCanvasLifecycle'
import { useCanvasNavigation } from './useCanvasNavigation' // Keeping for specialized nav if needed
import { CANVAS } from '@/constants/canvas'
import { useCanvasZoom } from './useCanvasZoom' // Keeping for cleanup hooks
import { useCanvasAlignment } from './useCanvasAlignment'
import { useCanvasConnections } from './useCanvasConnections'
import { useCanvasEdgeSync } from './useCanvasEdgeSync'
import { traceCanvasDone, traceCanvasDoneTasks } from '@/utils/canvas/doneTrace'

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

export function useCanvasOrchestrator() {
    const canvasStore = useCanvasStore()
    const taskStore = useTaskStore()
    const canvasImagesStore = useCanvasImagesStore()
    const canvasUiStore = useCanvasUiStore()
    const contextMenuStore = useCanvasContextMenuStore()
    const uiStore = useUIStore()

    // Store cleanup functions for onUnmounted - must be registered synchronously
    const positionManagerUnsubscribe = ref<(() => void) | null>(null)

    // --- 1. Core State & Vue Flow (Via useCanvasCore) ---
    const {
        nodes,
        edges,
        onPaneReady,
        viewport,
        updateNode,
        findNode,
        getViewport,
        setViewport: vueFlowSetViewport,
        onMoveStart,
        onMoveEnd,
        applyNodeChanges,
        applyEdgeChanges,
        screenToFlowCoordinate
    } = useCanvasCore()

    const { hasInitialFit, operationLoading, operationError } = storeToRefs(canvasUiStore)
    const { setOperationLoading, setOperationError, clearOperationError } = canvasUiStore
    const { width: _width, height: _height } = useWindowSize()
    const { shift, control, meta } = useMagicKeys()

    // --- ZOOM PERF INSTRUMENTATION (declarations) ---
    let zoomPerfActive = false
    let zoomMoveStartCount = 0
    let zoomMoveEndCount = 0
    let zoomWheelEventCount = 0
    let zoomStartTime = 0
    let lastZoomLevel = 0
    const zoomPerfLog: Array<{ event: string; zoom: number; elapsed: number; detail?: string }> = []

    function logZoomPerf(event: string, zoom: number, detail?: string) {
        if (!import.meta.env.DEV) return
        const elapsed = zoomStartTime ? performance.now() - zoomStartTime : 0
        zoomPerfLog.push({ event, zoom, elapsed, detail })
    }

    function flushZoomPerf() {
        if (!import.meta.env.DEV || zoomPerfLog.length === 0) return
        const duration = performance.now() - zoomStartTime
        const wheelRate = duration > 0 ? (zoomWheelEventCount / (duration / 1000)).toFixed(0) : '?'
        console.groupCollapsed(
            `%c[ZOOM PERF]%c gesture: ${zoomWheelEventCount} wheel events (${wheelRate}/sec), ${zoomMoveStartCount} starts, ${zoomMoveEndCount} ends in ${duration.toFixed(0)}ms`,
            'background: #4ecdc4; color: black; padding: 2px 6px; border-radius: 3px;',
            'color: inherit;'
        )
        console.table(zoomPerfLog)
        console.groupEnd()
        zoomPerfLog.length = 0
    }

    // Track raw wheel events on the canvas to measure mouse scroll rate
    if (import.meta.env.DEV) {
        // Defer until DOM is ready
        const attachWheelCounter = () => {
            const vfEl = document.querySelector('.vue-flow')
            if (vfEl) {
                vfEl.addEventListener('wheel', () => {
                    if (zoomPerfActive) zoomWheelEventCount++
                }, { passive: true })
            } else {
                setTimeout(attachWheelCounter, 500)
            }
        }
        setTimeout(attachWheelCounter, 1000)
    }
    // --- END ZOOM PERF INSTRUMENTATION ---

    // --- 2. Computed Data ---
    const canvasSourceTasks = computed(() => taskStore.tasksWithCanvasPosition)

    // Pass the live Pinia taskStore reference (not a plain-object getter wrapper)
    // so consumer computeds get native Pinia tracking on `hideCanvasDoneTasks` /
    // `hideCanvasOverdueTasks`. The previous wrapper at this site was the suspected
    // cause of the "Hide overdue tasks" toggle flipping state without re-filtering
    // visible canvas nodes.
    const canvasStoreWithTaskStore = {
        ...canvasStore,
        taskStore,
    }

    const {
        tasksWithCanvasPosition,
        dynamicNodeExtent,
        hasNoTasks,
        hasInboxTasks
    } = useCanvasFilteredState(canvasSourceTasks, canvasStoreWithTaskStore)

    // --- 3. Feature Initialization ---

    // Persistence (Sync)
    // const persistence = useCanvasPersistence()

    // Persistence (Sync)
    const persistence = useCanvasSync()

    // Unified Interactions (Drag & Resize)
    const {
        canAcceptRemoteUpdate,
        currentType: opCurrentType,
        state: opState,
        getDebugInfo: getOpDebugInfo,
        queueUpdate,
        cancelQueuedUpdates,
        resetToIdle: resetCanvasOperationToIdle,
    } = useCanvasOperationState()
    const projectionQueueOwner = Symbol('canvas-orchestrator-projection')

    const applyNodeChangesCompat = (changes: unknown[]) => applyNodeChanges(changes as import('@vue-flow/core').NodeChange[])

    const interactions = useCanvasInteractions({
        nodes,
        findNode,
        updateNode,
        applyNodeChanges: applyNodeChangesCompat
    })

    // Selection management
    const selection = useCanvasSelection({
        nodes,
        applyNodeChanges: applyNodeChangesCompat
    })

    // Groups (Unified)
    useCanvasGroups()

    // Navigation & Zoom (Legacy cleanup support, transitioning to Core)
    const { initialViewport, fitCanvas: legacyFitCanvas, zoomToSelection: legacyZoomToSelection, centerOnTodayGroup, centerOnTask } = useCanvasNavigation(canvasStore)
    const fitCanvas = legacyFitCanvas
    const zoomToSelection = legacyZoomToSelection
    const { cleanupZoom } = useCanvasZoom(resourceManager)

    // Modals
    const modals = useCanvasModals()

    // Sync Helpers (Adapter for legacy calls)
    // BUG-1361: Added `force` option to bypass the drag-settling guard for user-initiated
    // drops (inbox → canvas). Without this, tasks dropped during the 3-second settling
    // window after a canvas node drag would silently fail to render.
    const syncNodes = (tasks?: import('@/stores/tasks').Task[], options?: { force?: boolean }) => {
        // TASK-241: State Machine Guard
        // Block READ-PATH syncs if user is interacting (dragging/resizing)
        // unless forced by explicit user action (e.g., inbox drop)
        if (!options?.force && !canAcceptRemoteUpdate.value) {
            queueUpdate(() => syncNodes(), {
                key: 'canvas-node-projection',
                owner: projectionQueueOwner,
                retainOnInteractionRestart: true,
            })
            if (import.meta.env.DEV) {
                console.log(`[BUG-1492:ORCH] syncNodes DEFERRED`, { canAcceptRemoteUpdate: canAcceptRemoteUpdate.value, opState: opCurrentType.value })
            }
            return
        }

        if (import.meta.env.DEV) {
            console.log(`[BUG-1492:ORCH] syncNodes ALLOWED`, { force: options?.force, canAcceptRemoteUpdate: canAcceptRemoteUpdate.value, opState: opCurrentType.value })
        }

        try {
            const t0 = performance.now()
            const tasksToSync = tasks || tasksWithCanvasPosition.value
            traceCanvasDone('orchestrator:syncNodes:before', {
                force: options?.force === true,
                taskCount: tasksToSync.length,
                canAcceptRemoteUpdate: canAcceptRemoteUpdate.value,
                opState: opCurrentType.value
            })
            traceCanvasDoneTasks('orchestrator:syncNodes:tasks', tasksToSync)
            persistence.syncStoreToCanvas(tasksToSync)
            const syncMs = performance.now() - t0
            if (import.meta.env.DEV && zoomPerfActive) {
                logZoomPerf('syncNodes', viewport.value?.zoom ?? 1, `${tasksToSync.length} tasks, took ${syncMs.toFixed(1)}ms`)
            }
        } catch (e) {
            console.error('💥 [ORCHESTRATOR] syncNodes failed:', e)
        }
    }

    // OPTIMIZATION: True batching (only runs once per tick)
    let isSyncScheduled = false
    let pendingForce = false
    const batchedSyncNodes = (_priority?: string, options?: { force?: boolean }) => {
        if (options?.force) pendingForce = true
        if (isSyncScheduled) return
        isSyncScheduled = true
        nextTick(() => {
            syncNodes(undefined, pendingForce ? { force: true } : undefined)
            isSyncScheduled = false
            pendingForce = false
        })
    }

    // Edge sync: build edges from task.dependsOn arrays
    const recentlyRemovedEdges = ref(new Set<string>())
    const edgeSync = useCanvasEdgeSync({ recentlyRemovedEdges })
    const syncEdges = (options?: { force?: boolean }) => {
        // BUG-1371: Allow force bypass for user-initiated actions (e.g. node deletion)
        if (!options?.force && !canAcceptRemoteUpdate.value) {
            queueUpdate(() => syncEdges(), {
                key: 'canvas-edge-projection',
                owner: projectionQueueOwner,
                retainOnInteractionRestart: true,
            })
            return
        }
        const visibleEdgeTasks = taskStore.hideCanvasDoneTasks
            ? tasksWithCanvasPosition.value.filter(task => task.status !== 'done')
            : tasksWithCanvasPosition.value
        edgeSync.syncEdges(visibleEdgeTasks)
    }

    // Batched edge sync to coalesce multiple updates
    let isEdgeSyncScheduled = false
    const batchedSyncEdges = (options?: { force?: boolean }) => {
        if (isEdgeSyncScheduled) return
        isEdgeSyncScheduled = true
        nextTick(() => {
            syncEdges(options)
            isEdgeSyncScheduled = false
        })
    }

    // Events (Selection, Connection)
    const isVueFlowReady = ref(false)
    const isVueFlowMounted = ref(false)

    // BUG-1902: apply the saved viewport exactly once, as soon as BOTH the
    // async loadSavedViewport() has resolved AND the Vue Flow pane exists.
    // :default-viewport alone never worked — it is captured before the load
    // resolves, and no code ever called setViewport, so the canvas always
    // opened at the origin (and the viewport heal-persist was unreachable).
    let savedViewportLoaded = false
    let savedViewportApplied = false
    const applySavedViewportOnce = () => {
        if (savedViewportApplied || !savedViewportLoaded || !isVueFlowReady.value) return
        savedViewportApplied = true
        const vp = canvasStore.viewport
        if (!vp || !Number.isFinite(vp.x) || !Number.isFinite(vp.y) || !Number.isFinite(vp.zoom) || vp.zoom <= 0) return
        vueFlowSetViewport({ x: vp.x, y: vp.y, zoom: vp.zoom })
        // Reconcile persisted copies: loadSavedViewport prefers the cloud value,
        // so a stale/broken localStorage viewport would otherwise survive
        // forever (an offline/Electron start would then use it and reopen to
        // empty space). Persisting the CHOSEN value converges both stores.
        canvasStore.setViewport(vp.x, vp.y, vp.zoom)
        if (import.meta.env.DEV) {
            console.log('[VIEWPORT-RESTORE] Applied saved viewport', { x: vp.x, y: vp.y, zoom: vp.zoom })
        }
    }

    const syncNodesCompat = (tasks?: unknown[], options?: { force?: boolean }) => syncNodes(tasks as import('@/stores/tasks').Task[] | undefined, options)
    const events = useCanvasEvents(syncNodesCompat)

    // Actions
    const recentlyDeletedGroups = ref(new Set<string>())
    const actions = useCanvasActions({
        viewport,
        batchedSyncNodes: batchedSyncNodes,
        syncNodes: syncNodes,
        syncEdges: syncEdges,
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

    // Wrapper for createTaskInGroup to use stored context menu position
    // TASK-288 FIX: This ensures tasks are created at the click location within the group
    const createTaskInGroup = (groupOrId: string | any) => {
        const screenPos = {
            x: events.canvasContextMenuX.value,
            y: events.canvasContextMenuY.value
        }
        actions.createTaskInGroup(groupOrId, screenPos)
    }

    // Wrapper for createGroup to use stored context menu position
    // BUG-1126 FIX: This ensures groups are created at the right-click location, not viewport center
    const createGroup = () => {
        const screenPos = {
            x: events.canvasContextMenuX.value,
            y: events.canvasContextMenuY.value
        }
        if (import.meta.env.DEV) {
            console.log('[BUG-1126] createGroup wrapper called', {
                storedContextMenuX: events.canvasContextMenuX.value,
                storedContextMenuY: events.canvasContextMenuY.value,
                screenPos
            })
        }
        actions.createGroup(screenPos)
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
        // Canvas readiness is about local store -> Vue Flow projection. Remote sync is a
        // background concern; tying the full-screen loading overlay to sync failures made Electron
        // appear blank until restart when Supabase/realtime was degraded.
        return !operationLoading.value.loading
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

        // BUG-FIX: Skip if shift/ctrl/meta is held (user is multi-selecting)
        // This prevents clearing selection when Vue Flow's selection box is active
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
            // Still close context menus
            events.closeCanvasContextMenu()
            events.closeEdgeContextMenu()
            events.closeNodeContextMenu()
            return
        }

        // Only clear selection when clicking on truly empty canvas (pane/viewport)
        // Don't clear when clicking on nodes, edges, or other interactive elements
        // BUG-FIX: Exclude "selection" class which is Vue Flow's selection box
        const isVueFlowSelectionBox = target.classList.contains('selection')
        const isEmptyCanvasClick = !isVueFlowSelectionBox && (
            target.classList.contains('vue-flow__pane') ||
            target.classList.contains('vue-flow__viewport') ||
            target.classList.contains('vue-flow__container') ||
            target.classList.contains('vue-flow__background')
        )

        if (isEmptyCanvasClick) {
            selection.clearSelection()
        }

        // Always close context menus
        events.closeCanvasContextMenu()
        events.closeEdgeContextMenu()
        events.closeNodeContextMenu()
    }

    const collectTasksForSection = (sectionId: string) => {
        actions.collectOverdueTasksNearGroup(sectionId)
    }

    // TASK-1811: Apply group due date / properties to the tasks inside a group
    const applyGroupPropsToTasks = (groupId: string, mode: 'dueDate' | 'all') => {
        actions.applyGroupPropsToTasks(groupId, mode)
    }

    // TASK-1222: Collect overdue tasks and arrange near a group
    const collectOverdueTasksNearGroup = (sectionId: string) => {
        actions.collectOverdueTasksNearGroup(sectionId)
    }

    // Connections - use context menu store refs for edge menu to sync with EdgeContextMenu component
    const { showEdgeContextMenu, edgeContextMenuX, edgeContextMenuY } = storeToRefs(contextMenuStore)
    const selectedEdge = ref<import('@vue-flow/core').Edge | null>(null)
    // State for drag-to-create feature
    const pendingConnectionSource = ref<string | null>(null)
    const connectionWasSuccessful = ref(false)

    const connections = useCanvasConnections({
        syncEdges: syncEdges,
        closeCanvasContextMenu: events.closeCanvasContextMenu,
        closeEdgeContextMenu: events.closeEdgeContextMenu,
        closeNodeContextMenu: events.closeNodeContextMenu,
        withVueFlowErrorBoundary: mockErrorBoundary,
        // Drag-to-create dependencies
        screenToFlowCoordinate,
        createConnectedTask: actions.createConnectedTask
    }, {
        isConnecting: ref(false),
        recentlyRemovedEdges, // Shared with useCanvasEdgeSync for zombie edge prevention
        showEdgeContextMenu,
        edgeContextMenuX,
        edgeContextMenuY,
        selectedEdge,
        // Drag-to-create state
        pendingConnectionSource,
        connectionWasSuccessful
    })

    // --- 4. Initialization & Reactivity ---

    // CRITICAL: Initialization guard to prevent watchers from calling syncNodes during startup
    // Without this, watchers fire as data loads, causing multiple syncNodes() calls with different task counts
    const isInitialized = ref(false)

    const hasVisibleCanvasNode = () => {
        const container = document.querySelector<HTMLElement>('.canvas-container')
        if (!container) return false

        const bounds = container.getBoundingClientRect()
        const renderedNodes = Array.from(document.querySelectorAll<HTMLElement>('.vue-flow__node'))
            .filter(node => !node.classList.contains('hidden'))

        return renderedNodes.some(node => {
            const rect = node.getBoundingClientRect()
            return rect.width > 0 &&
                rect.height > 0 &&
                rect.right > bounds.left &&
                rect.left < bounds.right &&
                rect.bottom > bounds.top &&
                rect.top < bounds.bottom
        })
    }

    let viewportApplyWaits = 0
    const scheduleInitialViewportRecovery = (attempt = 0) => {
        const maxAttempts = 12
        setTimeout(async () => {
            await nextTick()

            // BUG-1902: recovery must judge visibility AFTER the saved viewport
            // has been applied. Before this gate, the stores-init watcher could
            // fire recovery while the pane was still at the origin default —
            // nodes looked visible, recovery early-returned, and the saved
            // (possibly broken) viewport then jumped in with recovery spent.
            // Waiting for the apply must NOT consume node-render attempts:
            // paneReady can lag stores-init by several seconds on cold boots.
            if (!savedViewportApplied) {
                viewportApplyWaits++
                if (viewportApplyWaits < 120) { // hard cap ~30s @250ms
                    scheduleInitialViewportRecovery(attempt)
                }
                return
            }

            if (hasVisibleCanvasNode()) {
                if (import.meta.env.DEV) {
                    console.log('🎯 [ORCHESTRATOR] Initial viewport already contains canvas nodes')
                }
                return
            }

            const hasRenderedNodes = nodes.value.some(node => !node.hidden)
            if (!hasRenderedNodes && attempt < maxAttempts) {
                scheduleInitialViewportRecovery(attempt + 1)
                return
            }

            // Startup recovery must settle synchronously so the healed viewport is
            // persisted before the next Electron restart can reuse stale storage.
            const centered = centerOnTodayGroup(true, 0)
            if (!centered && hasRenderedNodes) {
                fitCanvas(0)
            }
            if (centered || hasRenderedNodes) {
                // BUG-1902: persist the healed viewport immediately; animated
                // navigation is appropriate for user actions, not startup repair.
                const recoveredViewport = getViewport()
                canvasStore.setViewport(recoveredViewport.x, recoveredViewport.y, recoveredViewport.zoom)
            }

            if (import.meta.env.DEV) {
                console.log('🎯 [ORCHESTRATOR] Initial viewport recovery', {
                    centered,
                    fitCanvasFallback: !centered && hasRenderedNodes,
                    nodeCount: nodes.value.length,
                    attempt
                })
            }
        }, attempt === 0 ? 150 : 250)
    }

    // SEARCH REVEAL: Center viewport on a task when triggered from search modal
    const handleRevealTaskOnCanvas = (event: Event) => {
        const { taskId } = (event as CustomEvent<{ taskId: string }>).detail
        const found = centerOnTask(taskId)
        if (found) {
            // Flash the task after the pan animation completes
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('task-action-flash', { detail: { taskId } }))
            }, CANVAS.NAVIGATION_ANIMATION_MS + 50)
        }
    }

    // Initial sync
    onMounted(async () => {
        if (import.meta.env.DEV) {
            console.log('🚀 [ORCHESTRATOR] onMounted starting...')
        }

        window.addEventListener('reveal-task-on-canvas', handleRevealTaskOnCanvas)

        await canvasStore.loadSavedViewport()
        await nextTick()

        // BUG-1902: actually APPLY the saved viewport (see applySavedViewportOnce).
        savedViewportLoaded = true
        applySavedViewportOnce()

        // Initialize Realtime
        persistence.initRealtimeSubscription()

        // BUG-1084 v5: Wait for stores to be ready before initial sync
        // The root cause of empty canvas on initial load was calling syncNodes() before
        // stores were populated. Now we use a watcher to wait for initialization.
        // BUG-1107: Use let + nextTick to avoid "can't access before initialization" error
        // when watcher runs immediately and tries to call stopInitWatcher()
        let stopInitWatcher: (() => void) | null = null
        stopInitWatcher = watch(
            [
                () => taskStore._hasInitializedOnce,
                () => canvasStore._hasInitializedOnce
            ],
            async ([tasksReady, groupsReady]) => {
                // Run initial sync once BOTH stores have finished loading
                if (tasksReady && groupsReady && !isInitialized.value) {
                    if (import.meta.env.DEV) {
                        console.log('🚀 [ORCHESTRATOR] Stores initialized, running initial sync', {
                            tasks: taskStore.tasks.length,
                            groups: canvasStore.groups.length
                        })
                    }
                    syncNodes()
                    syncEdges()
                    isInitialized.value = true
                    if (import.meta.env.DEV) {
                        console.log('✅ [ORCHESTRATOR] Initialization complete')
                    }

                    // Startup must be a read/projection path. Rewriting parentId from spatial
                    // containment on each browser session made hard refreshes and Electron
                    // update restarts capable of changing canvas topology from partially
                    // loaded or mixed local/remote geometry. Parent changes now belong only
                    // to explicit drag/drop flows.
                    // Auto-place disabled: tasks should only appear on canvas via explicit user action
                    // (context menu "Canvas Group", due-date auto-routing, or drag-and-drop)
                    // Previously: autoPlaceEligibleTasks() ran here on every app load

                    // Calculate initial task counts AFTER reconciliation (fixes 0 counters on load)
                    canvasStore.recalculateAllTaskCounts(taskStore.tasks)
                    scheduleInitialViewportRecovery()

                    // Log hierarchy summary once on load (dev only)
                    if (import.meta.env.DEV) {
                        logHierarchySummary(canvasStore._rawGroups || [])
                    }

                    // Defer stop to next tick to ensure stopInitWatcher is assigned
                    if (stopInitWatcher) stopInitWatcher()
                }
            },
            { immediate: true }
        )

        // Fallback: If stores don't signal ready within 2s, sync anyway
        // This handles edge cases like empty databases or network timeouts
        setTimeout(() => {
            if (!isInitialized.value) {
                console.warn('⚠️ [ORCHESTRATOR] Fallback sync - stores took too long', {
                    tasksReady: taskStore._hasInitializedOnce,
                    groupsReady: canvasStore._hasInitializedOnce,
                    tasks: taskStore.tasks.length,
                    groups: canvasStore.groups.length
                })
                syncNodes()
                syncEdges()
                isInitialized.value = true
                scheduleInitialViewportRecovery()
                if (stopInitWatcher) stopInitWatcher()
            }
        }, 2000)

        // TASK-213: Position Manager Subscription
        // Listen for updates from other sources (e.g. Alignment tools, Auto-layout)
        // that are NOT 'user-drag' (handled by Vue Flow) or 'remote-sync' (handled by sync loop)
        positionManagerUnsubscribe.value = positionManager.subscribe((event) => {
            const { nodeId, payload } = event as { nodeId: string; payload: { source: string; position: { x: number; y: number }; parentId?: string | null } }
            if (payload.source !== 'user-drag' && payload.source !== 'remote-sync') {
                if (import.meta.env.DEV) {
                    console.log(`📡[ORCHESTRATOR] Applying external position update for ${nodeId} from ${payload.source}`)
                }

                const node = findNode(nodeId)
                if (node) {
                    // Convert Absolute (PM) -> Relative (Vue Flow)
                    // If node has parent, we need parent's position to convert
                    let relativePos = payload.position

                    if (payload.parentId) {
                        // Look up parent in PM (Truth) or Store
                        const parentPm = positionManager.getPosition(payload.parentId)
                        if (parentPm) {
                            relativePos = {
                                x: payload.position.x - parentPm.position.x,
                                y: payload.position.y - parentPm.position.y
                            }
                        }
                    }

                    updateNode(nodeId, { position: relativePos })
                }
            }
        })
    })

    // CRITICAL: Register onUnmounted synchronously (not inside async onMounted)
    // This fixes Vue warning: "onUnmounted is called when there is no active component instance"
    onUnmounted(() => {
        cancelQueuedUpdates(projectionQueueOwner)
        resetCanvasOperationToIdle()
        if (positionManagerUnsubscribe.value) {
            positionManagerUnsubscribe.value()
            positionManagerUnsubscribe.value = null
        }
        // BUG-1216: Clean up viewport debounce timer
        if (viewportSaveTimer) {
            clearTimeout(viewportSaveTimer)
            viewportSaveTimer = null
        }
        window.removeEventListener('reveal-task-on-canvas', handleRevealTaskOnCanvas)
    })

    // Persist Viewport on Change
    // BUG-1216: Debounce viewport persistence to prevent "double take" glitch during scroll-wheel zoom.
    // Each scroll tick triggers a zoom animation → onMoveEnd fires → reactive store update → re-render.
    // Without debounce, rapid scroll-wheel zoom causes cascading re-renders mid-animation.
    let viewportSaveTimer: ReturnType<typeof setTimeout> | null = null

    // Performance: pause expensive CSS animations during zoom/pan gestures
    // Set on .canvas-drop-zone (parent of both VueFlow and CanvasEmptyState)
    // Lazy query — DOM may not exist yet during composable setup
    let zoomContainer: Element | null = null
    onMoveStart(() => {
        if (!zoomContainer) zoomContainer = document.querySelector('.canvas-drop-zone') || document.querySelector('.vue-flow')
        zoomContainer?.classList.add('is-zooming')
        if (!zoomPerfActive) {
            zoomPerfActive = true
            zoomStartTime = performance.now()
            zoomMoveStartCount = 0
            zoomMoveEndCount = 0
            zoomWheelEventCount = 0
            zoomPerfLog.length = 0
            lastZoomLevel = viewport.value?.zoom ?? 1
        }
        zoomMoveStartCount++
        const currentZoom = viewport.value?.zoom ?? 1
        logZoomPerf('moveStart', currentZoom)
    })

    onMoveEnd((flow) => {
        zoomMoveEndCount++
        const currentZoom = flow?.flowTransform?.zoom ?? viewport.value?.zoom ?? 1
        const zoomDelta = currentZoom - lastZoomLevel
        logZoomPerf('moveEnd', currentZoom, `Δzoom=${zoomDelta.toFixed(3)}`)
        lastZoomLevel = currentZoom

        if (flow && flow.flowTransform) {
            if (viewportSaveTimer) clearTimeout(viewportSaveTimer)
            viewportSaveTimer = setTimeout(() => {
                const t0 = performance.now()
                canvasStore.setViewport(flow.flowTransform.x, flow.flowTransform.y, flow.flowTransform.zoom)
                const setViewportMs = performance.now() - t0
                logZoomPerf('setViewport', flow.flowTransform.zoom, `took ${setViewportMs.toFixed(1)}ms`)
                zoomContainer?.classList.remove('is-zooming')
                zoomPerfActive = false
                flushZoomPerf()
                viewportSaveTimer = null
            }, 150)
        }
    })

    // Watchers are now largely handled by persistence.initRealtimeSubscription which watches Stores
    // But we still need to watch Filter changes here as they affect WHICH tasks we show
    // CRITICAL: All watchers check isInitialized to prevent firing during startup
    // OPTIMIZATION: Use batchedSyncNodes to coalesce multiple updates
    watch(() => taskStore.activeStatusFilter, () => {
        if (!isInitialized.value) return
        if (import.meta.env.DEV && zoomPerfActive) logZoomPerf('watcher:activeStatusFilter', viewport.value?.zoom ?? 1)
        batchedSyncNodes()
    })
    watch(() => taskStore.hideCanvasDoneTasks, () => {
        if (!isInitialized.value) return
        if (import.meta.env.DEV && zoomPerfActive) logZoomPerf('watcher:hideCanvasDoneTasks', viewport.value?.zoom ?? 1)
        traceCanvasDone('watcher:hideCanvasDoneTasks')
        batchedSyncNodes()
    })
    watch(() => taskStore.hideCanvasOverdueTasks, () => {
        if (!isInitialized.value) return
        if (import.meta.env.DEV && zoomPerfActive) logZoomPerf('watcher:hideCanvasOverdueTasks', viewport.value?.zoom ?? 1)
        batchedSyncNodes()
    })
    // BUG-1210 FIX: Watch smart view changes to re-sync canvas nodes
    // Without this, switching to "This Week" doesn't refresh canvas when task count stays the same
    watch(() => taskStore.activeSmartView, () => {
        if (!isInitialized.value) return
        if (import.meta.env.DEV && zoomPerfActive) logZoomPerf('watcher:activeSmartView', viewport.value?.zoom ?? 1)
        batchedSyncNodes()
        batchedSyncEdges()
    })

    // REACTIVITY FIX: Watch for manual sync requests from context menus
    // User-initiated syncs bypass the drag-settling guard (force: true)
    watch(() => canvasStore.syncTrigger, () => {
        if (!isInitialized.value) return
        if (import.meta.env.DEV && zoomPerfActive) logZoomPerf('watcher:canvasStore.syncTrigger', viewport.value?.zoom ?? 1)
        batchedSyncNodes(undefined, { force: true })
        batchedSyncEdges({ force: true })
    })

    watch(() => canvasUiStore.syncTrigger, () => {
        if (!isInitialized.value) return
        batchedSyncNodes(undefined, { force: true })
    })

    // TASK-1158: Watch bridge refs for cross-store sync (breaks circular dependency)
    // canvasSyncTrigger is incremented by tasks.ts when relevant task changes come from sync
    watch(canvasSyncTrigger, () => {
        if (!isInitialized.value) return
        batchedSyncNodes()
        batchedSyncEdges()
    })
    // canvasUiSyncRequest is incremented by taskOperations.ts after task create/delete
    watch(canvasUiSyncRequest, () => {
        if (!isInitialized.value) return
        traceCanvasDone('watcher:canvasUiSyncRequest')
        batchedSyncNodes(undefined, { force: true })
    })

    // Global guard to prevent recursive watcher triggers
    let isSyncingFromWatcher = false

    // CRITICAL FIX: Watch for task data changes (e.g. after async load)
    // BUG-1210: Watch task IDs, not just length — smart view switches swap which tasks
    // are visible without necessarily changing the count
    watch(() => tasksWithCanvasPosition.value.map(t => t.id).join(','), () => {
        // Skip during initialization - onMounted handles initial sync
        if (!isInitialized.value) return
        if (isSyncingFromWatcher) return
        traceCanvasDone('watcher:taskIds', {
            taskSignature: tasksWithCanvasPosition.value.map(t => `${t.id}:${t.status}:${t.parentId ?? 'root'}:${t.canvasPosition?.x ?? ''},${t.canvasPosition?.y ?? ''}`).join('|')
        })
        isSyncingFromWatcher = true
        try {
            if (persistence.isSyncing.value) return
            if (import.meta.env.DEV && zoomPerfActive) logZoomPerf('watcher:taskIds', viewport.value?.zoom ?? 1, `${tasksWithCanvasPosition.value.length} tasks`)
            canvasStore.recalculateAllTaskCounts(taskStore.tasks)
            batchedSyncNodes()
            batchedSyncEdges() // Also sync edges when tasks change
        } finally {
            isSyncingFromWatcher = false
        }
    })

    watch(() => tasksWithCanvasPosition.value.map(t => `${t.id}:${t.status}:${t.parentId ?? 'root'}:${t.canvasPosition?.x ?? ''},${t.canvasPosition?.y ?? ''}`).join('|'), () => {
        if (!isInitialized.value) return
        traceCanvasDone('watcher:taskGeometryStatusSignature', {
            taskSignature: tasksWithCanvasPosition.value.map(t => `${t.id}:${t.status}:${t.parentId ?? 'root'}:${t.canvasPosition?.x ?? ''},${t.canvasPosition?.y ?? ''}`).join('|')
        })
    })

    // CRITICAL FIX: Watch for group changes (e.g. creation/deletion/remote sync)
    watch(() => canvasStore.groups.length, () => {
        // Skip during initialization - onMounted handles initial sync
        if (!isInitialized.value) return
        if (isSyncingFromWatcher) return
        isSyncingFromWatcher = true
        try {
            if (persistence.isSyncing.value) return
            if (import.meta.env.DEV && zoomPerfActive) logZoomPerf('watcher:groups.length', viewport.value?.zoom ?? 1)
            canvasStore.recalculateAllTaskCounts(taskStore.tasks)
            batchedSyncNodes()
        } finally {
            isSyncingFromWatcher = false
        }
    })

    // Collapse fix: re-sync when any group's collapsed state flips. updateGroup
    // does not bump syncTrigger and the groups watcher above only fires on
    // length change, so without this a collapse/expand never refreshes node data
    // (child task/group nodes would never hide). Mirrors the task-signature
    // watcher pattern above.
    watch(() => canvasStore.groups.map(g => `${g.id}:${g.isCollapsed ? 1 : 0}`).join('|'), () => {
        if (!isInitialized.value) return
        if (isSyncingFromWatcher) return
        isSyncingFromWatcher = true
        try {
            if (persistence.isSyncing.value) return
            batchedSyncNodes()
        } finally {
            isSyncingFromWatcher = false
        }
    })

    // TASK-1690: Watch for canvas image additions/removals to inject imageNode nodes
    watch(() => canvasImagesStore.images.length, () => {
        if (!isInitialized.value) return
        batchedSyncNodes(undefined, { force: true })
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
        // TASK-1756: exposed so CanvasView can gate day-group catchup on real
        // Vue Flow pane readiness (findNode returns undefined before this flips).
        isVueFlowReady,
        isVueFlowMounted,
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
        filteredTasks: canvasSourceTasks,
        tasksWithCanvasPosition,
        dynamicNodeExtent,
        hasNoTasks,
        hasInboxTasks,

        // Actions & Handlers
        ...actions,
        createTaskHere, // Override to use stored context menu position
        createTaskInGroup, // Override to use stored context menu position (TASK-288 fix)
        createGroup, // Override to use stored context menu position (BUG-1126 fix)
        ...modals,
        closeSectionSettingsModal: actions.closeGroupEditModal,
        handleSectionSettingsSave: actions.handleGroupEditSave,

        ...events,

        // Selection Handlers
        handleMouseDown: selection.startSelection,
        handleMouseMove: selection.updateSelection,
        handleMouseUp: selection.endSelection,
        handleCanvasContainerClick,

        // New feature re-exports
        ...selection,
        ...interactions,
        ...alignment,
        ...smartGroups,
        collectTasksForSection,
        collectOverdueTasksNearGroup,
        applyGroupPropsToTasks,
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

            // BUG-1902: the saved viewport may have finished loading before the
            // pane existed — apply it now that setViewport can take effect.
            applySavedViewportOnce()

            // BUG-1310: Log nodeExtent at VueFlow init for invisible barrier diagnosis
            if (import.meta.env.DEV) {
                const extent = dynamicNodeExtent.value
                console.log('[BUG-1310:INIT] VueFlow pane ready — dynamicNodeExtent:', {
                    extent: extent ? { minX: Math.round(extent[0][0]), minY: Math.round(extent[0][1]), maxX: Math.round(extent[1][0]), maxY: Math.round(extent[1][1]) } : 'null',
                    nodeCount: nodes.value?.length ?? 0,
                    tasksWithPos: tasksWithCanvasPosition.value?.length ?? 0
                })
            }
        },
        fitCanvas,
        zoomToSelection,
        retryFailedOperation,

        // Vue Flow Handlers
        // TASK-262: Filter selection changes to prevent unwanted deselection on node click
        // Vue Flow default: clicking a node deselects all others. We only want pane click to deselect.
        handleNodesChange: (changes: import('@vue-flow/core').NodeChange[]) => {
            // TASK-262 FIX: Allow all changes to pass through including deselection
            // TASK-1722: Filter out remove changes for image nodes (deletable:false safety net)
            // Our handleKeyDown in useCanvasHotkeys owns image deletion with undo support
            const filtered = (changes as Array<{ type: string; id?: string }>).filter(c => {
                if (c.type === 'remove' && c.id?.startsWith('img-')) return false
                return true
            })
            const nextNodes = applyNodeChanges(filtered as import('@vue-flow/core').NodeChange[])
            if (Array.isArray(nextNodes)) {
                nodes.value = [...nextNodes]
            }
        },
        handleEdgesChange: applyEdgeChanges,
        handleConnect: (params: import('@vue-flow/core').Connection) => {
            connections.handleConnect(params)
        },
        handleConnectStart: connections.handleConnectStart,
        handleConnectEnd: connections.handleConnectEnd,

        // Coordinate conversion (for external callers like sidebar quick-add)
        screenToFlowCoordinate,

        // Debug
        syncNodes,
        syncEdges,
        performSystemRestart: () => window.location.reload(), // Simple fallback
        storeHealth: lifecycle.storeHealth,

        // Hotkeys
        handleKeyDown,

        // TASK-241: State Machine Debug
        operationState: opState,
        getOperationDebug: getOpDebugInfo
    }
}
