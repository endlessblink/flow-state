/**
 * TASK-1822 — BridgeProvider Claude↔Codex failover.
 *
 * The subscription brain must never hard-fail: if the preferred CLI brain errors
 * or is out of credits (surfaced as BridgeUnavailableError before any token), the
 * provider automatically fails over to the other brain. It must NEVER switch
 * mid-stream (after tokens have already been yielded).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted so the mock factory (also hoisted) can reference these safely.
const { BridgeUnavailableError, bridgeChat, bridgeChatStream, isBridgeAvailable } = vi.hoisted(() => {
  class BridgeUnavailableError extends Error {}
  return {
    BridgeUnavailableError,
    bridgeChat: vi.fn(),
    bridgeChatStream: vi.fn(),
    isBridgeAvailable: vi.fn().mockResolvedValue(true),
  }
})

vi.mock('@/services/ai/proxy/bridgeClient', () => ({
  BridgeUnavailableError,
  isBridgeAvailable,
  bridgeChat,
  bridgeChatStream,
}))

import { BridgeProvider } from '@/services/ai/providers/bridgeProvider'

async function collect(gen: AsyncGenerator<{ content: string; error?: string }>) {
  const out: Array<{ content: string; error?: string }> = []
  for await (const c of gen) out.push(c)
  return out
}
const msgs = [{ role: 'user' as const, content: 'hi' }]

describe('BridgeProvider Claude↔Codex failover (TASK-1822)', () => {
  beforeEach(() => { vi.clearAllMocks(); isBridgeAvailable.mockResolvedValue(true) })

  it('streams: fails over to Codex when preferred Claude throws pre-stream', async () => {
    bridgeChatStream.mockImplementation(async function* (_m: unknown, brain: string) {
      if (brain === 'claude') throw new BridgeUnavailableError('rate_limited')
      yield 'codex answer'
    })
    const p = new BridgeProvider({ brain: 'claude' })
    const text = (await collect(p.generateStream(msgs, {}))).map(c => c.content).join('')
    expect(text).toContain('codex answer')
    expect(bridgeChatStream).toHaveBeenCalledTimes(2)
    expect(bridgeChatStream.mock.calls[0][1]).toBe('claude')
    expect(bridgeChatStream.mock.calls[1][1]).toBe('codex')
  })

  it('streams: honors preferred-brain order (Codex first when configured)', async () => {
    bridgeChatStream.mockImplementation(async function* (_m: unknown, brain: string) {
      if (brain === 'codex') throw new BridgeUnavailableError('rate_limited')
      yield 'claude answer'
    })
    const p = new BridgeProvider({ brain: 'codex' })
    const text = (await collect(p.generateStream(msgs, {}))).map(c => c.content).join('')
    expect(text).toContain('claude answer')
    expect(bridgeChatStream.mock.calls[0][1]).toBe('codex')
    expect(bridgeChatStream.mock.calls[1][1]).toBe('claude')
  })

  it('streams: throws when BOTH brains fail pre-stream', async () => {
    bridgeChatStream.mockImplementation(async function* () { throw new BridgeUnavailableError('down') })
    const p = new BridgeProvider({ brain: 'claude' })
    await expect(collect(p.generateStream(msgs, {}))).rejects.toThrow(BridgeUnavailableError)
    expect(bridgeChatStream).toHaveBeenCalledTimes(2)
  })

  it('streams: does NOT switch brains once tokens have streamed', async () => {
    bridgeChatStream.mockImplementation(async function* (_m: unknown, brain: string) {
      if (brain === 'claude') { yield 'partial'; throw new BridgeUnavailableError('mid') }
      yield 'should-not-run'
    })
    const p = new BridgeProvider({ brain: 'claude' })
    const chunks = await collect(p.generateStream(msgs, {}))
    const text = chunks.map(c => c.content).join('')
    expect(text).toContain('partial')
    expect(text).not.toContain('should-not-run')
    expect(bridgeChatStream).toHaveBeenCalledTimes(1)
    expect(chunks.some(c => c.error)).toBe(true)
  })

  it('generate() (non-stream) also fails over Claude→Codex', async () => {
    bridgeChat.mockImplementation(async (_m: unknown, brain: string) => {
      if (brain === 'claude') throw new BridgeUnavailableError('rate_limited')
      return { content: 'codex', model: 'codex', brain: 'codex' }
    })
    const p = new BridgeProvider({ brain: 'claude' })
    const res = await p.generate(msgs, {})
    expect(res.content).toBe('codex')
    expect(bridgeChat).toHaveBeenCalledTimes(2)
  })

  it('does NOT fail over on a non-bridge (code) error', async () => {
    bridgeChatStream.mockImplementation(async function* () { throw new TypeError('bug') })
    const p = new BridgeProvider({ brain: 'claude' })
    await expect(collect(p.generateStream(msgs, {}))).rejects.toThrow(TypeError)
    expect(bridgeChatStream).toHaveBeenCalledTimes(1)
  })
})
