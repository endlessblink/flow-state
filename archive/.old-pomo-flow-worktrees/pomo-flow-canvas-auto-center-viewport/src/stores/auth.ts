import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  updateProfile as firebaseUpdateProfile,
  updatePassword as firebaseUpdatePassword,
  onAuthStateChanged,
  type User
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, type Timestamp } from 'firebase/firestore'
import { auth, db } from '@/config/firebase'

/**
 * User profile data stored in Firestore
 */
export interface UserProfile {
  uid: string
  email: string
  displayName: string | null
  photoURL: string | null
  createdAt: Date
  lastLoginAt: Date
  preferences: {
    language: 'en' | 'he'
    theme: 'light' | 'dark' | 'auto'
    notifications: {
      email: boolean
      push: boolean
    }
    timezone: string
  }
  stats: {
    totalTasks: number
    completedTasks: number
    totalPomodoros: number
  }
}

/**
 * Firebase Auth error codes with user-friendly messages
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'This email is already registered',
  'auth/invalid-email': 'Invalid email address',
  'auth/operation-not-allowed': 'Email/password sign-in is disabled',
  'auth/weak-password': 'Password must be at least 8 characters',
  'auth/user-disabled': 'This account has been disabled',
  'auth/user-not-found': 'No account found with this email',
  'auth/wrong-password': 'Incorrect password',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later',
  'auth/network-request-failed': 'Network error. Please check your connection',
  'auth/popup-blocked': 'Popup was blocked by the browser. Please allow popups.',
  'auth/popup-closed-by-user': 'Sign-in cancelled',
  'auth/account-exists-with-different-credential': 'Email already registered with different provider',
  'auth/cancelled-popup-request': 'Only one popup request at a time'
}

/**
 * Get user-friendly error message from Firebase error code
 */
function getErrorMessage(error: any): string {
  if (error?.code && AUTH_ERROR_MESSAGES[error.code]) {
    return AUTH_ERROR_MESSAGES[error.code]
  }
  return error?.message || 'An unexpected error occurred'
}

/**
 * Default user profile preferences
 */
const DEFAULT_PREFERENCES: UserProfile['preferences'] = {
  language: 'en',
  theme: 'auto',
  notifications: {
    email: true,
    push: true
  },
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * Default user stats
 */
const DEFAULT_STATS: UserProfile['stats'] = {
  totalTasks: 0,
  completedTasks: 0,
  totalPomodoros: 0
}

export const useAuthStore = defineStore('auth', () => {
  // ===== State =====
  const user = ref<User | null>(null)
  const profile = ref<UserProfile | null>(null)
  const isLoading = ref(true) // Start as loading to prevent flash of unauthenticated state
  const error = ref<string | null>(null)
  const authListenerInitialized = ref(false)

  // ===== Computed =====
  const isAuthenticated = computed(() => user.value !== null)
  const userEmail = computed(() => user.value?.email || null)
  const userDisplayName = computed(() => profile.value?.displayName || user.value?.displayName || null)
  const userPhotoURL = computed(() => profile.value?.photoURL || user.value?.photoURL || null)

  // ===== Actions =====

  /**
   * Initialize auth state listener
   * Called once on app mount to listen for auth state changes
   */
  function initAuthListener(): void {
    if (authListenerInitialized.value) {
      console.warn('Auth listener already initialized')
      return
    }

    console.log('🔐 Initializing Firebase Auth listener...')

    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log('✅ User authenticated:', firebaseUser.email)
        user.value = firebaseUser

        // Load user profile from Firestore
        await loadUserProfile(firebaseUser.uid)

        // Update last login time
        await updateLastLogin(firebaseUser.uid)
      } else {
        console.log('👤 No user authenticated')
        user.value = null
        profile.value = null
      }

      isLoading.value = false
    })

    authListenerInitialized.value = true
  }

  /**
   * Load user profile from Firestore
   */
  async function loadUserProfile(uid: string): Promise<void> {
    try {
      const profileRef = doc(db, 'users', uid, 'profile', 'main')
      const profileSnap = await getDoc(profileRef)

      if (profileSnap.exists()) {
        const data = profileSnap.data()

        // Convert Firestore Timestamps to Dates
        profile.value = {
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          lastLoginAt: data.lastLoginAt?.toDate?.() || new Date()
        } as UserProfile
      } else {
        console.warn('Profile document does not exist, creating default profile')
        await createUserProfile(uid)
      }
    } catch (err) {
      console.error('Failed to load user profile:', err)
      error.value = 'Failed to load user profile'
    }
  }

  /**
   * Create user profile document in Firestore
   */
  async function createUserProfile(uid: string): Promise<void> {
    if (!user.value) return

    const now = new Date()

    const newProfile: Omit<UserProfile, 'createdAt' | 'lastLoginAt'> & {
      createdAt: ReturnType<typeof serverTimestamp>
      lastLoginAt: ReturnType<typeof serverTimestamp>
    } = {
      uid,
      email: user.value.email || '',
      displayName: user.value.displayName || null,
      photoURL: user.value.photoURL || null,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      preferences: { ...DEFAULT_PREFERENCES },
      stats: { ...DEFAULT_STATS }
    }

    try {
      const profileRef = doc(db, 'users', uid, 'profile', 'main')
      await setDoc(profileRef, newProfile)

      // Set local profile with actual dates
      profile.value = {
        ...newProfile,
        createdAt: now,
        lastLoginAt: now
      } as UserProfile

      console.log('✅ User profile created')
    } catch (err) {
      console.error('Failed to create user profile:', err)
      throw err
    }
  }

  /**
   * Update last login timestamp
   */
  async function updateLastLogin(uid: string): Promise<void> {
    try {
      const profileRef = doc(db, 'users', uid, 'profile', 'main')
      await updateDoc(profileRef, {
        lastLoginAt: serverTimestamp()
      })
    } catch (err) {
      console.error('Failed to update last login:', err)
    }
  }

  /**
   * Sign up with email and password
   */
  async function signUpWithEmail(email: string, password: string, displayName?: string): Promise<void> {
    error.value = null
    isLoading.value = true

    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      user.value = userCredential.user

      // Update display name if provided
      if (displayName) {
        await firebaseUpdateProfile(userCredential.user, { displayName })
      }

      // Create user profile in Firestore
      await createUserProfile(userCredential.user.uid)

      console.log('✅ User signed up:', email)
    } catch (err: any) {
      error.value = getErrorMessage(err)
      console.error('Sign up error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Sign in with email and password
   */
  async function signInWithEmail(email: string, password: string): Promise<void> {
    error.value = null
    isLoading.value = true

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      user.value = userCredential.user

      console.log('✅ User signed in:', email)
    } catch (err: any) {
      error.value = getErrorMessage(err)
      console.error('Sign in error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Sign in with Google
   */
  async function signInWithGoogle(): Promise<void> {
    error.value = null
    isLoading.value = true

    try {
      const provider = new GoogleAuthProvider()

      // Always show account picker
      provider.setCustomParameters({
        prompt: 'select_account'
      })

      const result = await signInWithPopup(auth, provider)
      user.value = result.user

      // Check if profile exists, create if not
      const profileRef = doc(db, 'users', result.user.uid, 'profile', 'main')
      const profileSnap = await getDoc(profileRef)

      if (!profileSnap.exists()) {
        await createUserProfile(result.user.uid)
      }

      console.log('✅ User signed in with Google:', result.user.email)
    } catch (err: any) {
      error.value = getErrorMessage(err)
      console.error('Google sign in error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Sign out
   */
  async function signOut(): Promise<void> {
    error.value = null

    try {
      await firebaseSignOut(auth)
      user.value = null
      profile.value = null

      console.log('👋 User signed out')
    } catch (err: any) {
      error.value = getErrorMessage(err)
      console.error('Sign out error:', err)
      throw err
    }
  }

  /**
   * Send password reset email
   */
  async function sendPasswordResetEmail(email: string): Promise<void> {
    error.value = null

    try {
      await firebaseSendPasswordResetEmail(auth, email)
      console.log('✅ Password reset email sent to:', email)
    } catch (err: any) {
      error.value = getErrorMessage(err)
      console.error('Password reset error:', err)
      throw err
    }
  }

  /**
   * Update user password
   */
  async function updatePassword(newPassword: string): Promise<void> {
    if (!user.value) {
      throw new Error('No user logged in')
    }

    error.value = null

    try {
      await firebaseUpdatePassword(user.value, newPassword)
      console.log('✅ Password updated')
    } catch (err: any) {
      error.value = getErrorMessage(err)
      console.error('Update password error:', err)
      throw err
    }
  }

  /**
   * Update user profile
   */
  async function updateUserProfile(data: Partial<UserProfile>): Promise<void> {
    if (!user.value || !profile.value) {
      throw new Error('No user logged in')
    }

    error.value = null

    try {
      const profileRef = doc(db, 'users', user.value.uid, 'profile', 'main')

      // Update Firestore
      await updateDoc(profileRef, {
        ...data,
        updatedAt: serverTimestamp()
      })

      // Update local profile (optimistic update)
      profile.value = {
        ...profile.value,
        ...data
      }

      // Update Firebase Auth profile if display name or photo changed
      if (data.displayName !== undefined || data.photoURL !== undefined) {
        await firebaseUpdateProfile(user.value, {
          displayName: data.displayName ?? user.value.displayName,
          photoURL: data.photoURL ?? user.value.photoURL
        })
      }

      console.log('✅ Profile updated')
    } catch (err: any) {
      error.value = getErrorMessage(err)
      console.error('Update profile error:', err)

      // Rollback optimistic update
      await loadUserProfile(user.value.uid)

      throw err
    }
  }

  /**
   * Update user preferences
   */
  async function updatePreferences(preferences: Partial<UserProfile['preferences']>): Promise<void> {
    if (!user.value || !profile.value) {
      throw new Error('No user logged in')
    }

    const updatedPreferences = {
      ...profile.value.preferences,
      ...preferences
    }

    await updateUserProfile({
      preferences: updatedPreferences
    })
  }

  /**
   * Update user stats
   */
  async function updateStats(stats: Partial<UserProfile['stats']>): Promise<void> {
    if (!user.value || !profile.value) {
      throw new Error('No user logged in')
    }

    const updatedStats = {
      ...profile.value.stats,
      ...stats
    }

    await updateUserProfile({
      stats: updatedStats
    })
  }

  /**
   * Clear error message
   */
  function clearError(): void {
    error.value = null
  }

  // ===== Return =====
  return {
    // State
    user,
    profile,
    isLoading,
    error,

    // Computed
    isAuthenticated,
    userEmail,
    userDisplayName,
    userPhotoURL,

    // Actions
    initAuthListener,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    signOut,
    sendPasswordResetEmail,
    updatePassword,
    updateUserProfile,
    updatePreferences,
    updateStats,
    clearError
  }
})
