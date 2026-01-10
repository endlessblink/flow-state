import { ref, onUnmounted } from 'vue'
import { supabase } from '@/services/auth/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface RealtimeSyncDeps {
    userId: string | undefined
}

export function useSupabaseRealtimeSync(deps: RealtimeSyncDeps) {
    const { userId } = deps

    const isSubscribed = ref(false)
    let channel: RealtimeChannel | null = null

    const subscribe = (
        onTaskChange: (payload: any) => void,
        onTimerChange: (payload: any) => void
    ) => {
        if (!userId || channel) return

        channel = supabase
            .channel(`user-${userId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'tasks',
                filter: `user_id=eq.${userId}`
            }, onTaskChange)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'timer_sessions',
                filter: `user_id=eq.${userId}`
            }, onTimerChange)
            .subscribe()

        isSubscribed.value = true
    }

    const unsubscribe = () => {
        if (channel) {
            supabase.removeChannel(channel)
            channel = null
        }
        isSubscribed.value = false
    }

    onUnmounted(() => {
        unsubscribe()
    })

    return {
        isSubscribed,
        subscribe,
        unsubscribe
    }
}
