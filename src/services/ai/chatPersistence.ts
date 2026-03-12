/**
 * AI Chat Persistence — Supabase CRUD for conversations
 *
 * VPS-first architecture: Supabase is the primary persistence layer.
 * localStorage is the backup/offline cache.
 *
 * All operations silently fail (log warnings, don't throw) so that
 * existing localStorage-only flow is never broken.
 *
 * @see TASK-1500 in MASTER_PLAN.md
 */

import { supabase } from '@/services/auth/supabase'
import type { Conversation } from '@/stores/aiChat'

// ============================================================================
// Helpers
// ============================================================================

function getClient() {
  return supabase
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Load all conversations for the current user from Supabase.
 * Returns null if not authenticated or on any error.
 */
export async function loadConversationsFromSupabase(): Promise<Conversation[] | null> {
  const client = getClient()
  if (!client) return null

  try {
    const { data: { user } } = await client.auth.getUser()
    if (!user?.id) return null

    const { data, error } = await client
      .from('ai_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(20)

    if (error || !data) {
      if (error) console.warn('[ChatPersistence] Load failed:', error.message)
      return null
    }

    return data.map(row => ({
      id: row.id as string,
      title: row.title as string,
      messages: ((row.messages || []) as Array<Record<string, unknown>>).map(m => ({
        id: m.id as string,
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content as string,
        timestamp: new Date(m.timestamp as string),
        isStreaming: false,
        error: m.error as string | undefined,
        taskId: m.taskId as string | undefined,
        metadata: m.metadata as Record<string, unknown> | undefined,
        // actions are NOT restored (handlers are functions — not serializable)
      })),
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    }))
  } catch (err) {
    console.warn('[ChatPersistence] Load error:', err)
    return null
  }
}

/**
 * Save (upsert) a single conversation to Supabase.
 * Strips non-serializable fields (action handlers, Vue refs) before saving.
 * Returns true on success, false on any error.
 */
export async function saveConversationToSupabase(conversation: Conversation): Promise<boolean> {
  const client = getClient()
  if (!client) return false

  try {
    const { data: { user } } = await client.auth.getUser()
    if (!user?.id) return false

    const serializedMessages = conversation.messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
      isStreaming: false,
      error: m.error,
      taskId: m.taskId,
      // Serialize only safe metadata fields — skip toolResults (may contain Vue reactivity)
      metadata: m.metadata ? {
        model: m.metadata.model,
        provider: m.metadata.provider,
        tokens: m.metadata.tokens,
        latencyMs: m.metadata.latencyMs,
        forceDirection: m.metadata.forceDirection,
      } : undefined,
      // actions intentionally omitted (function handlers)
    }))

    const { error } = await client
      .from('ai_conversations')
      .upsert({
        id: conversation.id,
        user_id: user.id,
        title: conversation.title,
        messages: serializedMessages,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

    if (error) {
      console.warn('[ChatPersistence] Save failed:', error.message)
      return false
    }

    return true
  } catch (err) {
    console.warn('[ChatPersistence] Save error:', err)
    return false
  }
}

/**
 * Delete a conversation from Supabase by ID.
 * Returns true on success, false on any error.
 */
export async function deleteConversationFromSupabase(conversationId: string): Promise<boolean> {
  const client = getClient()
  if (!client) return false

  try {
    const { error } = await client
      .from('ai_conversations')
      .delete()
      .eq('id', conversationId)

    if (error) {
      console.warn('[ChatPersistence] Delete failed:', error.message)
      return false
    }

    return true
  } catch (err) {
    console.warn('[ChatPersistence] Delete error:', err)
    return false
  }
}
