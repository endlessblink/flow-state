import type { ScheduledNotification } from '@/types/recurrence'
import {
    toSupabaseNotification, fromSupabaseNotification,
    type SupabaseNotification
} from '@/utils/supabaseMappers'
import { supabase, type DatabaseContext } from './_infrastructure'

export function useNotificationsDatabase(ctx: DatabaseContext) {
    const { getUserIdSafe, withRetry, handleError } = ctx

    const fetchNotifications = async (): Promise<ScheduledNotification[]> => {
        try {
            // BUG-1107: Wrap in withRetry for mobile PWA network resilience
            return await withRetry(async () => {
                const { data, error } = await supabase
                    .from('notifications')
                    .select('*')
                    .eq('is_dismissed', false)

                if (error) throw error
                if (!data) return []

                return (data as SupabaseNotification[]).map(fromSupabaseNotification)
            }, 'fetchNotifications')
        } catch (e: unknown) {
            handleError(e, 'fetchNotifications')
            return []
        }
    }

    const saveNotification = async (notification: ScheduledNotification): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveNotification - not authenticated')
            return
        }
        try {
            const payload = toSupabaseNotification(notification, userId)
            // BUG-352: Wrap in withRetry for mobile network resilience
            await withRetry(async () => {
                const { error } = await supabase.from('notifications').upsert(payload, { onConflict: 'id' })
                if (error) throw error
            }, 'saveNotification')
        } catch (e: unknown) {
            handleError(e, 'saveNotification')
            throw e // BUG-1051: Re-throw so caller knows save failed
        }
    }

    const saveNotifications = async (notifications: ScheduledNotification[]): Promise<void> => {
        if (notifications.length === 0) return
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveNotifications - not authenticated')
            return
        }
        try {
            const payload = notifications.map(n => toSupabaseNotification(n, userId))
            // BUG-352: Wrap in withRetry for mobile network resilience
            await withRetry(async () => {
                const { error } = await supabase.from('notifications').upsert(payload, { onConflict: 'id' })
                if (error) throw error
            }, 'saveNotifications')
        } catch (e: unknown) {
            handleError(e, 'saveNotifications')
            throw e // BUG-1051: Re-throw so caller knows save failed
        }
    }

    const deleteNotification = async (id: string): Promise<void> => {
        try {
            // BUG-352: Wrap in withRetry for mobile network resilience
            await withRetry(async () => {
                const { error } = await supabase.from('notifications').delete().eq('id', id)
                if (error) throw error
            }, 'deleteNotification')
        } catch (e: unknown) {
            handleError(e, 'deleteNotification')
            throw e // BUG-1051: Re-throw so caller knows save failed
        }
    }

    return {
        fetchNotifications,
        saveNotification,
        saveNotifications,
        deleteNotification,
    }
}
