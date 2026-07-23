import { afterEach, describe, expect, it, vi } from 'vitest'
import { runWithExclusiveQueueProcessorLock } from '@/services/offline/queueProcessorLock'

const originalLocks = navigator.locks

afterEach(() => {
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: originalLocks,
  })
})

describe('exclusive queue processor lock', () => {
  it('runs while the cross-window lock is acquired', async () => {
    const work = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: vi.fn(async (_name, _options, callback) => callback({ name: 'flowstate-sync-queue' })),
      },
    })

    await expect(runWithExclusiveQueueProcessorLock(work)).resolves.toEqual({ status: 'processed' })
    expect(work).toHaveBeenCalledWith({ hasCrossWindowExclusion: true })
  })

  it('does not process when another window owns the queue lock', async () => {
    const work = vi.fn()
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: vi.fn(async (_name, _options, callback) => callback(null)),
      },
    })

    await expect(runWithExclusiveQueueProcessorLock(work)).resolves.toEqual({ status: 'contended' })
    expect(work).not.toHaveBeenCalled()
  })

  it('keeps stale-timeout recovery when Web Locks are unavailable', async () => {
    const work = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: undefined,
    })

    await expect(runWithExclusiveQueueProcessorLock(work)).resolves.toEqual({ status: 'processed' })
    expect(work).toHaveBeenCalledWith({ hasCrossWindowExclusion: false })
  })

  it('fails closed when the lock service rejects before work starts', async () => {
    const work = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: vi.fn().mockRejectedValue(new DOMException('Locks unavailable', 'SecurityError')),
      },
    })

    await expect(runWithExclusiveQueueProcessorLock(work)).resolves.toEqual({
      status: 'unavailable',
      error: expect.objectContaining({ name: 'SecurityError' }),
    })
    expect(work).not.toHaveBeenCalled()
  })

  it('does not retry work outside the lock when locked work itself fails', async () => {
    const failure = new Error('queue processing failed')
    const work = vi.fn().mockRejectedValue(failure)
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: vi.fn(async (_name, _options, callback) => callback({ name: 'flowstate-sync-queue' })),
      },
    })

    await expect(runWithExclusiveQueueProcessorLock(work)).rejects.toBe(failure)
    expect(work).toHaveBeenCalledTimes(1)
  })
})
