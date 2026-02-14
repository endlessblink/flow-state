import { computed, ref, type Ref } from 'vue'
import type { Task } from '@/types/tasks'

import { assertNoDuplicateIds } from '@/utils/canvas/invariants'

interface TaskStoreSettings {
    hideCanvasDoneTasks?: boolean
    hideCanvasOverdueTasks?: boolean
}

interface CanvasGroup {
    id: string
    position: { x: number; y: number; width: number; height: number }
}

interface CanvasStore {
    calculateContentBounds: (tasks: Task[]) => { x: number; y: number; width: number; height: number }
    taskStore?: TaskStoreSettings
    groups?: CanvasGroup[]
}

export function useCanvasFilteredState(filteredTasks: Ref<Task[]>, canvasStore: CanvasStore) {


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
     * Also handles view-specific filtering (Hide Done, Hide Overdue).
     */
    const tasksWithCanvasPosition = computed(() => {
        let tasks = filteredTasks.value
        if (!Array.isArray(tasks)) return []

        // 1. Filter out Done tasks if enabled in store
        if (canvasStore.taskStore?.hideCanvasDoneTasks) {
            tasks = tasks.filter(t => t.status !== 'done')
        }

        // 2. Filter out Overdue tasks if enabled
        if (canvasStore.taskStore?.hideCanvasOverdueTasks) {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            tasks = tasks.filter(t => {
                if (!t.dueDate) return true
                const due = new Date(t.dueDate)
                return due >= today
            })
        }

        // Robust hashing for cache invalidation
        // TASK-370: Added parentId to hash - without it, parentId changes weren't invalidating cache,
        // causing Vue Flow to not receive updated parentNode, breaking group dragging
        const currentHash = tasks.map(t => `${t.id}:${t.title}:${t.description || ''}:${t.canvasPosition?.x || ''}:${t.canvasPosition?.y || ''}:${t.parentId || ''}:${t.updatedAt ? new Date(t.updatedAt).getTime() : ''}`).join('|')

        if (currentHash === lastCanvasTasksHash && lastCanvasTasks.length > 0) {
            return lastCanvasTasks
        }

        const result = tasks.filter(task => {
            const pos = task.canvasPosition
            return pos && typeof pos.x === 'number' && typeof pos.y === 'number'
        })

        // ================================================================
        // DUPLICATE DETECTION - Canvas Selector Layer (AUTHORITATIVE)
        // ================================================================
        // This detects if the store/filtering layer is returning duplicates
        // A duplicate here means the bug is upstream (in task store or filtering)
        // Uses assertNoDuplicateIds for consistent detection across layers
        if (import.meta.env.DEV) {
            const checkResult = assertNoDuplicateIds(result, 'tasksWithCanvasPosition')

            if (checkResult.hasDuplicates) {
                console.error('[TASK-ID-HISTOGRAM] DUPLICATES in tasksWithCanvasPosition', {
                    duplicates: checkResult.duplicates.map(d => ({ id: d.id.slice(0, 8), count: d.count })),
                    totalCount: checkResult.totalCount,
                    uniqueIdCount: checkResult.uniqueIdCount
                })
            } else if (result.length > 0) {
                console.debug('[TASK-ID-HISTOGRAM] tasksWithCanvasPosition', {
                    uniqueIdCount: checkResult.uniqueIdCount,
                    totalCount: checkResult.totalCount
                })
            }
        }

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
        const groups = canvasStore.groups || []

        // BUG-1310 FIX: When no tasks have canvas positions, the old default [-2000, 5000]
        // was too small — groups near x=4556 hit an invisible wall at x=5000.
        // Now we also consider group positions to compute the extent.
        if (!tasks.length && !groups.length) {
            return [[-50000, -50000], [50000, 50000]] as [[number, number], [number, number]]
        }

        // Build a hash from both tasks AND groups for cache invalidation
        const taskHash = tasks.map(t => `${t.id}:${t.canvasPosition?.x || 0}:${t.canvasPosition?.y || 0}`).join('|')
        const groupHash = groups.map(g => `${g.id}:${g.position?.x || 0}:${g.position?.y || 0}`).join('|')
        const currentHash = `${taskHash}##${groupHash}`
        if (currentHash === lastDynamicNodeExtentHash && lastDynamicNodeExtent) {
            return lastDynamicNodeExtent
        }

        try {
            const padding = 1000
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

            // Include task bounds
            if (tasks.length) {
                const bounds = canvasStore.calculateContentBounds(tasks)
                minX = Math.min(minX, bounds.x)
                minY = Math.min(minY, bounds.y)
                maxX = Math.max(maxX, bounds.x + bounds.width)
                maxY = Math.max(maxY, bounds.y + bounds.height)
            }

            // BUG-1310: Also include group bounds (critical when taskNodes=0)
            for (const group of groups) {
                if (!group.position) continue
                const gx = group.position.x
                const gy = group.position.y
                const gw = group.position.width || 0
                const gh = group.position.height || 0
                minX = Math.min(minX, gx)
                minY = Math.min(minY, gy)
                maxX = Math.max(maxX, gx + gw)
                maxY = Math.max(maxY, gy + gh)
            }

            // Fallback if somehow no valid bounds found
            if (!isFinite(minX)) {
                return [[-50000, -50000], [50000, 50000]] as [[number, number], [number, number]]
            }

            const result = [
                [minX - padding * 10, minY - padding * 10],
                [maxX + padding * 10, maxY + padding * 10]
            ] as [[number, number], [number, number]]

            // BUG-1310: Diagnostic logging for invisible barrier investigation
            if (import.meta.env.DEV) {
                console.log('[BUG-1310:EXTENT] dynamicNodeExtent recalculated', {
                    contentBounds: { minX: Math.round(minX), minY: Math.round(minY), maxX: Math.round(maxX), maxY: Math.round(maxY) },
                    extent: { minX: Math.round(result[0][0]), minY: Math.round(result[0][1]), maxX: Math.round(result[1][0]), maxY: Math.round(result[1][1]) },
                    taskCount: tasks.length,
                    groupCount: groups.length
                })
            }

            lastDynamicNodeExtent = result
            lastDynamicNodeExtentHash = currentHash
            return result
        } catch (error) {
            console.warn('⚠️ [COMPUTED] Error calculating dynamic node extent:', error)
            return [[-50000, -50000], [50000, 50000]] as [[number, number], [number, number]]
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
