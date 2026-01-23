import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, type User, type Session, type AuthError } from '@/services/auth/supabase'
import { clearGuestData } from '@/utils/guestModeStorage'
import type { Task } from '@/types/tasks'
export type { User, Session, AuthError }

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const isLoading = ref(false)
  const error = ref<AuthError | null>(null)
  const isInitialized = ref(false)

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
   * BUG-339: Perform token refresh and reschedule
   */
  const performTokenRefresh = async () => {
    if (!supabase) return

    try {
      console.log('[AUTH] Proactive token refresh starting...')
      const { data, error: refreshError } = await supabase.auth.refreshSession()

      if (refreshError) {
        console.error('[AUTH] Proactive token refresh failed:', refreshError)
        // Don't clear session - let user continue until actual API call fails
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
      console.error('[AUTH] Proactive token refresh error:', e)
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
  const initialize = async () => {
    if (isInitialized.value) return

    try {
      isLoading.value = true

      if (!supabase) {
        console.warn('Supabase client not available, staying in Guest Mode')
        return
      }

      // Check for existing session
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError

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
      supabase.auth.onAuthStateChange(async (_event: string, newSession: Session | null) => {
        session.value = newSession
        user.value = newSession?.user || null
        console.log('👤 [AUTH] Auth state changed:', _event, user.value?.id)

        // BUG-1020: Reload stores when user signs in (projects were empty during guest mode)
        if (_event === 'SIGNED_IN' && newSession?.user) {
          console.log('👤 [AUTH] User signed in - reloading stores...')
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
            console.log('✅ [AUTH] Stores reloaded after sign-in')
          } catch (e) {
            console.error('❌ [AUTH] Failed to reload stores after sign-in:', e)
          }
        }
      })

    } catch (e: unknown) {
      console.error('Auth initialization failed:', e)
      error.value = e as AuthError
    } finally {
      isLoading.value = false
      isInitialized.value = true
    }
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
      // Normalize both to the same format for comparison
      const existingFingerprints = new Set(
        existingTasks?.map((t: { title: string; due_date: string | null; status: string }) =>
          `${(t.title || '').toLowerCase().trim()}|${t.due_date || ''}|${t.status}`
        ) || []
      )

      // 4. Filter out duplicates
      // Guest tasks use camelCase (dueDate) - normalize to match Supabase fingerprints
      const uniqueTasks = allGuestTasks.filter((task: { title: string; dueDate: string | null; status: string }) => {
        const fp = `${(task.title || '').toLowerCase().trim()}|${task.dueDate || ''}|${task.status}`
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
    signIn,
    signInWithPassword,
    signInWithGoogle,
    signUpWithEmail,
    sendPasswordResetEmail,
    signOut
  }
})
