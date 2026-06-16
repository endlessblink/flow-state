import type { Session } from '@supabase/supabase-js'
import { supabaseConfig } from '@/services/auth/supabase'

/**
 * TASK-1797 — Local Task API bridge (renderer → Electron main → sidecar).
 *
 * Forwards the logged-in Supabase session to the Electron-spawned Local Task API
 * sidecar (token mode). The sidecar then talks to Supabase as the user (anon key
 * + this JWT), so every query is RLS-scoped. No-op outside Electron and when the
 * API is disabled (the main process simply ignores the session until enabled).
 *
 * The renderer is the sole token refresher: this runs on every session change
 * (sign-in / TOKEN_REFRESHED / sign-out), keeping the sidecar's token fresh.
 */

interface ElectronLocalApi {
  isElectron?: boolean
  setLocalApiSession?: (session: unknown) => Promise<unknown>
  clearLocalApiSession?: () => Promise<unknown>
}

function getElectronApi(): ElectronLocalApi | null {
  if (typeof window === 'undefined') return null
  const api = (window as unknown as { electronAPI?: ElectronLocalApi }).electronAPI
  return api && api.isElectron ? api : null
}

export function syncLocalApiSession(session: Session | null): void {
  const api = getElectronApi()
  if (!api) return
  try {
    const expiresAtMs = session?.expires_at ? session.expires_at * 1000 : null
    const isFresh = !expiresAtMs || Date.now() < expiresAtMs - 30_000
    if (session?.access_token && session.user?.id && isFresh) {
      void api.setLocalApiSession?.({
        supabaseUrl: supabaseConfig.url,
        anonKey: supabaseConfig.anonKey,
        accessToken: session.access_token,
        refreshToken: session.refresh_token || '',
        userId: session.user.id,
      })
    } else {
      void api.clearLocalApiSession?.()
    }
  } catch {
    /* best-effort; never break the auth flow */
  }
}
