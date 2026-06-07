/**
 * AI Bridge Client (TASK-1814)
 *
 * Talks to the VPS AI bridge (`infra/ai-bridge/server.mjs`), which wraps the
 * user's `claude` / `codex` CLIs (subscription brains, no API billing).
 *
 * The bridge is auth-gated: every request carries the user's Supabase access
 * token. If the bridge is unreachable or a brain's token is dead, this throws
 * `BridgeUnavailableError` so the router transparently falls back to Groq.
 */

import { supabase } from '@/services/auth/supabase'
import { EXTERNAL_URLS } from '@/config/urls'
import type { ChatMessage } from '../types'

export type BridgeBrain = 'claude' | 'codex'

export class BridgeUnavailableError extends Error {
  constructor(public reason: string) {
    super(`AI bridge unavailable: ${reason}`)
    this.name = 'BridgeUnavailableError'
  }
}

export interface BridgeChatResult {
  content: string
  model: string
  brain: BridgeBrain
}

/** Production bridge — the only place the CLIs actually run (the VPS). */
const PROD_BRIDGE_URL = 'https://in-theflow.com/ai-bridge'

/**
 * Bridge base URL. Override with VITE_AI_BRIDGE_URL. Otherwise use <site>/ai-bridge,
 * but never localhost — in dev the dev server has no bridge, so fall back to the
 * real VPS bridge (which CORS-allows localhost). Requires a *production* Supabase
 * session, so run dev with `doppler run -- npm run dev`.
 */
export function getBridgeUrl(): string {
  const explicit = import.meta.env.VITE_AI_BRIDGE_URL
  if (explicit) return String(explicit).replace(/\/$/, '')
  const site = (EXTERNAL_URLS.PRODUCTION_SITE || '').replace(/\/$/, '')
  if (site && !/localhost|127\.0\.0\.1/.test(site)) return `${site}/ai-bridge`
  return PROD_BRIDGE_URL
}

async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

function looksLikeBrainLimitMessage(text: string): boolean {
  return /you(?:'|’)?ve hit your limit|usage limit|rate limit|limit resets?|resets? \d{1,2}:\d{2}|no credits|quota exceeded/i.test(text)
}

function throwIfBrainLimitMessage(text: unknown): void {
  if (typeof text === 'string' && looksLikeBrainLimitMessage(text)) {
    throw new BridgeUnavailableError('brain_limit')
  }
}

/** Liveness probe — no model call, so it's cheap and quota-free. */
export async function isBridgeAvailable(timeoutMs = 4000): Promise<boolean> {
  try {
    const res = await fetch(`${getBridgeUrl()}/health`, {
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return false
    const body = await res.json()
    return Boolean(body?.ok)
  } catch {
    return false
  }
}

/**
 * Send a chat request to the bridge for the given brain.
 * Throws BridgeUnavailableError on auth/network/brain failure (router falls back).
 */
export async function bridgeChat(
  messages: ChatMessage[],
  brain: BridgeBrain,
  opts: { timeoutMs?: number } = {}
): Promise<BridgeChatResult> {
  const token = await getAccessToken()
  if (!token) throw new BridgeUnavailableError('not_signed_in')

  let res: Response
  try {
    res = await fetch(`${getBridgeUrl()}/v1/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ brain, stream: false, messages: messages.map(m => ({ role: m.role, content: m.content })) }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 130_000),
    })
  } catch (e) {
    throw new BridgeUnavailableError(`network:${e instanceof Error ? e.message : 'fetch_failed'}`)
  }

  if (res.status === 401) throw new BridgeUnavailableError('unauthorized')
  if (res.status === 429) throw new BridgeUnavailableError('rate_limited')
  if (res.status === 502) {
    let reason = 'brain_unavailable'
    try { reason = (await res.json())?.reason || reason } catch { /* ignore */ }
    throw new BridgeUnavailableError(reason)
  }
  if (!res.ok) throw new BridgeUnavailableError(`http_${res.status}`)

  const data = await res.json()
  if (!data?.content) throw new BridgeUnavailableError('empty_response')
  throwIfBrainLimitMessage(data.content)
  return { content: data.content, model: data.model || brain, brain }
}

/**
 * Stream a chat response from the bridge token-by-token (Server-Sent Events).
 * Yields text deltas as they arrive. Throws BridgeUnavailableError on
 * auth/network/brain failure so the router can fall back to Groq.
 */
export async function* bridgeChatStream(
  messages: ChatMessage[],
  brain: BridgeBrain,
  opts: { timeoutMs?: number; signal?: AbortSignal } = {}
): AsyncGenerator<string> {
  const token = await getAccessToken()
  if (!token) throw new BridgeUnavailableError('not_signed_in')

  let res: Response
  try {
    res = await fetch(`${getBridgeUrl()}/v1/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ brain, stream: true, messages: messages.map(m => ({ role: m.role, content: m.content })) }),
      signal: opts.signal ?? AbortSignal.timeout(opts.timeoutMs ?? 130_000),
    })
  } catch (e) {
    throw new BridgeUnavailableError(`network:${e instanceof Error ? e.message : 'fetch_failed'}`)
  }

  if (res.status === 401) throw new BridgeUnavailableError('unauthorized')
  if (res.status === 429) throw new BridgeUnavailableError('rate_limited')
  if (!res.ok || !res.body) throw new BridgeUnavailableError(`http_${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let sawDone = false

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let sep: number
    // SSE events are separated by a blank line (\n\n)
    while ((sep = buf.indexOf('\n\n')) >= 0) {
      const evtBlock = buf.slice(0, sep)
      buf = buf.slice(sep + 2)
      const dataLine = evtBlock.split('\n').find(l => l.startsWith('data:'))
      if (!dataLine) continue
      let obj: { delta?: string; done?: boolean; error?: string; reason?: string }
      try { obj = JSON.parse(dataLine.slice(5).trim()) } catch { continue }
      if (obj.error) throw new BridgeUnavailableError(obj.reason || obj.error)
      throwIfBrainLimitMessage(obj.delta)
      if (typeof obj.delta === 'string' && obj.delta) yield obj.delta
      if (obj.done) { sawDone = true; return }
    }
  }
  if (!sawDone) throw new BridgeUnavailableError('incomplete_stream')
}
