import { defineStore } from 'pinia'
import { ref } from 'vue'
import { usePersistentRef } from '@/composables/usePersistentRef'
import { STORAGE_KEYS } from '@/constants/storageKeys'

export const useCanvasUiStore = defineStore('canvasUi', () => {
    // Viewport state is owned by canvasViewport.ts / canvas.ts (TASK-1579: single source of truth)
    // Do NOT add a separate viewport ref here.

    // Track if initial viewport fit has been performed this session
    // Persisted to localStorage to survive navigation (but not full page refresh)
    const hasInitialFit = ref(false)
    const viewportInitializedAt = ref<number | null>(null)

    // Initialize hasInitialFit from localStorage on store creation
    const initHasInitialFit = () => {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.CANVAS_HAS_INITIAL_FIT)
            if (saved) {
                const parsed = JSON.parse(saved)
                // Only restore if within 5 minutes (session still active)
                const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
                if (parsed.value && parsed.timestamp > fiveMinutesAgo) {
                    hasInitialFit.value = true
                    viewportInitializedAt.value = parsed.timestamp
                }
            }
        } catch (e) {
            console.warn('[canvasUi] Failed to parse hasInitialFit:', e)
        }
    }

    // Call on store creation
    initHasInitialFit()

    // Group display state
    const activeGroupId = ref<string | null>(null)
    // Persist canvas preferences across restarts via localStorage.
    const showGroupGuides = usePersistentRef<boolean>('flowstate:canvas-group-guides', true)
    const snapToGroups = usePersistentRef<boolean>('flowstate:canvas-snap-groups', true)

    // Sync trigger for external components
    const syncTrigger = ref(0)

    // ==========================================================================
    // DRIFT FIX: Gated sync trigger to prevent feedback loops
    // ==========================================================================
    // ALLOWED sources (user actions):
    //   'user:drag-drop', 'user:create', 'user:delete', 'user:undo', 'user:redo',
    //   'user:resize', 'user:connect', 'user:context-menu'
    // BLOCKED sources (automated):
    //   'smart-group', 'watcher', 'reconcile', 'auto'
    // ==========================================================================
    const USER_ACTION_SOURCES = [
        'user:drag-drop',
        'user:create',
        'user:delete',
        'user:undo',
        'user:redo',
        'user:resize',
        'user:connect',
        'user:context-menu',
        'user:manual'
    ] as const

    type SyncSource = typeof USER_ACTION_SOURCES[number] | 'smart-group' | 'watcher' | 'reconcile' | 'auto' | 'unknown'

    /**
     * Request a canvas sync. Only user-action sources will trigger a sync.
     * Automated sources are logged but ignored to prevent feedback loops.
     *
     * @param source - The source of the sync request (e.g., 'user:drag-drop')
     */
    const requestSync = (source: SyncSource = 'unknown') => {
        const isUserAction = USER_ACTION_SOURCES.includes(source as typeof USER_ACTION_SOURCES[number])

        if (isUserAction) {
            console.log(`🔄 [SYNC-TRIGGER] Accepted from ${source}`)
            syncTrigger.value++
        } else {
            console.log(`⏭️ [SYNC-TRIGGER] Blocked from ${source} (not a user action)`)
        }
    }

    /**
     * Legacy sync request - BLOCKED to prevent sync loops.
     * Use requestSync(source) with explicit user-action source instead.
     * @deprecated Use requestSync(source) instead
     */
    const requestSyncLegacy = () => {
        // DRIFT FIX: BLOCKED - legacy calls without source were causing sync loops
        // All sync requests must now use requestSync(source) with an explicit user-action source
        console.warn('⛔ [SYNC-TRIGGER] Legacy requestSync BLOCKED - use requestSync(source) with explicit user-action source')
        // syncTrigger.value++ // REMOVED - no longer allowed
    }

    // Node display preferences.
    const showPriorityIndicator = usePersistentRef<boolean>('flowstate:canvas-show-priority', true)
    const showStatusBadge = usePersistentRef<boolean>('flowstate:canvas-show-status', true)
    const showDurationBadge = usePersistentRef<boolean>('flowstate:canvas-show-duration', true)
    const showScheduleBadge = usePersistentRef<boolean>('flowstate:canvas-show-schedule', true)

    const updateZoomConfig = (_config: Record<string, unknown>) => {
        // Zoom config is owned by canvasViewport.ts (TASK-1579)
        // This stub is kept for backwards-compat if any caller still imports it
    }

    const setActiveGroup = (id: string | null) => {
        activeGroupId.value = id
    }

    // Set hasInitialFit and persist to localStorage
    const setHasInitialFit = (value: boolean) => {
        hasInitialFit.value = value
        viewportInitializedAt.value = value ? Date.now() : null
        const fitData = { value, timestamp: Date.now() }
        localStorage.setItem(STORAGE_KEYS.CANVAS_HAS_INITIAL_FIT, JSON.stringify(fitData))
    }

    // Reset hasInitialFit (for testing or when user requests re-center)
    const resetHasInitialFit = () => {
        hasInitialFit.value = false
        viewportInitializedAt.value = null
        localStorage.removeItem(STORAGE_KEYS.CANVAS_HAS_INITIAL_FIT)
    }

    // Display preference toggles
    const togglePriorityIndicator = () => {
        showPriorityIndicator.value = !showPriorityIndicator.value
    }

    const toggleStatusBadge = () => {
        showStatusBadge.value = !showStatusBadge.value
    }

    const toggleDurationBadge = () => {
        showDurationBadge.value = !showDurationBadge.value
    }

    const toggleScheduleBadge = () => {
        showScheduleBadge.value = !showScheduleBadge.value
    }

    // Operation State
    const operationLoading = ref({
        saving: false,
        loading: false,
        syncing: false,
        creating: false,
        updating: false,
        deleting: false
    })

    const operationError = ref<{
        type: string
        message: string
        retryable: boolean
    } | null>(null)

    const setOperationLoading = (operation: string, loading: boolean) => {
        if (operation in operationLoading.value) {
            operationLoading.value[operation as keyof typeof operationLoading.value] = loading
            if (loading) {
                operationError.value = null
            }
        }
    }

    const setOperationError = (type: string, message: string, retryable: boolean = false) => {
        operationError.value = { type, message, retryable }
        Object.keys(operationLoading.value).forEach(key => {
            operationLoading.value[key as keyof typeof operationLoading.value] = false
        })
    }

    const clearOperationError = () => {
        operationError.value = null
    }

    return {
        activeGroupId,
        showGroupGuides,
        snapToGroups,
        syncTrigger,
        showPriorityIndicator,
        showStatusBadge,
        showDurationBadge,
        showScheduleBadge,
        hasInitialFit,
        viewportInitializedAt,
        requestSync,
        requestSyncLegacy,
        updateZoomConfig,
        setActiveGroup,
        setHasInitialFit,
        resetHasInitialFit,
        togglePriorityIndicator,
        toggleStatusBadge,
        toggleDurationBadge,
        toggleScheduleBadge,
        // Operation State
        operationLoading,
        operationError,
        setOperationLoading,
        setOperationError,
        clearOperationError
    }
})
