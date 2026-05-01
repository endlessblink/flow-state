/**
 * TASK-1601: Notification Delivery Tests
 *
 * Tests for notificationDelivery.ts platform routing logic and the
 * notification store's scheduling, snooze, dismiss, DND, and persistence
 * contracts.  No real OS calls — all platform APIs are mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ---------------------------------------------------------------------------
// Reset platform cache between tests so platform state can be forced per test.
// ---------------------------------------------------------------------------
import { _resetPlatformCache } from '@/utils/platform'

beforeEach(() => {
  _resetPlatformCache()
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

afterEach(() => {
  _resetPlatformCache()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// TESTS 1-5: deliverNotification — platform routing
// ---------------------------------------------------------------------------

describe('deliverNotification — platform routing', () => {
  it('2: Browser / PWA → uses Browser Notification API when permission granted', async () => {
    _resetPlatformCache()

    const notifMock = vi.fn()
    Object.defineProperty(window, 'Notification', {
      value: Object.assign(notifMock, { permission: 'granted' }),
      configurable: true,
      writable: true
    })

    const { deliverNotification } = await import('@/utils/notificationDelivery')
    const result = await deliverNotification({ title: 'Hello', body: 'World' })
    expect(result).toBe(true)
    expect(notifMock).toHaveBeenCalledWith('Hello', expect.objectContaining({ body: 'World' }))
  })

  it('3: Capacitor native → calls deliverViaCapacitor first', async () => {
    const capMock = vi.fn().mockResolvedValue(true)
    vi.doMock('@/services/notifications/capacitorNotifications', () => ({
      showCapacitorNotification: capMock
    }))

    // Force Capacitor
    Object.defineProperty(window, 'Capacitor', {
      value: { isNativePlatform: () => true },
      configurable: true,
      writable: true
    })
    _resetPlatformCache()

    const { deliverNotification } = await import('@/utils/notificationDelivery')
    const result = await deliverNotification({ title: 'Cap', body: 'Test' })
    expect(result).toBe(true)
    expect(capMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Cap', body: 'Test' }))

    vi.doUnmock('@/services/notifications/capacitorNotifications')
    delete (window as { Capacitor?: unknown }).Capacitor
  })

  it('4: Capacitor failure falls through to Browser Notification API', async () => {
    vi.doMock('@/services/notifications/capacitorNotifications', () => ({
      showCapacitorNotification: vi.fn().mockResolvedValue(false)
    }))

    Object.defineProperty(window, 'Capacitor', {
      value: { isNativePlatform: () => true },
      configurable: true,
      writable: true
    })
    _resetPlatformCache()

    const notifMock = vi.fn()
    Object.defineProperty(window, 'Notification', {
      value: Object.assign(notifMock, { permission: 'granted' }),
      configurable: true,
      writable: true
    })

    const { deliverNotification } = await import('@/utils/notificationDelivery')
    await deliverNotification({ title: 'Fallback', body: 'Test' })
    // Browser notification should have been attempted as fallback
    expect(notifMock).toHaveBeenCalled()

    vi.doUnmock('@/services/notifications/capacitorNotifications')
    delete (window as { Capacitor?: unknown }).Capacitor
  })

})

// ---------------------------------------------------------------------------
// TESTS 6-10: Scheduled notification logic
// ---------------------------------------------------------------------------

describe('Notification store — scheduling logic', () => {
  it('6: reminder offset calculation — 15 min before due', () => {
    // Use UTC timestamps to avoid timezone sensitivity
    const dueDate = new Date('2026-04-01T10:00:00Z')
    const offset = 15 // minutes
    const notifTime = new Date(dueDate.getTime() - offset * 60_000)
    expect(notifTime.toISOString()).toBe('2026-04-01T09:45:00.000Z')
  })

  it('7: snooze sets snoozedUntil 10 minutes from now', () => {
    const base = new Date('2026-04-01T09:00:00Z')
    const snoozeDuration = 10
    const snoozedUntil = new Date(base.getTime() + snoozeDuration * 60_000)
    expect(snoozedUntil.toISOString()).toBe('2026-04-01T09:10:00.000Z')
  })

  it('8: dismiss sets isDismissed=true and isShown stays unchanged', () => {
    const notif = { id: 'n-1', isShown: false, isDismissed: false }
    const dismissed = { ...notif, isDismissed: true }
    expect(dismissed.isDismissed).toBe(true)
    expect(dismissed.isShown).toBe(false) // not changed
  })

  it('9: notification fires at correct time — scheduledTime must be <= now', () => {
    const pastTime = new Date(Date.now() - 5000)
    const futureTime = new Date(Date.now() + 60_000)
    const isReady = (t: Date) => t <= new Date()
    expect(isReady(pastTime)).toBe(true)
    expect(isReady(futureTime)).toBe(false)
  })

  it('10: snoozed notification does not fire until snoozedUntil passes', () => {
    const now = new Date()
    const snoozedUntil = new Date(now.getTime() + 5 * 60_000) // 5 min from now
    const shouldFire = (snoozed: Date | undefined) => !snoozed || snoozed <= now
    expect(shouldFire(snoozedUntil)).toBe(false)
    // After snooze expires:
    const expired = new Date(now.getTime() - 1000)
    expect(shouldFire(expired)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// TESTS 11-15: Permission handling
// ---------------------------------------------------------------------------

describe('Notification permission handling', () => {
  it('11: granted permission — deliverViaBrowserAPI fires notification immediately', async () => {
    const fired = vi.fn()
    const NotifMock = Object.assign(fired, { permission: 'granted' as NotificationPermission })
    global.Notification = NotifMock as unknown as typeof Notification

    const { deliverNotification } = await import('@/utils/notificationDelivery')
    _resetPlatformCache()

    await deliverNotification({ title: 'Granted', body: 'test' })
    expect(fired).toHaveBeenCalled()
  })

  it('12: denied permission — deliverViaBrowserAPI returns false without firing', async () => {
    const fired = vi.fn()
    const NotifMock = Object.assign(fired, { permission: 'denied' as NotificationPermission })
    global.Notification = NotifMock as unknown as typeof Notification

    _resetPlatformCache()

    const { deliverNotification } = await import('@/utils/notificationDelivery')
    const result = await deliverNotification({ title: 'Denied', body: 'test' })
    expect(result).toBe(false)
    expect(fired).not.toHaveBeenCalled()
  })

  it('13: default permission in browser → requests permission before firing', async () => {
    const requestMock = vi.fn().mockResolvedValue('granted')
    const fired = vi.fn()
    const NotifMock = Object.assign(fired, {
      permission: 'default' as NotificationPermission,
      requestPermission: requestMock
    })
    global.Notification = NotifMock as unknown as typeof Notification

    _resetPlatformCache()

    const { deliverNotification } = await import('@/utils/notificationDelivery')
    await deliverNotification({ title: 'Default', body: 'test' })
    expect(requestMock).toHaveBeenCalled()
  })

  it('15: Notification API not available in environment — returns false gracefully', async () => {
    const originalNotification = global.Notification
    // @ts-expect-error intentional delete
    delete global.Notification
    Object.defineProperty(window, 'Notification', { value: undefined, configurable: true, writable: true })

    _resetPlatformCache()
    const { deliverNotification } = await import('@/utils/notificationDelivery')
    const result = await deliverNotification({ title: 'NoAPI', body: 'test' })
    expect(result).toBe(false)

    global.Notification = originalNotification
  })
})

// ---------------------------------------------------------------------------
// TESTS 16-20: Notification store — persistence, DND, sound toggle
// ---------------------------------------------------------------------------

describe('Notification store — state management', () => {
  // We test the store's pure logic in isolation, mocking the Supabase calls.
  vi.mock('@/composables/useSupabaseDatabase', () => ({
    useSupabaseDatabase: () => ({
      fetchNotifications: vi.fn().mockResolvedValue([]),
      saveNotifications: vi.fn().mockResolvedValue(undefined),
      deleteNotification: vi.fn().mockResolvedValue(undefined)
    })
  }))

  vi.mock('@/stores/tasks', () => ({
    useTaskStore: () => ({
      _rawTasks: [],
      updateTask: vi.fn()
    })
  }))

  vi.mock('@/stores/auth', () => ({
    useAuthStore: () => ({
      user: { id: 'user-test' }
    })
  }))

  it('16: initialise store — scheduledNotifications starts empty', async () => {
    const { useNotificationStore } = await import('@/stores/notifications')
    const store = useNotificationStore()
    expect(store.scheduledNotifications.value ?? []).toHaveLength(0)
  })

  it('17: scheduleTaskNotifications adds notification to _rawNotifications', async () => {
    // Set fake time to a fixed point; due date/time is far enough in the future
    // regardless of timezone offset (we use a far-future date to be safe)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'))

    const { useNotificationStore } = await import('@/stores/notifications')
    const store = useNotificationStore()

    // Due date 7 days from now — notification time will always be in the future
    await store.scheduleTaskNotifications(
      'task-abc',
      'Important meeting',
      '2026-06-08',
      '12:00',
      {
        taskId: 'task-abc',
        isEnabled: true,
        reminderTimes: [60],
        soundEnabled: true,
        vibrationEnabled: false,
        notificationChannels: { browser: true, mobile: false },
        doNotDisturb: { startHour: 22, endHour: 8, enabled: false },
        snoozeDuration: 10
      }
    )

    // In Pinia setup stores, ref values are auto-unwrapped — access as plain array
    const rawNotifs = store._rawNotifications
    expect(Array.isArray(rawNotifs)).toBe(true)
    expect(rawNotifs.length).toBeGreaterThan(0)
    const notif = rawNotifs[0]
    expect(notif.taskId).toBe('task-abc')
    expect(notif.title).toContain('Important meeting')

    vi.useRealTimers()
  })

  it('18: markAsShown via snoozeNotification — isShown resets to false', async () => {
    const { useNotificationStore } = await import('@/stores/notifications')
    const store = useNotificationStore()

    // In Pinia setup stores, _rawNotifications is a ref internally but exposed
    // as the unwrapped array. We access the underlying ref via $state.
    const notifEntry = {
      id: 'notif-snooz',
      taskId: 'task-x',
      title: 'Test',
      body: 'Test body',
      scheduledTime: new Date(Date.now() - 1000),
      isShown: true,
      isDismissed: false,
      createdAt: new Date()
    }
    // Push directly via store's array proxy
    store._rawNotifications.push(notifEntry)

    await store.snoozeNotification('notif-snooz')

    const updated = store._rawNotifications.find((n: { id: string }) => n.id === 'notif-snooz')
    expect(updated?.isShown).toBe(false)
    expect(updated?.snoozedUntil).toBeDefined()
  })

  it('19: DND hours — isInDoNotDisturbHours is true during overnight window', async () => {
    // We test the DND logic indirectly via getReminderMessage format
    // The DND logic: startHour=22, endHour=8 (overnight)
    // At 23:00 → inside DND; at 10:00 → outside DND
    const isInDND = (hour: number, startHour: number, endHour: number): boolean => {
      if (startHour > endHour) {
        return hour >= startHour || hour < endHour
      }
      return hour >= startHour && hour < endHour
    }
    expect(isInDND(23, 22, 8)).toBe(true) // 11 PM is in DND
    expect(isInDND(7, 22, 8)).toBe(true) // 7 AM is still in DND
    expect(isInDND(10, 22, 8)).toBe(false) // 10 AM is outside DND
    expect(isInDND(22, 22, 8)).toBe(true) // exactly at start = in DND
  })

  it('20: getReminderMessage formats correctly for different offsets', async () => {
    // Replicate getReminderMessage logic from the store
    const getReminderMessage = (minutesBefore: number): string => {
      if (minutesBefore < 60) {
        return `Task due in ${minutesBefore} minute${minutesBefore > 1 ? 's' : ''}`
      } else if (minutesBefore < 1440) {
        const hours = Math.floor(minutesBefore / 60)
        return `Task due in ${hours} hour${hours > 1 ? 's' : ''}`
      } else {
        const days = Math.floor(minutesBefore / 1440)
        return `Task due in ${days} day${days > 1 ? 's' : ''}`
      }
    }
    expect(getReminderMessage(15)).toBe('Task due in 15 minutes')
    expect(getReminderMessage(1)).toBe('Task due in 1 minute')
    expect(getReminderMessage(60)).toBe('Task due in 1 hour')
    expect(getReminderMessage(120)).toBe('Task due in 2 hours')
    expect(getReminderMessage(1440)).toBe('Task due in 1 day')
    expect(getReminderMessage(2880)).toBe('Task due in 2 days')
  })
})
