import { ref, onUnmounted } from 'vue'
import { supabase } from '@/services/auth/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { invalidateCache } from '@/composables/useSupabaseDatabase'

interface RealtimeSyncDeps {
    userId: string | undefined
}

export function useSupabaseRealtimeSync(deps: RealtimeSyncDeps) {
    const { userId } = deps

    const isSubscribed = ref(false)
    let channel: RealtimeChannel | null = null

    const subscribe = (
        onTaskChange: (payload: any) => void,
        onTimerChange: (payload: any) => void,
        onProjectChange?: (payload: any) => void,
        onGroupChange?: (payload: any) => void
    ) => {
        if (!userId || channel) return

        channel = supabase
            .channel(`user-${userId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'tasks',
                filter: `user_id=eq.${userId}`
            }, (payload: unknown) => {
                // TASK-1060: Invalidate SWR cache on realtime events
                invalidateCache.tasks()
                onTaskChange(payload)
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'timer_sessions',
                filter: `user_id=eq.${userId}`
            }, onTimerChange)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'projects',
                filter: `user_id=eq.${userId}`
            }, (payload: unknown) => {
                // TASK-1060: Invalidate SWR cache on realtime events
                invalidateCache.projects()
                onProjectChange?.(payload)
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'groups',
                filter: `user_id=eq.${userId}`
            }, (payload: unknown) => {
                // TASK-1060: Invalidate SWR cache on realtime events
                invalidateCache.groups()
                onGroupChange?.(payload)
            })
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
