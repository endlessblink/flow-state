import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, type User, type Session, type AuthError } from '@/services/auth/supabase'
import { clearGuestData } from '@/utils/guestModeStorage'
import { isBlockedByBrave, recordBlockedResource } from '@/utils/braveProtection'
import { invalidateCache } from '@/composables/useSupabaseDatabase'
import type { Task } from '@/types/tasks'
export type { User, Session, AuthError }

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const isLoading = ref(false)
  const error = ref<AuthError | null>(null)
  const isInitialized = ref(false)
  const initializationFailed = ref(false)

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

  // BUG-339: Proactive token refresh timer
  let refreshTimer: ReturnType<typeof setTimeout> | null = null

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
        }
        return
      }

      if (data.session) {
        console.log('[AUTH] Proactive token refresh successful')
        session.value = data.session
        user.value = data.session.user

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

  // Getters
  const isAuthenticated = computed(() => !!user.value)
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
    if (import.meta.env.DEV && localStorage.getItem('flow-state-dev-mode') === 'true') return true
    return user.value?.app_metadata?.role === 'admin' ||
      user.value?.user_metadata?.role === 'admin'
  })
  const isDev = computed(() => {
    // BUG-012 FIX: localStorage override ONLY works in DEV builds (AND, not OR)
    if (import.meta.env.DEV && localStorage.getItem('flow-state-dev-mode') === 'true') return true
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
    const identities = user.value?.identities as Array<{provider: string}> | undefined
    if (identities?.some(i => i.provider === 'email')) return true
    // Fallback to app_metadata.providers
    const providers = user.value?.app_metadata?.providers as string[] | undefined
    return providers?.includes('email') ?? false
  })

  // Actions
  const initialize = async (): Promise<void> => {
    // BUG-1086: Return existing promise if already initializing (prevents race condition)
    // Multiple callers will await the same promise instead of starting parallel init attempts
    if (initPromise) {
      return initPromise
    }
    if (isInitialized.value) return

    // BUG-1056: Generate tab ID for multi-tab debugging
    const tabId = (window as any).__flowstate_tab_id || (() => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      ;(window as any).__flowstate_tab_id = id
      return id
    })()

    // BUG-1086: Create and store the promise BEFORE any async work
    // This ensures subsequent callers get this promise immediately
    initPromise = (async () => {
      try {
        isLoading.value = true
        console.log(`[AUTH:${tabId}] Initializing auth...`)

        if (!supabase) {
          console.warn(`[AUTH:${tabId}] Supabase client not available, staying in Guest Mode`)
          return
        }

        // Check for existing session
        console.log(`[AUTH:${tabId}] Fetching session from localStorage...`)
        const { data, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          console.error(`[AUTH:${tabId}] getSession error:`, sessionError)
          throw sessionError
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
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
            if (refreshError) {
              console.error('[AUTH] Failed to refresh session:', refreshError)
              // TASK-1060: Mark initialization as failed so UI can show error state
              error.value = refreshError
              initializationFailed.value = true
              // Clear stale session - user needs to sign in again
              session.value = null
              user.value = null
              return
            }
            if (refreshData.session) {
              console.log('[AUTH] Session refreshed successfully')
              session.value = refreshData.session
              user.value = refreshData.session.user
              // BUG-339: Schedule next refresh
              if (refreshData.session.expires_at) {
                scheduleTokenRefresh(refreshData.session.expires_at)
              }
            }
          } else {
            session.value = data.session
            user.value = data.session?.user || null
            // BUG-339: Schedule proactive refresh for valid session
            scheduleTokenRefresh(data.session.expires_at)
          }
        } else {
          session.value = data.session
          user.value = data.session?.user || null
        }

        // BUG-339 FIX: If we have a session on init (e.g., after OAuth/Magic Link redirect),
        // check if there's guest data to migrate. This catches redirect-based auth flows.
        if (data.session?.user) {
          // Run migration asynchronously - don't block initialization
          migrateGuestData().catch(e => {
            console.error('[AUTH] Post-init migration failed:', e)
          })
        }

        // Listen for auth changes (sign in, sign out, etc.)
        // BUG-1056: This fires across all tabs when auth state changes (via localStorage sync)
        supabase.auth.onAuthStateChange(async (_event: string, newSession: Session | null) => {
          const currentTabId = (window as any).__flowstate_tab_id || 'unknown'
          const currentUserId = user.value?.id?.substring(0, 8) || 'none'
          const newUserId = newSession?.user?.id?.substring(0, 8) || 'none'
          console.log(`👤 [AUTH:${currentTabId}] Auth state changed:`, _event,
            'current:', currentUserId, '→ new:', newUserId,
            'hasSession:', !!session.value, '→', !!newSession)

          // BUG-1056: Invalidate SWR cache when user changes to prevent stale data
          // This ensures cached guest data doesn't persist after sign-in
          invalidateCache.onAuthChange(newSession?.user?.id || null)

          // BUG-1103: Multi-tab sign-in fix
          // When Tab 2 signs in, Supabase may fire SIGNED_OUT (old session) before SIGNED_IN (new session)
          // Tab 1 would blindly clear state, even though localStorage has Tab 2's valid new session
          // Fix: On SIGNED_OUT, check if localStorage actually has a session before clearing
          if (_event === 'SIGNED_OUT' && !newSession) {
            // Double-check: maybe another tab just signed in and localStorage has their session
            const { data: currentSession } = await supabase.auth.getSession()
            if (currentSession.session) {
              console.log(`👤 [AUTH:${currentTabId}] SIGNED_OUT received but localStorage has session - using it instead`)
              session.value = currentSession.session
              user.value = currentSession.session.user
              // Schedule refresh for the recovered session
              if (currentSession.session.expires_at) {
                scheduleTokenRefresh(currentSession.session.expires_at)
              }
              return // Don't process as sign-out
            }
          }

          // Update local state
          session.value = newSession
          user.value = newSession?.user || null

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

          // BUG-1086: Reset sign-in handler on sign-out so next sign-in reloads stores
          // BUG-1207: Reset appInitLoadComplete so post-login sign-in reloads stores
          if (_event === 'SIGNED_OUT') {
            handledSignInForUserId = null
            appInitLoadComplete = false
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

            if (appInitLoadComplete) {
              console.log(`👤 [AUTH:${currentTabId}] SIGNED_IN: skipping store reload (useAppInitialization already loaded)`)
            } else {
              // Post-init sign-in: user signed in via modal after app loaded in guest mode
              console.log(`👤 [AUTH:${currentTabId}] User signed in (post-init) - reloading stores...`)
              try {
                const { useProjectStore } = await import('@/stores/projects')
                const { useTaskStore } = await import('@/stores/tasks')
                const { useCanvasStore } = await import('@/stores/canvas')

                const projectStore = useProjectStore()
                const taskStore = useTaskStore()
                const canvasStore = useCanvasStore()

                await Promise.all([
                  projectStore.loadProjectsFromDatabase(),
                  taskStore.loadFromDatabase(),
                  canvasStore.loadFromDatabase()
                ])
                console.log(`✅ [AUTH:${currentTabId}] Stores reloaded after post-init sign-in`)
              } catch (e) {
                console.error(`❌ [AUTH:${currentTabId}] Failed to reload stores after sign-in:`, e)
              }
            }
          }
        })

      } catch (e: unknown) {
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

      // 2. Fetch existing user tasks for deduplication
      if (!supabase) {
        console.error('[AUTH] Supabase not available for migration')
        return
      }

      const { data: existingTasks, error: fetchError } = await supabase
        .from('tasks')
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
        // BUG-339: Schedule proactive refresh
        if (data.session.expires_at) {
          scheduleTokenRefresh(data.session.expires_at)
        }
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

      // BUG-339: Clear refresh timer on sign-out
      if (refreshTimer) {
        clearTimeout(refreshTimer)
        refreshTimer = null
      }

      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError

      // Clear auth state
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

      // Clear guest ephemeral data for fresh guest experience
      clearGuestData()

      console.log('[AUTH] Signed out, cleared task store and guest data')
    } catch (e: unknown) {
      error.value = e as AuthError
      console.error('Sign out failed:', e)
    } finally {
      isLoading.value = false
    }
  }

  const signInWithGoogle = async () => {
    try {
      isLoading.value = true
      error.value = null

      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
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

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
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

    // Getters
    isAuthenticated,
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
