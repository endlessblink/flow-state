import { ref, computed, type Ref } from 'vue'
import type { Node } from '@vue-flow/core'
import type { CanvasGroup } from '@/types/canvas'
import {
    getGroupAbsolutePosition,
    toAbsolutePosition,
    sanitizePosition
} from '@/utils/canvas/coordinates'
import { CANVAS } from '@/constants/canvas'
import { useToast } from '@/composables/useToast'

export function getAbsolutePositionForNodeSync(
    vueFlowNode: Pick<Node, 'position'> & { computedPosition?: { x: number; y: number } },
    currentParentId: string | null,
    allGroups: CanvasGroup[]
): { x: number; y: number } {
    const relativePos = sanitizePosition(vueFlowNode.position)

    if (currentParentId && currentParentId !== 'NONE') {
        const parentAbsolute = getGroupAbsolutePosition(currentParentId, allGroups)
        return toAbsolutePosition(relativePos, parentAbsolute)
    }

    if (vueFlowNode.computedPosition) {
        return {
            x: vueFlowNode.computedPosition.x,
            y: vueFlowNode.computedPosition.y
        }
    }

    return relativePos
}

/**
 * Composable for managing node sync with optimistic locking
 *
 * ============================================================================
 * WRITE PATH: Vue Flow → DB
 * ============================================================================
 *
 * This composable handles the WRITE PATH of the Fully Absolute Architecture:
 * - Takes Vue Flow node positions (relative for nested nodes)
 * - Converts to absolute world coordinates
 * - Saves to DB with optimistic locking for conflict detection
 *
 * KEY PRINCIPLE:
 * - Vue Flow stores RELATIVE positions for nested nodes
 * - DB must store ABSOLUTE world coordinates for ALL nodes
 * - Conversion happens HERE using computedPosition or manual calculation
 *
 * NOTE: nodeVersionMap is passed as Ref<Map> from Pinia store via storeToRefs.
 * We access .value to get the underlying Map.
 */
export function useNodeSync(
    nodeVersionMapRef: Ref<Map<string, number>>
) {
    // BUG FIX: Use per-node locking instead of global lock to prevent one stuck node blocking others
    const syncingNodes = ref(new Set<string>())
    const syncError = ref<string | null>(null)

    /**
     * Sync a single node position with conflict detection
     *
     * WRITE PATH FLOW:
     * 1. Get Vue Flow node position (relative if nested)
     * 2. Convert to absolute world coordinates
     * 3. Save to DB with optimistic lock
     *
     * @param nodeId The node/group ID (not Vue Flow node ID)
     * @param vueFlowNode The Vue Flow node with current position
     * @param allGroups All groups for parent lookup
     * @param tableName 'tasks' or 'groups'
     */
    async function syncNodePosition(
        nodeId: string,
        vueFlowNode: Node,
        allGroups: CanvasGroup[],
        tableName: 'tasks' | 'groups'
    ): Promise<boolean> {
        // Defensive initialization: ensure nodeVersionMapRef.value is always a Map
        if (!nodeVersionMapRef?.value || !(nodeVersionMapRef.value instanceof Map)) {
            if (nodeVersionMapRef) {
                nodeVersionMapRef.value = new Map<string, number>()
            } else {
                console.error('[NODE-SYNC] nodeVersionMapRef is null/undefined - cannot sync')
                return false
            }
        }


        if (!nodeId) {
            console.error('[NODE-SYNC] nodeId is required for sync')
            return false
        }

        // PER-NODE LOCKING
        if (syncingNodes.value.has(nodeId)) {
            console.warn(`⏳ [NODE-SYNC] Skipped ${nodeId} - sync already in progress`)
            return false
        }

        syncingNodes.value.add(nodeId)
        syncError.value = null

        try {
            // ================================================================
            // 1. EXTRACT PARENT ID FROM VUE FLOW NODE
            // ================================================================
            const rawParentId = vueFlowNode.parentNode
            const currentParentId = rawParentId
                ? (rawParentId.startsWith('section-')
                    ? rawParentId.replace('section-', '')
                    : rawParentId)
                : null

            // ================================================================
            // 2. CALCULATE ABSOLUTE POSITION
            // ================================================================
            const absolutePosition = getAbsolutePositionForNodeSync(vueFlowNode, currentParentId, allGroups)

            // ================================================================
            // 3. DISPATCH THROUGH THE STORE SINGLE-WRITER (BUG-1899)
            // ================================================================
            // This composable used to write positions straight to Supabase with
            // a private optimistic-lock version map. That raced the sync-queue
            // writes from updateTask/updateGroup on the same rows (the queue
            // never updated the private map), producing constant
            // "[NODE-SYNC] Conflict detected" retries and "LWW: Server wins …
            // DISCARDED" edit loss. Geometry now has exactly one transport:
            // the store update paths, which persist via the sync queue with
            // shared positionVersion semantics.
            const resolvedParentId = currentParentId === 'NONE' ? null : currentParentId

            if (tableName === 'tasks') {
                const { useTaskStore } = await import('@/stores/tasks')
                await useTaskStore().updateTask(nodeId, {
                    canvasPosition: { x: absolutePosition.x, y: absolutePosition.y },
                    // Task.parentId is string|undefined — explicit undefined still
                    // clears the parent through the update merge (legacy direct
                    // write used null for the same purpose).
                    parentId: resolvedParentId ?? undefined,
                    positionFormat: 'absolute'
                }, 'DRAG')
            } else {
                const { useCanvasStore } = await import('@/stores/canvas')
                const nodeSize = vueFlowNode as { width?: number; height?: number }
                await useCanvasStore().updateGroup(nodeId, {
                    position: {
                        x: absolutePosition.x,
                        y: absolutePosition.y,
                        width: vueFlowNode.data?.width || nodeSize.width || CANVAS.DEFAULT_GROUP_WIDTH,
                        height: vueFlowNode.data?.height || nodeSize.height || CANVAS.DEFAULT_GROUP_HEIGHT
                    },
                    parentGroupId: resolvedParentId,
                    positionFormat: 'absolute'
                })
            }
            return true
        } catch (err: unknown) {
            const error = err as { message?: string; code?: string }
            console.error('❌ [NODE-SYNC] Failed:', err)
            syncError.value = error.message || 'Sync failed'

            const { showToast } = useToast()
            if (error.code === 'PGRST116') {
                console.warn('⚠️ [NODE-SYNC] Entity not found (PGRST116) — suppressing toast')
            } else {
                showToast(`Sync Failed: ${syncError.value}`, 'error')
            }
            return false
        } finally {
            syncingNodes.value.delete(nodeId)
        }
    }


    return {
        // Expose boolean for backward compatibility (true if ANY node is syncing)
        isSyncing: computed(() => syncingNodes.value.size > 0),
        syncError: computed(() => syncError.value),
        syncNodePosition
    }
}
