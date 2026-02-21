import {
    toSupabaseWorkProfile, fromSupabaseWorkProfile,
    type SupabaseWorkProfile, type WorkProfile
} from '@/utils/supabaseMappers'
import { supabase, type DatabaseContext } from './_infrastructure'

export function useWorkProfileDatabase(ctx: DatabaseContext) {
    const { getUserIdSafe, withRetry, handleError } = ctx

    const fetchWorkProfile = async (): Promise<WorkProfile | null> => {
        const userId = getUserIdSafe()
        if (!userId) return null
        try {
            return await withRetry(async () => {
                const { data, error } = await supabase
                    .from('ai_work_profiles')
                    .select('*')
                    .eq('user_id', userId)
                    .maybeSingle()
                if (error) throw error
                if (!data) return null
                return fromSupabaseWorkProfile(data as SupabaseWorkProfile)
            }, 'fetchWorkProfile')
        } catch (e: unknown) {
            console.warn('[FEATURE-1317] Failed to fetch work profile:', e)
            return null
        }
    }

    const saveWorkProfile = async (profile: Partial<WorkProfile>): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveWorkProfile - not authenticated')
            return
        }
        try {
            const payload = toSupabaseWorkProfile(profile, userId)
            const { error } = await supabase
                .from('ai_work_profiles')
                .upsert(payload, { onConflict: 'user_id' })
            if (error) throw error
        } catch (e: unknown) {
            handleError(e, 'saveWorkProfile')
            throw e
        }
    }

    // -- Pomodoro History (FEATURE-1317) --

    const insertPomodoroHistory = async (entry: {
        taskId: string | null
        duration: number
        isBreak: boolean
        startedAt: Date
        completedAt: Date
    }): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) return
        try {
            const { error } = await supabase.from('pomodoro_history').insert({
                user_id: userId,
                task_id: entry.taskId,
                duration: entry.duration,
                is_break: entry.isBreak,
                started_at: entry.startedAt.toISOString(),
                completed_at: entry.completedAt.toISOString()
            })
            if (error) throw error
        } catch (e: unknown) {
            console.warn('[FEATURE-1317] Failed to insert pomodoro history:', e)
        }
    }

    const fetchPomodoroHistory = async (sinceDaysAgo: number = 28): Promise<Array<{
        taskId: string | null
        duration: number
        isBreak: boolean
        startedAt: string
        completedAt: string
    }>> => {
        const userId = getUserIdSafe()
        if (!userId) return []
        try {
            const since = new Date()
            since.setDate(since.getDate() - sinceDaysAgo)
            return await withRetry(async () => {
                const { data, error } = await supabase
                    .from('pomodoro_history')
                    .select('*')
                    .eq('user_id', userId)
                    .gte('completed_at', since.toISOString())
                    .order('completed_at', { ascending: false })
                if (error) throw error
                if (!data) return []
                return data.map((row: any) => ({
                    taskId: row.task_id,
                    duration: row.duration,
                    isBreak: row.is_break,
                    startedAt: row.started_at,
                    completedAt: row.completed_at
                }))
            }, 'fetchPomodoroHistory')
        } catch (e: unknown) {
            console.warn('[FEATURE-1317] Failed to fetch pomodoro history:', e)
            return []
        }
    }

    return {
        fetchWorkProfile,
        saveWorkProfile,
        insertPomodoroHistory,
        fetchPomodoroHistory,
    }
}
