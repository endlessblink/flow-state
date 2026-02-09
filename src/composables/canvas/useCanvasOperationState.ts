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

// Queue for updates that arrive during settling state
const pendingUpdates = ref<Array<() => void>>([])

/**
 * State machine for canvas operations.
 * Replaces ad-hoc lock flags with formal transitions.
 */
export function useCanvasOperationState() {

    // --- Transitions ---

    const startDrag = (nodeIds: string[]) => {
        if (state.value.type !== 'idle') return false
        state.value = { type: 'dragging', nodeIds }
        return true
    }

    const endDrag = (nodeIds: string[]) => {
        if (state.value.type !== 'dragging') return

        // Clear previous timeout if any
        if ('settleTimeout' in state.value) {
            window.clearTimeout(state.value.settleTimeout as any)
        }

        // BUG-1209: Set window flag so realtime handlers block during settling
        if (typeof window !== 'undefined') {
            ;(window as any).__FlowStateIsSettling = true
        }

        const settleTimeout = window.setTimeout(() => {
            if (state.value.type === 'drag-settling') {
                state.value = { type: 'idle' }
                // BUG-1209: Clear settling flag when returning to idle
                if (typeof window !== 'undefined') {
                    ;(window as any).__FlowStateIsSettling = false
                }
                // Process any queued updates after settling completes
                const updates = [...pendingUpdates.value]
                pendingUpdates.value = []
                updates.forEach(update => update())
            }
        }, 800)

        state.value = { type: 'drag-settling', nodeIds, settleTimeout }
    }

    const startResize = (groupId: string, handle: string) => {
        if (state.value.type !== 'idle') return false
        state.value = { type: 'resizing', groupId, handle }
        return true
    }

    const endResize = (groupId: string) => {
        if (state.value.type !== 'resizing') return

        // BUG-1209: Set window flag so realtime handlers block during settling
        if (typeof window !== 'undefined') {
            ;(window as any).__FlowStateIsSettling = true
        }

        const settleTimeout = window.setTimeout(() => {
            if (state.value.type === 'resize-settling') {
                state.value = { type: 'idle' }
                // BUG-1209: Clear settling flag when returning to idle
                if (typeof window !== 'undefined') {
                    ;(window as any).__FlowStateIsSettling = false
                }
                // Process any queued updates after settling completes
                const updates = [...pendingUpdates.value]
                pendingUpdates.value = []
                updates.forEach(update => update())
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

    const resetToIdle = () => {
        if ('settleTimeout' in state.value) {
            window.clearTimeout(state.value.settleTimeout as any)
        }
        // BUG-1209: Clear settling flag on any reset
        if (typeof window !== 'undefined') {
            ;(window as any).__FlowStateIsSettling = false
        }
        state.value = { type: 'idle' }
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
    const queueUpdate = (updateFn: () => void) => {
        pendingUpdates.value.push(updateFn)
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
            const w = window as any
            if (w.__FlowStateIsDragging || w.__FlowStateIsResizing || w.__FlowStateIsSettling) return true
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
        getDebugInfo
    }
}
