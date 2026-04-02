import { ref, computed, readonly } from 'vue'
import { getSupabase } from '@/composables/supabase/_infrastructure'
import { useAuthStore } from '@/stores/auth'
import type { PresenceState, PresenceStatus } from '@/types/workspace'
import type { RealtimeChannel } from '@supabase/supabase-js'

// Singleton state (shared across all component instances)
const presenceMap = ref<Map<string, PresenceState>>(new Map())
let currentChannel: RealtimeChannel | null = null
let currentWorkspaceId: string | null = null
let visibilityHandler: (() => void) | null = null

export function useWorkspacePresence() {
  const onlineUsers = computed(() => [...presenceMap.value.values()])

  const onlineCount = computed(() => presenceMap.value.size)

  function getUserPresenceStatus(userId: string): PresenceStatus {
    const entry = presenceMap.value.get(userId)
    if (!entry) return 'offline'
    return entry.tabState === 'active' ? 'online' : 'idle'
  }

  function isUserOnline(userId: string): boolean {
    return presenceMap.value.has(userId)
  }

  async function connect(workspaceId: string) {
    // Don't reconnect to same workspace
    if (currentWorkspaceId === workspaceId && currentChannel) return

    // Disconnect previous if any
    await disconnect()

    const authStore = useAuthStore()
    const userId = authStore.user?.id
    if (!userId) return

    currentWorkspaceId = workspaceId

    const supabase = getSupabase()
    const channelName = `presence:${workspaceId}`

    console.debug(`👥 [PRESENCE] Connecting to ${channelName}`)

    const channel = supabase.channel(channelName, {
      config: { presence: { key: userId } }
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceState>()
        const newMap = new Map<string, PresenceState>()

        for (const [key, presences] of Object.entries(state)) {
          // Each key can have multiple presences (multiple tabs)
          // Use the most recent active one, or the first idle one
          const active = (presences as PresenceState[]).find(p => p.tabState === 'active')
          const entry = active || (presences as PresenceState[])[0]
          if (entry) {
            newMap.set(key, { ...entry, userId: key })
          }
        }

        presenceMap.value = newMap
        console.debug(`👥 [PRESENCE] Sync: ${newMap.size} user(s) online`)
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        if (import.meta.env.DEV) {
          console.debug(`👥 [PRESENCE] Join: ${key}`)
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (import.meta.env.DEV) {
          console.debug(`👥 [PRESENCE] Leave: ${key}`)
        }
      })

    await channel.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        console.log('👥 [PRESENCE] Connected! Tracking...')
        await channel.track({
          userId,
          tabState: document.visibilityState === 'visible' ? 'active' : 'idle',
          joinedAt: new Date().toISOString(),
        })
      }
    })

    currentChannel = channel

    // Track visibility changes for active/idle state
    visibilityHandler = async () => {
      if (!currentChannel) return
      const tabState = document.visibilityState === 'visible' ? 'active' : 'idle'
      try {
        await currentChannel.track({
          userId,
          tabState,
          joinedAt: new Date().toISOString(),
        })
      } catch (e) {
        console.warn('👥 [PRESENCE] Failed to update tab state:', e)
      }
    }
    document.addEventListener('visibilitychange', visibilityHandler)
  }

  async function disconnect() {
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler)
      visibilityHandler = null
    }

    if (currentChannel) {
      console.debug('👥 [PRESENCE] Disconnecting...')
      try {
        await currentChannel.untrack()
        await getSupabase().removeChannel(currentChannel)
      } catch (e) {
        console.warn('👥 [PRESENCE] Cleanup error:', e)
      }
      currentChannel = null
    }

    currentWorkspaceId = null
    presenceMap.value = new Map()
  }

  return {
    onlineUsers,
    onlineCount,
    presenceMap: readonly(presenceMap),
    getUserPresenceStatus,
    isUserOnline,
    connect,
    disconnect,
  }
}
