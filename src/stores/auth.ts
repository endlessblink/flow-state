import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, type User, type Session, type AuthError } from '@/services/auth/supabase'

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
      supabase.auth.onAuthStateChange((_event: any, newSession: any) => {
        session.value = newSession
        user.value = newSession?.user || null
        console.log('👤 [AUTH] Auth state changed:', _event, user.value?.id)
      })

    } catch (e: any) {
      console.error('Auth initialization failed:', e)
      error.value = e
    } finally {
      isLoading.value = false
      isInitialized.value = true
    }
  }

  const signInWithPassword = async (email: string, password: string) => {
    try {
      isLoading.value = true
      error.value = null

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (signInError) throw signInError

    } catch (e: any) {
      error.value = e
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

    } catch (e: any) {
      error.value = e
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
    } catch (e: any) {
      error.value = e
      console.error('Sign out failed:', e)
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

    // Actions
    initialize,
    signIn,
    signInWithPassword,
    signOut
  }
})
