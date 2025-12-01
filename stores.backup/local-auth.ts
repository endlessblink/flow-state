import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * Local user profile for anonymous sessions
 */
export interface LocalUser {
  id: string                    // UUID generated on first visit
  sessionId: string             // Session identifier
  createdAt: Date              // When user first started using the app
  lastSeen: Date               // Last activity timestamp
  sessionCount: number         // How many sessions user has had
  displayName: string | null   // User's preferred display name
  preferences: UserPreferences
}

export interface UserPreferences {
  language: 'en' | 'he'
  theme: 'light' | 'dark' | 'auto'
  notifications: {
    taskReminders: boolean
    pomodoroNotifications: boolean
    dailySummary: boolean
  }
  timezone: string
  defaultPomodoroLength: number  // minutes
  defaultBreakLength: number      // minutes
  taskView: 'board' | 'calendar' | 'canvas'
}

/**
 * Default preferences for new users
 */
const DEFAULT_PREFERENCES: UserPreferences = {
  language: 'en',
  theme: 'auto',
  notifications: {
    taskReminders: true,
    pomodoroNotifications: true,
    dailySummary: false
  },
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  defaultPomodoroLength: 25,
  defaultBreakLength: 5,
  taskView: 'board'
}

/**
 * Local-first authentication store
 *
 * This store provides anonymous user sessions with data stored entirely
 * in the browser. No external authentication or cloud services required.
 */
export const useLocalAuthStore = defineStore('localAuth', () => {
  // State
  const localUser = ref<LocalUser | null>(null)
  const isInitialized = ref(false)
  const isLoading = ref(false)

  // Computed properties
  const isAuthenticated = computed(() => localUser.value !== null)
  const userId = computed(() => localUser.value?.id ?? null)
  const userPreferences = computed(() => localUser.value?.preferences ?? DEFAULT_PREFERENCES)
  const userDisplayName = computed(() => localUser.value?.displayName ?? 'Local User')
  const isNewSession = computed(() => localUser.value?.sessionCount === 1)

  /**
   * Generate a UUID for anonymous user identification
   */
  function generateUUID(): string {
    return crypto.randomUUID()
  }

  /**
   * Create a new local user profile
   */
  function createNewLocalUser(): LocalUser {
    const now = new Date()
    const userId = generateUUID()
    const sessionId = generateUUID()

    return {
      id: userId,
      sessionId,
      createdAt: now,
      lastSeen: now,
      sessionCount: 1,
      displayName: null,
      preferences: { ...DEFAULT_PREFERENCES }
    }
  }

  /**
   * Save local user to localStorage
   */
  function saveLocalUser(): void {
    if (localUser.value) {
      localStorage.setItem('pomo-flow-local-user', JSON.stringify(localUser.value))
    }
  }

  /**
   * Load local user from localStorage
   */
  function loadLocalUser(): LocalUser | null {
    try {
      const stored = localStorage.getItem('pomo-flow-local-user')
      if (stored) {
        const userData = JSON.parse(stored)
        // Convert date strings back to Date objects
        userData.createdAt = new Date(userData.createdAt)
        userData.lastSeen = new Date(userData.lastSeen)
        return userData as LocalUser
      }
    } catch (error) {
      console.warn('Failed to load local user data:', error)
      localStorage.removeItem('pomo-flow-local-user')
    }
    return null
  }

  /**
   * Initialize local user session
   * This should be called when the app starts
   */
  async function initializeLocalUser(): Promise<void> {
    if (isInitialized.value || isLoading.value) return

    isLoading.value = true

    try {
      const existing = loadLocalUser()

      if (existing) {
        // Update existing user for new session
        existing.lastSeen = new Date()
        existing.sessionCount++
        localUser.value = existing
        console.log(`👋 Welcome back! Session ${existing.sessionCount}`)
      } else {
        // Create new user
        localUser.value = createNewLocalUser()
        console.log('🎉 Welcome to Pomo-Flow! Created your local profile.')
      }

      saveLocalUser()
      isInitialized.value = true
    } catch (error) {
      console.error('Failed to initialize local user:', error)
      // Fallback: create new user even if loading fails
      localUser.value = createNewLocalUser()
      isInitialized.value = true
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Update user preferences
   */
  function updatePreferences(newPreferences: Partial<UserPreferences>): void {
    if (localUser.value) {
      localUser.value.preferences = {
        ...localUser.value.preferences,
        ...newPreferences
      }
      saveLocalUser()
    }
  }

  /**
   * Update user display name
   */
  function updateDisplayName(displayName: string): void {
    if (localUser.value) {
      localUser.value.displayName = displayName
      saveLocalUser()
    }
  }

  /**
   * Sign out (clear local user data)
   * This will create a new anonymous user on next initialization
   */
  async function signOut(): Promise<void> {
    try {
      localStorage.removeItem('pomo-flow-local-user')
      localUser.value = null
      isInitialized.value = false
      console.log('👋 Signed out. Your local data has been cleared.')
    } catch (error) {
      console.error('Failed to sign out:', error)
    }
  }

  /**
   * Reset user data to defaults
   */
  async function resetUserData(): Promise<void> {
    if (localUser.value) {
      localUser.value.preferences = { ...DEFAULT_PREFERENCES }
      localUser.value.displayName = null
      saveLocalUser()
      console.log('🔄 User data reset to defaults')
    }
  }

  /**
   * Export user data for backup
   */
  function exportUserData(): string {
    if (localUser.value) {
      const exportData = {
        user: localUser.value,
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
      }
      return JSON.stringify(exportData, null, 2)
    }
    throw new Error('No user data to export')
  }

  /**
   * Import user data from backup
   */
  async function importUserData(jsonData: string): Promise<void> {
    try {
      const importData = JSON.parse(jsonData)

      if (!importData.user || !importData.user.id) {
        throw new Error('Invalid user data format')
      }

      // Validate and merge data
      const importedUser: LocalUser = {
        ...importData.user,
        lastSeen: new Date(), // Update last seen to current time
        createdAt: new Date(importData.user.createdAt) // Ensure Date object
      }

      localUser.value = importedUser
      saveLocalUser()
      console.log('📥 User data imported successfully')
    } catch (error) {
      console.error('Failed to import user data:', error)
      throw new Error('Invalid user data format')
    }
  }

  /**
   * Update last seen timestamp
   * Call this periodically to track user activity
   */
  function updateLastSeen(): void {
    if (localUser.value) {
      localUser.value.lastSeen = new Date()
      saveLocalUser()
    }
  }

  /**
   * Get user statistics
   */
  function getUserStats() {
    if (!localUser.value) return null

    const now = new Date()
    const createdAt = localUser.value.createdAt
    const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

    return {
      sessionCount: localUser.value.sessionCount,
      daysSinceCreation,
      createdAt: localUser.value.createdAt,
      lastSeen: localUser.value.lastSeen
    }
  }

  return {
    // State
    localUser,
    isInitialized,
    isLoading,

    // Computed
    isAuthenticated,
    userId,
    userPreferences,
    userDisplayName,
    isNewSession,

    // Actions
    initializeLocalUser,
    updatePreferences,
    updateDisplayName,
    signOut,
    resetUserData,
    exportUserData,
    importUserData,
    updateLastSeen,
    getUserStats
  }
})