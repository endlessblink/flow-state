/**
 * TASK-1665: Google Calendar Integration Tests (10 tests)
 *
 * Tests for:
 * 1. OAuth token stored after authentication
 * 2. Calendar list fetched on connect
 * 3. Events synced to local state
 * 4. Event mapping: Google event → FlowState ExternalCalendarEvent
 * 5. Token refresh before expired
 * 6. Sync interval configured
 * 7. Disconnect clears tokens and events
 * 8. Error handling: API failure doesn't crash app
 * 9. Calendar selection: user picks which calendars to sync
 * 10. No sync when not connected
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ============================================================================
// Module-level mocks
// ============================================================================

const mockListCalendars = vi.fn()
const mockListEvents = vi.fn()
const mockTauriFetch = vi.fn()

vi.mock('@/services/calendar/googleCalendarService', () => ({
  listCalendars: mockListCalendars,
  listEvents: mockListEvents,
}))

vi.mock('@/services/ai/utils/tauriHttp', () => ({
  tauriFetch: mockTauriFetch,
}))

vi.mock('@/services/auth/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}))

const mockCalSupabase = {
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
  },
}
vi.mock('@/composables/supabase/_infrastructure', () => ({
  supabase: mockCalSupabase,
  getSupabase: vi.fn(() => mockCalSupabase),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isAuthenticated: true,
    user: { id: 'user-123' },
    signInWithGoogle: vi.fn(),
  }),
}))

// ============================================================================
// Settings store mock with a reactive googleConnected flag
// ============================================================================

let mockGoogleConnected = false
let mockGoogleToken = ''
let mockGoogleRefreshToken = ''
let mockGoogleTokenExpiry = 0
let mockGoogleCalendars: Array<{ id: string; summary: string; backgroundColor: string; enabled: boolean }> = []
let mockShowGoogleCalendarEvents = true
let mockSyncInterval = 30

vi.mock('@/stores/settings', () => ({
  useSettingsStore: () => ({
    get googleConnected() { return mockGoogleConnected },
    get googleProviderToken() { return mockGoogleToken },
    get googleProviderRefreshToken() { return mockGoogleRefreshToken },
    get googleProviderTokenExpiry() { return mockGoogleTokenExpiry },
    get googleCalendars() { return mockGoogleCalendars },
    get showGoogleCalendarEvents() { return mockShowGoogleCalendarEvents },
    get externalCalendarSyncInterval() { return mockSyncInterval },
    updateSetting: vi.fn((key: string, value: unknown) => {
      if (key === 'googleConnected') mockGoogleConnected = value as boolean
      if (key === 'googleProviderToken') mockGoogleToken = value as string
      if (key === 'googleProviderRefreshToken') mockGoogleRefreshToken = value as string
      if (key === 'googleProviderTokenExpiry') mockGoogleTokenExpiry = value as number
      if (key === 'googleCalendars') mockGoogleCalendars = value as typeof mockGoogleCalendars
      if (key === 'showGoogleCalendarEvents') mockShowGoogleCalendarEvents = value as boolean
    }),
  }),
}))

// ============================================================================
// Sample data
// ============================================================================

const sampleGoogleEvent = {
  id: 'gcal-event-1',
  summary: 'Team standup',
  start: { dateTime: '2026-03-21T09:00:00Z' },
  end: { dateTime: '2026-03-21T09:30:00Z' },
  location: 'Zoom',
  description: 'Daily sync',
}

const sampleCalendar = {
  id: 'primary',
  summary: 'My Calendar',
  backgroundColor: '#4285f4',
}

// ============================================================================
// Tests
// ============================================================================

describe('useGoogleCalendar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    // Reset shared state
    mockGoogleConnected = false
    mockGoogleToken = ''
    mockGoogleRefreshToken = ''
    mockGoogleTokenExpiry = 0
    mockGoogleCalendars = []
    mockShowGoogleCalendarEvents = true
    mockSyncInterval = 30
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('1. isConnected reflects googleConnected from settings store', async () => {
    const { useGoogleCalendar } = await import('@/composables/calendar/useGoogleCalendar')

    // Default: not connected
    const { isConnected } = useGoogleCalendar()
    expect(isConnected.value).toBe(false)
  })

  it('2. fetchAvailableCalendars calls listCalendars and returns mapped list', async () => {
    mockGoogleConnected = true
    mockGoogleToken = 'access-token-abc'
    mockListCalendars.mockResolvedValue({
      calendars: [sampleCalendar],
      newAccessToken: undefined,
    })

    const { useGoogleCalendar } = await import('@/composables/calendar/useGoogleCalendar')
    const { fetchAvailableCalendars } = useGoogleCalendar()

    const result = await fetchAvailableCalendars()

    expect(mockListCalendars).toHaveBeenCalledWith('access-token-abc', undefined)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('primary')
    expect(result[0].summary).toBe('My Calendar')
    expect(result[0].enabled).toBe(true)
  })

  it('3. syncNow fetches events and populates googleEvents', async () => {
    mockGoogleConnected = true
    mockGoogleToken = 'access-token-abc'
    mockGoogleCalendars = [{ id: 'primary', summary: 'My Calendar', backgroundColor: '#4285f4', enabled: true }]
    mockListEvents.mockResolvedValue({ events: [sampleGoogleEvent], newAccessToken: undefined })

    const { useGoogleCalendar } = await import('@/composables/calendar/useGoogleCalendar')
    const { syncNow, googleEvents } = useGoogleCalendar()

    await syncNow()

    expect(mockListEvents).toHaveBeenCalled()
    expect(googleEvents.value).toHaveLength(1)
    expect(googleEvents.value[0].title).toBe('Team standup')
  })

  it('4. transformEvent maps Google event to ExternalCalendarEvent shape', async () => {
    mockGoogleConnected = true
    mockGoogleToken = 'access-token-abc'
    mockGoogleCalendars = [{ id: 'primary', summary: 'My Calendar', backgroundColor: '#4285f4', enabled: true }]
    mockListEvents.mockResolvedValue({ events: [sampleGoogleEvent], newAccessToken: undefined })

    const { useGoogleCalendar } = await import('@/composables/calendar/useGoogleCalendar')
    const { syncNow, googleEvents } = useGoogleCalendar()

    await syncNow()

    const event = googleEvents.value[0]
    expect(event.id).toMatch(/^gcal-/)
    expect(event.title).toBe('Team standup')
    expect(event.startTime).toBeInstanceOf(Date)
    expect(event.endTime).toBeInstanceOf(Date)
    expect(event.isAllDay).toBe(false)
    expect(event.location).toBe('Zoom')
    expect(event.description).toBe('Daily sync')
  })

  it('5. token refresh: isTokenExpiringSoon triggers proactiveRefresh', async () => {
    // Set token expiry to past the refresh buffer (5min), so refresh should trigger now
    const soon = Date.now() + 2 * 60 * 1000 // 2 minutes away — within the 5min buffer
    mockGoogleConnected = true
    mockGoogleToken = 'expiring-token'
    mockGoogleRefreshToken = 'refresh-tok'
    mockGoogleTokenExpiry = soon
    mockGoogleCalendars = [{ id: 'primary', summary: 'Cal', backgroundColor: '#4285f4', enabled: true }]

    const newToken = 'fresh-access-token'
    mockListCalendars.mockResolvedValue({ calendars: [sampleCalendar], newAccessToken: newToken })
    mockListEvents.mockResolvedValue({ events: [], newAccessToken: undefined })

    const { useGoogleCalendar } = await import('@/composables/calendar/useGoogleCalendar')
    const { syncNow } = useGoogleCalendar()

    await syncNow()

    // proactiveRefresh calls listCalendars internally, so listCalendars should have been called
    expect(mockListCalendars).toHaveBeenCalledWith('expiring-token', 'refresh-tok')
  })

  it('6. setupAutoSync configures sync interval based on settings', async () => {
    mockGoogleConnected = true
    mockGoogleToken = 'tok'
    mockGoogleCalendars = [{ id: 'primary', summary: 'Cal', backgroundColor: '#4285f4', enabled: true }]
    mockSyncInterval = 15

    vi.useFakeTimers()
    mockListEvents.mockResolvedValue({ events: [], newAccessToken: undefined })

    const { useGoogleCalendar } = await import('@/composables/calendar/useGoogleCalendar')
    useGoogleCalendar()

    // Advance by 15 minutes — should trigger the auto-sync interval
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000)

    // syncNow would be called by the watcher and then again by interval — at least once
    expect(mockListEvents).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('7. disconnect clears tokens, calendars, and googleEvents', async () => {
    mockGoogleConnected = true
    mockGoogleToken = 'tok-to-clear'
    mockGoogleRefreshToken = 'refresh-to-clear'
    mockGoogleCalendars = [{ id: 'primary', summary: 'Cal', backgroundColor: '#4285f4', enabled: true }]

    mockListEvents.mockResolvedValue({ events: [sampleGoogleEvent], newAccessToken: undefined })

    const { useGoogleCalendar } = await import('@/composables/calendar/useGoogleCalendar')
    const { syncNow, disconnect, googleEvents } = useGoogleCalendar()

    await syncNow()
    expect(googleEvents.value.length).toBeGreaterThan(0)

    disconnect()

    // googleEvents cleared immediately
    expect(googleEvents.value).toHaveLength(0)
    // The disconnect() function sets these via updateSetting — verify the shared mock state was updated
    expect(mockGoogleConnected).toBe(false)
    expect(mockGoogleToken).toBe('')
    expect(mockGoogleRefreshToken).toBe('')
  })

  it('8. error handling: API failure sets error state without throwing', async () => {
    mockGoogleConnected = true
    mockGoogleToken = 'tok'
    mockGoogleCalendars = [{ id: 'primary', summary: 'Cal', backgroundColor: '#4285f4', enabled: true }]

    mockListEvents.mockRejectedValue(new Error('Network failure'))

    const { useGoogleCalendar } = await import('@/composables/calendar/useGoogleCalendar')
    const { syncNow, error } = useGoogleCalendar()

    await expect(syncNow()).resolves.toBeUndefined() // should not throw
    expect(error.value).toBeTruthy()
    expect(error.value).toContain('Network failure')
  })

  it('9. only enabled calendars are synced during syncNow', async () => {
    mockGoogleConnected = true
    mockGoogleToken = 'tok'
    mockGoogleCalendars = [
      { id: 'primary', summary: 'My Calendar', backgroundColor: '#4285f4', enabled: true },
      { id: 'work', summary: 'Work', backgroundColor: '#ff0000', enabled: false },
    ]

    mockListEvents.mockResolvedValue({ events: [], newAccessToken: undefined })

    const { useGoogleCalendar } = await import('@/composables/calendar/useGoogleCalendar')
    const { syncNow, selectedCalendars } = useGoogleCalendar()

    // Only enabled calendars should appear in selectedCalendars
    expect(selectedCalendars.value).toHaveLength(1)
    expect(selectedCalendars.value[0].id).toBe('primary')

    // Clear calls accumulated from watcher immediate invocation, then call syncNow explicitly
    mockListEvents.mockClear()
    await syncNow()

    // listEvents called only once (for the single enabled calendar)
    expect(mockListEvents).toHaveBeenCalledTimes(1)
    expect(mockListEvents.mock.calls[0][1]).toBe('primary')
  })

  it('10. syncNow is a no-op when not connected', async () => {
    mockGoogleConnected = false
    mockGoogleToken = ''

    const { useGoogleCalendar } = await import('@/composables/calendar/useGoogleCalendar')
    const { syncNow, googleEvents } = useGoogleCalendar()

    await syncNow()

    expect(mockListEvents).not.toHaveBeenCalled()
    expect(googleEvents.value).toHaveLength(0)
  })
})
