import type { PomodoroSession } from '@/stores/timer'
import {
    toSupabaseTimerSession, fromSupabaseTimerSession,
    type SupabaseTimerSession
} from '@/utils/supabaseMappers'
import { supabase, type DatabaseContext } from './_infrastructure'

export function useTimerDatabase(ctx: DatabaseContext) {
    const { getUserIdSafe, withRetry, handleError } = ctx

    const fetchActiveTimerSession = async (): Promise<PomodoroSession | null> => {
        try {
            const userId = getUserIdSafe()
            console.log('🍅 [DB] fetchActiveTimerSession userId:', userId)
            if (!userId) {
                console.log('🍅 [DB] No userId - returning null')
                return null
            }

            // BUG-1107: Wrap in withRetry for mobile PWA network resilience
            return await withRetry(async () => {
                const { data, error } = await supabase
                    .from('timer_sessions')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('is_active', true)
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                console.log('🍅 [DB] fetchActiveTimerSession result:', { hasData: !!data, error: error?.message })

                if (error) throw error
                if (!data) return null

                return fromSupabaseTimerSession(data as SupabaseTimerSession)
            }, 'fetchActiveTimerSession')
        } catch (e: unknown) {
            handleError(e, 'fetchActiveTimerSession')
            return null
        }
    }

    const saveActiveTimerSession = async (session: PomodoroSession, deviceId: string): Promise<void> => {
        try {
            const userId = getUserIdSafe()
            if (!userId) {
                console.log('🍅 [DB] saveActiveTimerSession - no userId, skipping')
                return
            }

            const payload = toSupabaseTimerSession(session, userId, deviceId)
            console.log('🍅 [DB] saveActiveTimerSession:', { sessionId: session.id, userId, deviceId, isActive: session.isActive })
            // BUG-352: Wrap in withRetry for mobile PWA network resilience (was missing from BUG-1107 fix)
            await withRetry(async () => {
                const { error } = await supabase.from('timer_sessions').upsert(payload, { onConflict: 'id' })
                if (error) {
                    console.error('🍅 [DB] saveActiveTimerSession error:', error)
                    throw error
                }
            }, 'saveActiveTimerSession')
            console.log('🍅 [DB] saveActiveTimerSession success')
        } catch (e: unknown) {
            handleError(e, 'saveActiveTimerSession')
        }
    }

    const deleteTimerSession = async (id: string): Promise<void> => {
        try {
            const userId = getUserIdSafe()
            if (!userId) return // Skip Supabase sync when not authenticated (local-only mode)

            // BUG-352: Wrap in withRetry for mobile PWA network resilience
            await withRetry(async () => {
                const { error } = await supabase.from('timer_sessions').delete().eq('id', id)
                if (error) throw error
            }, 'deleteTimerSession')
        } catch (e: unknown) {
            handleError(e, 'deleteTimerSession')
        }
    }

    return {
        fetchActiveTimerSession,
        saveActiveTimerSession,
        deleteTimerSession,
    }
}
