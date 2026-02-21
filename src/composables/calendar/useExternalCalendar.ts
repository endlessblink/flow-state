/**
 * TASK-1317: External Calendar (iCal) Sync
 * Fetches iCal URLs, parses VEVENT data, and provides read-only events for calendar views.
 * Supports Google Calendar .ics URLs and any standard iCal feed.
 */
import { ref, computed, watch, onUnmounted } from 'vue'
import { useSettingsStore, type ExternalCalendarConfig } from '@/stores/settings'

export interface ExternalCalendarEvent {
  id: string
  title: string
  startTime: Date
  endTime: Date
  isAllDay: boolean
  location?: string
  description?: string
  calendarId: string
  color: string
}

// ─── iCal Parser ───────────────────────────────────────────────────────────

function getPropertyWithParams(text: string, name: string): { value: string | null; params: string } {
  const unfolded = text.replace(/\r?\n[ \t]/g, '')
  const regex = new RegExp(`^${name}([;:].*)$`, 'm')
  const match = unfolded.match(regex)
  if (!match) return { value: null, params: '' }

  const rest = match[1]
  if (rest.startsWith(':')) {
    return { value: rest.substring(1).trim(), params: '' }
  }
  // Has params — find the colon separating params from value
  const colonIdx = rest.indexOf(':')
  if (colonIdx === -1) return { value: rest, params: '' }

  return {
    value: rest.substring(colonIdx + 1).trim(),
    params: rest.substring(0, colonIdx)
  }
}

function parseICalDate(dateStr: string): Date {
  // DATE format: 20260214
  if (dateStr.length === 8) {
    return new Date(
      parseInt(dateStr.substring(0, 4)),
      parseInt(dateStr.substring(4, 6)) - 1,
      parseInt(dateStr.substring(6, 8))
    )
  }

  // DATE-TIME format: 20260214T090000Z or 20260214T090000
  const year = parseInt(dateStr.substring(0, 4))
  const month = parseInt(dateStr.substring(4, 6)) - 1
  const day = parseInt(dateStr.substring(6, 8))
  const hour = parseInt(dateStr.substring(9, 11))
  const minute = parseInt(dateStr.substring(11, 13))
  const second = parseInt(dateStr.substring(13, 15)) || 0

  if (dateStr.endsWith('Z')) {
    return new Date(Date.UTC(year, month, day, hour, minute, second))
  }

  return new Date(year, month, day, hour, minute, second)
}

function unescapeIcal(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

function parseICalText(icsText: string, calendarId: string, color: string): ExternalCalendarEvent[] {
  const events: ExternalCalendarEvent[] = []
  const blocks = icsText.split('BEGIN:VEVENT')

  for (let i = 1; i < blocks.length; i++) {
    const endIdx = blocks[i].indexOf('END:VEVENT')
    if (endIdx === -1) continue
    const eventText = blocks[i].substring(0, endIdx)

    const uid = getPropertyWithParams(eventText, 'UID')
    const summary = getPropertyWithParams(eventText, 'SUMMARY')
    const dtstart = getPropertyWithParams(eventText, 'DTSTART')
    const dtend = getPropertyWithParams(eventText, 'DTEND')
    const location = getPropertyWithParams(eventText, 'LOCATION')
    const description = getPropertyWithParams(eventText, 'DESCRIPTION')

    if (!summary.value || !dtstart.value) continue

    // Skip recurring event templates (RRULE) — individual occurrences have RECURRENCE-ID
    // For MVP, we only show non-recurring events and expanded occurrences
    const hasRRule = eventText.includes('RRULE:')
    const hasRecurrenceId = eventText.includes('RECURRENCE-ID')
    if (hasRRule && !hasRecurrenceId) continue

    const isAllDay = !dtstart.value.includes('T')
    const startTime = parseICalDate(dtstart.value)
    const endTime = dtend.value
      ? parseICalDate(dtend.value)
      : new Date(startTime.getTime() + (isAllDay ? 86400000 : 3600000))

    events.push({
      id: uid.value || `${calendarId}-${i}`,
      title: unescapeIcal(summary.value),
      startTime,
      endTime,
      isAllDay,
      location: location.value ? unescapeIcal(location.value) : undefined,
      description: description.value ? unescapeIcal(description.value) : undefined,
      calendarId,
      color
    })
  }

  return events
}

// ─── Fetch Logic ───────────────────────────────────────────────────────────

async function fetchICalUrl(url: string): Promise<string> {
  // Tauri desktop: use HTTP plugin (no CORS restrictions)
  if (window.__TAURI__) {
    try {
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
      const response = await tauriFetch(url, { method: 'GET' })
      if (response.ok) {
        return await response.text()
      }
      throw new Error(`HTTP ${response.status}`)
    } catch (e: any) {
      // If Tauri fetch fails, fall through to native fetch
      console.warn('[ExternalCalendar] Tauri fetch failed:', e.message)
    }
  }

  // Browser: try native fetch (works for CORS-enabled URLs)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  return await response.text()
}

// ─── Composable ────────────────────────────────────────────────────────────

export function useExternalCalendar() {
  const settingsStore = useSettingsStore()

  const allEvents = ref<ExternalCalendarEvent[]>([])
  const isLoading = ref(false)
  const syncErrors = ref<Map<string, string>>(new Map())

  let syncInterval: ReturnType<typeof setInterval> | null = null

  const calendars = computed(() => settingsStore.externalCalendars || [])
  const enabledCalendars = computed(() => calendars.value.filter(c => c.enabled))
  const hasEnabledCalendars = computed(() => enabledCalendars.value.length > 0)

  const syncNow = async () => {
    if (enabledCalendars.value.length === 0) return

    isLoading.value = true
    syncErrors.value.clear()
    const newEvents: ExternalCalendarEvent[] = []

    for (const cal of enabledCalendars.value) {
      try {
        const icsText = await fetchICalUrl(cal.url)
        const events = parseICalText(icsText, cal.id, cal.color)
        newEvents.push(...events)

        // Update last synced
        const cals = [...settingsStore.externalCalendars]
        const idx = cals.findIndex(c => c.id === cal.id)
        if (idx !== -1) {
          cals[idx] = { ...cals[idx], lastSynced: new Date().toISOString(), error: undefined }
          settingsStore.updateSetting('externalCalendars', cals)
        }
      } catch (e: any) {
        console.error(`[ExternalCalendar] Sync failed for ${cal.name}:`, e)
        syncErrors.value.set(cal.id, e.message)

        const cals = [...settingsStore.externalCalendars]
        const idx = cals.findIndex(c => c.id === cal.id)
        if (idx !== -1) {
          cals[idx] = { ...cals[idx], error: e.message }
          settingsStore.updateSetting('externalCalendars', cals)
        }
      }
    }

    allEvents.value = newEvents
    isLoading.value = false
  }

  const getEventsForDate = (dateString: string): ExternalCalendarEvent[] => {
    return allEvents.value.filter(event => {
      const d = event.startTime
      const eventDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return eventDate === dateString
    })
  }

  const addCalendar = (config: Omit<ExternalCalendarConfig, 'id'>) => {
    const id = `ical-${Date.now()}`
    const cals = [...(settingsStore.externalCalendars || []), { ...config, id }]
    settingsStore.updateSetting('externalCalendars', cals)
    syncNow()
    return id
  }

  const removeCalendar = (calendarId: string) => {
    const cals = (settingsStore.externalCalendars || []).filter(c => c.id !== calendarId)
    settingsStore.updateSetting('externalCalendars', cals)
    allEvents.value = allEvents.value.filter(e => e.calendarId !== calendarId)
  }

  const toggleCalendar = (calendarId: string) => {
    const cals = [...(settingsStore.externalCalendars || [])]
    const idx = cals.findIndex(c => c.id === calendarId)
    if (idx !== -1) {
      cals[idx] = { ...cals[idx], enabled: !cals[idx].enabled }
      settingsStore.updateSetting('externalCalendars', cals)
      syncNow()
    }
  }

  // Auto-sync setup
  const setupAutoSync = () => {
    if (syncInterval) clearInterval(syncInterval)

    const intervalMinutes = settingsStore.externalCalendarSyncInterval || 30
    if (intervalMinutes > 0 && enabledCalendars.value.length > 0) {
      syncInterval = setInterval(syncNow, intervalMinutes * 60 * 1000)
    }
  }

  // Watch for calendar config changes
  watch(enabledCalendars, (cals) => {
    if (cals.length > 0) {
      syncNow()
      setupAutoSync()
    } else {
      allEvents.value = []
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
    allEvents,
    isLoading,
    syncErrors,
    calendars,
    enabledCalendars,
    hasEnabledCalendars,
    syncNow,
    getEventsForDate,
    addCalendar,
    removeCalendar,
    toggleCalendar
  }
}
