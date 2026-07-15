import type { PomodoroSession } from '@/stores/timer'
import {
    fromSupabaseTimerSession,
    type SupabaseTimerSession
} from '@/utils/supabaseMappers'
import { getSupabase, type DatabaseContext } from './_infrastructure'

const CLAIM_LEADERSHIP_ERROR_LOG_WINDOW_MS = 60_000

let lastClaimLeadershipErrorKey = ''
let lastClaimLeadershipErrorAt = 0

function toErrorLogKey(error: unknown): string {
    if (error instanceof Error) return error.message
    if (typeof error === 'string') return error

    try {
        return JSON.stringify(error)
    } catch {
        return String(error)
    }
}

function shouldLogClaimLeadershipError(error: unknown): boolean {
    const now = Date.now()
    const key = toErrorLogKey(error)
    const shouldLog =
        key !== lastClaimLeadershipErrorKey ||
        now - lastClaimLeadershipErrorAt > CLAIM_LEADERSHIP_ERROR_LOG_WINDOW_MS

    if (shouldLog) {
        lastClaimLeadershipErrorKey = key
        lastClaimLeadershipErrorAt = now
    }

    return shouldLog
}

export function useTimerDatabase(ctx: DatabaseContext) {
    const { getUserIdSafe, withRetry, handleError } = ctx

    const fetchActiveTimerSession = async (): Promise<PomodoroSession | null> => {
        try {
            const userId = getUserIdSafe()
            if (import.meta.env.DEV) console.log('🍅 [DB] fetchActiveTimerSession userId:', userId)
            if (!userId) {
                if (import.meta.env.DEV) console.log('🍅 [DB] No userId - returning null')
                return null
            }

            // BUG-1107: Wrap in withRetry for mobile PWA network resilience
            return await withRetry(async () => {
                const { data, error } = await getSupabase()
                    .from('timer_sessions')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('is_active', true)
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (import.meta.env.DEV) console.log('🍅 [DB] fetchActiveTimerSession result:', { hasData: !!data, error: error?.message })

                if (error) throw error
                if (!data) return null

                return fromSupabaseTimerSession(data as SupabaseTimerSession)
            }, 'fetchActiveTimerSession')
        } catch (e: unknown) {
            handleError(e, 'fetchActiveTimerSession')
            return null
        }
    }

    /**
     * BUG-1511: Atomic leadership claim via Supabase RPC.
     * The RPC performs a conditional UPDATE — it only sets device_leader_id when
     * the current leader is null, the same device, or the lease has expired.
     * Returns true if this device was granted leadership, false if another device
     * holds a fresh lease.
     */
    const claimLeadership = async (sessionId: string, deviceId: string): Promise<boolean> => {
        try {
            const userId = getUserIdSafe()
            if (!userId) return false

            const { data, error } = await getSupabase().rpc('claim_timer_leadership', {
                p_session_id: sessionId,
                p_new_leader: deviceId,
            })

            if (error) {
                if (shouldLogClaimLeadershipError(error)) {
                    console.error('🍅 [DB] claimLeadership RPC error:', error)
                }
                return false
            }

            return data === true
        } catch (e: unknown) {
            handleError(e, 'claimLeadership')
            return false
        }
    }

    const heartbeatTimerSession = async (
        sessionId: string,
        deviceId: string,
        remainingTime: number,
    ): Promise<boolean> => {
        try {
            const userId = getUserIdSafe()
            if (!userId) return false
            const { data, error } = await getSupabase().rpc('heartbeat_timer_session', {
                p_session_id: sessionId,
                p_device_id: deviceId,
                p_remaining_time: Math.max(0, Math.floor(remainingTime)),
            })
            if (error) {
                console.error('🍅 [DB] heartbeatTimerSession RPC error:', error)
                return false
            }
            return data === true
        } catch (e: unknown) {
            handleError(e, 'heartbeatTimerSession')
            return false
        }
    }

    return {
        fetchActiveTimerSession,
        claimLeadership,
        heartbeatTimerSession,
    }
}
