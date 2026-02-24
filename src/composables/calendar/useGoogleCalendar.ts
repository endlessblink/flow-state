/**
 * TASK-1283: Google Calendar composable
 * Fetches events from Google Calendar via the edge function proxy,
 * transforms them to ExternalCalendarEvent[], and manages connection state.
 *
 * Token lifecycle:
 * - Access token captured once during OAuth and stored in settingsStore
 * - Access token expires after ~1 hour (Google default)
 * - Edge function refreshes expired tokens using the refresh token + Google client_secret
 * - This composable proactively refreshes 5 min before expiry to avoid visible errors
 * - If refresh fails, shows reconnect prompt (refresh token revoked or never captured)
 */
import { ref, computed, watch, onUnmounted } from 'vue'
import { useSettingsStore, type GoogleCalendarConfig } from '@/stores/settings'
import { listCalendars as fetchCalendars, listEvents as fetchEvents, type GoogleCalendarEvent as RawGoogleEvent } from '@/services/calendar/googleCalendarService'
import type { ExternalCalendarEvent } from './useExternalCalendar'

// Refresh 5 minutes before expiry to avoid 401 errors during sync
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000

export function useGoogleCalendar() {
  const settingsStore = useSettingsStore()

  const googleEvents = ref<ExternalCalendarEvent[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  let syncInterval: ReturnType<typeof setInterval> | null = null
  let refreshTimer: ReturnType<typeof setTimeout> | null = null

  // Computed from settings — connected if flag is true (token may have expired, but user is still "connected")
  const isConnected = computed(() => settingsStore.googleConnected)
  const needsReauth = computed(() => settingsStore.googleConnected && !settingsStore.googleProviderToken)
  const showGoogleEvents = computed({
    get: () => settingsStore.showGoogleCalendarEvents,
    set: (val: boolean) => settingsStore.updateSetting('showGoogleCalendarEvents', val)
  })
  const selectedCalendars = computed(() =>
    (settingsStore.googleCalendars || []).filter((c: GoogleCalendarConfig) => c.enabled)
  )

  // Check if the access token is expired or about to expire
  function isTokenExpiringSoon(): boolean {
    const expiry = settingsStore.googleProviderTokenExpiry
    if (!expiry) return false // unknown expiry — let the edge function handle it
    return Date.now() > expiry - TOKEN_REFRESH_BUFFER_MS
  }

  // Helper: update token + expiry when proxy refreshed it
  function handleTokenRefresh(newAccessToken?: string) {
    if (newAccessToken) {
      settingsStore.updateSetting('googleProviderToken', newAccessToken)
      // Google access tokens last ~3600s; set expiry with small safety margin
      settingsStore.updateSetting('googleProviderTokenExpiry', Date.now() + 3500 * 1000)
      console.log('[GoogleCalendar] Access token refreshed by proxy, new expiry set')
      scheduleProactiveRefresh()
    }
  }

  // Proactively refresh the token before it expires by making a lightweight API call
  // (list-calendars is cheap). The edge function will detect 401 and refresh automatically.
  async function proactiveRefresh() {
    if (!isConnected.value || !settingsStore.googleProviderToken) return
    if (!settingsStore.googleProviderRefreshToken) {
      console.log('[GoogleCalendar] No refresh token — skipping proactive refresh')
      return
    }

    console.log('[GoogleCalendar] Proactive token refresh triggered')
    try {
      const result = await fetchCalendars(
        settingsStore.googleProviderToken,
        settingsStore.googleProviderRefreshToken
      )
      handleTokenRefresh(result.newAccessToken)
      // Even if no new token (token still valid), reset the timer
      if (!result.newAccessToken) {
        scheduleProactiveRefresh()
      }
    } catch (e: unknown) {
      console.warn('[GoogleCalendar] Proactive refresh failed:', e.message)
      // If refresh fails with auth error, clear token so UI shows reconnect
      if (e.message?.includes('expired') || e.message?.includes('401') || e.message?.includes('refresh failed')) {
        settingsStore.updateSetting('googleProviderToken', '')
        settingsStore.updateSetting('googleProviderTokenExpiry', 0)
        error.value = 'Google token expired — please reconnect in Settings'
      }
    }
  }

  // Schedule proactive refresh based on known expiry time
  function scheduleProactiveRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer)
    const expiry = settingsStore.googleProviderTokenExpiry
    if (!expiry || !isConnected.value) return

    const msUntilRefresh = expiry - Date.now() - TOKEN_REFRESH_BUFFER_MS
    if (msUntilRefresh <= 0) {
      // Already past the refresh window — refresh now
      proactiveRefresh()
    } else {
      console.log(`[GoogleCalendar] Scheduling proactive refresh in ${Math.round(msUntilRefresh / 60000)}min`)
      refreshTimer = setTimeout(proactiveRefresh, msUntilRefresh)
    }
  }

  // Transform Google event to ExternalCalendarEvent
  function transformEvent(event: RawGoogleEvent, calendarId: string, color: string): ExternalCalendarEvent {
    const isAllDay = !event.start.dateTime
    const startTime = event.start.dateTime
      ? new Date(event.start.dateTime)
      : new Date(event.start.date + 'T00:00:00')
    const endTime = event.end.dateTime
      ? new Date(event.end.dateTime)
      : new Date(event.end.date + 'T00:00:00')

    return {
      id: `gcal-${calendarId}-${event.id}`,
      title: event.summary || '(No title)',
      startTime,
      endTime,
      isAllDay,
      location: event.location,
      description: event.description,
      calendarId: `gcal-${calendarId}`,
      color
    }
  }

  // Fetch events from all selected calendars
  async function syncNow() {
    if (!isConnected.value || selectedCalendars.value.length === 0) return
    if (!settingsStore.googleProviderToken) {
      error.value = 'Token expired — please reconnect Google Calendar in Settings'
      return
    }

    // If token is expiring soon and we have a refresh token, refresh first
    if (isTokenExpiringSoon() && settingsStore.googleProviderRefreshToken) {
      console.log('[GoogleCalendar] Token expiring soon — refreshing before sync')
      await proactiveRefresh()
      // If refresh cleared the token (failure), bail out
      if (!settingsStore.googleProviderToken) return
    }

    isLoading.value = true
    error.value = null
    const allEvents: ExternalCalendarEvent[] = []

    // Determine visible date range (± 30 days from now for broad coverage)
    const now = new Date()
    const timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const timeMax = new Date(now.getFullYear(), now.getMonth() + 2, 0)

    for (const cal of selectedCalendars.value) {
      try {
        const result = await fetchEvents(
          settingsStore.googleProviderToken,
          cal.id,
          timeMin,
          timeMax,
          settingsStore.googleProviderRefreshToken || undefined
        )
        handleTokenRefresh(result.newAccessToken)

        const transformed = result.events.map(e => transformEvent(e, cal.id, cal.backgroundColor))
        allEvents.push(...transformed)
      } catch (e: unknown) {
        console.error(`[GoogleCalendar] Failed to fetch events for ${cal.summary}:`, e)
        // Token expired AND refresh failed — clear access token so UI shows re-auth prompt
        if (e.message?.includes('expired') || e.message?.includes('401') || e.message?.includes('refresh failed')) {
          settingsStore.updateSetting('googleProviderToken', '')
          settingsStore.updateSetting('googleProviderTokenExpiry', 0)
          error.value = 'Google token expired — please reconnect in Settings'
          break
        }
        error.value = e.message
      }
    }

    googleEvents.value = allEvents
    isLoading.value = false
  }

  // Fetch available calendars from Google
  async function fetchAvailableCalendars(): Promise<GoogleCalendarConfig[]> {
    if (!settingsStore.googleProviderToken) {
      throw new Error('Not connected to Google Calendar')
    }

    const result = await fetchCalendars(
      settingsStore.googleProviderToken,
      settingsStore.googleProviderRefreshToken || undefined
    )
    handleTokenRefresh(result.newAccessToken)

    return result.calendars.map(c => ({
      id: c.id,
      summary: c.summary,
      backgroundColor: c.backgroundColor || '#4285f4',
      enabled: true  // default to enabled when first fetched
    }))
  }

  // Connect: triggers re-auth with Google (the auth store handles the OAuth flow)
  async function connect() {
    try {
      const { useAuthStore } = await import('@/stores/auth')
      const authStore = useAuthStore()
      await authStore.signInWithGoogle()
      // After sign-in, the auth store's SIGNED_IN handler captures provider tokens
      // and stores them in settingsStore (see auth.ts TASK-1283 section)
    } catch (e: unknown) {
      error.value = e.message
    }
  }

  // Disconnect: clear tokens and calendars
  function disconnect() {
    settingsStore.updateSetting('googleProviderToken', '')
    settingsStore.updateSetting('googleProviderRefreshToken', '')
    settingsStore.updateSetting('googleProviderTokenExpiry', 0)
    settingsStore.updateSetting('googleConnected', false)
    settingsStore.updateSetting('googleCalendars', [])
    googleEvents.value = []
    error.value = null
    if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null }
  }

  // Get events for a specific date (YYYY-MM-DD string)
  function getEventsForDate(dateString: string): ExternalCalendarEvent[] {
    return googleEvents.value.filter(event => {
      const d = event.startTime
      const eventDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return eventDate === dateString
    })
  }

  // Auto-sync setup
  function setupAutoSync() {
    if (syncInterval) clearInterval(syncInterval)
    const intervalMinutes = settingsStore.externalCalendarSyncInterval || 30
    if (intervalMinutes > 0 && isConnected.value && selectedCalendars.value.length > 0) {
      syncInterval = setInterval(syncNow, intervalMinutes * 60 * 1000)
    }
  }

  // Watch for connection and calendar changes
  watch([isConnected, selectedCalendars], ([connected, cals]) => {
    if (connected && cals.length > 0) {
      syncNow()
      setupAutoSync()
      scheduleProactiveRefresh()
    } else {
      googleEvents.value = []
      if (syncInterval) { clearInterval(syncInterval); syncInterval = null }
      if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null }
    }
  }, { immediate: true })

  onUnmounted(() => {
    if (syncInterval) { clearInterval(syncInterval); syncInterval = null }
    if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null }
  })

  return {
    googleEvents,
    isLoading,
    error,
    isConnected,
    needsReauth,
    showGoogleEvents,
    selectedCalendars,
    syncNow,
    getEventsForDate,
    fetchAvailableCalendars,
    connect,
    disconnect
  }
}
