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
import { reconcileTaskParentsByContainment } from '@/utils/canvas/spatialContainment'
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
    const filteredTasks = computed(() => taskStore.filteredTasks)

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
    } = useCanvasFilteredState(filteredTasks, canvasStoreWithTaskStore)

    // --- 3. Feature Initialization ---

    // Persistence (Sync)
    // const persistence = useCanvasPersistence()

    // Persistence (Sync)
    const persistence = useCanvasSync()

    // Unified Interactions (Drag & Resize)
    const { canAcceptRemoteUpdate, currentType: opCurrentType, state: opState, getDebugInfo: getOpDebugInfo } = useCanvasOperationState()

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
        // Prevent sync if explicitly unwanted (e.g. during specific interactions)
        if (canvasUiStore.operationLoading.syncing) {
            return
        }

        // TASK-241: State Machine Guard
        // Block READ-PATH syncs if user is interacting (dragging/resizing)
        // unless forced by explicit user action (e.g., inbox drop)
        if (!options?.force && !canAcceptRemoteUpdate.value) {
            if (import.meta.env.DEV) {
                console.log(`[BUG-1492:ORCH] syncNodes BLOCKED`, { canAcceptRemoteUpdate: canAcceptRemoteUpdate.value, opState: opCurrentType.value })
            }
            return
        }

        if (import.meta.env.DEV) {
            console.log(`[BUG-1492:ORCH] syncNodes ALLOWED`, { force: options?.force, canAcceptRemoteUpdate: canAcceptRemoteUpdate.value, opState: opCurrentType.value })
        }

        try {
            const t0 = performance.now()
            const tasksToSync = tasks || tasksWithCanvasPosition.value
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

                    // CONTAINMENT RECONCILIATION: Fix legacy tasks with incorrect parentId
                    // DRIFT FIX: Only run ONCE per browser session to prevent repeated parent changes
                    // This guards against remounts from: tab focus, auth refresh, route changes
                    // BUG-1084 FIX: Also guard against empty groups - reconciliation needs groups to determine containment
                    // RACE FIX: Moved from onMounted into init watcher so reconciliation runs AFTER
                    // both stores are fully loaded — prevents incorrect parentId from partial task data
                    if (!hasReconciledThisSession && canvasStore.groups.length > 0) {
                        hasReconciledThisSession = true
                        if (import.meta.env.DEV) {
                            console.log('🔧 [ORCHESTRATOR] Starting ONE-TIME reconciliation with', taskStore.tasks.length, 'tasks')
                        }
                        await reconcileTaskParentsByContainment(
                            taskStore.tasks,
                            canvasStore.groups,
                            async (taskId, updates) => {
                                // Update store (will auto-sync to Supabase via existing persistence)
                                // GEOMETRY WRITER: One-time reconciliation only (TASK-255)
                                if (import.meta.env.DEV) {
                                    console.log(`🔧[RECONCILE-WRITE] Task ${taskId.slice(0, 8)}... parentId → ${updates.parentId ?? 'none'}`)
                                }
                                taskStore.updateTask(taskId, updates, 'RECONCILE')
                            },
                            { writeToDb: true, silent: false }
                        )
                    } else if (hasReconciledThisSession) {
                        if (import.meta.env.DEV) {
                            console.log('⏭️ [ORCHESTRATOR] Skipping reconciliation - already ran this session')
                        }
                    }

                    // Auto-place disabled: tasks should only appear on canvas via explicit user action
                    // (context menu "Canvas Group", due-date auto-routing, or drag-and-drop)
                    // Previously: autoPlaceEligibleTasks() ran here on every app load

                    // Calculate initial task counts AFTER reconciliation (fixes 0 counters on load)
                    canvasStore.recalculateAllTaskCounts(taskStore.tasks)

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
                if (stopInitWatcher) stopInitWatcher()
            }
        }, 2000)

        // TASK-299: Auto-center on Today group after nodes are rendered
        // Use setTimeout to allow Vue Flow to calculate node dimensions
        setTimeout(() => {
            // Check if user has a custom saved viewport (not default 0,0,1)
            const vp = canvasStore.viewport
            const hasCustomViewport = vp && (vp.x !== 0 || vp.y !== 0 || vp.zoom !== 1)

            // If no custom viewport (first visit), force fallback to busiest group
            // If has custom viewport, only override if Today group exists
            const forceFallback = !hasCustomViewport
            const centered = centerOnTodayGroup(forceFallback)
            if (import.meta.env.DEV) {
                console.log('🎯 [ORCHESTRATOR] Auto-center result:', centered ? 'SUCCESS' : 'USING_SAVED_VIEWPORT', { hasCustomViewport })
            }
        }, 100)

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
        filteredTasks,
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
