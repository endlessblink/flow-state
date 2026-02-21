import type { Project } from '@/types/tasks'
import {
    toSupabaseProject, fromSupabaseProject,
    type SupabaseProject
} from '@/utils/supabaseMappers'
import { supabase, swrCache, type DatabaseContext } from './_infrastructure'
import { useTombstoneDatabase } from './_tombstone'

export function useProjectsDatabase(ctx: DatabaseContext) {
    const { authStore, isSyncing, lastSyncError, getUserIdSafe, withRetry, handleError } = ctx
    const { recordTombstone } = useTombstoneDatabase(ctx)

    const fetchProjects = async (): Promise<Project[]> => {
        // TASK-1060: Ensure auth is initialized before fetching
        if (!authStore.isInitialized) {
            console.log('🔄 [TASK-1060] Auth not initialized, waiting...')
            await authStore.initialize()
        }

        const userId = getUserIdSafe()
        // BUG-1056: Check if user changed since last fetch - invalidates cache if so
        swrCache.checkUserChange(userId)
        const cacheKey = `projects:${userId || 'guest'}`

        return swrCache.getOrFetch(cacheKey, async () => {
            try {
                return await withRetry(async () => {
                    const { data, error } = await supabase
                        .from('projects')
                        .select('*')
                        .order('created_at', { ascending: true })

                    if (error) throw error
                    if (!data) return []

                    return (data as SupabaseProject[]).map(fromSupabaseProject)
                }, 'fetchProjects')
            } catch (e: unknown) {
                handleError(e, 'fetchProjects')
                return []
            }
        })
    }

    const saveProject = async (project: Project): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveProject - not authenticated')
            return
        }
        try {
            isSyncing.value = true
            const payload = toSupabaseProject(project, userId)
            // BUG-352: Wrap in withRetry for mobile network resilience
            await withRetry(async () => {
                const { error } = await supabase.from('projects').upsert(payload, { onConflict: 'id' })
                if (error) throw error
            }, 'saveProject')
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'saveProject')
            throw e // BUG-1051: Re-throw so caller knows save failed
        } finally {
            isSyncing.value = false
        }
    }

    const saveProjects = async (projects: Project[]): Promise<void> => {
        if (projects.length === 0) return
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveProjects - not authenticated')
            return
        }
        try {
            isSyncing.value = true
            const payload = projects.map(p => toSupabaseProject(p, userId))
            // BUG-352: Wrap in withRetry for mobile network resilience
            await withRetry(async () => {
                // BUG-171 FIX: Add .select() and verify data.length to detect RLS partial write failures
                const { data, error } = await supabase.from('projects').upsert(payload, { onConflict: 'id' }).select('id')
                if (error) throw error
                if (!data || data.length !== payload.length) {
                    const writtenCount = data?.length ?? 0
                    const failedCount = payload.length - writtenCount
                    throw new Error(`RLS blocked ${failedCount} of ${payload.length} project writes (only ${writtenCount} succeeded)`)
                }
            }, 'saveProjects')
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'saveProjects')
            throw e // BUG-171: Re-throw so callers know the save failed
        } finally {
            isSyncing.value = false
        }
    }

    const deleteProject = async (projectId: string): Promise<void> => {
        try {
            isSyncing.value = true
            // BUG-352: Wrap in withRetry for mobile network resilience
            await withRetry(async () => {
                const { error } = await supabase
                    .from('projects')
                    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
                    .eq('id', projectId)
                if (error) throw error
            }, 'deleteProject')
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'deleteProject')
            throw e // BUG-1051: Re-throw so caller knows save failed
        } finally {
            isSyncing.value = false
        }
    }

    const restoreProject = async (projectId: string): Promise<void> => {
        try {
            isSyncing.value = true
            // BUG-352: Wrap in withRetry for mobile network resilience
            await withRetry(async () => {
                const { error } = await supabase
                    .from('projects')
                    .update({ is_deleted: false, deleted_at: null })
                    .eq('id', projectId)
                if (error) throw error
            }, 'restoreProject')
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'restoreProject')
            throw e // BUG-1051: Re-throw so caller knows save failed
        } finally {
            isSyncing.value = false
        }
    }

    const permanentlyDeleteProject = async (projectId: string): Promise<void> => {
        try {
            isSyncing.value = true
            // TASK-317: Record tombstone before permanent deletion
            await recordTombstone('project', projectId)
            // BUG-352: Wrap in withRetry for mobile network resilience
            await withRetry(async () => {
                const { error } = await supabase
                    .from('projects')
                    .delete()
                    .eq('id', projectId)
                if (error) throw error
            }, 'permanentlyDeleteProject')
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'permanentlyDeleteProject')
        } finally {
            isSyncing.value = false
        }
    }

    // TASK-153: Fetch IDs of deleted projects (for golden backup validation)
    const fetchDeletedProjectIds = async (): Promise<string[]> => {
        try {
            const userId = getUserIdSafe()
            if (!userId) return []

            // BUG-1311: Wrap in withRetry for network resilience
            return await withRetry(async () => {
                const { data, error } = await supabase
                    .from('projects')
                    .select('id')
                    .eq('is_deleted', true)
                    .eq('user_id', userId)

                if (error) throw error
                return data?.map((d: any) => d.id) || []
            }, 'fetchDeletedProjectIds')
        } catch (e: unknown) {
            console.error('[TASK-153] Failed to fetch deleted project IDs:', e)
            return []
        }
    }

    return {
        fetchProjects,
        saveProject,
        saveProjects,
        deleteProject,
        restoreProject,
        permanentlyDeleteProject,
        fetchDeletedProjectIds,
    }
}
