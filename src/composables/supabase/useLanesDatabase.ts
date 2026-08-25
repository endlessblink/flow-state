import type { Lane } from '@/types/tasks'
import {
    toSupabaseLane, fromSupabaseLane,
    type SupabaseLane
} from '@/utils/supabaseMappers'
import { getSupabase, swrCache, invalidateCache, type DatabaseContext } from './_infrastructure'
import { useTombstoneDatabase } from './_tombstone'

// TASK-1812: Lanes DB module — mirrors useProjectsDatabase. Lanes are sprint-style
// cross-project goals; CRUD + soft-delete + tombstone, same shape as projects.
export function useLanesDatabase(ctx: DatabaseContext) {
    const { authStore, isSyncing, lastSyncError, getUserIdSafe, withRetry, handleError } = ctx
    const { recordTombstone } = useTombstoneDatabase(ctx)

    const fetchLanes = async (
        workspaceId?: string | null,
        options?: { onError?: (error: unknown) => void },
    ): Promise<Lane[]> => {
        if (!authStore.isInitialized) {
            await authStore.initialize()
        }

        const userId = getUserIdSafe()
        swrCache.checkUserChange(userId)
        const wsKey = workspaceId === undefined ? 'all' : (workspaceId ?? 'personal')
        const cacheKey = `lanes:${userId || 'guest'}:ws:${wsKey}`

        try {
            return await swrCache.getOrFetch(cacheKey, async () => {
                try {
                return await withRetry(async () => {
                    let query = getSupabase()
                        .from('lanes')
                        .select('*')

                    if (workspaceId === null) {
                        query = query.is('workspace_id', null)
                    } else if (typeof workspaceId === 'string') {
                        query = query.eq('workspace_id', workspaceId)
                    }

                    const { data, error } = await query
                        .or('is_deleted.is.null,is_deleted.eq.false')
                        .order('created_at', { ascending: true })

                    if (error) throw error
                    if (!data) return []

                    return (data as SupabaseLane[]).map(fromSupabaseLane)
                }, 'fetchLanes')
                } catch (e: unknown) {
                    handleError(e, 'fetchLanes')
                    options?.onError?.(e)
                    throw e
                }
            })
        } catch {
            return []
        }
    }

    const saveLane = async (lane: Lane): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveLane - not authenticated')
            return
        }
        try {
            isSyncing.value = true
            const payload = toSupabaseLane(lane, userId)
            await withRetry(async () => {
                const { error } = await getSupabase().from('lanes').upsert(payload, { onConflict: 'id' })
                if (error) throw error
            }, 'saveLane')
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'saveLane')
            throw e
        } finally {
            isSyncing.value = false
        }
    }

    const saveLanes = async (lanes: Lane[]): Promise<void> => {
        if (lanes.length === 0) return
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveLanes - not authenticated')
            return
        }
        try {
            isSyncing.value = true
            const payload = lanes.map(l => toSupabaseLane(l, userId))
            await withRetry(async () => {
                // Add .select() and verify length to detect RLS partial write failures
                const { data, error } = await getSupabase().from('lanes').upsert(payload, { onConflict: 'id' }).select('id')
                if (error) throw error
                if (!data || data.length !== payload.length) {
                    const writtenCount = data?.length ?? 0
                    const failedCount = payload.length - writtenCount
                    throw new Error(`RLS blocked ${failedCount} of ${payload.length} lane writes (only ${writtenCount} succeeded)`)
                }
            }, 'saveLanes')
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'saveLanes')
            throw e
        } finally {
            isSyncing.value = false
        }
    }

    const deleteLane = async (laneId: string): Promise<void> => {
        try {
            isSyncing.value = true
            await withRetry(async () => {
                const { error } = await getSupabase()
                    .from('lanes')
                    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
                    .eq('id', laneId)
                if (error) throw error
            }, 'deleteLane')
            invalidateCache.lanes?.()
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'deleteLane')
            throw e
        } finally {
            isSyncing.value = false
        }
    }

    const restoreLane = async (laneId: string): Promise<void> => {
        try {
            isSyncing.value = true
            await withRetry(async () => {
                const { error } = await getSupabase()
                    .from('lanes')
                    .update({ is_deleted: false, deleted_at: null })
                    .eq('id', laneId)
                if (error) throw error
            }, 'restoreLane')
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'restoreLane')
            throw e
        } finally {
            isSyncing.value = false
        }
    }

    const permanentlyDeleteLane = async (laneId: string): Promise<void> => {
        try {
            isSyncing.value = true
            await recordTombstone('lane', laneId)
            await withRetry(async () => {
                const { error } = await getSupabase()
                    .from('lanes')
                    .delete()
                    .eq('id', laneId)
                if (error) throw error
            }, 'permanentlyDeleteLane')
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'permanentlyDeleteLane')
            throw e
        } finally {
            isSyncing.value = false
        }
    }

    return {
        fetchLanes,
        saveLane,
        saveLanes,
        deleteLane,
        restoreLane,
        permanentlyDeleteLane,
    }
}
