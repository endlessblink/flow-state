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
})
