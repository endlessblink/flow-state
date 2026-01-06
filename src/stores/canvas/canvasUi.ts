import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'

export const useCanvasUiStore = defineStore('canvasUi', () => {
    const db = useSupabaseDatabase()

    // Viewport state
    const viewport = ref({
        x: 0,
        y: 0,
        zoom: 1
    })

    // Group display state
    const activeGroupId = ref<string | null>(null)
    const showGroupGuides = ref(true)
    const snapToGroups = ref(true)

    // Sync trigger for external components
    const syncTrigger = ref(0)
    const requestSync = () => {
        syncTrigger.value++
    }

    // Node display preferences
    const showPriorityIndicator = ref(true)
    const showStatusBadge = ref(true)
    const showDurationBadge = ref(true)
    const showScheduleBadge = ref(true)

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
                await db.saveUserSettings({
                    ...settings,
                    canvas_viewport: newViewport
                })
                console.log('🔭 [canvasUi] Viewport saved to cloud:', newViewport)
            } catch (error) {
                console.error('❌ Viewport save failed:', error)
            }
        }, 2000) // Debounce heavily for viewport
    }, { deep: true })

    const loadSavedViewport = async (): Promise<boolean> => {
        try {
            const savedViewport = await db.load<{ x: number; y: number; zoom: number }>(DB_KEYS.CANVAS_VIEWPORT)
            if (savedViewport && typeof savedViewport.x === 'number') {
                viewport.value = savedViewport
                console.log('🔭 [canvasUi] Viewport restored:', savedViewport)
                return true
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
        requestSync,
        setViewport,
        saveZoomToHistory,
        setViewportWithHistory,
        updateZoomConfig,
        setActiveGroup,
        togglePriorityIndicator,
        toggleStatusBadge,
        toggleDurationBadge,
        toggleScheduleBadge,
        loadSavedViewport
    }
})
