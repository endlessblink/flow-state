/**
 * BUG-2100: a burst of skipped realtime echoes used to schedule one full
 * reload each; those reloads hold the queue barrier and starved uploads.
 */
import { describe, it, expect, vi } from 'vitest'
import { createCoalescedReloader } from '@/composables/app/coalescedReload'

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

describe('createCoalescedReloader (BUG-2100)', () => {
  it('collapses a burst of 48 requests into one reload plus one follow-up', async () => {
    const order: string[] = []
    let releaseReload: () => void = () => {}
    const reload = vi.fn(() => new Promise<void>(resolve => {
      order.push('reload')
      releaseReload = resolve
    }))
    const beforeReload = vi.fn(async () => { order.push('queue-turn') })
    const reloader = createCoalescedReloader({ reload, beforeReload, wait: async () => {} })

    for (let i = 0; i < 48; i++) void reloader.request()
    await flush()
    expect(reload).toHaveBeenCalledTimes(1)

    // More echoes arrive while the first reload is running.
    for (let i = 0; i < 20; i++) void reloader.request()
    releaseReload()
    await flush()
    expect(reload).toHaveBeenCalledTimes(2)
    releaseReload()
    await flush()

    expect(reload).toHaveBeenCalledTimes(2)
    expect(order).toEqual(['queue-turn', 'reload', 'queue-turn', 'reload'])
    expect(reloader.isRunning()).toBe(false)
  })

  it('still reloads when the queue turn fails, and recovers after a reload error', async () => {
    const onError = vi.fn()
    const reload = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined)
    const reloader = createCoalescedReloader({
      reload,
      beforeReload: async () => { throw new Error('queue busy') },
      onError,
      wait: async () => {},
    })

    await reloader.request()
    expect(reload).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledTimes(2)

    await reloader.request()
    expect(reload).toHaveBeenCalledTimes(2)
  })
})
