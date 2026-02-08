import { ref } from 'vue'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
// TASK-1215: Tauri dual-write for viewport persistence
import { getTauriStore, isTauriEnv, scheduleTauriSave } from '@/composables/usePersistentRef'

export const useCanvasViewport = (initialViewport = { x: 0, y: 0, zoom: 1 }) => {
    const viewport = ref(initialViewport)
    const zoomConfig = ref({ minZoom: 0.1, maxZoom: 4.0 })

    const setViewport = (x: number, y: number, zoom: number) => {
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom) || zoom <= 0) {
            console.warn('⚠️ [CANVAS] Attempted to set invalid viewport:', { x, y, zoom })
            return
        }
        viewport.value = { x, y, zoom }
        localStorage.setItem('flowstate-canvas-viewport', JSON.stringify({ x, y, zoom }))
        // TASK-1215: Tauri dual-write
        if (isTauriEnv()) {
            getTauriStore().then(store => {
                if (!store) return
                store.set('flowstate-canvas-viewport', { x, y, zoom }).then(() => scheduleTauriSave('flowstate-canvas-viewport'))
            })
        }
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

            const local = localStorage.getItem('flowstate-canvas-viewport')
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
