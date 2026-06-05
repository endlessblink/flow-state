/**
 * TASK-1814 — bridge client runtime (SSE parsing, auth, error→fallback).
 *
 * The bridgeClient turns the VPS bridge's SSE stream into token deltas and decides
 * when to fail (so the router falls back to Groq). These tests mock fetch + the
 * Supabase session to pin that runtime behavior independent of a live bridge.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/services/auth/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok-123' } } })) } },
}))
vi.mock('@/config/urls', () => ({ EXTERNAL_URLS: { PRODUCTION_SITE: 'http://localhost:5546' } }))

import { bridgeChat, bridgeChatStream, isBridgeAvailable, getBridgeUrl, BridgeUnavailableError } from '@/services/ai/proxy/bridgeClient'
import { supabase } from '@/services/auth/supabase'

function sseResponse(events: object[]): Response {
  const body = events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('')
  const stream = new ReadableStream<Uint8Array>({
    start(c) { c.enqueue(new TextEncoder().encode(body)); c.close() },
  })
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

async function collect(brain: 'claude' | 'codex', messages = [{ role: 'user' as const, content: 'hi' }]) {
  const out: string[] = []
  for await (const d of bridgeChatStream(messages, brain)) out.push(d)
  return out.join('')
}

describe('bridge client — getBridgeUrl', () => {
  it('falls back to the prod bridge when the site is localhost', () => {
    expect(getBridgeUrl()).toBe('https://in-theflow.com/ai-bridge')
  })
})

describe('bridge client — isBridgeAvailable', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  it('true when /health returns ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })))
    expect(await isBridgeAvailable()).toBe(true)
  })
  it('false when /health is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })))
    expect(await isBridgeAvailable()).toBe(false)
  })
  it('false on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED') }))
    expect(await isBridgeAvailable()).toBe(false)
  })
})

describe('bridge client — bridgeChatStream (SSE)', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('yields token deltas in order and stops on done', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([
      { delta: 'Hel' }, { delta: 'lo ' }, { delta: 'world' }, { done: true, brain: 'claude' },
    ])))
    expect(await collect('claude')).toBe('Hello world')
  })

  it('throws BridgeUnavailableError on an error event (so the router falls back)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([{ error: 'brain_unavailable', reason: 'auth' }])))
    await expect(collect('claude')).rejects.toBeInstanceOf(BridgeUnavailableError)
  })

  it('throws on HTTP 502 (dead brain)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 502 })))
    await expect(collect('claude')).rejects.toBeInstanceOf(BridgeUnavailableError)
  })

  it('throws on HTTP 401 (unauthorized)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    await expect(collect('claude')).rejects.toBeInstanceOf(BridgeUnavailableError)
  })

  it('throws when not signed in (no token)', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({ data: { session: null } } as never)
    vi.stubGlobal('fetch', vi.fn())
    await expect(collect('claude')).rejects.toThrow(/not_signed_in/)
  })

  it('throws on an incomplete stream (no done event)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([{ delta: 'partial' }])))
    await expect(collect('claude')).rejects.toThrow(/incomplete_stream/)
  })
})

describe('bridge client — bridgeChat (non-streaming)', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('returns content from a JSON response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ content: 'answer', model: 'claude' }), { status: 200 })))
    const r = await bridgeChat([{ role: 'user', content: 'hi' }], 'claude')
    expect(r.content).toBe('answer')
    expect(r.brain).toBe('claude')
  })

  it('throws BridgeUnavailableError on 502', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'brain_unavailable', reason: 'auth' }), { status: 502 })))
    await expect(bridgeChat([{ role: 'user', content: 'hi' }], 'codex')).rejects.toBeInstanceOf(BridgeUnavailableError)
  })

  it('sends stream:false for the non-streaming path', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ content: 'x' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await bridgeChat([{ role: 'user', content: 'hi' }], 'claude')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.stream).toBe(false)
  })
})
