import { ref, computed } from 'vue'
import { DRAG_SETTLE_TIMEOUT_MS } from '@/config/timing'

export type CanvasOperationType =
    | 'idle'
    | 'dragging'
    | 'drag-settling'
    | 'resizing'
    | 'resize-settling'
    | 'syncing'
    | 'editing'

export interface Position {
    x: number
    y: number
}

export type CanvasOperationState =
    | { type: 'idle' }
    | { type: 'dragging'; nodeIds: string[] }
    | { type: 'drag-settling'; nodeIds: string[]; settleTimeout: number }
    | { type: 'resizing'; groupId: string; handle: string }
    | { type: 'resize-settling'; groupId: string; settleTimeout: number }
    | { type: 'syncing'; source: 'local' | 'remote' }
    | { type: 'editing'; nodeId: string }

// Singleton state to be shared across all canvas composables
const state = ref<CanvasOperationState>({ type: 'idle' })

type PendingUpdate = {
    key?: string
    owner?: symbol
    retainOnInteractionRestart?: boolean
    run: () => void
}

type QueueUpdateOptions = {
    key?: string
    owner?: symbol
    retainOnInteractionRestart?: boolean
}

type ResetToIdleOptions = {
    flushPending?: boolean
}

// Queue for updates that arrive while local interaction guards are active.
// Keyed work is replaced in place so repeated Realtime events reconcile once
// from the latest store state after the guard clears.
const pendingUpdates = ref<PendingUpdate[]>([])

const flushPendingUpdates = () => {
    const updates = [...pendingUpdates.value]
    pendingUpdates.value = []
    updates.forEach(update => update.run())
}

/**
 * State machine for canvas operations.
 * Replaces ad-hoc lock flags with formal transitions.
 */
export function useCanvasOperationState() {

    // --- Transitions ---

    const startDrag = (nodeIds: string[]) => {
        if (import.meta.env.DEV) {
            console.log(`[BUG-1492:STATE] startDrag from="${state.value.type}"`, { nodeIds: nodeIds.map(id => id.slice(0, 8)) })
        }
        // BUG-1328: Allow starting a new drag from 'drag-settling' state.
        // Without this, rapid consecutive drags (within 3s settling window) leave
        // canvasStore.isDragging=false, so realtime events bypass all guards and
        // overwrite node positions mid-drag → cursor drift "after a while".
        if (state.value.type === 'drag-settling') {
            // Cancel the old settling timeout before starting new drag
            if ('settleTimeout' in state.value) {
                window.clearTimeout(state.value.settleTimeout as number)
            }
            // BUG-1492: Discard interaction-local closures from drag A, but retain
            // authoritative projection catch-up work that reads latest store state.
            // Otherwise a second drag can permanently drop a remote update that
            // arrived during drag A's settling window.
            pendingUpdates.value = pendingUpdates.value.filter(
                update => update.retainOnInteractionRestart
            )
            state.value = { type: 'dragging', nodeIds }
            return true
        }
        if (state.value.type !== 'idle') return false
        state.value = { type: 'dragging', nodeIds }
        return true
    }

    const endDrag = (nodeIds: string[]) => {
        if (import.meta.env.DEV) {
            console.log(`[BUG-1492:STATE] endDrag from="${state.value.type}"`, { nodeIds: nodeIds.map(id => id.slice(0, 8)) })
        }
        if (state.value.type !== 'dragging') return

        // Clear previous timeout if any
        if ('settleTimeout' in state.value) {
            window.clearTimeout(state.value.settleTimeout as number)
        }

        // BUG-1209: Set window flag so realtime handlers block during settling
        if (typeof window !== 'undefined') {
            window.__FlowStateIsSettling = true
        }

        // TASK-1289: Use DRAG_SETTLE_TIMEOUT_MS (3000ms) instead of 800ms to match
        // the pendingWrite guard. The previous 800ms left a 2.2s gap where realtime
        // echo could trigger syncStoreToCanvas with stale positions.
        const settleTimeout = window.setTimeout(() => {
            if (import.meta.env.DEV) {
                console.log(`[BUG-1492:STATE] settle-timeout fired, current="${state.value.type}"`, {
                    pendingUpdatesCount: pendingUpdates.value.length
                })
            }
            if (state.value.type === 'drag-settling') {
                state.value = { type: 'idle' }
                // BUG-1209: Clear settling flag when returning to idle
                if (typeof window !== 'undefined') {
                    window.__FlowStateIsSettling = false
                }
                // Process any queued updates after settling completes
                flushPendingUpdates()
            }
        }, DRAG_SETTLE_TIMEOUT_MS)

        state.value = { type: 'drag-settling', nodeIds, settleTimeout }
    }

    const startResize = (groupId: string, handle: string) => {
        // BUG-1328: Same fix as startDrag — allow from settling states
        if (state.value.type === 'drag-settling' || state.value.type === 'resize-settling') {
            if ('settleTimeout' in state.value) {
                window.clearTimeout(state.value.settleTimeout as number)
            }
            state.value = { type: 'resizing', groupId, handle }
            return true
        }
        if (state.value.type !== 'idle') return false
        state.value = { type: 'resizing', groupId, handle }
        return true
    }

    const endResize = (groupId: string) => {
        if (state.value.type !== 'resizing') return

        // BUG-1209: Set window flag so realtime handlers block during settling
        if (typeof window !== 'undefined') {
            window.__FlowStateIsSettling = true
        }

        const settleTimeout = window.setTimeout(() => {
            if (state.value.type === 'resize-settling') {
                state.value = { type: 'idle' }
                // BUG-1209: Clear settling flag when returning to idle
                if (typeof window !== 'undefined') {
                    window.__FlowStateIsSettling = false
                }
                // Process any queued updates after settling completes
                flushPendingUpdates()
            }
        }, 800)

        state.value = { type: 'resize-settling', groupId, settleTimeout }
    }

    const setSyncing = (source: 'local' | 'remote') => {
        // Can only sync if idle or already syncing
        if (state.value.type !== 'idle' && state.value.type !== 'syncing') return false
        state.value = { type: 'syncing', source }
        return true
    }

    const setEditing = (nodeId: string) => {
        if (state.value.type !== 'idle') return false
        state.value = { type: 'editing', nodeId }
        return true
    }

    const resetToIdle = (options: ResetToIdleOptions = {}) => {
        if ('settleTimeout' in state.value) {
            window.clearTimeout(state.value.settleTimeout as number)
        }
        // BUG-1209: Clear settling flag on any reset
        if (typeof window !== 'undefined') {
            window.__FlowStateIsSettling = false
        }
        state.value = { type: 'idle' }
        if (options.flushPending === false) {
            pendingUpdates.value = []
        } else {
            flushPendingUpdates()
        }
    }

    // --- Guards/Selectors ---

    const currentType = computed(() => state.value.type)

    const isIdle = computed(() => state.value.type === 'idle')
    const isDragging = computed(() => state.value.type === 'dragging')
    const isResizing = computed(() => state.value.type === 'resizing')
    const isSyncing = computed(() => state.value.type === 'syncing')

    /**
     * Whether remote updates should be blocked due to ongoing local interaction.
     */
    const isLocked = computed(() => {
        return state.value.type !== 'idle' && state.value.type !== 'syncing'
    })

    /**
     * Specific guard for sync updates.
     */
    const canAcceptRemoteUpdate = computed(() => {
        return state.value.type === 'idle' || state.value.type === 'syncing'
    })

    const canStartOperation = computed(() => state.value.type === 'idle')

    /**
     * Is canvas in a settling state? (just finished interaction)
     */
    const isSettling = computed(() => {
        return state.value.type === 'drag-settling' || state.value.type === 'resize-settling'
    })

    /**
     * Should we block ALL updates? (interacting or settling)
     */
    const shouldBlockUpdates = computed(() => {
        return isLocked.value || isSettling.value
    })

    /**
     * Queue an update to be processed after settling completes
     */
    const queueUpdate = (updateFn: () => void, options: QueueUpdateOptions = {}) => {
        if (options.key) {
            const existingIndex = pendingUpdates.value.findIndex(
                update => update.key === options.key && update.owner === options.owner
            )
            if (existingIndex >= 0) {
                pendingUpdates.value[existingIndex] = { ...options, run: updateFn }
                return
            }
        }
        pendingUpdates.value.push({ ...options, run: updateFn })
    }

    const cancelQueuedUpdates = (owner: symbol) => {
        pendingUpdates.value = pendingUpdates.value.filter(update => update.owner !== owner)
    }

    /**
     * BUG-1209: Unified guard that checks ALL position modification locks.
     * Use this single function instead of checking individual flags separately.
     * Returns true if positions should NOT be modified by remote/sync operations.
     */
    const isPositionModificationBlocked = computed(() => {
        // State machine checks (dragging, settling, resizing, editing)
        if (shouldBlockUpdates.value) return true
        // Window-level flags (set by other subsystems)
        if (typeof window !== 'undefined') {
            if (window.__FlowStateIsDragging || window.__FlowStateIsResizing || window.__FlowStateIsSettling) return true
        }
        return false
    })

    /**
     * Get debug info for troubleshooting
     */
    const getDebugInfo = () => ({
        type: state.value.type,
        canAcceptRemoteUpdate: canAcceptRemoteUpdate.value,
        isLocked: isLocked.value,
        isSettling: isSettling.value,
        pendingUpdatesCount: pendingUpdates.value.length,
        fullState: state.value
    })

    return {
        state,
        currentType,
        isIdle,
        isDragging,
        isResizing,
        isSyncing,
        isLocked,
        canAcceptRemoteUpdate,
        canStartOperation,
        startDrag,
        endDrag,
        startResize,
        endResize,
        setSyncing,
        setEditing,
        resetToIdle,
        isSettling,
        shouldBlockUpdates,
        isPositionModificationBlocked,
        queueUpdate,
        cancelQueuedUpdates,
        getDebugInfo
    }
}
