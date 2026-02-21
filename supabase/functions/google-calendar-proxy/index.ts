/**
 * Supabase Edge Function: google-calendar-proxy
 *
 * Proxies Google Calendar API requests on behalf of authenticated FlowState users.
 * Google OAuth tokens are passed per-request from the client (never stored here).
 * GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are read from Supabase secrets for
 * token refresh flows.
 *
 * Supported actions:
 * - list-calendars: GET /users/me/calendarList
 * - list-events: GET /calendars/{calendarId}/events
 *
 * Token refresh: if a Google API call returns 401 and googleRefreshToken is present,
 * the function refreshes the token and retries, returning newAccessToken to the client.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================================
// Types
// ============================================================================

interface GoogleCalendarProxyRequest {
  action: 'list-calendars' | 'list-events'
  googleToken: string
  googleRefreshToken?: string
  calendarId?: string
  timeMin?: string  // ISO string
  timeMax?: string  // ISO string
}

interface GoogleCalendarEntry {
  id: string
  summary: string
  backgroundColor?: string
}

interface GoogleCalendarEvent {
  id: string
  summary?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  location?: string
  description?: string
  htmlLink?: string
}

interface TokenRefreshResponse {
  access_token: string
  expires_in: number
  token_type: string
}

// ============================================================================
// CORS Headers
// ============================================================================

const ALLOWED_ORIGINS = [
  'https://in-theflow.com',
  'https://www.in-theflow.com',
  'http://localhost:5546',   // dev server
  'tauri://localhost',        // Tauri desktop app
]

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

// ============================================================================
// Auth Validation
// ============================================================================

/**
 * Validate Supabase JWT from the Authorization header.
 * Returns the authenticated user or throws on failure.
 */
async function validateSupabaseAuth(req: Request): Promise<{ id: string }> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header')
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment not configured')
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('Invalid or expired Supabase session')
  }

  return user
}

// ============================================================================
// Google Token Refresh
// ============================================================================

/**
 * Exchange a refresh token for a new access token via Google OAuth2.
 * Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Supabase secrets.
 */
async function refreshGoogleToken(refreshToken: string): Promise<string> {
  // Read from Supabase Auth's existing Google OAuth env vars (shared via Doppler)
  const clientId = Deno.env.get('SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID') || Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET') || Deno.env.get('GOOGLE_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured (SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID / SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)')
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Google token refresh failed:', response.status, errorText)
    throw new Error(`Token refresh failed: ${response.status}`)
  }

  const data: TokenRefreshResponse = await response.json()
  return data.access_token
}

// ============================================================================
// Action Handlers
// ============================================================================

/**
 * list-calendars: GET /users/me/calendarList
 * Returns calendars the user has access to.
 */
async function listCalendars(
  accessToken: string
): Promise<{ calendars: GoogleCalendarEntry[] }> {
  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (!response.ok) {
    const status = response.status
    if (status === 401) {
      // Signal to caller that token is expired
      const err = new Error('Google token expired')
      ;(err as Error & { status: number }).status = 401
      throw err
    }
    const errorText = await response.text()
    console.error('Google calendarList error:', status, errorText)
    throw new Error(`Google Calendar API error: ${status}`)
  }

  const data = await response.json()
  const calendars: GoogleCalendarEntry[] = (data.items || []).map(
    (item: { id: string; summary: string; backgroundColor?: string }) => ({
      id: item.id,
      summary: item.summary,
      backgroundColor: item.backgroundColor,
    })
  )

  return { calendars }
}

/**
 * list-events: GET /calendars/{calendarId}/events
 * Returns events in the specified calendar within the given time window.
 */
async function listEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<{ events: GoogleCalendarEvent[] }> {
  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    timeMin,
    timeMax,
    maxResults: '250',
  })

  const encodedCalendarId = encodeURIComponent(calendarId)
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events?${params}`

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const status = response.status
    if (status === 401) {
      const err = new Error('Google token expired')
      ;(err as Error & { status: number }).status = 401
      throw err
    }
    const errorText = await response.text()
    console.error('Google events error:', status, errorText)
    throw new Error(`Google Calendar API error: ${status}`)
  }

  const data = await response.json()
  const events: GoogleCalendarEvent[] = (data.items || []).map(
    (item: {
      id: string
      summary?: string
      start: { dateTime?: string; date?: string }
      end: { dateTime?: string; date?: string }
      location?: string
      description?: string
      htmlLink?: string
    }) => ({
      id: item.id,
      summary: item.summary,
      start: item.start,
      end: item.end,
      location: item.location,
      description: item.description,
      htmlLink: item.htmlLink,
    })
  )

  return { events }
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate Supabase auth
    try {
      await validateSupabaseAuth(req)
    } catch (authError) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: (authError as Error).message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: GoogleCalendarProxyRequest = await req.json()

    // Validate action
    if (!body.action || !['list-calendars', 'list-events'].includes(body.action)) {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Supported: list-calendars, list-events' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate googleToken
    if (!body.googleToken) {
      return new Response(
        JSON.stringify({ error: 'googleToken is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate list-events params
    if (body.action === 'list-events') {
      if (!body.calendarId) {
        return new Response(
          JSON.stringify({ error: 'calendarId is required for list-events' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      if (!body.timeMin || !body.timeMax) {
        return new Response(
          JSON.stringify({ error: 'timeMin and timeMax are required for list-events' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Execute action with optional token refresh on 401
    let accessToken = body.googleToken
    let newAccessToken: string | undefined

    const executeAction = async () => {
      if (body.action === 'list-calendars') {
        return await listCalendars(accessToken)
      } else {
        return await listEvents(accessToken, body.calendarId!, body.timeMin!, body.timeMax!)
      }
    }

    let result: object
    try {
      result = await executeAction()
    } catch (err) {
      const apiErr = err as Error & { status?: number }
      if (apiErr.status === 401 && body.googleRefreshToken) {
        // Token expired — attempt refresh and retry
        console.log('Google token expired, attempting refresh...')
        try {
          accessToken = await refreshGoogleToken(body.googleRefreshToken)
          newAccessToken = accessToken
          result = await executeAction()
        } catch (refreshErr) {
          console.error('Token refresh or retry failed:', refreshErr)
          return new Response(
            JSON.stringify({
              error: 'Google token expired and refresh failed',
              message: (refreshErr as Error).message,
            }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } else if (apiErr.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Google token expired. Please reconnect your Google account.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        throw err
      }
    }

    // Return result, optionally including newAccessToken for client storage update
    const responseBody = newAccessToken
      ? { ...result, newAccessToken }
      : result

    return new Response(
      JSON.stringify(responseBody),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
