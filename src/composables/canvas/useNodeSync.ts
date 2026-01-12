import { ref, computed, type Ref } from 'vue'
import { supabase } from '@/services/auth/supabase'
import type { Node } from '@vue-flow/core'
import type { CanvasGroup } from '@/stores/canvas/types'
import {
    getGroupAbsolutePosition,
    toAbsolutePosition,
    sanitizePosition
} from '@/utils/canvas/coordinates'

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
    const isSyncing = ref(false)
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
        // Runtime guard: ensure nodeVersionMapRef is a valid Ref<Map>
        if (!nodeVersionMapRef?.value || !(nodeVersionMapRef.value instanceof Map)) {
            console.error('[NODE-SYNC] nodeVersionMap is not initialized or not a Map')
            return false
        }



        if (isSyncing.value) return false

        isSyncing.value = true
        syncError.value = null

        try {
            // ================================================================
            // 1. EXTRACT PARENT ID FROM VUE FLOW NODE
            // ================================================================
            // Vue Flow stores parentNode as "section-{groupId}" format
            const rawParentId = vueFlowNode.parentNode
            const currentParentId = rawParentId
                ? (rawParentId.startsWith('section-')
                    ? rawParentId.replace('section-', '')
                    : rawParentId)
                : null

            // ================================================================
            // 2. CALCULATE ABSOLUTE POSITION
            // ================================================================
            // FULLY ABSOLUTE ARCHITECTURE: Always save absolute coordinates
            //
            // Priority order:
            // 1. computedPosition (Vue Flow already computed world position)
            // 2. Manual conversion using parent's absolute position
            let absolutePosition: { x: number; y: number }

            const vfNode = vueFlowNode as any
            if (vfNode.computedPosition) {
                // Vue Flow provides computed world position - use directly
                absolutePosition = {
                    x: vfNode.computedPosition.x,
                    y: vfNode.computedPosition.y
                }
            } else {
                // Fallback: manually convert relative → absolute
                const relativePos = sanitizePosition(vueFlowNode.position)

                if (currentParentId && currentParentId !== 'NONE') {
                    const parentAbsolute = getGroupAbsolutePosition(currentParentId, allGroups)
                    absolutePosition = toAbsolutePosition(relativePos, parentAbsolute)
                } else {
                    // Root node - position is already absolute
                    absolutePosition = relativePos
                }
            }

            // ================================================================
            // 3. GET CURRENT VERSION FOR OPTIMISTIC LOCK
            // ================================================================
            // nodeVersionMapRef.value is a plain Map
            const currentVersion = nodeVersionMapRef.value.get(nodeId) ?? 0

            // ================================================================
            // 4. PREPARE DB PAYLOAD
            // ================================================================
            // FULLY ABSOLUTE: All nodes save absolute coordinates
            // No special case for nested groups - consistent architecture
            const positionToSave = absolutePosition

            // Build update payload based on table type
            const updatePayload: Record<string, any> = {
                position_version: currentVersion + 1,
                updated_at: new Date().toISOString()
            }

            if (tableName === 'tasks') {
                // Tasks: position is JSONB with x, y, parentId, format
                updatePayload.position = {
                    x: positionToSave.x,
                    y: positionToSave.y,
                    parentId: currentParentId === 'NONE' ? null : currentParentId,
                    format: 'absolute'
                }
            } else {
                // Groups: position_json is JSONB with x, y, width, height
                updatePayload.position_json = {
                    x: positionToSave.x,
                    y: positionToSave.y,
                    width: vueFlowNode.data?.width || (vueFlowNode as any).width || 300,
                    height: vueFlowNode.data?.height || (vueFlowNode as any).height || 200
                }
                // Also update parent_group_id column for groups
                updatePayload.parent_group_id = currentParentId === 'NONE' ? null : currentParentId
            }

            // ================================================================
            // 5. EXECUTE OPTIMISTIC LOCK UPDATE
            // ================================================================
            const { data, error } = await supabase
                .from(tableName)
                .update(updatePayload)
                .eq('id', nodeId)
                .eq('position_version', currentVersion) // ← The Key: Optimistic Lock
                .select('position_version')

            if (error) {
                throw error;
            }

            // Fix 406: Manually check array instead of using maybeSingle()
            // PostgREST can return 406 if maybeSingle finds 0 rows with return=representation
            if (!data || data.length === 0) {
                // ================================================================
                // BUG #2 FIX: RETRY ONCE ON CONFLICT
                // ================================================================
                // Update failed - version mismatch (someone else updated)
                // Instead of just returning false and losing the user's changes,
                // we fetch the latest version and retry ONCE.
                console.warn(`⚠️ [NODE-SYNC] Conflict detected for ${tableName} ${nodeId}, retrying with fresh version...`)

                // Fetch latest version to recover
                const { data: latest, error: fetchError } = await supabase
                    .from(tableName)
                    .select('position_version')
                    .eq('id', nodeId)
                    .single()

                if (fetchError || !latest) {
                    syncError.value = `Sync Conflict: Could not fetch latest version for ${tableName} ${nodeId}`
                    return false
                }

                const newVersion = latest.position_version
                nodeVersionMapRef.value.set(nodeId, newVersion)

                // Retry the update with the new version
                updatePayload.position_version = newVersion + 1

                const { data: retryData, error: retryError } = await supabase
                    .from(tableName)
                    .update(updatePayload)
                    .eq('id', nodeId)
                    .eq('position_version', newVersion)
                    .select('position_version')

                if (retryError) {
                    throw retryError
                }

                if (!retryData || retryData.length === 0) {
                    // Retry also failed - give up to avoid infinite loops
                    syncError.value = `Sync Conflict: Retry failed for ${tableName} ${nodeId}. Position may be lost.`
                    console.error(`❌ [NODE-SYNC] Retry failed for ${tableName} ${nodeId}`)
                    return false
                }

                // Retry succeeded
                console.log(`✅ [NODE-SYNC] Retry succeeded for ${tableName} ${nodeId}`)
                nodeVersionMapRef.value.set(nodeId, retryData[0].position_version)
                return true
            }

            // Success: update local version tracker
            nodeVersionMapRef.value.set(nodeId, data[0].position_version)
            return true

        } catch (err: any) {
            console.error('Optimistic Sync Failed:', err)
            syncError.value = err.message || 'Sync failed'
            return false
        } finally {
            isSyncing.value = false
        }
    }

    return {
        isSyncing: computed(() => isSyncing.value),
        syncError: computed(() => syncError.value),
        syncNodePosition
    }
}
