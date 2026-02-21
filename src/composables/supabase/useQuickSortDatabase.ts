import type { SessionSummary } from '@/stores/quickSort'
import {
    toSupabaseQuickSortSession, fromSupabaseQuickSortSession,
    type SupabaseQuickSortSession
} from '@/utils/supabaseMappers'
import { supabase, type DatabaseContext } from './_infrastructure'

export function useQuickSortDatabase(ctx: DatabaseContext) {
    const { getUserIdSafe, withRetry, handleError } = ctx

    const fetchQuickSortHistory = async (): Promise<SessionSummary[]> => {
        try {
            // BUG-1311: Wrap in withRetry for network resilience (was missing)
            return await withRetry(async () => {
                const { data, error } = await supabase
                    .from('quick_sort_sessions')
                    .select('*')
                    .order('completed_at', { ascending: false })

                if (error) throw error
                if (!data) return []

                return (data as SupabaseQuickSortSession[]).map(fromSupabaseQuickSortSession)
            }, 'fetchQuickSortHistory')
        } catch (e: unknown) {
            handleError(e, 'fetchQuickSortHistory')
            return []
        }
    }

    const saveQuickSortSession = async (summary: SessionSummary): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveQuickSortSession - not authenticated')
            return
        }
        try {
            const payload = toSupabaseQuickSortSession(summary, userId)
            // BUG-352: Wrap in withRetry for mobile network resilience
            await withRetry(async () => {
                const { error } = await supabase.from('quick_sort_sessions').upsert(payload, { onConflict: 'id' })
                if (error) throw error
            }, 'saveQuickSortSession')
        } catch (e: unknown) {
            handleError(e, 'saveQuickSortSession')
            throw e // BUG-1051: Re-throw so caller knows save failed
        }
    }

    return {
        fetchQuickSortHistory,
        saveQuickSortSession,
    }
}
