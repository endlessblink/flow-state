import { computed, type Ref } from 'vue'
import type { Task } from '@/types/tasks'
import type { CanvasGroup } from '@/types/canvas'

import { assertNoDuplicateIds } from '@/utils/canvas/invariants'
import { findMatchingGroupForDueDate } from '@/composables/canvas/useSmartGroupMatcher'
import { detectPowerKeyword } from '@/composables/usePowerKeywords'
import { CANVAS } from '@/constants/canvas'
import { getCanonicalTodayTaskIds } from '@/utils/todayTaskProjection'

// Accept any object exposing the two reactive booleans. Pass the live Pinia
// taskStore here (not a plain-object getter wrapper) so reads inside the
// consumer's `computed` track natively via Pinia's Proxy.
interface TaskStoreSettings {
    hideCanvasDoneTasks: boolean
    hideCanvasOverdueTasks: boolean
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

        // Keep done canvas tasks in the node model. useCanvasSync marks them
        // hidden instead of removing them, preserving Vue Flow parent/position state.

        // Filter out Overdue tasks if enabled
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
        // BUG-1365: Added t.status to hash — without it, status changes (e.g. marking done → auto-archive)
        // might not invalidate the cache, causing stale canvas nodes to linger
        const groupHash = (canvasStore.groups || [])
            .map(group => `${group.id}:${group.name}:${group.isVisible}:${group.position?.x || ''}:${group.position?.y || ''}`)
            .join('|')
        const currentHash = `${tasks.map(t => `${t.id}:${t.title}:${t.description || ''}:${t.dueDate || ''}:${t.canvasPosition?.x || ''}:${t.canvasPosition?.y || ''}:${t.parentId || ''}:${t.status || ''}:${t.updatedAt ? new Date(t.updatedAt).getTime() : ''}`).join('|')}##${groupHash}`

        if (currentHash === lastCanvasTasksHash && lastCanvasTasks.length > 0) {
            return lastCanvasTasks
        }

        const todayTaskIds = getCanonicalTodayTaskIds(
            tasks,
            !!canvasStore.taskStore?.hideCanvasDoneTasks,
        )
        const result = tasks
            .map(task => {
                const todayGroup = (canvasStore.groups || []).find(group => {
                    const keyword = detectPowerKeyword(group.name)
                    return group.isVisible && keyword?.category === 'date' && keyword.keyword === 'today'
                })
                if (todayGroup && todayTaskIds.has(task.id)) {
                    const projectedPosition = task.canvasPosition ?? {
                        x: todayGroup.position.x + CANVAS.GROUP_PADDING,
                        y: todayGroup.position.y + CANVAS.DAY_GROUP_HEADER_HEIGHT + CANVAS.GROUP_PADDING,
                    }
                    return {
                        ...task,
                        parentId: todayGroup.id,
                        canvasPosition: projectedPosition,
                    }
                }

                if (task.canvasPosition) {
                    const matchingGroup = task.dueDate
                        ? findMatchingGroupForDueDate(task.dueDate, canvasStore.groups || [])
                        : null
                    if (!matchingGroup || task.parentId === matchingGroup.id) return task

                    return {
                        ...task,
                        parentId: matchingGroup.id,
                    }
                }

                const matchingGroup = task.dueDate
                    ? findMatchingGroupForDueDate(task.dueDate, canvasStore.groups || [])
                    : null
                if (!matchingGroup?.position) return null

                return {
                    ...task,
                    parentId: matchingGroup.id,
                    canvasPosition: {
                        x: matchingGroup.position.x + CANVAS.GROUP_PADDING,
                        y: matchingGroup.position.y + CANVAS.DAY_GROUP_HEADER_HEIGHT + CANVAS.GROUP_PADDING,
                    },
                }
            })
            .filter((task): task is Task => task !== null && !!task.canvasPosition)

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
