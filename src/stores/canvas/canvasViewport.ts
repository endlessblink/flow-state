import { ref } from 'vue'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import { STORAGE_KEYS } from '@/constants/storageKeys'

export const useCanvasViewport = (initialViewport = { x: 0, y: 0, zoom: 1 }) => {
    const viewport = ref(initialViewport)
    const zoomConfig = ref({ minZoom: 0.1, maxZoom: 4.0 })

    // TASK-1579: Debounced Supabase write — single source of truth for viewport persistence
    let _viewportSupabaseSaveTimer: ReturnType<typeof setTimeout> | null = null

    const setViewport = (x: number, y: number, zoom: number) => {
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom) || zoom <= 0) {
            console.warn('⚠️ [CANVAS] Attempted to set invalid viewport:', { x, y, zoom })
            return
        }
        viewport.value = { x, y, zoom }
        localStorage.setItem(STORAGE_KEYS.CANVAS_VIEWPORT, JSON.stringify({ x, y, zoom }))
        // TASK-1579: Debounced Supabase write (2s) — single owner of cloud persistence
        if (_viewportSupabaseSaveTimer) clearTimeout(_viewportSupabaseSaveTimer)
        _viewportSupabaseSaveTimer = setTimeout(async () => {
            try {
                const { fetchUserSettings, saveUserSettings } = useSupabaseDatabase()
                const settings = await fetchUserSettings()
                if (settings) {
                    await saveUserSettings({ ...settings, canvasViewport: { x, y, zoom } })
                    console.log('🔭 [canvasViewport] Viewport saved to cloud:', { x, y, zoom })
                }
            } catch (error) {
                console.error('❌ [canvasViewport] Viewport Supabase save failed:', error)
            }
        }, 2000)
    }

    const loadSavedViewport = async () => {
        try {
            const { fetchUserSettings } = useSupabaseDatabase()
            const settings = await fetchUserSettings()
            const savedViewport = settings?.canvasViewport as { x: number; y: number; zoom: number } | undefined

            if (savedViewport && typeof savedViewport.x === 'number' && Number.isFinite(savedViewport.zoom) && savedViewport.zoom > 0) {
                viewport.value = savedViewport
                return true
            }

            const local = localStorage.getItem(STORAGE_KEYS.CANVAS_VIEWPORT)
            if (local) {
                try {
                    const parsed = JSON.parse(local)
                    if (
                        Number.isFinite(parsed.x) &&
                        Number.isFinite(parsed.y) &&
                        Number.isFinite(parsed.zoom) &&
                        parsed.zoom > 0
                    ) {
                        viewport.value = parsed
                        return true
                    }
                } catch (_e) {
                    console.error('Failed to parse local viewport:', _e)
                }
            }
            return false
        } catch (_e) {
            console.error('Failed to load viewport:', _e)
            return false
        }
    }

    return {
        viewport,
        zoomConfig,
        setViewport,
        loadSavedViewport
    }
}
