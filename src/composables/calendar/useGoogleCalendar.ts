/**
 * TASK-1283: Google Calendar composable
 * Fetches events from Google Calendar via the edge function proxy,
 * transforms them to ExternalCalendarEvent[], and manages connection state.
 */
import { ref, computed, watch, onUnmounted } from 'vue'
import { useSettingsStore, type GoogleCalendarConfig } from '@/stores/settings'
import { listCalendars as fetchCalendars, listEvents as fetchEvents, type GoogleCalendarEvent as RawGoogleEvent } from '@/services/calendar/googleCalendarService'
import type { ExternalCalendarEvent } from './useExternalCalendar'

export function useGoogleCalendar() {
  const settingsStore = useSettingsStore()

  const googleEvents = ref<ExternalCalendarEvent[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  let syncInterval: ReturnType<typeof setInterval> | null = null

  // Computed from settings
  const isConnected = computed(() => settingsStore.googleCalendarConnected && !!settingsStore.googleCalendarToken)
  const showGoogleEvents = computed({
    get: () => settingsStore.showGoogleCalendarEvents,
    set: (val: boolean) => settingsStore.updateSetting('showGoogleCalendarEvents', val)
  })
  const selectedCalendars = computed(() =>
    (settingsStore.googleCalendars || []).filter((c: GoogleCalendarConfig) => c.enabled)
  )

  // Helper: update token if proxy refreshed it
  function handleTokenRefresh(newAccessToken?: string) {
    if (newAccessToken) {
      settingsStore.updateSetting('googleCalendarToken', newAccessToken)
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
          settingsStore.googleCalendarToken,
          cal.id,
          timeMin,
          timeMax,
          settingsStore.googleCalendarRefreshToken || undefined
        )
        handleTokenRefresh(result.newAccessToken)

        const transformed = result.events.map(e => transformEvent(e, cal.id, cal.backgroundColor))
        allEvents.push(...transformed)
      } catch (e: any) {
        console.error(`[GoogleCalendar] Failed to fetch events for ${cal.summary}:`, e)
        error.value = e.message
      }
    }

    googleEvents.value = allEvents
    isLoading.value = false
  }

  // Fetch available calendars from Google
  async function fetchAvailableCalendars(): Promise<GoogleCalendarConfig[]> {
    if (!settingsStore.googleCalendarToken) {
      throw new Error('Not connected to Google Calendar')
    }

    const result = await fetchCalendars(
      settingsStore.googleCalendarToken,
      settingsStore.googleCalendarRefreshToken || undefined
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
    } catch (e: any) {
      error.value = e.message
    }
  }

  // Disconnect: clear tokens and calendars
  function disconnect() {
    settingsStore.updateSetting('googleCalendarToken', '')
    settingsStore.updateSetting('googleCalendarRefreshToken', '')
    settingsStore.updateSetting('googleCalendarConnected', false)
    settingsStore.updateSetting('googleCalendars', [])
    googleEvents.value = []
    error.value = null
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
    } else {
      googleEvents.value = []
      if (syncInterval) {
        clearInterval(syncInterval)
        syncInterval = null
      }
    }
  }, { immediate: true })

  onUnmounted(() => {
    if (syncInterval) {
      clearInterval(syncInterval)
      syncInterval = null
    }
  })

  return {
    googleEvents,
    isLoading,
    error,
    isConnected,
    showGoogleEvents,
    selectedCalendars,
    syncNow,
    getEventsForDate,
    fetchAvailableCalendars,
    connect,
    disconnect
  }
}
