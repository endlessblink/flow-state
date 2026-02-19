/**
 * FEATURE-1345: Capacitor OAuth composable
 *
 * Handles Google OAuth sign-in for Capacitor (Android/iOS) using:
 * 1. Open system browser via @capacitor/browser
 * 2. Listen for deep link return via @capacitor/app
 * 3. Exchange auth code for Supabase session (PKCE flow)
 *
 * Custom scheme: com.flowstate.app://auth-callback
 */
import { supabase } from '@/services/auth/supabase'

const REDIRECT_URL = 'com.flowstate.app://auth-callback'

/**
 * Initiate Google OAuth sign-in via Capacitor.
 * Opens system browser, waits for deep link callback, exchanges code for session.
 */
export async function signInWithGoogleCapacitor(): Promise<void> {
  const { Browser } = await import('@capacitor/browser')
  const { App } = await import('@capacitor/app')

  // Generate OAuth URL with PKCE and custom scheme redirect
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      skipBrowserRedirect: true,
      redirectTo: REDIRECT_URL,
    },
  })

  if (error || !data.url) {
    throw error || new Error('Failed to generate OAuth URL')
  }

  // Set up deep link listener BEFORE opening browser
  const listenerPromise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      listener.remove()
      reject(new Error('OAuth timeout — no response within 5 minutes'))
    }, 5 * 60 * 1000)

    const listener = App.addListener('appUrlOpen', async ({ url }) => {
      if (!url.startsWith(REDIRECT_URL)) return

      clearTimeout(timeout)
      listener.remove()

      try {
        await Browser.close()
      } catch {
        // Browser might already be closed
      }

      try {
        // Extract the code from the callback URL
        // Supabase PKCE: com.flowstate.app://auth-callback?code=xxx
        const urlObj = new URL(url)
        const code = urlObj.searchParams.get('code')

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            reject(exchangeError)
            return
          }
          console.log('[CAP-OAUTH] Successfully exchanged code for session')
          resolve()
        } else {
          // Check for error in callback
          const errorDesc = urlObj.searchParams.get('error_description')
          reject(new Error(errorDesc || 'No auth code in callback URL'))
        }
      } catch (e) {
        reject(e)
      }
    })
  })

  // Open system browser with OAuth URL
  await Browser.open({ url: data.url, presentationStyle: 'popover' })

  // Wait for the deep link callback
  await listenerPromise
}
