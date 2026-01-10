import { ref, computed } from 'vue'

export const mockUseLocalAuthStore = () => {
    const localUser = ref({
        id: 'mock-user-123',
        sessionId: 'mock-session-456',
        createdAt: new Date(Date.now() - 86400000 * 5), // 5 days ago
        lastSeen: new Date(),
        sessionCount: 12,
        displayName: 'Mock User',
        preferences: {
            language: 'en',
            theme: 'dark',
            notifications: {
                taskReminders: true,
                pomodoroNotifications: true,
                dailySummary: false
            },
            timezone: 'UTC',
            defaultPomodoroLength: 25,
            defaultBreakLength: 5,
            taskView: 'board'
        }
    })

    return {
        localUser,
        isInitialized: ref(true),
        isLoading: ref(false),
        isAuthenticated: computed(() => true),
        userId: computed(() => 'mock-user-123'),
        userPreferences: computed(() => localUser.value.preferences),
        userDisplayName: computed(() => localUser.value.displayName ?? 'Local User'),
        isNewSession: computed(() => false),
        initializeLocalUser: async () => { },
        updatePreferences: () => { },
        updateDisplayName: (name: string) => { localUser.value.displayName = name },
        signOut: async () => { },
        resetUserData: async () => { },
        exportUserData: () => JSON.stringify({ user: localUser.value }),
        importUserData: async () => { },
        updateLastSeen: () => { },
        getUserStats: () => ({
            sessionCount: localUser.value.sessionCount,
            daysSinceCreation: 5,
            createdAt: localUser.value.createdAt,
            lastSeen: localUser.value.lastSeen
        })
    }
}

export default mockUseLocalAuthStore
