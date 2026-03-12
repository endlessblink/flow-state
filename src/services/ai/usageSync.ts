/**
 * AI Usage Sync — flush localStorage usage entries to Supabase periodically.
 *
 * Aggregates raw entries (per-request) into daily buckets (per user/date/provider/model)
 * before calling the additive upsert RPC. This matches the DB schema design.
 *
 * Silently fails — never disrupts the caller. Retries on the next interval.
 *
 * @see TASK-1500 in MASTER_PLAN.md
 */

import { supabase } from '@/services/auth/supabase'
import { getUsageEntries } from './usageTracker'

// ============================================================================
// Internal State
// ============================================================================

let flushTimer: ReturnType<typeof setInterval> | null = null
let lastFlushedIndex = 0

// ============================================================================
// Core
// ============================================================================

async function flushToSupabase(): Promise<void> {
  const client = supabase
  if (!client) return

  const entries = getUsageEntries().value
  if (entries.length <= lastFlushedIndex) return

  const newEntries = entries.slice(lastFlushedIndex)
  // Optimistically advance; roll back on failure
  const previousIndex = lastFlushedIndex
  lastFlushedIndex = entries.length

  // Aggregate by date + provider + model
  const aggregated = new Map<string, {
    date: string
    provider: string
    model: string
    inputTokens: number
    outputTokens: number
    requestCount: number
  }>()

  for (const entry of newEntries) {
    const date = entry.timestamp.split('T')[0]
    const key = `${date}:${entry.provider}:${entry.model}`
    const existing = aggregated.get(key)
    if (existing) {
      existing.inputTokens += entry.inputTokens
      existing.outputTokens += entry.outputTokens
      existing.requestCount++
    } else {
      aggregated.set(key, {
        date,
        provider: entry.provider,
        model: entry.model,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        requestCount: 1,
      })
    }
  }

  try {
    const { data: { user } } = await client.auth.getUser()
    if (!user?.id) return

    let anyError = false
    for (const agg of aggregated.values()) {
      const { error } = await client.rpc('upsert_ai_usage_log', {
        p_user_id: user.id,
        p_date: agg.date,
        p_provider: agg.provider,
        p_model: agg.model,
        p_input_tokens: agg.inputTokens,
        p_output_tokens: agg.outputTokens,
        p_request_count: agg.requestCount,
      })
      if (error) {
        console.warn('[UsageSync] RPC error:', error.message)
        anyError = true
      }
    }

    if (anyError) {
      // Roll back index so we retry on next interval
      lastFlushedIndex = previousIndex
    } else {
      console.log(`[UsageSync] Flushed ${aggregated.size} usage aggregate(s) to Supabase`)
    }
  } catch (err) {
    console.warn('[UsageSync] Flush error:', err)
    lastFlushedIndex = previousIndex
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Start periodic usage sync (60s interval + beforeunload flush).
 * Safe to call multiple times — only starts once.
 */
export function startUsageSync(): void {
  if (flushTimer) return

  flushTimer = setInterval(() => {
    flushToSupabase().catch(() => {})
  }, 60_000)

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      flushToSupabase().catch(() => {})
    })
  }

  console.log('[UsageSync] Started (60s interval)')
}

/**
 * Stop the periodic sync timer.
 */
export function stopUsageSync(): void {
  if (flushTimer) {
    clearInterval(flushTimer)
    flushTimer = null
  }
}

/**
 * Flush immediately. Used for testing or explicit user-triggered sync.
 */
export async function flushUsageNow(): Promise<void> {
  return flushToSupabase()
}
