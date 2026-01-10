import { onMounted, onBeforeUnmount } from 'vue'
import type { useTaskStore } from '@/stores/tasks'
import type { useCanvasStore } from '@/stores/canvas'
import type { useUIStore } from '@/stores/ui'
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'

export function useCanvasLifecycle(
    taskStore: ReturnType<typeof useTaskStore>,
    canvasStore: ReturnType<typeof useCanvasStore>,
    uiStore: ReturnType<typeof useUIStore>,
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

        if (!storeStatus.taskStore) {
            errorHandler.report({
                message: 'TaskStore failed to initialize',
                severity: ErrorSeverity.CRITICAL,
                category: ErrorCategory.STATE
            })
        }
        if (!storeStatus.canvasStore) {
            errorHandler.report({
                message: 'CanvasStore failed to initialize',
                severity: ErrorSeverity.CRITICAL,
                category: ErrorCategory.CANVAS
            })
        }
        if (!storeStatus.uiStore) {
            errorHandler.report({
                message: 'UIStore failed to initialize',
                severity: ErrorSeverity.CRITICAL,
                category: ErrorCategory.STATE
            })
        }

        return storeStatus
    }

    const storeHealth = validateStores()

    onMounted(async () => {
        // Wait for stores to be ready
        if (!storeHealth.taskStore || !storeHealth.canvasStore) {
            errorHandler.report({
                message: 'Stores not ready on mount, canvas initialization may complete later',
                severity: ErrorSeverity.WARNING,
                category: ErrorCategory.CANVAS
            })
        }
    })

    onBeforeUnmount(() => {
        cleanupZoom()
    })

    return {
        storeHealth,
        validateStores
    }
}
