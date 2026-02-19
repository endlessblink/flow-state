/**
 * useAISync — Supabase persistence for AI conversations, settings, and usage.
 * TASK-1344: Cross-device AI data sync.
 *
 * Responsibilities:
 * - On auth: load remote conversations and merge with local
 * - On conversation change (debounced): upsert to Supabase
 * - On conversation delete: delete from Supabase
 * - On settings change (debounced): save ai_settings to user_settings row
 * - On app load: push local usage entries to Supabase daily aggregates
 * - Periodically flush new usage entries (5s debounce)
 */

import { watch, ref } from 'vue'
import { useAIChatStore } from '@/stores/aiChat'
import { useAuthStore } from '@/stores/auth'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import { getUsageEntries } from '@/services/ai/usageTracker'

const CONVERSATION_SYNC_DEBOUNCE_MS = 2000
const SETTINGS_SYNC_DEBOUNCE_MS = 1000
const USAGE_SYNC_DEBOUNCE_MS = 5000
const USAGE_PRUNE_DAYS = 90
const USAGE_STORAGE_KEY = 'flowstate-ai-usage-log'

// Module-level singleton to prevent multiple initializations
let isWatching = false

export function useAISync() {
  const store = useAIChatStore()
  const authStore = useAuthStore()
  const db = useSupabaseDatabase()

  const isSyncing = ref(false)
  const lastSyncError = ref<string | null>(null)

  const conversationSyncTimers = new Map<string, ReturnType<typeof setTimeout>>()
  let settingsSyncTimer: ReturnType<typeof setTimeout> | null = null
  let usageSyncTimer: ReturnType<typeof setTimeout> | null = null
  // Track which usage entries have been synced to avoid double-counting
  let lastSyncedUsageCount = 0

  // ======================================================================
  // Load from Supabase on auth (called from useAppInitialization)
  // ======================================================================

  async function loadFromSupabase(): Promise<void> {
    if (!authStore.isAuthenticated) return

    isSyncing.value = true
    try {
      await Promise.all([
        loadSettings(),
        loadConversations(),
        pushUsageToSupabase(),
      ])
    } catch (e) {
      lastSyncError.value = String(e)
      console.warn('[AI-SYNC] loadFromSupabase failed:', e)
    } finally {
      isSyncing.value = false
    }
  }

  /**
   * Load AI settings (provider, model, chatDirection) from Supabase.
   * Supabase wins if it has a value; localStorage is the fallback.
   */
  async function loadSettings(): Promise<void> {
    const remoteSettings = await db.fetchAISettings()
    if (remoteSettings) {
      store.saveSettings(remoteSettings)
    }
  }

  /**
   * Load conversations and merge with local.
   * Merge strategy: union of local + remote, most-recent updatedAt wins per ID.
   * Conversations with active streaming are skipped (not overwritten).
   */
  async function loadConversations(): Promise<void> {
    const remoteConvs = await db.fetchAIConversations()
    if (remoteConvs.length === 0) return

    const localConvs = store.conversations

    // Build map: id → most-recent version
    const merged = new Map<string, (typeof localConvs)[0]>()

    for (const local of localConvs) {
      merged.set(local.id, local)
    }

    for (const remote of remoteConvs) {
      const existing = merged.get(remote.id)

      // Don't overwrite a conversation that is currently streaming
      if (existing) {
        const hasStreamingMsg = existing.messages.some(m => m.isStreaming)
        if (hasStreamingMsg) continue
      }

      if (!existing || remote.updatedAt > existing.updatedAt) {
        merged.set(remote.id, remote)
      }
    }

    // Sort by updatedAt desc, keep top 20
    const sorted = Array.from(merged.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 20)

    store.conversations = sorted

    // Ensure active conversation is still valid
    if (store.activeConversationId && !sorted.find(c => c.id === store.activeConversationId)) {
      store.activeConversationId = sorted[0]?.id || null
    }
  }

  /**
   * Push accumulated local usage entries to Supabase as daily aggregates.
   * Prune entries older than 90 days from localStorage after sync.
   */
  async function pushUsageToSupabase(): Promise<void> {
    const entries = getUsageEntries().value
    if (entries.length === 0) return

    await db.syncAIUsageLog(entries)

    // Track that we've synced these entries
    lastSyncedUsageCount = entries.length

    // Prune old entries from localStorage
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - USAGE_PRUNE_DAYS)
    const pruned = entries.filter(e => new Date(e.timestamp) >= cutoff)
    if (pruned.length < entries.length) {
      getUsageEntries().value = pruned
      try {
        localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(pruned))
      } catch { /* ignore */ }
    }
  }

  // ======================================================================
  // Watchers — Sync on change (debounced)
  // ======================================================================

  function startWatching(): void {
    if (isWatching) return
    isWatching = true

    // Watch conversations for per-conversation debounced upsert
    watch(
      () => store.conversations,
      (newConvs) => {
        if (!authStore.isAuthenticated) return

        for (const conv of newConvs) {
          scheduleSaveConversation(conv.id)
        }
      },
      { deep: true }
    )

    // Watch settings
    watch(
      () => store.persistedSettings,
      (settings) => {
        if (!authStore.isAuthenticated || !settings) return
        scheduleSaveSettings(settings)
      },
      { deep: true }
    )

    // Watch usage entries for periodic flush
    watch(
      getUsageEntries(),
      () => {
        if (!authStore.isAuthenticated) return
        scheduleUsageSync()
      },
    )

    // Register delete callback on the store
    store.onConversationDelete((id: string) => {
      onConversationDeleted(id)
    })
  }

  function scheduleSaveConversation(id: string): void {
    const existing = conversationSyncTimers.get(id)
    if (existing) clearTimeout(existing)
    conversationSyncTimers.set(id, setTimeout(async () => {
      const conv = store.conversations.find(c => c.id === id)
      if (conv) {
        await db.saveAIConversation(conv)
      }
      conversationSyncTimers.delete(id)
    }, CONVERSATION_SYNC_DEBOUNCE_MS))
  }

  function scheduleSaveSettings(settings: { provider: string; model: string; chatDirection?: 'auto' | 'ltr' | 'rtl' }): void {
    if (settingsSyncTimer) clearTimeout(settingsSyncTimer)
    settingsSyncTimer = setTimeout(async () => {
      await db.saveAISettings(settings)
      settingsSyncTimer = null
    }, SETTINGS_SYNC_DEBOUNCE_MS)
  }

  function scheduleUsageSync(): void {
    if (usageSyncTimer) clearTimeout(usageSyncTimer)
    usageSyncTimer = setTimeout(async () => {
      const entries = getUsageEntries().value
      // Only sync new entries (ones added after last sync)
      const newEntries = entries.slice(lastSyncedUsageCount)
      if (newEntries.length > 0) {
        await db.syncAIUsageLog(newEntries)
        lastSyncedUsageCount = entries.length
      }
      usageSyncTimer = null
    }, USAGE_SYNC_DEBOUNCE_MS)
  }

  async function onConversationDeleted(id: string): Promise<void> {
    if (!authStore.isAuthenticated) return
    // Cancel any pending save for this ID
    const timer = conversationSyncTimers.get(id)
    if (timer) {
      clearTimeout(timer)
      conversationSyncTimers.delete(id)
    }
    await db.deleteAIConversation(id)
  }

  return {
    isSyncing,
    lastSyncError,
    loadFromSupabase,
    pushUsageToSupabase,
    onConversationDeleted,
    startWatching,
  }
}
