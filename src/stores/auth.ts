import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, type User, type Session, type AuthError } from '@/services/auth/supabase'
export type { User, Session, AuthError }

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const isLoading = ref(false)
  const error = ref<AuthError | null>(null)
  const isInitialized = ref(false)

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
    if (import.meta.env.DEV && localStorage.getItem('pomo-flow-dev-mode') === 'true') return true
    return user.value?.app_metadata?.role === 'admin' ||
      user.value?.user_metadata?.role === 'admin'
  })
  const isDev = computed(() => {
    // BUG-012 FIX: localStorage override ONLY works in DEV builds (AND, not OR)
    if (import.meta.env.DEV && localStorage.getItem('pomo-flow-dev-mode') === 'true') return true
    return isAdmin.value ||
      user.value?.app_metadata?.role === 'developer' ||
      user.value?.user_metadata?.role === 'developer'
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

      session.value = data.session
      user.value = data.session?.user || null

      // Listen for auth changes (sign in, sign out, etc.)
      supabase.auth.onAuthStateChange((_event: string, newSession: Session | null) => {
        session.value = newSession
        user.value = newSession?.user || null
        console.log('👤 [AUTH] Auth state changed:', _event, user.value?.id)
      })

    } catch (e: unknown) {
      console.error('Auth initialization failed:', e)
      error.value = e as AuthError
    } finally {
      isLoading.value = false
      isInitialized.value = true
    }
  }

  /* 
   * Helper to migrate guest data to the new user account
   */
  const migrateGuestData = async () => {
    try {
      // Dynamic import to avoid circular dependency
      const { useTaskStore } = await import('@/stores/tasks')
      const taskStore = useTaskStore()

      const guestTasks = [...taskStore.tasks]
      if (guestTasks.length === 0) return

      console.log(`📦 [AUTH] Migrating ${guestTasks.length} guest tasks to new user...`)

      // We need to re-create these tasks for the new user
      // The simple way is to use createTask for each, which handles the ID generation and DB insert
      for (const task of guestTasks) {
        // Skip tasks that might already look like they have an owner (sanity check)
        // But realistically, all local tasks are guest tasks at this point

        await taskStore.createTask({
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          // Canvas specific
          canvasPosition: task.canvasPosition,
          isInInbox: task.isInInbox,
          // Other fields
          estimatedDuration: task.estimatedDuration,
          projectId: task.projectId
        })
      }

      console.log('✅ [AUTH] Guest data migration complete')
    } catch (e) {
      console.error('❌ [AUTH] Guest data migration failed:', e)
    }
  }

  const signInWithPassword = async (email: string, password: string) => {
    try {
      // 1. Capture guest data BEFORE sign-in clears/changes state
      // (Actually, sign-in itself doesn't clear store, but the subsequent app reload/sync might)
      // We'll run migration AFTER successful sign-in.

      isLoading.value = true
      error.value = null

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (signInError) throw signInError

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
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError

      // Clear state
      user.value = null
      session.value = null
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
