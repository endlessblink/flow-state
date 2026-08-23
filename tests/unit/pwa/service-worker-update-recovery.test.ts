import { describe, expect, it, vi } from 'vitest'
import { startServiceWorkerUpdateRecovery } from '@/services/pwa/serviceWorkerUpdateRecovery'

describe('service worker update recovery', () => {
  it('checks for a new worker on startup and every foreground resume', async () => {
    const update = vi.fn().mockResolvedValue(undefined)
    const listeners = new Map<string, () => void>()
    const stop = startServiceWorkerUpdateRecovery({
      ready: Promise.resolve({ update, waiting: null }),
      visibility: {
        get hidden() {
          return false
        },
        addEventListener: (event, listener) => listeners.set(event, listener),
        removeEventListener: (event) => listeners.delete(event),
      },
    })

    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    listeners.get('visibilitychange')?.()
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(2))

    stop()
    expect(listeners.has('visibilitychange')).toBe(false)
  })

  it('activates a waiting worker after the update check', async () => {
    const postMessage = vi.fn()
    startServiceWorkerUpdateRecovery({
      ready: Promise.resolve({
        update: vi.fn().mockResolvedValue(undefined),
        waiting: { postMessage },
      }),
      visibility: {
        hidden: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    })

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    })
  })

  it('coalesces overlapping foreground checks and remains retryable after failure', async () => {
    let resolveUpdate!: () => void
    const update = vi.fn(() => new Promise<void>((resolve) => { resolveUpdate = resolve }))
    const listeners = new Map<string, () => void>()
    const visibility = {
      hidden: false,
      addEventListener: (_event: string, listener: () => void) => listeners.set('visibilitychange', listener),
      removeEventListener: vi.fn(),
    }
    startServiceWorkerUpdateRecovery({ ready: Promise.resolve({ update, waiting: null }), visibility })
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    listeners.get('visibilitychange')?.()
    listeners.get('visibilitychange')?.()
    expect(update).toHaveBeenCalledTimes(1)
    resolveUpdate()
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1))

    const retry = vi.fn().mockRejectedValueOnce(new Error('network down')).mockResolvedValue(undefined)
    const retryListeners = new Map<string, () => void>()
    startServiceWorkerUpdateRecovery({
      ready: Promise.resolve({ update: retry, waiting: null }),
      visibility: {
        hidden: false,
        addEventListener: (_event, listener) => retryListeners.set('visibilitychange', listener),
        removeEventListener: vi.fn(),
      },
    })
    await vi.waitFor(() => expect(retry).toHaveBeenCalledTimes(1))
    retryListeners.get('visibilitychange')?.()
    await vi.waitFor(() => expect(retry).toHaveBeenCalledTimes(2))
  })
})
