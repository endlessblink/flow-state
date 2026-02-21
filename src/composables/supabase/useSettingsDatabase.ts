import type { AppSettings } from '@/stores/settings'
import {
    toSupabaseUserSettings, fromSupabaseUserSettings,
    type SupabaseUserSettings
} from '@/utils/supabaseMappers'
import { supabase, type DatabaseContext } from './_infrastructure'

export function useSettingsDatabase(ctx: DatabaseContext) {
    const { getUserIdSafe, withRetry, handleError } = ctx

    const fetchUserSettings = async (): Promise<AppSettings | null> => {
        try {
            const userId = getUserIdSafe()
            if (!userId) return null

            // BUG-1311: Wrap in withRetry for network resilience
            return await withRetry(async () => {
                const { data, error } = await supabase
                    .from('user_settings')
                    .select('*')
                    .eq('user_id', userId)
                    .maybeSingle()

                if (error) throw error
                if (!data) return null

                return fromSupabaseUserSettings(data as SupabaseUserSettings)
            }, 'fetchUserSettings')
        } catch (e: unknown) {
            console.error('Fetch User Settings Error:', e)
            return null
        }
    }

    const saveUserSettings = async (settings: AppSettings): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveUserSettings - not authenticated')
            return
        }
        try {
            const payload = toSupabaseUserSettings(settings, userId)

            await withRetry(async () => {
                // Fix: Explicitly specify conflict target to handle 'user_settings_user_id_key' violation
                const { error } = await supabase.from('user_settings').upsert(payload, { onConflict: 'user_id' })
                if (error) throw error
            }, 'saveUserSettings')
        } catch (e: unknown) {
            handleError(e, 'saveUserSettings')
            throw e // BUG-1051: Re-throw so caller knows save failed
        }
    }

    return {
        fetchUserSettings,
        saveUserSettings,
    }
}
