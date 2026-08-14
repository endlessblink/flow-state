import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElectronAutoStartMonitor, shouldStartAutomaticPomodoro } from '@/composables/timer/useElectronAutoStart'

describe('Electron auto-start after absence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts only when enabled and no timer is working', () => {
    expect(shouldStartAutomaticPomodoro({ enabled: true, isTimerActive: false })).toBe(true)
    expect(shouldStartAutomaticPomodoro({ enabled: false, isTimerActive: false })).toBe(false)
    expect(shouldStartAutomaticPomodoro({ enabled: true, isTimerActive: true })).toBe(false)
  })

  it('notifies once on the first activity after the configured absence', async () => {
    let idleSeconds = 0
    const onReturn = vi.fn()
    const monitor = createElectronAutoStartMonitor({
      absenceSeconds: 25 * 60,
      getSystemIdleSeconds: () => idleSeconds,
      onReturn,
      pollIntervalMs: 1_000,
    })

    monitor.start()
    idleSeconds = 25 * 60
    await vi.advanceTimersByTimeAsync(1_000)
    idleSeconds = 0
    await vi.advanceTimersByTimeAsync(1_000)

    expect(onReturn).toHaveBeenCalledTimes(1)
    monitor.stop()
  })

  it('does not notify before the absence threshold or repeatedly during one return', async () => {
    let idleSeconds = 0
    const onReturn = vi.fn()
    const monitor = createElectronAutoStartMonitor({
      absenceSeconds: 25 * 60,
      getSystemIdleSeconds: () => idleSeconds,
      onReturn,
      pollIntervalMs: 1_000,
    })

    monitor.start()
    idleSeconds = 24 * 60
    await vi.advanceTimersByTimeAsync(1_000)
    idleSeconds = 0
    await vi.advanceTimersByTimeAsync(1_000)
    expect(onReturn).not.toHaveBeenCalled()

    idleSeconds = 25 * 60
    await vi.advanceTimersByTimeAsync(1_000)
    idleSeconds = 0
    await vi.advanceTimersByTimeAsync(1_000)
    await vi.advanceTimersByTimeAsync(5_000)

    expect(onReturn).toHaveBeenCalledTimes(1)
    monitor.stop()
  })
})
