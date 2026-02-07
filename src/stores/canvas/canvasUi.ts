import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useStorage } from '@vueuse/core'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'

export const useCanvasUiStore = defineStore('canvasUi', () => {
    const db = useSupabaseDatabase()

    // Viewport state
    const viewport = ref({
        x: 0,
        y: 0,
        zoom: 1
    })

    // Track if initial viewport fit has been performed this session
    // Persisted to localStorage to survive navigation (but not full page refresh)
    const hasInitialFit = ref(false)
    const viewportInitializedAt = ref<number | null>(null)

    // Initialize hasInitialFit from localStorage on store creation
    const initHasInitialFit = () => {
        try {
            const saved = localStorage.getItem('flowstate-canvas-has-initial-fit')
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
    // TASK-1215: Persist canvas preferences across restarts
    const showGroupGuides = useStorage<boolean>('flowstate:canvas-group-guides', true)
    const snapToGroups = useStorage<boolean>('flowstate:canvas-snap-groups', true)

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

    // Node display preferences (TASK-1215: Persist across restarts)
    const showPriorityIndicator = useStorage<boolean>('flowstate:canvas-show-priority', true)
    const showStatusBadge = useStorage<boolean>('flowstate:canvas-show-status', true)
    const showDurationBadge = useStorage<boolean>('flowstate:canvas-show-duration', true)
    const showScheduleBadge = useStorage<boolean>('flowstate:canvas-show-schedule', true)

    // Zoom configuration
    const zoomConfig = ref({
        minZoom: 0.05,
        maxZoom: 4.0,
        fitToContentPadding: 0.15,
        zoomStep: 0.1,
        wheelSensitivity: 1.0,
        invertWheel: false,
        wheelZoomMode: 'zoom' as 'zoom' | 'pan'
    })

    // Zoom history
    const zoomHistory = ref<Array<{ zoom: number, timestamp: number }>>([])
    const maxZoomHistory = 50

    // Actions
    const setViewport = (x: number, y: number, zoom: number) => {
        viewport.value = { x, y, zoom }
    }

    const saveZoomToHistory = (zoom: number) => {
        const entry = { zoom, timestamp: Date.now() }
        zoomHistory.value.push(entry)
        if (zoomHistory.value.length > maxZoomHistory) {
            zoomHistory.value.shift()
        }
    }

    const setViewportWithHistory = (x: number, y: number, zoom: number) => {
        saveZoomToHistory(zoom)
        setViewport(x, y, zoom)
    }

    const updateZoomConfig = (config: Partial<typeof zoomConfig.value>) => {
        zoomConfig.value = { ...zoomConfig.value, ...config }
    }

    const setActiveGroup = (id: string | null) => {
        activeGroupId.value = id
    }

    // Set hasInitialFit and persist to localStorage
    const setHasInitialFit = (value: boolean) => {
        hasInitialFit.value = value
        viewportInitializedAt.value = value ? Date.now() : null
        localStorage.setItem('flowstate-canvas-has-initial-fit', JSON.stringify({
            value,
            timestamp: Date.now()
        }))
    }

    // Reset hasInitialFit (for testing or when user requests re-center)
    const resetHasInitialFit = () => {
        hasInitialFit.value = false
        viewportInitializedAt.value = null
        localStorage.removeItem('flowstate-canvas-has-initial-fit')
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

    // Persistence via User Settings in Supabase
    let viewportSaveTimer: ReturnType<typeof setTimeout> | null = null
    watch(viewport, (newViewport) => {
        if (viewportSaveTimer) clearTimeout(viewportSaveTimer)
        viewportSaveTimer = setTimeout(async () => {
            try {
                // Save to local storage for immediate recovery
                localStorage.setItem('canvas-viewport', JSON.stringify(newViewport))

                // Also save to Supabase User Settings for cloud persistence
                const settings = await db.fetchUserSettings()
                if (settings) {
                    await db.saveUserSettings({
                        ...settings,
                        canvasViewport: newViewport
                    })
                    console.log('🔭 [canvasUi] Viewport saved to cloud:', newViewport)
                }
            } catch (error) {
                console.error('❌ Viewport save failed:', error)
            }
        }, 2000) // Debounce heavily for viewport
    }, { deep: true })

    const loadSavedViewport = async (): Promise<boolean> => {
        try {
            // Try loading from Supabase user settings
            const settings = await db.fetchUserSettings()
            const savedViewport = settings?.canvasViewport as { x: number; y: number; zoom: number } | undefined

            if (savedViewport && typeof savedViewport.x === 'number') {
                viewport.value = savedViewport
                console.log('🔭 [canvasUi] Viewport restored from cloud:', savedViewport)
                return true
            }

            // Fallback to local storage (handled by caller or component mount usually, but here for completeness if needed)
            const local = localStorage.getItem('canvas-viewport')
            if (local) {
                const parsed = JSON.parse(local)
                if (parsed && typeof parsed.x === 'number') {
                    viewport.value = parsed
                    console.log('🔭 [canvasUi] Viewport restored from local storage:', parsed)
                    return true
                }
            }
        } catch (error) {
            console.warn('⚠️ Failed to load saved viewport:', error)
        }
        return false
    }

    return {
        viewport,
        activeGroupId,
        showGroupGuides,
        snapToGroups,
        syncTrigger,
        showPriorityIndicator,
        showStatusBadge,
        showDurationBadge,
        showScheduleBadge,
        zoomConfig,
        zoomHistory,
        hasInitialFit,
        viewportInitializedAt,
        requestSync,
        requestSyncLegacy,
        setViewport,
        saveZoomToHistory,
        setViewportWithHistory,
        updateZoomConfig,
        setActiveGroup,
        setHasInitialFit,
        resetHasInitialFit,
        togglePriorityIndicator,
        toggleStatusBadge,
        toggleDurationBadge,
        toggleScheduleBadge,
        loadSavedViewport,
        // Operation State
        operationLoading,
        operationError,
        setOperationLoading,
        setOperationError,
        clearOperationError
    }
})
