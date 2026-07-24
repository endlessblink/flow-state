import type { CanvasGroup } from '@/types/canvas'
import {
    toSupabaseGroup, fromSupabaseGroup,
    type SupabaseGroup
} from '@/utils/supabaseMappers'
import { getSupabase, swrCache, invalidateCache, type DatabaseContext } from './_infrastructure'
import { useTombstoneDatabase } from './_tombstone'

const GROUP_SAVE_BACKPRESSURE_COOLDOWN_MS = 30_000
let groupSaveBackpressureUntil = 0
const groupSaveInFlight = new Set<string>()

const getErrorStatus = (error: unknown): string => {
    if (!error || typeof error !== 'object') return ''
    const candidate = error as { status?: unknown; code?: unknown }
    return String(candidate.status ?? candidate.code ?? '')
}

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message
    if (error && typeof error === 'object' && 'message' in error) {
        return String((error as { message?: unknown }).message ?? '')
    }
    return String(error)
}

const isGroupSaveBackpressureError = (error: unknown): boolean => {
    const status = getErrorStatus(error)
    const message = getErrorMessage(error).toLowerCase()
    return (
        status === '429' ||
        message.includes('too many requests') ||
        message.includes('rate limit')
    )
}

export function useGroupsDatabase(ctx: DatabaseContext) {
    const { authStore, isSyncing, lastSyncError, getUserIdSafe, withRetry, handleError } = ctx
    const { recordTombstone } = useTombstoneDatabase(ctx)

    const fetchGroups = async (
        workspaceId?: string | null,
        options?: { forceFresh?: boolean; onError?: (error: unknown) => void },
    ): Promise<CanvasGroup[]> => {
        // TASK-1060: Ensure auth is initialized before fetching
        if (!authStore.isInitialized) {
            console.log('🔄 [TASK-1060] Auth not initialized, waiting...')
            await authStore.initialize()
        }

        const userId = getUserIdSafe()
        // BUG-1056: Check if user changed since last fetch - invalidates cache if so
        swrCache.checkUserChange(userId)
        // Workspace-aware cache key so switching workspaces invalidates stale results
        const wsKey = workspaceId === undefined ? 'all' : (workspaceId ?? 'personal')
        const cacheKey = `groups:${userId || 'guest'}:ws:${wsKey}`
        if (options?.forceFresh) {
            invalidateCache.groups()
        }

        return swrCache.getOrFetch(cacheKey, async () => {
            try {
                // BUG-1107: Wrap in withRetry for mobile PWA network resilience
                return await withRetry(async () => {
                    let query = getSupabase()
                        .from('groups')
                        .select('*')
                        .eq('is_deleted', false)

                    // Workspace filter: undefined = legacy (no filter), null = personal, string = workspace
                    if (workspaceId === null) {
                        query = query.is('workspace_id', null)
                    } else if (typeof workspaceId === 'string') {
                        query = query.eq('workspace_id', workspaceId)
                    }
                    // workspaceId === undefined: no filter (legacy/backward-compat)

                    const { data, error } = await query

                    if (error) throw error
                    if (!data) return []

                    // DEBUG: Log loaded groups and their dimensions
                    const groups = data as SupabaseGroup[]
                    groups.forEach((g: SupabaseGroup) => {
                        const pos = g.position_json
                        console.log(`📦 [GROUP-LOAD] "${g.name}" loaded from Supabase: size=${pos?.width}x${pos?.height}`)
                    })

                    return (data as SupabaseGroup[]).map(fromSupabaseGroup)
                }, 'fetchGroups')
            } catch (e: unknown) {
                handleError(e, 'fetchGroups')
                options?.onError?.(e)
                return []
            }
        })
    }

    const saveGroup = async (group: CanvasGroup): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveGroup - not authenticated')
            return
        }
        try {
            isSyncing.value = true
            const payload = toSupabaseGroup(group, userId)

            // BUG-1184: Skip groups with legacy non-UUID IDs gracefully
            if (!payload) {
                console.debug(`⏭️ [LEGACY-GROUP] Skipping save for group "${group.name}" - has legacy ID format`)
                return
            }

            const now = Date.now()
            if (now < groupSaveBackpressureUntil) {
                console.warn(`⏳ [GROUP-SAVE] Supabase backpressure cooldown active; keeping "${group.name}" local-first`)
                return
            }

            if (groupSaveInFlight.has(group.id)) {
                console.warn(`⏳ [GROUP-SAVE] Save already in flight for "${group.name}"; keeping latest local copy only`)
                return
            }

            // TASK-142 FIX: Add .select() and check data.length to detect RLS silent failures
            // BUG FIX: Use position_json (actual DB column name), not position
            groupSaveInFlight.add(group.id)
            await withRetry(async () => {
                const { data, error } = await getSupabase().from('groups').upsert(payload, { onConflict: 'id' }).select('id, position_json')
                if (error) throw error
                if (!data || data.length === 0) {
                    throw new Error('RLS blocked write - upsert returned no data for group')
                }
                // Log position save for debugging
                if (data[0]?.position_json) {
                    const pos = data[0].position_json
                    console.log(`📍 [GROUP-SAVE] Saved group "${group.name}" pos=(${pos.x?.toFixed(0)}, ${pos.y?.toFixed(0)}) size=${pos.width}x${pos.height} to Supabase - VERIFIED`)
                }
            }, 'saveGroup')

            // TASK-1083: Invalidate cache after successful write to prevent stale reads
            invalidateCache.groups()

            lastSyncError.value = null
        } catch (e: unknown) {
            if (isGroupSaveBackpressureError(e)) {
                groupSaveBackpressureUntil = Date.now() + GROUP_SAVE_BACKPRESSURE_COOLDOWN_MS
                lastSyncError.value = `Group save paused after Supabase rate limiting: ${getErrorMessage(e)}`
                console.warn(`⏳ [GROUP-SAVE] Supabase rate-limited group saves; pausing remote group writes for ${GROUP_SAVE_BACKPRESSURE_COOLDOWN_MS / 1000}s and keeping local state`, e)
                return
            }
            console.error('Save Group Error:', e)
            throw e // Re-throw so callers know the save failed
        } finally {
            groupSaveInFlight.delete(group.id)
            isSyncing.value = false
        }
    }

    const deleteGroup = async (groupId: string): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping deleteGroup - not authenticated')
            return
        }
        console.log(`🗑️ [SUPABASE-DELETE-GROUP] Starting soft-delete for group: ${groupId}`)
        try {
            isSyncing.value = true

            // BUG-352: Wrap in withRetry for mobile network resilience
            const { data, error: _error, count: _count } = await withRetry(async () => {
                // TASK-149 FIX: Add user_id filter and verify rows affected
                // TASK-317: Now includes deleted_at after migration
                const { data, error, count } = await getSupabase()
                    .from('groups')
                    .update({ is_deleted: true, deleted_at: new Date().toISOString() }, { count: 'exact' })
                    .eq('id', groupId)
                    .eq('user_id', userId)
                    .select('id, is_deleted')

                console.log(`🗑️ [SUPABASE-DELETE-GROUP] Result - error: ${error?.message || 'none'}, affected: ${count ?? 'unknown'}`)

                if (error) throw error
                return { data, error, count }
            }, 'deleteGroup')

            // Verify the delete actually worked
            if (!data || data.length === 0) {
                // BUG-208 FIX: Treat "no rows updated" as success (idempotent delete).
                console.warn(`⚠️ [SUPABASE-DELETE-GROUP] No rows updated - group ${groupId} likely already deleted or RLS blocked. Proceeding with local removal.`)
            } else {
                console.log(`✅ [SUPABASE-DELETE-GROUP] Group ${groupId} marked as deleted`)
            }
        } catch (e: unknown) {
            console.error(`❌ [SUPABASE-DELETE-GROUP] Failed:`, e)
            handleError(e, 'deleteGroup')
            throw e // Only re-throw actual errors (network, auth, etc)
        } finally {
            isSyncing.value = false
        }
    }

    // TASK-317: Permanent group deletion with tombstone
    const permanentlyDeleteGroup = async (groupId: string): Promise<void> => {
        try {
            isSyncing.value = true
            // Record tombstone before permanent deletion
            await recordTombstone('group', groupId)
            // BUG-352: Wrap in withRetry for mobile network resilience
            await withRetry(async () => {
                const { error } = await getSupabase()
                    .from('groups')
                    .delete()
                    .eq('id', groupId)
                if (error) throw error
            }, 'permanentlyDeleteGroup')
            lastSyncError.value = null
            console.log(`🪦 [PERMANENT-DELETE-GROUP] Group ${groupId} permanently deleted`)
        } catch (e: unknown) {
            handleError(e, 'permanentlyDeleteGroup')
            throw e
        } finally {
            isSyncing.value = false
        }
    }

    // TASK-153: Fetch IDs of deleted groups (for golden backup validation)
    const fetchDeletedGroupIds = async (): Promise<string[]> => {
        try {
            const userId = getUserIdSafe()
            if (!userId) return []

            // BUG-1311: Wrap in withRetry for network resilience
            return await withRetry(async () => {
                const { data, error } = await getSupabase()
                    .from('groups')
                    .select('id')
                    .eq('is_deleted', true)
                    .eq('user_id', userId)

                if (error) throw error
                return data?.map((d: Record<string, unknown>) => d.id as string) || []
            }, 'fetchDeletedGroupIds')
        } catch (e: unknown) {
            console.error('[TASK-153] Failed to fetch deleted group IDs:', e)
            return []
        }
    }

    return {
        fetchGroups,
        saveGroup,
        deleteGroup,
        permanentlyDeleteGroup,
        fetchDeletedGroupIds,
    }
}
