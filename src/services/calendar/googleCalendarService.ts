/**
 * Google Calendar Proxy Client
 *
 * Client service for proxying Google Calendar API requests through the
 * Supabase Edge Function `google-calendar-proxy`. This keeps OAuth tokens
 * and refresh logic server-side, preventing direct Google API calls from
 * the client bundle.
 *
 * Supports:
 * - Listing a user's Google Calendars
 * - Listing events within a date range from a specific calendar
 * - Automatic token refresh via the proxy (newAccessToken flow)
 *
 * @see TASK-1283 in MASTER_PLAN.md - Google Calendar integration
 */

import { supabase } from '@/services/auth/supabase'
// TASK-1186: Use Tauri HTTP for CORS-free requests in desktop app
import { tauriFetch } from '@/services/ai/utils/tauriHttp'

// ============================================================================
// Types
// ============================================================================

/**
 * A Google Calendar entry as returned by the proxy.
 */
export interface GoogleCalendar {
  id: string
  summary: string
  backgroundColor: string
}

/**
 * A Google Calendar event as returned by the proxy.
 * Both `start` and `end` may carry either a dateTime (timed events)
 * or a date (all-day events).
 */
export interface GoogleCalendarEvent {
  id: string
  summary: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  location?: string
  description?: string
  htmlLink?: string
}

// ============================================================================
// URL Resolution
// ============================================================================

const envUrl = import.meta.env.VITE_SUPABASE_URL || ''

/**
 * Resolve the Supabase base URL, handling relative paths (e.g. in local dev
 * where VITE_SUPABASE_URL may be set to a path like `/api/supabase`).
 */
function resolveSupabaseUrl(): string {
  if (!envUrl) return ''
  if (envUrl.startsWith('/') && typeof window !== 'undefined') {
    return `${window.location.origin}${envUrl}`
  }
  return envUrl
}

// ============================================================================
// Internal Proxy Helper
// ============================================================================

/**
 * Send a POST request to the `google-calendar-proxy` edge function.
 *
 * Automatically attaches the Supabase session token and the anon key so the
 * function can verify the caller. Uses `tauriFetch` for Tauri CORS bypass,
 * falling back to native `fetch` in a browser context.
 *
 * If the proxy refreshed the Google OAuth access token it returns a
 * `newAccessToken` field in the response body alongside the data payload.
 *
 * @param body - JSON-serialisable request payload (must include `action`)
 * @returns Parsed JSON response from the edge function
 * @throws Error with a descriptive message on auth failure or HTTP error
 *
 * @see TASK-1283
 */
async function callGoogleCalendarProxy(body: Record<string, unknown>): Promise<unknown> {
  const supabaseUrl = resolveSupabaseUrl()
  if (!supabaseUrl) {
    throw new Error('[GoogleCalendarService] VITE_SUPABASE_URL is not configured')
  }

  const url = `${supabaseUrl}/functions/v1/google-calendar-proxy`

  // Retrieve the current session token for authenticating against the edge function.
  if (!supabase) {
    throw new Error('[GoogleCalendarService] Supabase client is not initialised')
  }
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('[GoogleCalendarService] No active Supabase session — user must be signed in')
  }

  const response = await tauriFetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`
    try {
      const errorData = await response.json() as { error?: string; message?: string }
      errorMessage = errorData.error || errorData.message || errorMessage
    } catch {
      // ignore JSON parse failure — keep the HTTP status message
    }
    throw new Error(`[GoogleCalendarService] Proxy request failed: ${errorMessage}`)
  }

  return response.json()
}

// ============================================================================
// Public API
// ============================================================================

/**
 * List all Google Calendars accessible by the authenticated user.
 *
 * The proxy may transparently refresh the Google access token. When it does
 * so the new token is returned alongside the calendar list so the caller can
 * persist it.
 *
 * @param googleToken - Current Google OAuth access token
 * @param googleRefreshToken - Optional Google OAuth refresh token for auto-renewal
 * @returns An object containing the calendar list and an optional refreshed access token
 *
 * @example
 * ```typescript
 * const { calendars, newAccessToken } = await listCalendars(googleToken, googleRefreshToken)
 * if (newAccessToken) persistToken(newAccessToken)
 * ```
 *
 * @see TASK-1283
 */
export async function listCalendars(
  googleToken: string,
  googleRefreshToken?: string,
): Promise<{ calendars: GoogleCalendar[]; newAccessToken?: string }> {
  const data = await callGoogleCalendarProxy({
    action: 'list-calendars',
    googleToken,
    ...(googleRefreshToken ? { googleRefreshToken } : {}),
  }) as { calendars: GoogleCalendar[]; newAccessToken?: string }

  return {
    calendars: data.calendars ?? [],
    ...(data.newAccessToken ? { newAccessToken: data.newAccessToken } : {}),
  }
}

/**
 * List Google Calendar events within a time window.
 *
 * The proxy may transparently refresh the Google access token. When it does
 * so the new token is returned alongside the events so the caller can persist
 * it.
 *
 * @param googleToken - Current Google OAuth access token
 * @param calendarId - ID of the calendar to query (e.g. `"primary"`)
 * @param timeMin - Start of the time range (inclusive)
 * @param timeMax - End of the time range (exclusive)
 * @param googleRefreshToken - Optional Google OAuth refresh token for auto-renewal
 * @returns An object containing the event list and an optional refreshed access token
 *
 * @example
 * ```typescript
 * const start = startOfWeek(new Date())
 * const end = endOfWeek(new Date())
 * const { events, newAccessToken } = await listEvents(googleToken, 'primary', start, end)
 * ```
 *
 * @see TASK-1283
 */
export async function listEvents(
  googleToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
  googleRefreshToken?: string,
): Promise<{ events: GoogleCalendarEvent[]; newAccessToken?: string }> {
  const data = await callGoogleCalendarProxy({
    action: 'list-events',
    googleToken,
    calendarId,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    ...(googleRefreshToken ? { googleRefreshToken } : {}),
  }) as { events: GoogleCalendarEvent[]; newAccessToken?: string }

  return {
    events: data.events ?? [],
    ...(data.newAccessToken ? { newAccessToken: data.newAccessToken } : {}),
  }
}
