import { computed, ref, type Ref } from 'vue'
import type { Task } from '@/stores/tasks'
import { useWindowSize } from '@vueuse/core'

interface CanvasStore {
    calculateContentBounds: (tasks: Task[]) => { x: number; y: number; width: number; height: number }
}

export function useCanvasFilteredState(filteredTasks: Ref<Task[]>, canvasStore: CanvasStore) {
    const { width } = useWindowSize()

    // --- Caching Variables ---
    let lastCanvasTasks: Task[] = []
    let lastCanvasTasksHash = ''

    let lastHasNoTasks = false
    let lastHasNoTasksLength = -1

    let lastHasInboxTasks = false
    let lastHasInboxTasksHash = ''

    let lastDynamicNodeExtent: [[number, number], [number, number]] | null = null
    let lastDynamicNodeExtentHash = ''

    // --- Computed State ---

    /**
     * Optimized filtering for tasks that have valid canvas positions.
     * Consolidates filteredTasksWithCanvasPosition and tasksWithCanvasPositions.
     */
    const tasksWithCanvasPosition = computed(() => {
        const tasks = filteredTasks.value
        if (!Array.isArray(tasks)) return []

        // Robust hashing for cache invalidation
        const currentHash = tasks.map(t => `${t.id}:${t.title}:${t.description || ''}:${t.canvasPosition?.x || ''}:${t.canvasPosition?.y || ''}:${t.updatedAt ? new Date(t.updatedAt).getTime() : ''}`).join('|')

        if (currentHash === lastCanvasTasksHash && lastCanvasTasks.length > 0) {
            return lastCanvasTasks
        }

        const result = tasks.filter(task => {
            const pos = task.canvasPosition
            return pos && typeof pos.x === 'number' && typeof pos.y === 'number'
        })

        lastCanvasTasksHash = currentHash
        lastCanvasTasks = result
        return result
    })

    const hasNoTasks = computed(() => {
        const currentLength = filteredTasks.value?.length || 0
        if (currentLength === lastHasNoTasksLength) return lastHasNoTasks

        lastHasNoTasksLength = currentLength
        lastHasNoTasks = currentLength === 0
        return lastHasNoTasks
    })

    const hasInboxTasks = computed(() => {
        const tasks = filteredTasks.value
        if (!Array.isArray(tasks)) return false

        const currentHash = tasks.map(t => `${t.id}:${!!t.canvasPosition}:${t.status}`).join('|')
        if (currentHash === lastHasInboxTasksHash) return lastHasInboxTasks

        // Logic: Task is in "inbox" if it has no canvas position and is not done
        const result = tasks.some(task => !task.canvasPosition && task.status !== 'done')

        lastHasInboxTasksHash = currentHash
        lastHasInboxTasks = result
        return result
    })

    const dynamicNodeExtent = computed(() => {
        const tasks = tasksWithCanvasPosition.value
        if (!tasks.length) {
            return [[-2000, -2000], [5000, 5000]] as [[number, number], [number, number]]
        }

        const currentHash = tasks.map(t => `${t.id}:${t.canvasPosition?.x || 0}:${t.canvasPosition?.y || 0}`).join('|')
        if (currentHash === lastDynamicNodeExtentHash && lastDynamicNodeExtent) {
            return lastDynamicNodeExtent
        }

        try {
            const bounds = canvasStore.calculateContentBounds(tasks)
            const padding = 1000

            // Convert {x,y,w,h} to extent [[minX, minY], [maxX, maxY]]
            const minX = bounds.x
            const minY = bounds.y
            const maxX = bounds.x + bounds.width
            const maxY = bounds.y + bounds.height

            const result = [
                [minX - padding * 10, minY - padding * 10],
                [maxX + padding * 10, maxY + padding * 10]
            ] as [[number, number], [number, number]]

            lastDynamicNodeExtent = result
            lastDynamicNodeExtentHash = currentHash
            return result
        } catch (error) {
            console.warn('⚠️ [COMPUTED] Error calculating dynamic node extent:', error)
            return [[-2000, -2000], [5000, 5000]] as [[number, number], [number, number]]
        }
    })

    // --- Helper Logic ---

    return {
        tasksWithCanvasPosition,
        hasNoTasks,
        hasInboxTasks,
        dynamicNodeExtent
    }
}
