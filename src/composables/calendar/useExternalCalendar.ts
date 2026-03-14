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

// BUG-1523: RRULE expansion — supports DAILY/WEEKLY/MONTHLY/YEARLY with INTERVAL, COUNT, UNTIL
const MAX_RRULE_INSTANCES = 500

function parseByday(byday: string): number[] {
  const dayMap: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }
  return byday.split(',').map(d => dayMap[d.trim().replace(/^[+-]?\d+/, '')]).filter(n => n !== undefined)
}

function expandRRule(dtstart: Date, rruleText: string, rangeStart: Date, rangeEnd: Date): Date[] {
  const dates: Date[] = []
  const parts: Record<string, string> = {}
  rruleText.replace('RRULE:', '').split(';').forEach(p => {
    const [k, v] = p.split('=')
    if (k && v !== undefined) parts[k.trim()] = v.trim()
  })

  const freq = parts.FREQ
  if (!freq) return dates

  const interval = parseInt(parts.INTERVAL || '1', 10) || 1
  const until = parts.UNTIL ? parseICalDate(parts.UNTIL) : rangeEnd
  const effectiveEnd = until < rangeEnd ? until : rangeEnd
  const countLimit = parts.COUNT ? parseInt(parts.COUNT, 10) : MAX_RRULE_INSTANCES
  const bydayNums = parts.BYDAY ? parseByday(parts.BYDAY) : null

  let current = new Date(dtstart)
  let generated = 0

  while (current <= effectiveEnd && generated < countLimit && generated < MAX_RRULE_INSTANCES) {
    if (current >= rangeStart) {
      // For WEEKLY with BYDAY, check if current day-of-week is in the list
      if (freq === 'WEEKLY' && bydayNums && bydayNums.length > 0) {
        if (bydayNums.includes(current.getDay())) {
          dates.push(new Date(current))
        }
      } else {
        dates.push(new Date(current))
      }
    }
    generated++

    // Advance to next candidate
    const prev = new Date(current)
    switch (freq) {
      case 'DAILY':
        current = new Date(current)
        current.setDate(current.getDate() + interval)
        break
      case 'WEEKLY':
        if (bydayNums && bydayNums.length > 1) {
          // Advance one day at a time; the BYDAY filter above handles which days count
          current = new Date(current)
          current.setDate(current.getDate() + 1)
          // When we've gone a full week past a BYDAY hit without another hit, jump ahead
          // (simple: just advance day by day, filter handles it, safety via generated < MAX)
        } else {
          current = new Date(current)
          current.setDate(current.getDate() + 7 * interval)
        }
        break
      case 'MONTHLY':
        current = new Date(current)
        current.setMonth(current.getMonth() + interval)
        break
      case 'YEARLY':
        current = new Date(current)
        current.setFullYear(current.getFullYear() + interval)
        break
      default:
        return dates // unknown freq — bail
    }
    // Safety: if date didn't advance (e.g. setMonth overflow), force break
    if (current.getTime() === prev.getTime()) break
  }

  return dates
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

    const hasRRule = eventText.includes('RRULE:')
    // RECURRENCE-ID marks an exception override for a specific occurrence — keep as-is
    const hasRecurrenceId = eventText.includes('RECURRENCE-ID')

    const isAllDay = !dtstart.value.includes('T')
    const startTime = parseICalDate(dtstart.value)
    const durationMs = dtend.value
      ? parseICalDate(dtend.value).getTime() - startTime.getTime()
      : isAllDay ? 86400000 : 3600000

    const eventBase = {
      title: unescapeIcal(summary.value),
      isAllDay,
      location: location.value ? unescapeIcal(location.value) : undefined,
      description: description.value ? unescapeIcal(description.value) : undefined,
      calendarId,
      color
    }

    if (hasRRule && !hasRecurrenceId) {
      // BUG-1523: Expand recurring event into individual instances within visible window
      const rruleLine = eventText.split(/\r?\n/).find(l => l.startsWith('RRULE:'))
      if (!rruleLine) continue

      const now = new Date()
      const rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)
      const rangeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 90)

      const occurrences = expandRRule(startTime, rruleLine.trim(), rangeStart, rangeEnd)
      const baseUid = uid.value || `${calendarId}-${i}`

      for (let j = 0; j < occurrences.length; j++) {
        const occStart = occurrences[j]
        const occEnd = new Date(occStart.getTime() + durationMs)
        events.push({
          ...eventBase,
          id: `${baseUid}-occ${j}`,
          startTime: occStart,
          endTime: occEnd
        })
      }
    } else {
      // Non-recurring event or RECURRENCE-ID exception instance — add directly
      const endTime = new Date(startTime.getTime() + durationMs)
      events.push({
        ...eventBase,
        id: uid.value || `${calendarId}-${i}`,
        startTime,
        endTime
      })
    }
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
    } catch (e: unknown) {
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
      } catch (e: unknown) {
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
