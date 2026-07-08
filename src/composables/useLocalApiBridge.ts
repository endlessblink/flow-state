import type { Session } from '@supabase/supabase-js'
import type { PomodoroSession } from '@/stores/timer'
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
  setLocalApiTimerSnapshot?: (snapshot: unknown) => Promise<unknown>
  setLocalApiRendererAuthState?: (state: unknown) => Promise<unknown>
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

export interface LocalApiRendererAuthState {
  isAuthenticated: boolean
  hasUser: boolean
  canSyncRemotely: boolean
  reauthRequired: boolean
  isInitialized: boolean
}

export function syncLocalApiRendererAuthState(state: LocalApiRendererAuthState): void {
  const api = getElectronApi()
  if (!api) return
  try {
    void api.setLocalApiRendererAuthState?.({
      isAuthenticated: !!state.isAuthenticated,
      hasUser: !!state.hasUser,
      canSyncRemotely: !!state.canSyncRemotely,
      reauthRequired: !!state.reauthRequired,
      isInitialized: !!state.isInitialized,
      updatedAt: Date.now(),
    })
  } catch {
    /* best-effort; never break the auth flow */
  }
}

function toIso(value: Date | string | number | null | undefined): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function syncLocalApiTimerSnapshot(session: PomodoroSession | null, deviceId?: string): void {
  const api = getElectronApi()
  if (!api) return
  try {
    const now = Date.now()
    void api.setLocalApiTimerSnapshot?.({
      active: !!session?.isActive,
      updatedAt: now,
      session: session
        ? {
            id: session.id,
            task_id: session.taskId,
            start_time: toIso(session.startTime) || new Date(now).toISOString(),
            duration: session.duration,
            remaining_time: Math.max(0, Math.floor(session.remainingTime)),
            is_active: session.isActive,
            is_paused: session.isPaused,
            is_break: session.isBreak,
            completed_at: toIso(session.completedAt),
            device_leader_id: session.deviceLeaderId || deviceId || 'electron-app',
            device_leader_last_seen: new Date(session.deviceLeaderLastSeen || now).toISOString(),
          }
        : null,
    })
  } catch {
    /* best-effort; never break timer control */
  }
}
