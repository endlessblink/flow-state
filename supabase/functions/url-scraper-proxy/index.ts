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
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DEFAULT_ORIGINS = [
  'http://localhost:5546',
  'http://localhost:3000',
  'tauri://localhost',
]

const ALLOWED_ORIGINS = (() => {
  const envOrigins = Deno.env.get('ALLOWED_ORIGINS')
  if (envOrigins) {
    return [...envOrigins.split(',').map(o => o.trim()), ...DEFAULT_ORIGINS]
  }
  return DEFAULT_ORIGINS
})()

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

/**
 * BUG-1142: Validate Supabase JWT from the Authorization header.
 * Prevents unauthenticated access to the URL scraper proxy.
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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // BUG-1142: Require authenticated user
    await validateSupabaseAuth(req)

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
