import { describe, expect, it, vi } from 'vitest'

const { createSessionDelivery } = require('../../../server/local-api/session-delivery.cjs')

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe('Local API sidecar session delivery', () => {
  it('applies and acknowledges only the newest completed generation', async () => {
    const first = deferred<Record<string, unknown>>()
    const second = deferred<Record<string, unknown>>()
    const constructContext = vi.fn((message: { generation: number }) => (
      message.generation === 1 ? first.promise : second.promise
    ))
    const applyContext = vi.fn()
    const invalidateContext = vi.fn()
    const postMessage = vi.fn()
    const delivery = createSessionDelivery({
      constructContext,
      applyContext,
      invalidateContext,
      postMessage,
    })

    const firstResult = delivery.apply({ generation: 1, userId: 'user-1' })
    const secondResult = delivery.apply({ generation: 2, userId: 'user-2' })
    expect(invalidateContext).toHaveBeenCalledTimes(2)
    second.resolve({ userId: 'user-2', client: 'second' })
    await expect(secondResult).resolves.toEqual({ applied: true, generation: 2, userId: 'user-2' })
    first.resolve({ userId: 'user-1', client: 'first' })
    await expect(firstResult).resolves.toEqual({ applied: false, code: 'stale_generation' })

    expect(applyContext).toHaveBeenCalledOnce()
    expect(applyContext).toHaveBeenCalledWith({ userId: 'user-2', client: 'second' })
    expect(postMessage).toHaveBeenCalledOnce()
    expect(postMessage).toHaveBeenCalledWith({
      type: 'sessionApplied',
      generation: 2,
      userId: 'user-2',
    })
  })

  it('rejects a constructed context whose user does not match the requested user', async () => {
    const applyContext = vi.fn()
    const invalidateContext = vi.fn()
    const postMessage = vi.fn()
    const delivery = createSessionDelivery({
      constructContext: vi.fn().mockResolvedValue({ userId: 'other-user' }),
      applyContext,
      invalidateContext,
      postMessage,
    })

    await expect(delivery.apply({ generation: 1, userId: 'expected-user' })).resolves.toEqual({
      applied: false,
      code: 'user_mismatch',
    })
    expect(applyContext).not.toHaveBeenCalled()
    expect(invalidateContext).toHaveBeenCalledOnce()
    expect(postMessage).not.toHaveBeenCalled()
  })

  it('invalidates an in-flight construction when the session is cleared', async () => {
    const pending = deferred<Record<string, unknown>>()
    const applyContext = vi.fn()
    const invalidateContext = vi.fn()
    const postMessage = vi.fn()
    const delivery = createSessionDelivery({
      constructContext: () => pending.promise,
      applyContext,
      invalidateContext,
      postMessage,
    })

    const result = delivery.apply({ generation: 1, userId: 'user-1' })
    delivery.clear()
    pending.resolve({ userId: 'user-1' })

    await expect(result).resolves.toEqual({ applied: false, code: 'stale_generation' })
    expect(applyContext).not.toHaveBeenCalled()
    expect(postMessage).not.toHaveBeenCalled()
  })

  it('invalidates the previous context before construction and keeps it invalid after failure', async () => {
    const applyContext = vi.fn()
    const invalidateContext = vi.fn()
    const delivery = createSessionDelivery({
      constructContext: vi.fn().mockRejectedValue(new Error('rejected session')),
      applyContext,
      invalidateContext,
      postMessage: vi.fn(),
    })

    const result = delivery.apply({ generation: 1, userId: 'new-user' })
    expect(invalidateContext).toHaveBeenCalledOnce()
    await expect(result).resolves.toEqual({ applied: false, code: 'session_application_failed' })
    expect(applyContext).not.toHaveBeenCalled()
  })
})
