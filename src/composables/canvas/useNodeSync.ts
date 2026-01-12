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
        // Defensive initialization: ensure nodeVersionMapRef.value is always a Map
        // This handles cases where the ref might not be properly initialized yet
        // (e.g., during HMR, store re-initialization, or timing issues)
        if (!nodeVersionMapRef?.value || !(nodeVersionMapRef.value instanceof Map)) {
            // Auto-fix: reinitialize as an empty Map instead of bailing out
            if (nodeVersionMapRef) {
                nodeVersionMapRef.value = new Map<string, number>()
            } else {
                // Truly exceptional case: ref itself is missing
                console.error('[NODE-SYNC] nodeVersionMapRef is null/undefined - cannot sync')
                return false
            }
        }

        // CRITICAL: Capture the Map reference in a local variable
        // This ensures we use the same Map instance throughout the async function,
        // even if nodeVersionMapRef.value gets reassigned during await calls
        const versionMap = nodeVersionMapRef.value as Map<string, number>

        // Validate nodeId is provided
        if (!nodeId) {
            console.error('[NODE-SYNC] nodeId is required for sync')
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
            // Use local versionMap (captured above) for all Map operations
            const currentVersion = versionMap.get(nodeId) ?? 0

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
                // Use local versionMap for all Map operations
                versionMap.set(nodeId, newVersion)

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
                    // ================================================================
                    // RETRY FAILED - LOG ONLY, NO STORE MUTATION
                    // ================================================================
                    // CRITICAL CONTRACT: On retry failure, we ONLY log the error.
                    // We do NOT:
                    //   - Fire syncTrigger to cause another sync attempt
                    //   - Modify task.canvasPosition or task.parentId
                    //   - Modify group.position or group.parentGroupId
                    //   - Call any store mutation methods
                    //
                    // This prevents feedback loops where failed syncs cascade into
                    // more sync attempts that also fail.
                    // ================================================================
                    const expectedPayload = tableName === 'tasks'
                        ? updatePayload.position
                        : updatePayload.position_json
                    console.error(`❌ [NODE-SYNC] Retry failed for ${tableName} ${nodeId}`, {
                        expectedPosition: expectedPayload,
                        lastKnownVersion: newVersion,
                        advice: 'Position may be stale until next user drag. No automatic retry.'
                    })
                    syncError.value = `Sync Conflict: Retry failed for ${tableName} ${nodeId}. Position may be stale.`
                    return false
                }

                // Retry succeeded - use local versionMap
                console.log(`✅ [NODE-SYNC] Retry succeeded for ${tableName} ${nodeId}`)
                versionMap.set(nodeId, retryData[0].position_version)
                return true
            }

            // Success: update local version tracker using versionMap
            versionMap.set(nodeId, data[0].position_version)
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
