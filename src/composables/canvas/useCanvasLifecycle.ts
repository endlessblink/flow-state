import { onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useUIStore } from '@/stores/ui'
import { useCanvasNavigation } from '@/composables/canvas/useCanvasNavigation'

export function useCanvasLifecycle(
    taskStore: any,
    canvasStore: any,
    uiStore: any,
    fitCanvas: () => void,
    cleanupZoom: () => void
) {
    // Graceful degradation: Validate store initialization
    const validateStores = () => {
        const storeStatus = {
            taskStore: !!taskStore,
            canvasStore: !!canvasStore,
            uiStore: !!uiStore
        }

        if (!storeStatus.taskStore) console.error('❌ CRITICAL: TaskStore failed to initialize')
        if (!storeStatus.canvasStore) console.error('❌ CRITICAL: CanvasStore failed to initialize')
        if (!storeStatus.uiStore) console.error('❌ CRITICAL: UIStore failed to initialize')

        return storeStatus
    }

    const storeHealth = validateStores()

    onMounted(async () => {
        // Wait for stores to be ready
        if (!storeHealth.taskStore || !storeHealth.canvasStore) {
            console.warn('⚠️ Stores not ready on mount, canvas initialization may complete later')
        }

        // Initial fit is handled by useCanvasNavigation usually, but we can trigger it here if needed
        // fitCanvas() 
    })

    onBeforeUnmount(() => {
        cleanupZoom()
    })

    return {
        storeHealth,
        validateStores
    }
}
