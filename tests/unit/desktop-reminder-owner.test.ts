/**
 * BUG-2110: on the Linux desktop app the widget owns desktop reminders; the
 * app must not add its own session-complete notification on top.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { widgetOwnsDesktopReminders } from '@/utils/desktopReminderOwner'
import { useTimerNotifications } from '@/composables/timer/useTimerNotifications'

vi.mock('@/composables/useTauriStartup', () => ({ isTauri: () => false }))

const setElectron = (platform?: string) => {
  if (platform) (window as unknown as { electronAPI: unknown }).electronAPI = { isElectron: true, platform }
  else delete (window as unknown as { electronAPI?: unknown }).electronAPI
}

afterEach(() => {
  setElectron()
  vi.unstubAllGlobals()
})

describe('widgetOwnsDesktopReminders', () => {
  it('is true only for the Linux desktop app', () => {
    setElectron('linux')
    expect(widgetOwnsDesktopReminders()).toBe(true)
    setElectron('darwin')
    expect(widgetOwnsDesktopReminders()).toBe(false)
    setElectron()
    expect(widgetOwnsDesktopReminders()).toBe(false)
  })
})

describe('session-complete notification', () => {
  const run = async () => {
    const created: string[] = []
    class FakeNotification {
      static permission = 'granted'
      constructor(title: string) { created.push(title) }
    }
    vi.stubGlobal('Notification', FakeNotification)
    const { showTimerNotification } = useTimerNotifications({
      findTaskTitle: () => undefined,
      startTimer: vi.fn(),
    } as never)
    await showTimerNotification('session-1', false, 'general', false)
    return created
  }

  it('is not shown by the Linux desktop app (the widget card is the one reminder)', async () => {
    setElectron('linux')
    expect(await run()).toEqual([])
  })

  it('is still shown on the web app', async () => {
    setElectron()
    expect(await run()).toEqual(['Session Complete! 🍅'])
  })
})
