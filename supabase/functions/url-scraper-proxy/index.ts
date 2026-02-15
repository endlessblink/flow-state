/**
 * Supabase Edge Function: url-scraper-proxy
 * TASK-1325: Proxies URL fetches for PWA mode (CORS bypass).
 *
 * POST { url } → { html, statusCode, contentType }
 *
 * Security:
 * - Blocks private IP ranges (SSRF protection)
 * - Only allows http/https schemes
 * - Truncates response to 50KB
 * - CORS restricted to allowed origins
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ALLOWED_ORIGINS = [
  'https://in-theflow.com',
  'https://www.in-theflow.com',
  'http://localhost:5546',
  'tauri://localhost',
]

const MAX_HTML_SIZE = 50_000
const FETCH_TIMEOUT = 10_000

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

/**
 * SSRF protection: block private/reserved IP ranges
 */
function isPrivateUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr)
    const hostname = url.hostname

    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('172.') ||
      hostname.startsWith('169.254.') ||
      hostname.endsWith('.local') ||
      hostname === '0.0.0.0'
    ) {
      return true
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return true
    }

    return false
  } catch {
    return true
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()

    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (isPrivateUrl(url)) {
      return new Response(
        JSON.stringify({ error: 'URL not allowed' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
          'User-Agent': 'FlowState-Bot/1.0 (URL Preview)',
        },
        signal: controller.signal,
        redirect: 'follow',
      })

      clearTimeout(timeoutId)

      const contentType = response.headers.get('content-type') || ''
      const text = await response.text()
      const html = text.slice(0, MAX_HTML_SIZE)

      return new Response(
        JSON.stringify({ html, statusCode: response.status, contentType }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        return new Response(
          JSON.stringify({ error: 'Request timed out' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      throw fetchError
    }
  } catch (error: any) {
    const corsHeaders = getCorsHeaders(req)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
