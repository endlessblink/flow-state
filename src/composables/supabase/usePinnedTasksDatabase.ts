import type { PinnedTask } from '@/types/quickTasks'
import {
    toSupabasePinnedTask, fromSupabasePinnedTask,
    type SupabasePinnedTask
} from '@/utils/supabaseMappers'
import { supabase, swrCache, invalidateCache, type DatabaseContext } from './_infrastructure'

export function usePinnedTasksDatabase(ctx: DatabaseContext) {
    const { getUserIdSafe, withRetry, handleError } = ctx

    const fetchPinnedTasks = async (): Promise<PinnedTask[]> => {
        const userId = getUserIdSafe()
        if (!userId) return []

        try {
            return await swrCache.getOrFetch(`pinnedTasks:${userId}`, async () => {
                return await withRetry(async () => {
                    const { data, error } = await supabase
                        .from('pinned_tasks')
                        .select('*')
                        .eq('user_id', userId)
                        .order('sort_order', { ascending: true })

                    if (error) throw error
                    if (!data) return []

                    return (data as SupabasePinnedTask[]).map(fromSupabasePinnedTask)
                }, 'fetchPinnedTasks')
            })
        } catch (e: unknown) {
            handleError(e, 'fetchPinnedTasks')
            return []
        }
    }

    const savePinnedTask = async (pin: PinnedTask): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('[GUEST] Skipping savePinnedTask - not authenticated')
            return
        }
        try {
            const payload = toSupabasePinnedTask(pin, userId)
            // BUG-352: Wrap in withRetry for mobile network resilience
            await withRetry(async () => {
                const { error } = await supabase.from('pinned_tasks').upsert(payload, { onConflict: 'id' })
                if (error) throw error
            }, 'savePinnedTask')
            invalidateCache.pinnedTasks()
        } catch (e: unknown) {
            handleError(e, 'savePinnedTask')
            throw e
        }
    }

    const deletePinnedTask = async (pinId: string): Promise<void> => {
        try {
            // BUG-352: Wrap in withRetry for mobile network resilience
            await withRetry(async () => {
                const { error } = await supabase.from('pinned_tasks').delete().eq('id', pinId)
                if (error) throw error
            }, 'deletePinnedTask')
            invalidateCache.pinnedTasks()
        } catch (e: unknown) {
            handleError(e, 'deletePinnedTask')
            throw e
        }
    }

    const reorderPinnedTasks = async (pins: PinnedTask[]): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) return
        try {
            const payload = pins.map((pin, index) => ({
                ...toSupabasePinnedTask({ ...pin, sortOrder: index }, userId)
            }))
            // BUG-352: Wrap in withRetry for mobile network resilience
            await withRetry(async () => {
                const { error } = await supabase.from('pinned_tasks').upsert(payload, { onConflict: 'id' })
                if (error) throw error
            }, 'reorderPinnedTasks')
            invalidateCache.pinnedTasks()
        } catch (e: unknown) {
            handleError(e, 'reorderPinnedTasks')
            throw e
        }
    }

    return {
        fetchPinnedTasks,
        savePinnedTask,
        deletePinnedTask,
        reorderPinnedTasks,
    }
}
