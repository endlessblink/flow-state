import { ref, computed, type Ref } from 'vue'
import { supabase } from '@/services/auth/supabase'
import type { Node } from '@vue-flow/core'
import type { CanvasGroup } from '@/types/canvas'
import {
    getGroupAbsolutePosition,
    toAbsolutePosition,
    sanitizePosition
} from '@/utils/canvas/coordinates'
import { CANVAS } from '@/constants/canvas'
import { useToast } from '@/composables/useToast'

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

        const versionMap = nodeVersionMapRef.value as Map<string, number>

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
            let absolutePosition: { x: number; y: number }
            const vfNode = vueFlowNode as any

            if (vfNode.computedPosition) {
                absolutePosition = {
                    x: vfNode.computedPosition.x,
                    y: vfNode.computedPosition.y
                }
            } else {
                const relativePos = sanitizePosition(vueFlowNode.position)
                if (currentParentId && currentParentId !== 'NONE') {
                    const parentAbsolute = getGroupAbsolutePosition(currentParentId, allGroups)
                    absolutePosition = toAbsolutePosition(relativePos, parentAbsolute)
                } else {
                    absolutePosition = relativePos
                }
            }

            // ================================================================
            // 3. GET CURRENT VERSION (with fallback to store)
            // ================================================================
            // CRITICAL FIX: If versionMap is out of sync, fall back to task store
            let currentVersion = versionMap.get(nodeId)
            if (currentVersion === undefined) {
                // Try to get version from task store as fallback
                try {
                    const { useTaskStore } = await import('@/stores/tasks')
                    const taskStore = useTaskStore()
                    const task = taskStore.tasks.find((t: any) => t.id === nodeId)
                    if (task?.positionVersion !== undefined) {
                        currentVersion = task.positionVersion
                        versionMap.set(nodeId, currentVersion) // Sync the map
                        console.log(`[NODE-SYNC] Recovered version from task store for ${nodeId.slice(0, 8)}: v${currentVersion}`)
                    }
                } catch {
                    // Store not available, use 0
                }
                currentVersion = currentVersion ?? 0
            }

            // ================================================================
            // 4. PREPARE DB PAYLOAD
            // ================================================================
            const positionToSave = absolutePosition
            const updatePayload: Record<string, any> = {
                position_version: currentVersion + 1,
                updated_at: new Date().toISOString()
            }

            if (tableName === 'tasks') {
                updatePayload.position = {
                    x: positionToSave.x,
                    y: positionToSave.y,
                    parentId: currentParentId === 'NONE' ? null : currentParentId,
                    format: 'absolute'
                }
            } else {
                updatePayload.position_json = {
                    x: positionToSave.x,
                    y: positionToSave.y,
                    width: vueFlowNode.data?.width || (vueFlowNode as any).width || CANVAS.DEFAULT_GROUP_WIDTH,
                    height: vueFlowNode.data?.height || (vueFlowNode as any).height || CANVAS.DEFAULT_GROUP_HEIGHT
                }
                updatePayload.parent_group_id = currentParentId === 'NONE' ? null : currentParentId
            }

            // ================================================================
            // 5. EXECUTE OPTIMISTIC LOCK UPDATE (WITH TIMEOUT)
            // ================================================================
            // We wrap Supabase call in a timeout to prevent infinite hanging
            // which causes the "stops syncing after a while" bug.
            // Increased timeout for production VPS latency (BUG-1116)

            const SYNC_TIMEOUT_MS = 20000 // 20s timeout for VPS latency
            const timeoutPromise = new Promise<{ timeout: true }>((resolve) =>
                setTimeout(() => resolve({ timeout: true }), SYNC_TIMEOUT_MS)
            )

            const dbRequest = supabase
                .from(tableName)
                .update(updatePayload)
                .eq('id', nodeId)
                .eq('position_version', currentVersion)
                .select('position_version')

            // Race: DB Request vs Timeout
            const result = await Promise.race([dbRequest, timeoutPromise])

            // Handle Timeout
            if ('timeout' in result) {
                throw new Error(`Sync timed out after ${SYNC_TIMEOUT_MS}ms`)
            }

            const { data, error } = result

            if (error) throw error

            // Handle Version Mismatch (Retry Once)
            if (!data || data.length === 0) {
                console.warn(`⚠️ [NODE-SYNC] Conflict detected for ${tableName} ${nodeId}, retrying...`)

                // Fetch latest
                const { data: latest, error: fetchError } = await supabase
                    .from(tableName)
                    .select('position_version')
                    .eq('id', nodeId)
                    .single()

                if (fetchError || !latest) {
                    throw new Error('Could not fetch latest version for retry')
                }

                const newVersion = latest.position_version
                versionMap.set(nodeId, newVersion)
                updatePayload.position_version = newVersion + 1

                // Retry Request (With new timeout race)
                const retryRequest = supabase
                    .from(tableName)
                    .update(updatePayload)
                    .eq('id', nodeId)
                    .eq('position_version', newVersion)
                    .select('position_version')

                const retryResult = await Promise.race([retryRequest, timeoutPromise])
                if ('timeout' in retryResult) {
                    throw new Error(`Retry sync timed out after ${SYNC_TIMEOUT_MS}ms`)
                }

                const { data: retryData, error: retryError } = retryResult

                if (retryError) throw retryError

                if (!retryData || retryData.length === 0) {
                    console.error(`❌ [NODE-SYNC] Retry failed for ${tableName} ${nodeId}. Position may be stale.`)
                    syncError.value = `Sync Conflict: Retry failed`
                    return false
                }

                console.log(`✅ [NODE-SYNC] Retry succeeded for ${tableName} ${nodeId}`)
                versionMap.set(nodeId, retryData[0].position_version)
                return true
            }

            // Success
            // console.log(`✅ [NODE-SYNC] Sync success for ${tableName} ${nodeId} v${data[0].position_version}`)
            versionMap.set(nodeId, data[0].position_version)
            return true

        } catch (err: any) {
            console.error('❌ [NODE-SYNC] Failed:', err)
            syncError.value = err.message || 'Sync failed'

            // Only show toast for persistent errors, not just one timeout
            if (!err.message?.includes('timed out')) {
                const { showToast } = useToast()
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
