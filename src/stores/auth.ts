import { defineStore } from 'pinia'
import { ref, computed, watch, onScopeDispose } from 'vue'
import {
  supabase,
  consumePendingProviderTokens,
  persistAuthSessionBackup,
  restoreAuthSessionFromBackup,
  persistPrimaryAuthSession,
  readPersistedAuthSessionCandidate,
  persistAuthIdentity,
  readPersistedAuthIdentity,
  clearPersistedAuthIdentity,
  clearAuthSessionBackup,
  clearPrimaryAuthSession,
  type User,
  type Session,
  type AuthError
} from '@/services/auth/supabase'
import { syncLocalApiRendererAuthState, syncLocalApiSession } from '@/composables/useLocalApiBridge'
import { clearGuestData, clearGuestSessionId } from '@/utils/guestModeStorage'
import { isBlockedByBrave, recordBlockedResource } from '@/utils/braveProtection'
import { invalidateCache } from '@/composables/useSupabaseDatabase'
import { DB_TABLES } from '@/constants/dbTables'
import { isTauri as isTauriRuntime } from '@/utils/platform'
import type { Task } from '@/types/tasks'
export type { User, Session, AuthError }

// BUG-1898: Upper bound on the auth reconnect grace period. Past this, with
// the token refresh still failing, the store surfaces `reauthRequired` so the
// UI can prompt a re-login instead of staying silently write-blocked forever.
export const GRACE_MAX_MS = 10 * 60 * 1000
// BUG-1898: While in grace, retry the token refresh on this cadence. Some
// grace entry points (e.g. Electron backup restore) previously registered no
// recovery path at all — grace could only end via an unrelated refresh.
export const GRACE_RETRY_MS = 60 * 1000
export const LOCAL_API_AUTH_HEARTBEAT_MS = 30 * 1000

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const isLoading = ref(false)
  const error = ref<AuthError | null>(null)
  const isInitialized = ref(false)
  const initializationFailed = ref(false)
  // BUG-1944: A durable account identity exists, but auth-js has not confirmed a
  // remotely usable session yet. Local edits may queue under this user; remote
  // consumers and the sign-in UI must remain gated until initialization settles.
  const isRestoringSession = ref(false)
  // TASK-1426: True when the JWT expired while offline — session kept for local ops (user.id valid)
  const isOfflineGracePeriod = ref(false)
  // BUG-1898: True once the reconnect grace has exceeded GRACE_MAX_MS with the
  // refresh still failing — the UI should prompt an explicit re-login instead
  // of staying silently write-blocked. Cleared by any successful refresh.
  const reauthRequired = ref(false)
  let graceDeadlineTimer: ReturnType<typeof setTimeout> | null = null
  let graceRetryTimer: ReturnType<typeof setInterval> | null = null

  // BUG-1086: Promise lock to prevent concurrent initialization attempts
  // Multiple callers (router guard, useAppInitialization) may call initialize() simultaneously
  // This ensures they all await the same promise instead of racing
  let initPromise: Promise<void> | null = null

  // BUG-1086: Track which user we've already handled SIGNED_IN for
  // Prevents duplicate store reloads when onAuthStateChange fires multiple times
  let handledSignInForUserId: string | null = null

  // BUG-1207: Flag set by useAppInitialization after it completes its own store load
  // When true, the SIGNED_IN handler skips redundant loadFromDatabase() calls
  let appInitLoadComplete = false

  // BUG-1352: Flag to prevent onAuthStateChange from re-establishing session during signOut
  let isSigningOut = false

  // BUG-339: Proactive token refresh timer
  let refreshTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectRefreshTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * BUG-339: Schedule proactive token refresh before expiry
   * Refreshes 5 minutes before expiry to ensure continuous auth
   */
  const scheduleTokenRefresh = (expiresAt: number) => {
    // Clear any existing timer
    if (refreshTimer) {
      clearTimeout(refreshTimer)
      refreshTimer = null
    }

    const now = Date.now()
    const expiresMs = expiresAt * 1000
    const refreshBufferMs = 5 * 60 * 1000 // 5 minutes before expiry
    const timeUntilRefresh = expiresMs - now - refreshBufferMs

    if (timeUntilRefresh <= 0) {
      // Already expired or about to expire, refresh now
      console.log('[AUTH] Token expired or expiring soon, refreshing immediately')
      performTokenRefresh()
      return
    }

    console.log(`[AUTH] Scheduling token refresh in ${Math.round(timeUntilRefresh / 60000)} minutes`)
    refreshTimer = setTimeout(performTokenRefresh, timeUntilRefresh)
  }

  /**
   * BUG-339: Perform token refresh and reschedule with retry logic
   */
  const performTokenRefresh = async (attempt = 1, maxAttempts = 3): Promise<void> => {
    if (!supabase) return

    try {
      console.log('[AUTH] Proactive token refresh starting...')
      const { data, error: refreshError } = await supabase.auth.refreshSession()

      if (refreshError) {
        if (attempt < maxAttempts) {
          const delay = Math.pow(2, attempt) * 1000 // 2s, 4s, 8s
          console.warn(`[AUTH] Token refresh failed, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`)
          setTimeout(() => performTokenRefresh(attempt + 1, maxAttempts), delay)
        } else {
          console.error('[AUTH] Token refresh failed after all retries:', refreshError)
          // Don't clear session - let user continue until actual API call fails
          // TASK-1426: If we're offline, explicitly enter grace period so other parts of
          // the app know the session is expired but being kept for local operations only
          if (!navigator.onLine) {
            console.log('[AUTH] Proactive refresh exhausted retries while offline — entering grace period')
            enterOfflineGrace()
          }
        }
        return
      }

      if (data.session) {
        console.log('[AUTH] Proactive token refresh successful')
        session.value = data.session
        user.value = data.session.user
        clearOfflineGrace()
        error.value = null
        persistAuthSessionBackup(data.session).catch(e => console.warn('[AUTH] Failed to backup refreshed session:', e))

        // Schedule next refresh
        if (data.session.expires_at) {
          scheduleTokenRefresh(data.session.expires_at)
        }
      }
    } catch (e) {
      if (attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 1000 // 2s, 4s, 8s
        console.warn(`[AUTH] Token refresh error, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`)
        setTimeout(() => performTokenRefresh(attempt + 1, maxAttempts), delay)
      } else {
        console.error('[AUTH] Token refresh error after all retries:', e)
      }
    }
  }

  // BUG-1898: Centralized grace transitions. Entering grace arms a bounded
  // deadline; leaving it (any successful refresh) disarms the deadline and
  // clears the re-auth flag. All isOfflineGracePeriod writes go through these.
  const enterOfflineGrace = () => {
    isOfflineGracePeriod.value = true
    // Periodic recovery: some grace entry points had no retry/online listener
    // at all, so grace could never end on its own. A successful refresh runs
    // clearOfflineGrace() via performTokenRefresh's success path.
    if (!graceRetryTimer) {
      graceRetryTimer = setInterval(() => {
        performTokenRefresh().catch(e => console.warn('[AUTH] Grace retry refresh failed:', e))
      }, GRACE_RETRY_MS)
    }
    if (graceDeadlineTimer) return
    graceDeadlineTimer = setTimeout(async () => {
      graceDeadlineTimer = null
      if (!isOfflineGracePeriod.value) return
      // Last-chance refresh before surfacing re-auth
      try {
        await performTokenRefresh()
      } catch { /* refresh failure keeps grace active */ }
      if (isOfflineGracePeriod.value) {
        console.warn(`[AUTH] Reconnect grace exceeded ${GRACE_MAX_MS}ms with refresh still failing — re-authentication required`)
        reauthRequired.value = true
        // BUG-1913: this flag previously had ZERO UI consumers — the grace cap
        // fired into the void while the app stayed silently write-blocked for
        // hours. Tell the user directly.
        try {
          const { useToast } = await import('@/composables/useToast')
          useToast().showToast(
            'Your account is still here, but it needs to reconnect. Choose Reconnect account; your local work is safe.',
            'error',
            { duration: 15000 }
          )
        } catch { /* headless/test env — flag still set for programmatic consumers */ }
      }
    }, GRACE_MAX_MS)
  }

  const clearOfflineGrace = () => {
    isOfflineGracePeriod.value = false
    // A successful refresh validates the durable startup candidate and may now
    // expose the account to remote readers/Local API consumers.
    isRestoringSession.value = false
    reauthRequired.value = false
    if (graceDeadlineTimer) {
      clearTimeout(graceDeadlineTimer)
      graceDeadlineTimer = null
    }
    if (graceRetryTimer) {
      clearInterval(graceRetryTimer)
      graceRetryTimer = null
    }
  }

  // Getters
  // A remembered user is still signed in until the explicit sign-out action clears
  // the identity. Session usability is a separate concern: `canSyncRemotely`
  // remains false while auth-js is restoring, refreshing, or waiting for reconnect.
  // This keeps update/relaunch from showing the sign-in screen for a user who never
  // signed out, without allowing an unvalidated token to reach remote writers.
  const isAuthenticated = computed(() => !!user.value)
  const canSyncRemotely = computed(() =>
    !!session.value?.access_token &&
    !!user.value?.id &&
    !isOfflineGracePeriod.value &&
    !isRestoringSession.value
  )

  // TASK-1797: Keep the Electron Local Task API sidecar's session in sync with
  // ours (no-op outside Electron / when the API is disabled). Fires on sign-in,
  // token refresh, and sign-out.
  watch([session, isRestoringSession, isInitialized], ([s, restoring, initialized]) => {
    // Startup absence is not a sign-out. Keep any still-valid main/sidecar session
    // until auth-js has finished validating the renderer's durable session candidate.
    if (restoring || (!s && !initialized)) return
    syncLocalApiSession(s)
  }, { immediate: true })
  const publishLocalApiRendererAuthState = () => {
    syncLocalApiRendererAuthState({
      isAuthenticated: isAuthenticated.value,
      hasUser: !!user.value?.id,
      canSyncRemotely: canSyncRemotely.value,
      reauthRequired: reauthRequired.value,
      isInitialized: isInitialized.value,
    })
  }
  watch(
    [isAuthenticated, user, canSyncRemotely, reauthRequired, isInitialized],
    publishLocalApiRendererAuthState,
    { immediate: true },
  )
  const localApiAuthHeartbeat = setInterval(
    publishLocalApiRendererAuthState,
    LOCAL_API_AUTH_HEARTBEAT_MS,
  )
  onScopeDispose(() => clearInterval(localApiAuthHeartbeat))
  const errorMessage = computed(() => error.value?.message || null)

  // Compatibility getters for Supabase/Firebase differences
  const displayName = computed(() =>
    user.value?.user_metadata?.full_name ||
    user.value?.user_metadata?.display_name ||
    user.value?.user_metadata?.name ||
    user.value?.email?.split('@')[0] ||
    'User'
  )
  const photoURL = computed(() =>
    user.value?.user_metadata?.avatar_url ||
    user.value?.user_metadata?.photo_url ||
    user.value?.user_metadata?.picture ||
    null
  )
  const isAdmin = computed(() => {
    // BUG-012 FIX: localStorage override ONLY works in DEV builds (AND, not OR)
    // This prevents production users from gaining admin access via localStorage
    if (import.meta.env.DEV && localStorage.getItem('flowstate-dev-mode') === 'true') return true
    return user.value?.app_metadata?.role === 'admin' ||
      user.value?.user_metadata?.role === 'admin'
  })
  const isDev = computed(() => {
    // BUG-012 FIX: localStorage override ONLY works in DEV builds (AND, not OR)
    if (import.meta.env.DEV && localStorage.getItem('flowstate-dev-mode') === 'true') return true
    return isAdmin.value ||
      user.value?.app_metadata?.role === 'developer' ||
      user.value?.user_metadata?.role === 'developer'
  })

  // TASK-337: Check if user has email/password auth (vs OAuth-only)
  // Note: This is a best-effort check. app_metadata.providers can be unreliable
  // (doesn't update when OAuth users set password via updateUser)
  // For UI decisions, prefer showing options and handling API errors gracefully
  const hasPasswordAuth = computed(() => {
    // Check identities array first (more reliable)
    const identities = user.value?.identities as Array<{ provider: string }> | undefined
    if (identities?.some(i => i.provider === 'email')) return true
    // Fallback to app_metadata.providers
    const providers = user.value?.app_metadata?.providers as string[] | undefined
    return providers?.includes('email') ?? false
  })

  // Actions
  const startReconnectRefreshRecovery = () => {
    if (reconnectRefreshTimer) return
    reconnectRefreshTimer = setTimeout(() => {
      reconnectRefreshTimer = null
      performTokenRefresh().catch(e => console.warn('[AUTH] Reconnect refresh retry failed:', e))
    }, 1000)
  }

  const keepSessionForReconnect = (
    recoverableSession: Session,
    logMessage: string,
    authError?: AuthError | null,
    options: { persistBackup?: boolean } = {},
  ) => {
    console.warn(logMessage)
    session.value = recoverableSession
    user.value = recoverableSession.user
    enterOfflineGrace()
    if (authError) {
      error.value = authError
    }
    if (options.persistBackup !== false) {
      persistAuthSessionBackup(recoverableSession).catch(e => console.warn('[AUTH] Failed to backup reconnect-grace session:', e))
    }
    // BUG-1933: supabase-js nulls the primary key when a refresh fails. Without this the durable
    // session disappears while the UI still shows signed-in, so the sidecar/KDE widget and the next
    // launch see nothing.
    persistPrimaryAuthSession(recoverableSession).catch(e => console.warn('[AUTH] Failed to persist reconnect-grace session:', e))
    startReconnectRefreshRecovery()
  }

  const keepSessionForExplicitReauth = (
    recoverableSession: Session,
    logMessage: string,
    authError: AuthError,
  ) => {
    console.warn(logMessage)
    session.value = recoverableSession
    user.value = recoverableSession.user
    error.value = authError
    isOfflineGracePeriod.value = true
    isRestoringSession.value = true
    reauthRequired.value = true
    persistAuthIdentity(recoverableSession.user).catch(e => console.warn('[AUTH] Failed to persist account identity:', e))

    // A server-confirmed invalid/used refresh token is terminal. Retrying it or
    // persisting it as the next-launch recovery source only repeats the failure.
    if (graceDeadlineTimer) clearTimeout(graceDeadlineTimer)
    if (graceRetryTimer) clearInterval(graceRetryTimer)
    if (reconnectRefreshTimer) clearTimeout(reconnectRefreshTimer)
    if (refreshTimer) clearTimeout(refreshTimer)
    graceDeadlineTimer = null
    graceRetryTimer = null
    reconnectRefreshTimer = null
    refreshTimer = null

    void import('@/composables/useToast').then(({ useToast }) => {
      useToast().showToast(
        'Your account is still here, but it needs to reconnect. Choose Reconnect account; your local work is safe.',
        'error',
        { duration: 15000 },
      )
    }).catch(() => { /* headless/test env — heartbeat still carries reauthRequired */ })
  }

  /**
   * BUG-1918: repopulate the stores after a sign-in, in the same order a page reload uses.
   *
   * Workspaces MUST load first. Task and canvas fetches are workspace-scoped and read
   * `activeWorkspaceId`, which is only restored inside `loadWorkspaces()`. The previous code
   * loaded tasks first and workspaces afterwards, so the fetch ran against a null workspace,
   * returned nothing, and nothing reloaded once the workspace arrived — an empty canvas and zeroed
   * sidebar counts until the user hit refresh. Lanes were never reloaded at all.
   */
  const reloadStoresAfterSignIn = async () => {
    // BUG-1339: clear SWR cache so a cached empty result isn't replayed.
    const { invalidateCache } = await import('@/composables/useSupabaseDatabase')
    invalidateCache.all()

    const { useWorkspaceStore } = await import('@/stores/workspace')
    await useWorkspaceStore().loadWorkspaces()

    const { useProjectStore } = await import('@/stores/projects')
    const { useTaskStore } = await import('@/stores/tasks')
    const { useCanvasStore } = await import('@/stores/canvas')
    const { useLaneStore } = await import('@/stores/lanes')

    await Promise.all([
      useProjectStore().loadProjectsFromDatabase(),
      useTaskStore().loadFromDatabase(),
      useCanvasStore().loadFromDatabase(),
      useLaneStore().loadLanesFromDatabase(),
    ])
  }

  const clearAccountScopedLocalStateForSwitch = async (previousUserId: string) => {
    const [
      { useTaskStore },
      { useCanvasStore },
      { useWorkspaceStore },
      { useProjectStore },
      { useLaneStore },
      { useCanvasImagesStore },
    ] = await Promise.all([
      import('@/stores/tasks'),
      import('@/stores/canvas'),
      import('@/stores/workspace'),
      import('@/stores/projects'),
      import('@/stores/lanes'),
      import('@/stores/canvasImages'),
    ])

    useTaskStore().clearAll()
    useCanvasStore().clearAll()
    useWorkspaceStore().clearAll()
    useProjectStore().clearAll()
    useLaneStore().clearAll()
    useCanvasImagesStore().clearAll()

    await clearAccountScopedDeviceState()

    try {
      const { deleteReadCacheScopesForUser } = await import('@/services/offline/readCacheDB')
      await deleteReadCacheScopesForUser(previousUserId)
    } catch (_e) {
      // Non-critical; authenticated reload below replaces the visible state.
    }

    try {
      const { clearAll: clearWriteQueue } = await import('@/services/offline/writeQueueDB')
      await clearWriteQueue()
    } catch (_e) {
      // Non-critical in environments without IndexedDB.
    }
  }

  const clearAccountScopedDeviceState = async () => {
    const [{ useAIChatStore }, { useQuickSortStore }, { useSettingsStore }] = await Promise.all([
      import('@/stores/aiChat'),
      import('@/stores/quickSort'),
      import('@/stores/settings'),
    ])

    useAIChatStore().reset()
    useQuickSortStore().clearAll()
    const settingsStore = useSettingsStore()
    settingsStore.updateSetting('googleProviderToken', '')
    settingsStore.updateSetting('googleProviderRefreshToken', '')
    settingsStore.updateSetting('googleProviderTokenExpiry', 0)
    settingsStore.updateSetting('googleConnected', false)
    settingsStore.updateSetting('googleCalendars', [])
  }

  const preserveReconnectShellAfterFailedRefresh = (
    recoverableSession: Session,
    logMessage: string,
    authError?: AuthError | null,
  ) => {
    keepSessionForReconnect(recoverableSession, logMessage, authError, { persistBackup: false })
    initializationFailed.value = false
  }

  const initialize = async (): Promise<void> => {
    // BUG-1086: Return existing promise if already initializing (prevents race condition)
    // Multiple callers will await the same promise instead of starting parallel init attempts
    if (initPromise) {
      return initPromise
    }
    if (isInitialized.value) return

    // BUG-1056: Generate tab ID for multi-tab debugging
    const tabId = (window as unknown as { __flowstate_tab_id?: string }).__flowstate_tab_id || (() => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        ; (window as unknown as { __flowstate_tab_id?: string }).__flowstate_tab_id = id
      return id
    })()

    // BUG-1086: Create and store the promise BEFORE any async work
    // This ensures subsequent callers get this promise immediately
    initPromise = (async () => {
      try {
        isLoading.value = true
        isRestoringSession.value = true
        console.log(`[AUTH:${tabId}] Initializing auth...`)

        // BUG-1944: Hydrate only the durable identity before getSession(). auth-js can
        // block here while refreshing an expired token; without this shell, cached
        // account data renders as a guest and local writes lose their queue owner.
        const persistedCandidate = await readPersistedAuthSessionCandidate()
        const persistedIdentity = persistedCandidate?.user || await readPersistedAuthIdentity()
        if (persistedCandidate) {
          session.value = persistedCandidate
          user.value = persistedCandidate.user
          persistAuthIdentity(persistedCandidate.user).catch(e => console.warn('[AUTH] Failed to persist restored identity:', e))
        } else if (persistedIdentity) {
          user.value = persistedIdentity
        }

        if (!supabase) {
          if (user.value) {
            isOfflineGracePeriod.value = true
            reauthRequired.value = true
            console.warn(`[AUTH:${tabId}] Supabase client unavailable — retaining remembered account for reconnect`)
          } else {
            console.warn(`[AUTH:${tabId}] Supabase client not available, staying in Guest Mode`)
          }
          return
        }

        // Check for existing session
        console.log(`[AUTH:${tabId}] Fetching session from localStorage...`)
        let { data, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          console.error(`[AUTH:${tabId}] getSession error:`, sessionError)
          throw sessionError
        }

        let restoredBackupSession: Session | null = null
        if (!data.session) {
          restoredBackupSession = await restoreAuthSessionFromBackup()
          if (restoredBackupSession) {
            // BUG-1952: auth-js has already initialized its in-memory session by this point.
            // Writing the backup through the storage adapter does not make that live client
            // re-read disk, so a second getSession() can keep returning null and overwrite the
            // restored primary key. Hydrate through the supported auth API instead; it validates
            // or refreshes the recovered token pair and updates memory plus durable storage.
            const hydrated = await supabase.auth.setSession({
              access_token: restoredBackupSession.access_token,
              refresh_token: restoredBackupSession.refresh_token,
            })
            data = hydrated.data
            sessionError = hydrated.error
            if (sessionError) {
              console.error(`[AUTH:${tabId}] setSession from backup error:`, sessionError)
              // TASK-1871: A stale/already-used refresh token in the Electron-safe backup
              // (common when multiple instances rotated the single-use token) must NOT
              // hard-fail auth init. Clear the dead backup so it isn't re-restored, and
              // keep the signed-in shell on the restored session — the app stays usable on
              // cached data and recovers on reconnect / next valid refresh, instead of
              // dropping to a degraded no-auth state.
              const refreshErr = sessionError as AuthError
              const m = (refreshErr?.message || '').toLowerCase()
              if (refreshErr?.status === 400 || m.includes('refresh token') || m.includes('already used')) {
                await clearAuthSessionBackup()
                keepSessionForExplicitReauth(
                  restoredBackupSession,
                  '[AUTH] Electron backup refresh token is terminal — cleared stale backup and requiring sign-in',
                  refreshErr,
                )
                return
              }
              throw sessionError
            }
            if (!data.session) {
              keepSessionForReconnect(
                restoredBackupSession,
                '[AUTH] Electron backup restored but Supabase has not rehydrated yet — keeping signed-in shell for reconnect',
              )
              return
            }
          }
        }
        console.log(`[AUTH:${tabId}] Session found:`, !!data.session, data.session?.user?.email)

        // BUG-339 FIX: Check if session is expired and refresh it
        // getSession() returns the stored session but doesn't auto-refresh expired tokens
        if (data.session?.expires_at) {
          const expiresAt = data.session.expires_at * 1000 // Convert to milliseconds
          const now = Date.now()
          const bufferMs = 60 * 1000 // 1 minute buffer before expiry

          if (now >= expiresAt - bufferMs) {
            console.log('[AUTH] Session expired or expiring soon, refreshing...')
            // BUG-1743: Timeout after 5s to prevent blank screen on flaky networks
            const REFRESH_TIMEOUT_MS = 5000
            const { data: refreshData, error: refreshError } = await Promise.race([
              supabase.auth.refreshSession(),
              new Promise<{ data: { session: null }, error: AuthError }>((resolve) =>
                setTimeout(() => resolve({
                  data: { session: null },
                  error: { name: 'AuthError', message: 'Session refresh timed out (offline)', status: 408 } as AuthError
                }), REFRESH_TIMEOUT_MS)
              )
            ])
            if (refreshError) {
              // TASK-1426: Offline grace period — expired session is kept in memory when offline
              // The JWT is useless for API calls, but user.id is valid for local IndexedDB operations
              // (sync queue writes, offline reads). When back online, we attempt a real refresh.
              if (!navigator.onLine) {
                console.log('[AUTH] Session expired but offline — keeping auth for local operations (grace period)')
                session.value = data.session  // keep expired session; user.id stays accessible
                user.value = data.session.user
                persistAuthSessionBackup(data.session).catch(e => console.warn('[AUTH] Failed to backup offline grace session:', e))
                enterOfflineGrace()
                window.addEventListener('online', async () => {
                  console.log('[AUTH] Back online — attempting session refresh after offline grace period')
                  if (!supabase) return
                  // BUG-1514: Retry up to 3 times with exponential backoff (1s, 3s, 9s)
                  // before giving up and clearing the session. A single raw refresh attempt
                  // could fail transiently (server not yet reachable right as the 'online'
                  // event fires), permanently orphaning any pending sync-queue writes.
                  const maxAttempts = 3
                  let lastError: AuthError | null = null
                  let refreshed = false
                  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                    if (attempt > 1) {
                      const delay = Math.pow(3, attempt - 1) * 1000 // 1s, 3s, 9s
                      console.log(`[AUTH] BUG-1514: Retry ${attempt}/${maxAttempts} after ${delay}ms`)
                      await new Promise(resolve => setTimeout(resolve, delay))
                    }
                    const { data: onlineData, error: onlineError } = await supabase.auth.refreshSession()
                    if (!onlineError && onlineData.session) {
                      console.log(`[AUTH] Session refreshed successfully after coming online (attempt ${attempt})`)
                      session.value = onlineData.session
                      user.value = onlineData.session.user
                      persistAuthSessionBackup(onlineData.session).catch(e => console.warn('[AUTH] Failed to backup refreshed session:', e))
                      clearOfflineGrace()
                      if (onlineData.session.expires_at) {
                        scheduleTokenRefresh(onlineData.session.expires_at)
                      }
                      refreshed = true
                      break
                    }
                    console.warn(`[AUTH] BUG-1514: Session refresh attempt ${attempt}/${maxAttempts} failed:`, onlineError)
                    lastError = onlineError
                  }
                  if (!refreshed) {
                    console.error('[AUTH] BUG-1514: Session refresh failed after all retries — preserving signed-in shell for reconnect.', lastError)
                    preserveReconnectShellAfterFailedRefresh(
                      data.session,
                      '[AUTH] Offline-grace refresh failed after retries — keeping signed-in shell for reconnect',
                      lastError,
                    )
                  }
                }, { once: true })
                return
              }
              // BUG-1743: Don't wipe session if we have cached data — user can work offline
              // Check if IndexedDB has data before deciding to enter guest mode
              let hasCachedData = false
              try {
                const { getCacheStats } = await import('@/services/offline/readCacheDB')
                const stats = await getCacheStats()
                hasCachedData = (stats.tasks?.count ?? 0) > 0
              } catch {
                // IndexedDB check failed — fall through to original behavior
              }

              if (hasCachedData) {
                console.log('[AUTH] BUG-1743: Refresh failed but IndexedDB has cached data — keeping session for offline access')
                session.value = data.session  // keep expired session for user.id access
                user.value = data.session.user
                persistAuthSessionBackup(data.session).catch(e => console.warn('[AUTH] Failed to backup cached-data grace session:', e))
                enterOfflineGrace()
                // Register online listener like the navigator.onLine === false path
                window.addEventListener('online', async () => {
                  console.log('[AUTH] Back online — attempting session refresh after failed-refresh grace period')
                  if (!supabase) return
                  const maxAttempts = 3
                  let lastError: AuthError | null = null
                  let refreshed = false
                  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                    if (attempt > 1) {
                      const delay = Math.pow(3, attempt - 1) * 1000
                      await new Promise(resolve => setTimeout(resolve, delay))
                    }
                    const { data: onlineData, error: onlineError } = await supabase.auth.refreshSession()
                    if (!onlineError && onlineData.session) {
                      session.value = onlineData.session
                      user.value = onlineData.session.user
                      persistAuthSessionBackup(onlineData.session).catch(e => console.warn('[AUTH] Failed to backup refreshed session:', e))
                      clearOfflineGrace()
                      if (onlineData.session.expires_at) {
                        scheduleTokenRefresh(onlineData.session.expires_at)
                      }
                      refreshed = true
                      break
                    }
                    lastError = onlineError
                  }
                  if (!refreshed) {
                    console.error('[AUTH] BUG-1743: Post-grace refresh failed — preserving signed-in shell for reconnect')
                    preserveReconnectShellAfterFailedRefresh(
                      data.session,
                      '[AUTH] Cached-data grace refresh failed after retries — keeping signed-in shell for reconnect',
                      lastError,
                    )
                  }
                }, { once: true })
                return
              }

              keepSessionForReconnect(
                data.session,
                '[AUTH] Session refresh failed during startup — keeping signed-in shell for reconnect',
                refreshError,
              )
              return
            }
            if (refreshData.session) {
              console.log('[AUTH] Session refreshed successfully')
              session.value = refreshData.session
              user.value = refreshData.session.user
              persistAuthSessionBackup(refreshData.session).catch(e => console.warn('[AUTH] Failed to backup refreshed session:', e))
              // BUG-339: Schedule next refresh
              if (refreshData.session.expires_at) {
                scheduleTokenRefresh(refreshData.session.expires_at)
              }
            }
          } else {
            session.value = data.session
            user.value = data.session?.user || null
            persistAuthSessionBackup(data.session).catch(e => console.warn('[AUTH] Failed to backup valid session:', e))
            // BUG-339: Schedule proactive refresh for valid session
            scheduleTokenRefresh(data.session.expires_at)
          }
        } else if (data.session) {
          session.value = data.session
          user.value = data.session.user
          persistAuthSessionBackup(data.session).catch(e => console.warn('[AUTH] Failed to backup session:', e))
        } else if (persistedIdentity) {
          // A server-usable session is gone, but the user never explicitly signed out.
          // Keep the credential-free identity and account-owned cache across restarts.
          session.value = null
          user.value = persistedIdentity
          isOfflineGracePeriod.value = true
          reauthRequired.value = true
        } else {
          session.value = null
          user.value = null
        }

        // BUG-339 FIX: If we have a session on init (e.g., after OAuth/Magic Link redirect),
        // check if there's guest data to migrate. This catches redirect-based auth flows.
        if (data.session?.user) {
          clearOfflineGrace()
          // Run migration asynchronously - don't block initialization
          migrateGuestData().catch(e => {
            console.error('[AUTH] Post-init migration failed:', e)
          })
        }

        // Listen for auth changes (sign in, sign out, etc.)
        // BUG-1056: This fires across all tabs when auth state changes (via localStorage sync)
        const handleAuthStateChange = async (_event: string, newSession: Session | null) => {
          const currentTabId = (window as unknown as { __flowstate_tab_id?: string }).__flowstate_tab_id || 'unknown'
          const currentUserId = user.value?.id?.substring(0, 8) || 'none'
          const newUserId = newSession?.user?.id?.substring(0, 8) || 'none'
          console.log(`👤 [AUTH:${currentTabId}] Auth state changed:`, _event,
            'current:', currentUserId, '→ new:', newUserId,
            'hasSession:', !!session.value, '→', !!newSession)

          // BUG-1352: If we're in the middle of an explicit signOut, ignore all auth events
          // to prevent auto-refresh or other mechanisms from re-establishing the session
          if (isSigningOut) {
            console.log(`👤 [AUTH:${currentTabId}] Ignoring ${_event} during explicit sign-out`)
            return
          }

          // A reconnect prompt belongs to the remembered account. Accepting a
          // different user's session here would silently transfer cached data
          // and queued writes across accounts. Account switching requires the
          // explicit sign-out path that clears that ownership first.
          if (newSession && user.value?.id && user.value.id !== newSession.user.id) {
            if (_event !== 'SIGNED_IN') {
              console.warn(`👤 [AUTH:${currentTabId}] Rejected passive session for a different account; sign out before switching accounts`)
              await supabase.auth.signOut({ scope: 'local' })
              return
            }
            const previousUserId = user.value.id
            console.warn(`👤 [AUTH:${currentTabId}] SIGNED_IN switched accounts; clearing previous local account state before reload`)
            await clearAccountScopedLocalStateForSwitch(previousUserId)
            handledSignInForUserId = null
            appInitLoadComplete = false
          }

          // Any auth-js event carrying a valid session completes restoration,
          // including cross-tab SIGNED_IN and TOKEN_REFRESHED events.
          if (newSession) {
            clearOfflineGrace()
            persistAuthIdentity(newSession.user).catch(e => console.warn('[AUTH] Failed to persist auth event identity:', e))
          }

          // BUG-1103: Multi-tab sign-in fix
          // When Tab 2 signs in, Supabase may fire SIGNED_OUT (old session) before SIGNED_IN (new session)
          // Tab 1 would blindly clear state, even though localStorage has Tab 2's valid new session
          // Fix: On SIGNED_OUT, check if localStorage actually has a session before clearing
          // BUG-1352: Skip this recovery when the user explicitly requested sign-out
          if (!newSession && !isSigningOut) {
            if (_event === 'SIGNED_OUT') {
              // Double-check: maybe another tab just signed in and localStorage has their session
              const { data: currentSession } = await supabase.auth.getSession()
              if (currentSession.session) {
                console.log(`👤 [AUTH:${currentTabId}] SIGNED_OUT received but localStorage has session - using it instead`)
                session.value = currentSession.session
                user.value = currentSession.session.user
                clearOfflineGrace()
                // Schedule refresh for the recovered session
                if (currentSession.session.expires_at) {
                  scheduleTokenRefresh(currentSession.session.expires_at)
                }
                return // Don't process as sign-out
              }
            }

            // No null-session auth-js callback proves that the person chose to
            // leave this account. INITIAL_SESSION can race durable identity
            // hydration, and future passive events can also arrive without a
            // usable session. Only signOut() may erase account ownership.
            if (user.value && session.value) {
              keepSessionForExplicitReauth(
                session.value,
                `👤 [AUTH:${currentTabId}] Passive ${_event} without session — retaining account until explicit sign-out`,
                { name: 'AuthError', message: 'Session needs reconnection', status: 401 } as AuthError,
              )
              return
            }
            if (user.value) {
              reauthRequired.value = true
              isOfflineGracePeriod.value = true
              isRestoringSession.value = true
              persistAuthIdentity(user.value).catch(e => console.warn('[AUTH] Failed to preserve passive sign-out identity:', e))
              return
            }
          }

          // Invalidate only after passive null-session callbacks have been
          // rejected. Otherwise a retained account still loses cache ownership
          // as though an explicit sign-out occurred.
          invalidateCache.onAuthChange(newSession?.user?.id || null)

          // Update local state
          session.value = newSession
          user.value = newSession?.user || null
          if (newSession) {
            persistAuthSessionBackup(newSession).catch(e => console.warn('[AUTH] Failed to backup auth event session:', e))
          }

          // FEATURE-1202: Write session to shared file for KDE widget (Tauri only)
          // ~/.config/flowstate/session.json — KDE widget reads this for authenticated API calls
          if (isTauriRuntime()) {
            writeSessionFile(newSession).catch(e => {
              console.warn('[AUTH] Failed to write session file for KDE widget:', e)
            })
          }

          // BUG-1056: Handle token refresh across tabs - update realtime connection
          if (_event === 'TOKEN_REFRESHED' && newSession?.access_token) {
            console.log(`👤 [AUTH:${currentTabId}] Token refreshed - updating realtime auth`)
            try {
              // Update the realtime WebSocket with the new token
              supabase.realtime.setAuth(newSession.access_token)
            } catch (e) {
              console.error(`❌ [AUTH:${currentTabId}] Failed to update realtime auth:`, e)
            }
          }

          // AI chat can initialize before Electron's async disk-backed auth storage
          // has resolved. Retry chat merge/realtime once auth is known-good so
          // Electron, localhost, and PWA converge on the same Supabase history.
          if ((_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED' || _event === 'INITIAL_SESSION') && newSession?.user) {
            try {
              const { useAIChatStore } = await import('@/stores/aiChat')
              const aiChatStore = useAIChatStore()
              if (aiChatStore.isInitialized) {
                await aiChatStore.syncConversationsWithSupabaseNow()
              }
            } catch (e) {
              console.warn(`👤 [AUTH:${currentTabId}] Failed to resync AI chat after ${_event}:`, e)
            }
          }

          // BUG-1086: Reset sign-in handler on sign-out so next sign-in reloads stores
          // BUG-1207: Reset appInitLoadComplete so post-login sign-in reloads stores
          if (_event === 'SIGNED_OUT') {
            handledSignInForUserId = null
            appInitLoadComplete = false
          }

          // TASK-1283: Capture Google provider tokens for Calendar API
          // FEATURE-1414: Renamed keys from googleCalendarToken to googleProviderToken
          //   (same token now serves both Calendar and Drive APIs)
          // PKCE flow: Supabase exchanges ?code=xxx for tokens, fires SIGNED_IN with session.provider_token
          // Legacy implicit flow: tokens from hash via consumePendingProviderTokens(), fires INITIAL_SESSION
          // We handle both events to cover all flows.
          if ((_event === 'SIGNED_IN' || _event === 'INITIAL_SESSION') && newSession?.user) {
            const providerTokens = consumePendingProviderTokens()
            const providerToken = providerTokens?.provider_token || (newSession as unknown as Record<string, unknown>).provider_token as string | undefined
            const providerRefreshToken = providerTokens?.provider_refresh_token || (newSession as unknown as Record<string, unknown>).provider_refresh_token as string | undefined
            if (providerToken) {
              try {
                const { useSettingsStore } = await import('@/stores/settings')
                const settingsStore = useSettingsStore()
                settingsStore.updateSetting('googleProviderToken', providerToken)
                // Google access tokens expire in ~3600s. Store expiry for proactive refresh.
                settingsStore.updateSetting('googleProviderTokenExpiry', Date.now() + 3500 * 1000)
                if (providerRefreshToken) {
                  settingsStore.updateSetting('googleProviderRefreshToken', providerRefreshToken)
                }
                settingsStore.updateSetting('googleConnected', true)
                console.log(`👤 [AUTH:${currentTabId}] Google provider tokens captured and stored (event: ${_event}, source: ${providerTokens ? 'hash' : 'session'}, hasRefresh: ${!!providerRefreshToken})`)
              } catch (e) {
                console.warn('[AUTH] Failed to store Google provider tokens:', e)
              }
            }
          }

          // BUG-1020: Reload stores when user signs in (projects were empty during guest mode)
          // BUG-1086: Only run ONCE per user to prevent duplicate reloads from repeated SIGNED_IN events
          // BUG-1207: Skip if useAppInitialization already loaded stores (prevents double-load)
          if (_event === 'SIGNED_IN' && newSession?.user) {
            if (handledSignInForUserId === newSession.user.id) {
              console.log(`👤 [AUTH:${currentTabId}] SIGNED_IN already handled for this user, skipping reload`)
              return
            }
            handledSignInForUserId = newSession.user.id

            // BUG-1207 guard retained: on a normal launch useAppInitialization owns the load, so
            // SIGNED_IN must not double-fetch. It only reloads when that load produced nothing
            // (stale auth during init, or a sign-out having emptied the stores).
            let shouldReload = true
            if (appInitLoadComplete) {
              const { useTaskStore } = await import('@/stores/tasks')
              shouldReload = useTaskStore()._rawTasks.length === 0
              if (!shouldReload) {
                console.log(`👤 [AUTH:${currentTabId}] SIGNED_IN: skipping store reload (useAppInitialization already loaded)`)
              }
            }

            if (shouldReload) {
              console.log(`👤 [AUTH:${currentTabId}] SIGNED_IN — reloading stores (workspaces first)`)
              try {
                await reloadStoresAfterSignIn()
                console.log(`✅ [AUTH:${currentTabId}] Stores reloaded after sign-in`)
              } catch (e) {
                console.error(`❌ [AUTH:${currentTabId}] Failed to reload stores after sign-in:`, e)
                // Let the next SIGNED_IN retry rather than latching a failed load.
                handledSignInForUserId = null
              }
            }
          }
        }

        // auth-js invokes listeners while holding its internal auth lock. Returning
        // a Promise, or calling another auth method before that lock is released,
        // can deadlock session restoration. Defer all listener work to a new task.
        let authEventQueue: Promise<void> = Promise.resolve()
        supabase.auth.onAuthStateChange((_event: string, newSession: Session | null) => {
          setTimeout(() => {
            authEventQueue = authEventQueue.then(() => handleAuthStateChange(_event, newSession)).catch(e => {
              console.error(`[AUTH] Failed to process ${_event} event:`, e)
            })
          }, 0)
        })

      } catch (e: unknown) {
        if (isRestoringSession.value && (e as Error)?.message?.includes('Electron preload bridge unavailable')) {
          // Storage unavailability is not proof of a guest account. Keep caches
          // and the UI in recovery until the preload bridge can be retried.
          isOfflineGracePeriod.value = true
          initializationFailed.value = true
          error.value = e as AuthError
          return
        }
        if (isRestoringSession.value && session.value?.user?.id) {
          preserveReconnectShellAfterFailedRefresh(
            session.value,
            '[AUTH] Session validation failed during startup — keeping persisted identity write-blocked for reconnect',
            e as AuthError,
          )
          return
        }
        if (isRestoringSession.value && user.value?.id) {
          // The durable identity still proves which account owns local data even
          // when the session cannot be read. Keep it write-blocked instead of
          // treating a validation/storage error as a sign-out.
          isOfflineGracePeriod.value = true
          reauthRequired.value = true
          initializationFailed.value = false
          persistAuthIdentity(user.value).catch(err => console.warn('[AUTH] Failed to preserve identity after startup validation error:', err))
          return
        }
        // BUG-1056: Detect if Brave Shields blocked auth initialization
        if (isBlockedByBrave(e)) {
          recordBlockedResource('supabase-auth-init')
          console.error('[AUTH] Auth initialization blocked by Brave Shields. Please disable Shields for this site.')
        }
        console.error('Auth initialization failed:', e)
        error.value = e as AuthError
        initializationFailed.value = true
      } finally {
        isLoading.value = false
        // A failed validation enters reconnect grace. Keep the account in the
        // restoring state until a refresh succeeds so no persisted token leaks
        // back to the Local API or direct writers through isAuthenticated.
        isRestoringSession.value = isOfflineGracePeriod.value
        isInitialized.value = true
      }
    })()

    return initPromise
  }

  /**
   * BUG-1207: Mark that useAppInitialization has completed its store load
   * This prevents the SIGNED_IN handler from doing a redundant reload
   */
  const markAppInitLoadComplete = () => {
    appInitLoadComplete = true
  }

  /**
   * Retry auth initialization after a failure
   */
  const retryInitialization = async () => {
    console.log('[AUTH] Retrying initialization...')
    initializationFailed.value = false
    error.value = null
    isInitialized.value = false
    // BUG-1086: Reset promise lock to allow fresh initialization
    initPromise = null
    await initialize()
  }

  /**
   * BUG-339: Migrate guest data to user account with deduplication
   *
   * This improved migration:
   * 1. Checks if migration already happened (per-user flag)
   * 2. Fetches existing user tasks to build fingerprints
   * 3. Only inserts tasks that don't already exist
   * 4. Clears guest data BEFORE migration to prevent contamination on interruption
   *
   * CRITICAL FIXES (BUG #8, #9):
   * - Only use localStorage as source (in-memory could be Supabase data after loadFromDatabase)
   * - Clear localStorage BEFORE creating tasks (prevents duplicates if interrupted)
   * - Pass explicit empty string for null dates (prevents createTask's default from breaking fingerprints)
   */
  const migrateGuestData = async () => {
    try {
      // Safety check: ensure user is authenticated before migration
      if (!user.value?.id) {
        console.warn('[AUTH] Cannot migrate guest data: user not authenticated')
        return
      }

      // 1. Check if already migrated for this user
      const migrationKey = `flowstate-migrated-${user.value.id}`
      if (localStorage.getItem(migrationKey)) {
        console.log('[AUTH] Guest data already migrated for this user, skipping')
        return
      }

      // Dynamic import to avoid circular dependency
      const { useTaskStore } = await import('@/stores/tasks')
      const taskStore = useTaskStore()

      // BUG #8 FIX: ONLY use localStorage as the source of guest tasks
      // In-memory tasks could be contaminated with Supabase data if loadFromDatabase() ran first
      // (race condition with async migration in initialize())
      const guestTasksJson = localStorage.getItem('flowstate-guest-tasks')
      const allGuestTasks = guestTasksJson ? JSON.parse(guestTasksJson) : []

      if (allGuestTasks.length === 0) {
        console.log('[AUTH] No guest tasks to migrate, loading user data from database...')
        localStorage.setItem(migrationKey, new Date().toISOString())
        // Still need to load user's existing tasks and groups from Supabase
        const { useTaskStore } = await import('@/stores/tasks')
        const { useCanvasStore } = await import('@/stores/canvas')
        const taskStore = useTaskStore()
        const canvasStore = useCanvasStore()
        await Promise.all([
          taskStore.loadFromDatabase(),
          canvasStore.loadFromDatabase()
        ])
        return
      }

      console.log(`[AUTH] Migrating ${allGuestTasks.length} guest tasks...`)

      // BUG-1137: Log guest session ID for audit trail
      const guestSessionId = localStorage.getItem('flowstate-guest-session-id')
      if (guestSessionId) {
        console.log(`[AUTH] Guest session ID: ${guestSessionId} → migrating to user ${user.value.id}`)
      }

      // 2. Fetch existing user tasks for deduplication
      if (!supabase) {
        console.error('[AUTH] Supabase not available for migration')
        return
      }

      const { data: existingTasks, error: fetchError } = await supabase
        .from(DB_TABLES.TASKS)
        .select('title, due_date, status')
        .eq('user_id', user.value.id)

      if (fetchError) {
        console.error('[AUTH] Failed to fetch existing tasks for deduplication:', fetchError)
        // Continue anyway - better to potentially have duplicates than lose data
      }

      // 3. Generate fingerprints for existing tasks
      // CRITICAL: Supabase returns snake_case (due_date), guest tasks use camelCase (dueDate)
      // BUG-333 FIX: Normalize dates to YYYY-MM-DD format for comparison
      // Supabase may return ISO timestamps (2026-01-25T00:00:00.000Z) while guest mode
      // may store dates as plain strings (2026-01-25) - these must match
      const normalizeDate = (d: string | null | undefined): string => {
        if (!d) return ''
        // Extract YYYY-MM-DD from any date format
        const dateOnly = d.split('T')[0]
        return dateOnly || ''
      }

      const existingFingerprints = new Set(
        existingTasks?.map((t: { title: string; due_date: string | null; status: string }) =>
          `${(t.title || '').toLowerCase().trim()}|${normalizeDate(t.due_date)}|${t.status}`
        ) || []
      )

      // 4. Filter out duplicates
      // Guest tasks use camelCase (dueDate) - normalize to match Supabase fingerprints
      const uniqueTasks = allGuestTasks.filter((task: { title: string; dueDate: string | null; status: string }) => {
        const fp = `${(task.title || '').toLowerCase().trim()}|${normalizeDate(task.dueDate)}|${task.status}`
        return !existingFingerprints.has(fp)
      })

      const duplicateCount = allGuestTasks.length - uniqueTasks.length
      console.log(`[AUTH] Migrating ${uniqueTasks.length} unique tasks (${duplicateCount} duplicates skipped)`)

      // BUG #8 FIX: Clear localStorage BEFORE creating tasks
      // This prevents duplicates if migration is interrupted - guest tasks are already gone
      // so they won't be re-migrated on next attempt
      localStorage.removeItem('flowstate-guest-tasks')

      // 5. TASK-344: Use safeCreateTask to preserve IDs and prevent duplicates
      // This respects the Immutable Task ID System - same ID = same task
      const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
      const db = useSupabaseDatabase()

      let created = 0
      let skipped = 0

      // TASK-1550: Guest tasks are intentionally created WITHOUT workspace_id
      // This ensures they land in the personal workspace (NULL = personal)
      // and never bleed into shared workspaces
      for (const task of uniqueTasks) {
        // PRESERVE the original task ID - don't generate new ones
        const result = await db.safeCreateTask(task as Task)

        if (result.status === 'created') {
          created++
        } else {
          skipped++
          console.log(`[AUTH] Task ${task.id.slice(0, 8)} skipped: ${result.status}`)
        }
      }

      console.log(`[AUTH] Migration: ${created} created, ${skipped} skipped (already exist/tombstoned)`)

      // 6. Mark migration complete
      localStorage.setItem(migrationKey, new Date().toISOString())

      // BUG-1137: Clear guest session ID after successful migration
      clearGuestSessionId()

      // 7. BUG-339 FIX: Reload tasks and groups from database to replace in-memory guest data
      // Without this, _rawTasks would have BOTH old guest tasks AND new migrated tasks
      console.log('[AUTH] Reloading data from database after migration...')
      const { useCanvasStore } = await import('@/stores/canvas')
      const canvasStore = useCanvasStore()
      await Promise.all([
        taskStore.loadFromDatabase(),
        canvasStore.loadFromDatabase()
      ])

      console.log('[AUTH] Guest data migration complete')
    } catch (e) {
      console.error('[AUTH] Guest data migration failed:', e)
    }
  }

  /**
   * FEATURE-1202: Write session to shared file for KDE widget
   * Tauri app writes to ~/.config/flowstate/session.json on every auth state change.
   * KDE widget reads this file for authenticated API calls.
   * On sign-out (null session), the file is cleared.
   */
  const writeSessionFile = async (sessionData: Session | null) => {
    try {
      const { writeTextFile, mkdir, exists } = await import('@tauri-apps/plugin-fs')
      const { homeDir } = await import('@tauri-apps/api/path')

      const home = await homeDir()
      const configDir = `${home}/.config/flowstate`
      const sessionPath = `${configDir}/session.json`

      // Ensure directory exists
      const dirExists = await exists(configDir)
      if (!dirExists) {
        await mkdir(configDir, { recursive: true })
      }

      if (sessionData) {
        // Write minimal session data (only what KDE widget needs)
        const payload = JSON.stringify({
          access_token: sessionData.access_token,
          refresh_token: sessionData.refresh_token,
          expires_at: sessionData.expires_at,
          user_id: sessionData.user?.id,
          updated_at: new Date().toISOString(),
        })
        await writeTextFile(sessionPath, payload)
        console.log('[AUTH] Session file written for KDE widget')
      } else {
        // Clear session file on sign-out
        await writeTextFile(sessionPath, '{}')
        console.log('[AUTH] Session file cleared (signed out)')
      }
    } catch (e) {
      // Non-critical — KDE widget is optional
      console.warn('[AUTH] Could not write session file:', e)
    }
  }

  const signInWithPassword = async (email: string, password: string) => {
    try {
      // 1. Capture guest data BEFORE sign-in clears/changes state
      // (Actually, sign-in itself doesn't clear store, but the subsequent app reload/sync might)
      // We'll run migration AFTER successful sign-in.

      isLoading.value = true
      error.value = null

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (signInError) throw signInError

      // BUG-339 FIX: Set user/session immediately from response
      // Don't wait for onAuthStateChange (async) - we need user.id for migration
      if (data.session) {
        session.value = data.session
        user.value = data.user
        clearOfflineGrace()
        persistAuthSessionBackup(data.session).catch(e => console.warn('[AUTH] Failed to backup password sign-in session:', e))
        // BUG-339: Schedule proactive refresh
        if (data.session.expires_at) {
          scheduleTokenRefresh(data.session.expires_at)
        }
      }

      // BUG-1137: Log guest session link
      const guestSessionId = localStorage.getItem('flowstate-guest-session-id')
      if (guestSessionId) {
        console.log(`[AUTH] Linking guest session ${guestSessionId} to user ${data.user?.id}`)
      }

      // 2. Migrate Data
      await migrateGuestData()

    } catch (e: unknown) {
      // BUG-1056: Detect if Brave Shields blocked the auth request
      if (isBlockedByBrave(e)) {
        recordBlockedResource('supabase-auth-signin')
        console.error('[AUTH] Sign-in blocked by Brave Shields. Please disable Shields for this site.')
      }
      error.value = e as AuthError
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const signIn = async (email: string) => { // Basic Magic Link for now (easiest to start)
    try {
      isLoading.value = true
      error.value = null

      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Redirect back to app after login
          emailRedirectTo: window.location.origin
        }
      })

      if (signInError) throw signInError

      // Note: Magic link flow redirects, so migration would happen on the callback/landing page
      // preventing us from doing it here. We'd need a "post-login-migration" check on app init.
      // For now, Password login is the primary immediate flow.

    } catch (e: unknown) {
      error.value = e as AuthError
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const signOut = async () => {
    try {
      isLoading.value = true
      const readCache = await import('@/services/offline/readCacheDB')
      const signedOutCacheScope = readCache.getReadCacheScope()

      // BUG-1352: Set flag to prevent onAuthStateChange from re-establishing session
      isSigningOut = true

      // Explicit sign-out is the only terminal account transition. Cancel every
      // recovery path so no delayed refresh can recreate auth afterward.
      if (graceDeadlineTimer) clearTimeout(graceDeadlineTimer)
      if (graceRetryTimer) clearInterval(graceRetryTimer)
      if (reconnectRefreshTimer) clearTimeout(reconnectRefreshTimer)
      if (refreshTimer) clearTimeout(refreshTimer)
      graceDeadlineTimer = null
      graceRetryTimer = null
      reconnectRefreshTimer = null
      refreshTimer = null
      isOfflineGracePeriod.value = false
      reauthRequired.value = false

      // BUG-1352: supabase.auth.signOut() still makes a server request even with
      // scope: 'local'. If the server returns an error (500, timeout), the Supabase
      // client returns { error } WITHOUT removing the session from localStorage and
      // WITHOUT firing SIGNED_OUT. The auto-refresh mechanism then re-establishes
      // the session, making the user appear logged in again.
      //
      // Fix: Force-remove the session from localStorage BEFORE calling signOut,
      // so even if signOut fails, the session can't be restored.
      await clearAuthSessionBackup()
      await clearPersistedAuthIdentity()
      await clearPrimaryAuthSession()
      try {
        localStorage.removeItem('flowstate-supabase-auth')
        localStorage.removeItem('flowstate-supabase-auth-code-verifier')
      } catch (_e) {
        // localStorage might not be available in some edge cases
      }

      try {
        await supabase.auth.signOut({ scope: 'local' })
      } catch (signOutErr) {
        console.warn('[AUTH] supabase.auth.signOut() failed, clearing locally:', signOutErr)
      }

      // Always clear auth state regardless of signOut result
      isRestoringSession.value = false
      user.value = null
      session.value = null

      // Clear task store to prevent showing authenticated user's data in guest mode
      const { useTaskStore } = await import('@/stores/tasks')
      const taskStore = useTaskStore()
      taskStore.clearAll()

      // Clear canvas store (groups, nodes, edges)
      const { useCanvasStore } = await import('@/stores/canvas')
      const canvasStore = useCanvasStore()
      canvasStore.clearAll()

      // Clear workspace store
      const { useWorkspaceStore } = await import('@/stores/workspace')
      const workspaceStore = useWorkspaceStore()
      workspaceStore.clearAll()

      // Clear account metadata that otherwise remains visible in the signed-out sidebar.
      const [{ useProjectStore }, { useLaneStore }] = await Promise.all([
        import('@/stores/projects'),
        import('@/stores/lanes'),
      ])
      useProjectStore().clearAll()
      useLaneStore().clearAll()

      const { useCanvasImagesStore } = await import('@/stores/canvasImages')
      useCanvasImagesStore().clearAll()

      await clearAccountScopedDeviceState()

      // Clear guest ephemeral data for fresh guest experience
      clearGuestData()

      // BUG-1411: Clear IndexedDB read cache on sign-out (prevent data leaking to guest mode)
      try {
        if (signedOutCacheScope) {
          await readCache.deleteReadCacheScopesForUser(signedOutCacheScope.userId)
        }
      } catch (_e) {
        // Non-critical — cache will be overwritten on next sign-in anyway
      }

      // Pending writes belong to the account that created them. Never let a
      // later account inherit/rewrite them during queue recovery.
      try {
        const { clearAll: clearWriteQueue } = await import('@/services/offline/writeQueueDB')
        await clearWriteQueue()
      } catch (_e) {
        // Non-critical in environments without IndexedDB; auth state is already cleared.
      }

      // BUG-1352: Disconnect realtime to prevent stale authenticated connections
      try {
        supabase?.realtime.disconnect()
      } catch (_e) {
        // Not critical if this fails
      }

      console.log('[AUTH] Signed out, cleared task store and guest data')
    } catch (e: unknown) {
      error.value = e as AuthError
      console.error('Sign out failed:', e)
    } finally {
      isLoading.value = false
      isSigningOut = false
    }
  }

  const signInWithGoogle = async () => {
    try {
      isLoading.value = true
      error.value = null

      if (!supabase) {
        throw new Error('Supabase is not configured for this build. Rebuild Electron with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
      }

      // FEATURE-1202: Branch on Tauri vs PWA
      // Tauri uses localhost redirect + system browser (can't do in-WebView redirect)
      // PWA uses standard OAuth redirect in same window
      const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

      if (isTauri) {
        const { signInWithGoogleTauri } = await import('@/composables/useTauriOAuth')
        await signInWithGoogleTauri()
        // Tauri flow handles session internally via exchangeCodeForSession
        // onAuthStateChange will fire and update store state
        return
      }

      // FEATURE-1345: Capacitor — use system browser + deep link callback (PKCE)
      const isCapacitorRuntime = typeof window !== 'undefined' &&
        !!window.Capacitor?.isNativePlatform?.()
      if (isCapacitorRuntime) {
        const { signInWithGoogleCapacitor } = await import('@/composables/useCapacitorOAuth')
        await signInWithGoogleCapacitor()
        return
      }

      // Electron: Use localhost HTTP server to capture OAuth callback (like Tauri)
      const isElectronApp = typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectron
      if (isElectronApp) {
        const electronAPI = (window as any).electronAPI

        // 1. Start localhost OAuth server
        let port: number
        try {
          port = await electronAPI.oauthStart()
        } catch (e: unknown) {
          throw new Error(`Failed to start OAuth server: ${e instanceof Error ? e.message : e}`)
        }

        console.log(`[AUTH] Electron OAuth server on port ${port}`)

        // 2. Generate OAuth URL with localhost redirect
        const { data: oauthData, error: oauthError } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            skipBrowserRedirect: true,
            redirectTo: `http://127.0.0.1:${port}`,
            scopes: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.file',
            queryParams: {
              access_type: 'offline',
              prompt: 'consent'
            }
          }
        })

        if (oauthError || !oauthData?.url) {
          await electronAPI.oauthCancel()
          throw oauthError || new Error('Failed to generate OAuth URL')
        }

        // 3. Open OAuth in system browser
        try {
          await electronAPI.openExternal(oauthData.url)
        } catch (e: unknown) {
          await electronAPI.oauthCancel()
          throw new Error(`Failed to open browser for authentication: ${e instanceof Error ? e.message : e}`)
        }
        console.log('[AUTH] Opened system browser for Electron OAuth')

        // 4. Wait for callback
        let callbackUrl: string
        try {
          callbackUrl = await electronAPI.oauthWaitForCallback()
        } catch (e: unknown) {
          throw new Error(`OAuth callback failed: ${e instanceof Error ? e.message : e}`)
        }

        console.log('[AUTH] Received OAuth callback')

        // 5. Extract code and exchange for session
        const url = new URL(callbackUrl)
        const errorParam = url.searchParams.get('error')
        if (errorParam) {
          throw new Error(`OAuth error: ${url.searchParams.get('error_description') || errorParam}`)
        }

        const code = url.searchParams.get('code')
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError
          console.log('[AUTH] Electron OAuth session established via PKCE')
        } else {
          // Fallback: check hash for implicit flow tokens
          const hashParams = new URLSearchParams(url.hash.substring(1))
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')
          if (accessToken) {
            const { error: setError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            })
            if (setError) throw setError
            console.log('[AUTH] Electron OAuth session established via implicit flow')
          } else {
            throw new Error('No authorization code or access token in OAuth callback')
          }
        }
        return
      }

      // PWA: standard OAuth redirect flow
      // TASK-1283: Request calendar.readonly scope for Google Calendar integration
      // FEATURE-1414: Added drive.file scope for task image attachments
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          scopes: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.file',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      })

      if (signInError) throw signInError
    } catch (e: unknown) {
      // BUG-1056: Detect if Brave Shields blocked the OAuth redirect
      if (isBlockedByBrave(e)) {
        recordBlockedResource('supabase-auth-google-oauth')
        console.error('[AUTH] Google sign-in blocked by Brave Shields. Please disable Shields for this site.')
      }
      console.error('Google sign in failed:', e)
      error.value = e as AuthError
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const signUpWithEmail = async (email: string, password: string, metadata?: Record<string, unknown>) => {
    try {
      isLoading.value = true
      error.value = null

      // BUG-1137: Include guest session ID in signup metadata for migration tracking
      const guestSessionId = localStorage.getItem('flowstate-guest-session-id')
      const signUpMetadata = {
        ...metadata,
        ...(guestSessionId ? { guest_session_id: guestSessionId } : {})
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: signUpMetadata
        }
      })

      if (signUpError) throw signUpError

      // If auto-confirm is on, we might get a session immediately
      if (data.session) {
        session.value = data.session
        user.value = data.user
        // BUG-339: Schedule proactive refresh
        if (data.session.expires_at) {
          scheduleTokenRefresh(data.session.expires_at)
        }
        await migrateGuestData()
      }

      return data
    } catch (e: unknown) {
      console.error('Sign up failed:', e)
      error.value = e as AuthError
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const sendPasswordResetEmail = async (email: string) => {
    try {
      isLoading.value = true
      error.value = null

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (resetError) throw resetError
    } catch (e: unknown) {
      console.error('Password reset failed:', e)
      error.value = e as AuthError
      throw e
    } finally {
      isLoading.value = false
    }
  }

  // Auto-init (Removed: let composables/components control init timing)
  // initialize()

  return {
    // State
    user,
    session,
    isLoading,
    error,
    isInitialized,
    initializationFailed,
    isRestoringSession,
    // TASK-1426: True when JWT expired while offline — user.id still valid for local ops
    isOfflineGracePeriod,
    // BUG-1898: True when the grace period exceeded GRACE_MAX_MS with refresh still failing
    reauthRequired,

    // Getters
    isAuthenticated,
    canSyncRemotely,
    errorMessage,
    displayName,
    photoURL,
    isAdmin,
    isDev,
    hasPasswordAuth,

    // Actions
    initialize,
    retryInitialization,
    markAppInitLoadComplete,
    signIn,
    signInWithPassword,
    signInWithGoogle,
    signUpWithEmail,
    sendPasswordResetEmail,
    signOut
  }
})
