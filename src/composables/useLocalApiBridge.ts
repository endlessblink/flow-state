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
  setLocalApiWorkspaceContext?: (state: unknown) => Promise<unknown>
  onLocalApiTaskMutation?: (callback: (mutation: LocalApiTaskMutation) => void) => void
  offLocalApiTaskMutation?: () => void
}

interface LocalApiSessionDeliveryResult {
  ok?: boolean
  userId?: string
}

const LOCAL_API_SESSION_RETRY_MS = 250
const LOCAL_API_SESSION_MAX_ATTEMPTS = 3
let localApiSessionAttempt = 0

export interface LocalApiTaskMutation {
  operation: 'create' | 'update' | 'delete'
  taskId: string
}

function getElectronApi(): ElectronLocalApi | null {
  if (typeof window === 'undefined') return null
  const api = (window as unknown as { electronAPI?: ElectronLocalApi }).electronAPI
  return api && api.isElectron ? api : null
}

function isRemotelyValidSession(session: Session | null): session is Session {
  if (!session?.access_token || !session.user?.id) return false
  const expiresAtMs = session.expires_at ? session.expires_at * 1000 : null
  return !expiresAtMs || Date.now() < expiresAtMs - 30_000
}

function waitForRetry(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, LOCAL_API_SESSION_RETRY_MS))
}

async function deliverLocalApiSession(
  api: ElectronLocalApi,
  session: Session,
  payload: Record<string, string>,
  attemptId: number,
): Promise<void> {
  for (let attempt = 0; attempt < LOCAL_API_SESSION_MAX_ATTEMPTS; attempt += 1) {
    if (attemptId !== localApiSessionAttempt || !isRemotelyValidSession(session)) return
    let result: LocalApiSessionDeliveryResult | undefined
    try {
      result = await api.setLocalApiSession?.(payload) as LocalApiSessionDeliveryResult | undefined
    } catch {
      result = undefined
    }
    if (attemptId !== localApiSessionAttempt || !isRemotelyValidSession(session)) return
    if (result?.ok && result.userId === session.user.id) return
    if (attempt + 1 < LOCAL_API_SESSION_MAX_ATTEMPTS) await waitForRetry()
  }
}

export function syncLocalApiSession(session: Session | null): void {
  const api = getElectronApi()
  if (!api) return
  const attemptId = ++localApiSessionAttempt
  try {
    // Only a real sign-out clears the sidecar. BUG-1933: a session whose access token has gone
    // stale (e.g. just restored from backup, refresh still in flight) used to send `clear`, which
    // blinded the Local API — and with it the KDE widget and agent tools — while the app itself
    // showed signed-in. Hold the last good context and wait for the refreshed session; this
    // watcher re-fires with fresh tokens.
    if (!session?.access_token || !session.user?.id) {
      void api.clearLocalApiSession?.()
      return
    }
    if (!isRemotelyValidSession(session)) return

    void deliverLocalApiSession(api, session, {
      supabaseUrl: supabaseConfig.url,
      anonKey: supabaseConfig.anonKey,
      accessToken: session.access_token,
      refreshToken: session.refresh_token || '',
      userId: session.user.id,
    }, attemptId)
  } catch {
    /* best-effort; never break the auth flow */
  }
}

export function subscribeLocalApiTaskMutations(
  callback: (mutation: LocalApiTaskMutation) => void,
): () => void {
  const api = getElectronApi()
  if (!api?.onLocalApiTaskMutation) return () => undefined

  api.offLocalApiTaskMutation?.()
  api.onLocalApiTaskMutation((mutation) => {
    if (!mutation || !['create', 'update', 'delete'].includes(mutation.operation)) return
    if (typeof mutation.taskId !== 'string' || !mutation.taskId) return
    callback(mutation)
  })

  return () => api.offLocalApiTaskMutation?.()
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

export function syncLocalApiWorkspaceContext(activeWorkspaceId: string | null): void {
  const api = getElectronApi()
  if (!api) return
  try {
    void api.setLocalApiWorkspaceContext?.({ activeWorkspaceId })
  } catch {
    /* best-effort; never break workspace switching */
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
