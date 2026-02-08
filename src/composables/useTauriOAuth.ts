/**
 * FEATURE-1202: Tauri OAuth composable for desktop Google sign-in
 *
 * Uses tauri-plugin-oauth to spawn a temporary localhost HTTP server
 * that captures the OAuth callback from the system browser.
 *
 * Flow:
 * 1. Start localhost OAuth server → get port
 * 2. Set up onUrl listener for callback
 * 3. Generate Supabase OAuth URL with redirectTo = localhost:port
 * 4. Open URL in system browser via tauri-plugin-shell
 * 5. User authenticates → Google redirects to localhost:PORT
 * 6. onUrl fires with callback URL
 * 7. Extract authorization code and exchange for session
 */

import { supabase } from '@/services/auth/supabase'

const OAUTH_PORTS = [24892, 24893, 24894]
const OAUTH_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Sign in with Google via Tauri desktop OAuth flow.
 * Opens system browser for authentication, captures callback on localhost.
 */
export async function signInWithGoogleTauri(): Promise<void> {
  const { start, cancel, onUrl } = await import('@fabianlars/tauri-plugin-oauth')
  const { open } = await import('@tauri-apps/plugin-shell')

  if (!supabase) {
    throw new Error('Supabase client not available')
  }

  // 1. Start localhost server to capture the OAuth callback
  let port: number
  try {
    port = await start({
      ports: OAUTH_PORTS,
      response: [
        '<html><head><style>',
        'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
        'display:flex;justify-content:center;align-items:center;',
        'height:100vh;margin:0;background:#1a1a2e;color:#e0e0e0}',
        '.c{text-align:center}h2{color:#00d4ff;margin-bottom:8px}p{opacity:.7}',
        '</style></head><body><div class="c">',
        '<h2>Authentication Successful</h2>',
        '<p>You can close this tab and return to FlowState.</p>',
        '</div></body></html>',
      ].join(''),
    })
  } catch (e) {
    throw new Error(`Failed to start OAuth server: ${e}`)
  }

  console.log(`[TAURI-OAUTH] Server listening on port ${port}`)

  // 2. Set up callback listener BEFORE opening browser
  const callbackPromise = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cancel(port).catch(() => {})
      reject(new Error('OAuth timed out — no response received within 5 minutes'))
    }, OAUTH_TIMEOUT_MS)

    onUrl((url: string) => {
      clearTimeout(timeout)
      resolve(url)
    }).catch((err) => {
      clearTimeout(timeout)
      reject(new Error(`Failed to set up OAuth listener: ${err}`))
    })
  })

  // 3. Generate Supabase OAuth URL with the actual localhost:port as redirect
  const { data: oauthData, error: oauthError } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      skipBrowserRedirect: true,
      redirectTo: `http://127.0.0.1:${port}`,
    },
  })

  if (oauthError || !oauthData?.url) {
    await cancel(port).catch(() => {})
    throw oauthError || new Error('Failed to generate OAuth URL')
  }

  // 4. Open the OAuth URL in the system browser
  try {
    await open(oauthData.url)
  } catch (e) {
    await cancel(port).catch(() => {})
    throw new Error(`Failed to open browser for authentication: ${e}`)
  }

  console.log('[TAURI-OAUTH] Opened system browser for authentication')

  // 5. Wait for the callback URL
  const callbackUrl = await callbackPromise

  console.log('[TAURI-OAUTH] Received callback URL')

  // 6. Parse the callback and extract auth data
  const url = new URL(callbackUrl)

  // Check for errors
  const errorParam = url.searchParams.get('error')
  if (errorParam) {
    const errorDesc = url.searchParams.get('error_description') || errorParam
    throw new Error(`OAuth error: ${errorDesc}`)
  }

  // PKCE flow: extract authorization code from query params
  const code = url.searchParams.get('code')

  // Implicit flow fallback: check hash fragment for access_token
  const hashParams = new URLSearchParams(url.hash.substring(1))
  const accessToken = hashParams.get('access_token')
  const refreshToken = hashParams.get('refresh_token')

  if (code) {
    // PKCE flow — exchange code for session
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      throw exchangeError
    }
    console.log('[TAURI-OAUTH] Session established via PKCE code exchange')
  } else if (accessToken) {
    // Implicit flow fallback — set session directly
    const { error: setError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken || '',
    })
    if (setError) {
      throw setError
    }
    console.log('[TAURI-OAUTH] Session established via implicit flow tokens')
  } else {
    throw new Error('No authorization code or access token in OAuth callback')
  }
}
