import { defineStore } from 'pinia'
// TASK-1215: Tauri dual-write for settings persistence
import { getTauriStore, isTauriEnv, scheduleTauriSave } from '@/composables/usePersistentRef'
// TASK-1219: Time block notification types
import type { TimeBlockNotificationSettings } from '@/types/timeBlockNotifications'
import { DEFAULT_TIME_BLOCK_NOTIFICATION_SETTINGS } from '@/types/timeBlockNotifications'
// TASK-1338: Push notification preferences
import type { PushNotificationPreferences } from '@/types/pushNotifications'
import { DEFAULT_PUSH_NOTIFICATION_PREFERENCES } from '@/types/pushNotifications'

// TASK-1317: External calendar (iCal) sync config
export interface ExternalCalendarConfig {
    id: string
    name: string
    url: string
    color: string
    enabled: boolean
    lastSynced?: string
    error?: string
}

// TASK-1283: Google Calendar integration — selected calendar config
export interface GoogleCalendarConfig {
    id: string
    summary: string
    backgroundColor: string
    enabled: boolean
}

export interface AppSettings {
    // Timer
    workDuration: number
    shortBreakDuration: number
    longBreakDuration: number
    autoStartBreaks: boolean
    autoStartPomodoros: boolean
    playNotificationSounds: boolean

    // Workflow
    showDoneColumn: boolean
    powerGroupOverrideMode: 'always' | 'only_empty' | 'ask'
    boardDensity: 'comfortable' | 'compact' | 'ultrathin'

    // TASK-1321: Start of Week
    weekStartsOn: 0 | 1  // 0 = Sunday, 1 = Monday

    // Appearance
    language: string
    textDirection: 'auto' | 'ltr' | 'rtl'
    theme: 'light' | 'dark' | 'system'

    // Suggestions
    enableDayGroupSuggestions: boolean

    // Feedback
    showUndoRedoToasts: boolean

    // FEATURE-1118: Gamification Settings
    gamificationEnabled: boolean
    showXpNotifications: boolean
    showAchievementNotifications: boolean
    gamificationIntensity: 'minimal' | 'moderate' | 'intense'

    // FEATURE-1194: Auto-updater
    autoUpdateEnabled: boolean

    // FEATURE-1317: AI Work Profile learning
    aiLearningEnabled: boolean

    // TASK-1327: Weekly Plan model override
    weeklyPlanProvider: 'auto' | 'ollama' | 'groq' | 'openrouter'
    weeklyPlanModel: string

    // TASK-1219: Time block progress notifications
    timeBlockNotifications: TimeBlockNotificationSettings

    // TASK-1338: Push notification preferences
    pushNotifications: PushNotificationPreferences

    // TASK-1317: External calendar (iCal) sync
    externalCalendars: ExternalCalendarConfig[]
    externalCalendarSyncInterval: number // minutes, 0 = manual only

    // TASK-1283: Google Calendar integration
    googleCalendarToken: string
    googleCalendarRefreshToken: string
    googleCalendarConnected: boolean
    googleCalendars: GoogleCalendarConfig[]
    showGoogleCalendarEvents: boolean

    // TASK-1350: AI Setup (BYOK Groq + first-time wizard)
    groqApiKey: string
    aiSetupComplete: boolean
    aiPreferredProvider: 'auto' | 'groq' | 'ollama' | 'openrouter'

    // Miscellaneous UI State (Persisted)
    sidebarCollapsed?: boolean
    kanbanSettings?: Record<string, unknown>
    canvasViewport?: { x: number; y: number; zoom: number } | null
}

const STORAGE_KEY = 'flowstate-settings-v2'

// FEATURE-1363: Debounced sync of notification settings to Supabase
// The push service reads user_settings.settings to determine delivery preferences
let settingsSyncTimer: ReturnType<typeof setTimeout> | null = null
const SETTINGS_SYNC_DEBOUNCE = 2000 // 2 seconds

async function syncSettingsToSupabase(state: AppSettings) {
    try {
        const { createClient } = await import('@supabase/supabase-js')
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
        if (!supabaseUrl || !supabaseKey) return

        const supabase = createClient(supabaseUrl, supabaseKey)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.id) return

        await supabase
            .from('user_settings')
            .upsert({
                user_id: user.id,
                settings: {
                    pushNotifications: state.pushNotifications,
                    timeBlockNotifications: state.timeBlockNotifications
                },
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' })

        console.log('[SETTINGS] Notification preferences synced to Supabase')
    } catch (error) {
        console.warn('[SETTINGS] Failed to sync notification preferences:', error)
    }
}

export const useSettingsStore = defineStore('settings', {
    state: (): AppSettings => ({
        // Timer defaults
        workDuration: 25 * 60,
        shortBreakDuration: 5 * 60,
        longBreakDuration: 15 * 60,
        autoStartBreaks: false,
        autoStartPomodoros: false,
        playNotificationSounds: true,

        // Workflow defaults
        showDoneColumn: true,
        powerGroupOverrideMode: 'only_empty',
        boardDensity: 'comfortable',

        // TASK-1321: Start of Week (default: Monday)
        weekStartsOn: 0 as 0 | 1,

        // Appearance defaults
        language: 'en',
        textDirection: 'auto',
        theme: 'system',

        // Suggestions defaults
        enableDayGroupSuggestions: true,

        // Feedback defaults
        showUndoRedoToasts: true,

        // FEATURE-1118: Gamification defaults
        gamificationEnabled: true,
        showXpNotifications: true,
        showAchievementNotifications: true,
        gamificationIntensity: 'moderate',

        // FEATURE-1194: Auto-updater defaults
        autoUpdateEnabled: false,

        // FEATURE-1317: AI Work Profile learning (default: on)
        aiLearningEnabled: true,

        // TASK-1327: Weekly Plan model override (defaults to chat model)
        weeklyPlanProvider: 'auto' as 'auto' | 'ollama' | 'groq' | 'openrouter',
        weeklyPlanModel: '',

        // TASK-1219: Time block notification defaults
        timeBlockNotifications: { ...DEFAULT_TIME_BLOCK_NOTIFICATION_SETTINGS },

        // TASK-1338: Push notification defaults
        pushNotifications: { ...DEFAULT_PUSH_NOTIFICATION_PREFERENCES },

        // TASK-1317: External calendar defaults
        externalCalendars: [],
        externalCalendarSyncInterval: 30,

        // TASK-1283: Google Calendar defaults
        googleCalendarToken: '',
        googleCalendarRefreshToken: '',
        googleCalendarConnected: false,
        googleCalendars: [],
        showGoogleCalendarEvents: true,

        // TASK-1350: AI Setup defaults (BYOK Groq + first-time wizard)
        groqApiKey: '',
        aiSetupComplete: false,
        aiPreferredProvider: 'auto' as 'auto' | 'groq' | 'ollama' | 'openrouter',

        // Miscellaneous defaults
        sidebarCollapsed: false,
        kanbanSettings: {},
        canvasViewport: null
    }),

    actions: {
        loadFromStorage() {
            // Try new key first
            let saved = localStorage.getItem(STORAGE_KEY)

            // TASK-1267: Migrate from old hyphenated key prefix
            if (!saved) {
                const oldKey = localStorage.getItem('flow-state-settings-v2')
                if (oldKey) {
                    localStorage.setItem(STORAGE_KEY, oldKey)
                    localStorage.removeItem('flow-state-settings-v2')
                    saved = oldKey
                }
            }

            if (!saved) {
                // Migration from old keys
                const oldTimerSettings = localStorage.getItem('flow-state-settings')
                const oldKanbanSettings = localStorage.getItem('flow-state-kanban-settings')
                const oldUiState = localStorage.getItem('flow-state-ui-state')
                const oldLocale = localStorage.getItem('app-locale')

                if (oldTimerSettings || oldKanbanSettings || oldUiState || oldLocale) {
                    const migrated: Partial<AppSettings> = {}

                    if (oldTimerSettings) {
                        try {
                            const timer = JSON.parse(oldTimerSettings)
                            Object.assign(migrated, {
                                workDuration: timer.workDuration,
                                shortBreakDuration: timer.shortBreakDuration,
                                longBreakDuration: timer.longBreakDuration,
                                autoStartBreaks: timer.autoStartBreaks,
                                autoStartPomodoros: timer.autoStartPomodoros,
                                playNotificationSounds: timer.playNotificationSounds
                            })
                        } catch (e) {
                            console.error('Failed to migrate timer settings', e)
                        }
                    }

                    if (oldKanbanSettings) {
                        try {
                            const kanban = JSON.parse(oldKanbanSettings)
                            migrated.showDoneColumn = kanban.showDoneColumn
                        } catch (e) {
                            console.error('Failed to migrate kanban settings', e)
                        }
                    }

                    if (oldUiState) {
                        try {
                            const ui = JSON.parse(oldUiState)
                            migrated.boardDensity = ui.boardDensity
                            migrated.powerGroupOverrideMode = ui.powerGroupOverrideMode
                            migrated.theme = ui.theme
                            if (ui.locale) migrated.language = ui.locale
                            if (ui.directionPreference) migrated.textDirection = ui.directionPreference
                        } catch (e) {
                            console.error('Failed to migrate UI state', e)
                        }
                    }

                    if (oldLocale && !migrated.language) {
                        migrated.language = oldLocale
                    }

                    // Merge migrated values into state
                    Object.assign(this.$state, migrated)
                    this.saveToStorage()

                    // Clean up old keys (optional: might want to keep them for a bit just in case, 
                    // but the prompt says to clean them up)
                    localStorage.removeItem('flow-state-settings')
                    localStorage.removeItem('flow-state-kanban-settings')
                    // We don't remove ui-state yet as it contains other non-setting UI state 
                    // like sidebar visibility which isn't moved here (yet?). 
                    // Actually, looking at ui.ts, much of it IS UI state. 
                    // I'll leave ui-state for now but might clean up parts of it later.
                    localStorage.removeItem('app-locale')
                }
            } else {
                try {
                    const parsed = JSON.parse(saved)
                    Object.assign(this.$state, parsed)

                    // TASK-1219: Backfill new settings fields for existing users
                    // Object.assign overwrites defaults with saved state, so fields
                    // added after the user's settings were first saved will be undefined.
                    if (!this.$state.timeBlockNotifications) {
                        this.$state.timeBlockNotifications = JSON.parse(JSON.stringify(DEFAULT_TIME_BLOCK_NOTIFICATION_SETTINGS))
                        try { this.saveToStorage() } catch (_) { /* non-fatal */ }
                    }
                    // TASK-1317: Backfill external calendar fields
                    if (!this.$state.externalCalendars) {
                        this.$state.externalCalendars = []
                    }
                    if (this.$state.externalCalendarSyncInterval === undefined) {
                        this.$state.externalCalendarSyncInterval = 30
                    }
                    // TASK-1321: Backfill weekStartsOn
                    if (this.$state.weekStartsOn === undefined) {
                        this.$state.weekStartsOn = 0
                    }
                    // TASK-1327: Backfill weekly plan model settings
                    if (this.$state.weeklyPlanProvider === undefined) {
                        this.$state.weeklyPlanProvider = 'auto'
                    }
                    if (this.$state.weeklyPlanModel === undefined) {
                        this.$state.weeklyPlanModel = ''
                    }
                    // TASK-1338: Backfill push notification preferences
                    if (!this.$state.pushNotifications) {
                        this.$state.pushNotifications = JSON.parse(JSON.stringify(DEFAULT_PUSH_NOTIFICATION_PREFERENCES))
                    }
                    // TASK-1283: Backfill Google Calendar fields
                    if (this.$state.googleCalendarToken === undefined) {
                        this.$state.googleCalendarToken = ''
                    }
                    if (this.$state.googleCalendarRefreshToken === undefined) {
                        this.$state.googleCalendarRefreshToken = ''
                    }
                    if (this.$state.googleCalendarConnected === undefined) {
                        this.$state.googleCalendarConnected = false
                    }
                    if (!this.$state.googleCalendars) {
                        this.$state.googleCalendars = []
                    }
                    if (this.$state.showGoogleCalendarEvents === undefined) {
                        this.$state.showGoogleCalendarEvents = true
                    }
                    // TASK-1350: Backfill AI setup fields
                    if (this.$state.groqApiKey === undefined) {
                        this.$state.groqApiKey = ''
                    }
                    if (this.$state.aiSetupComplete === undefined) {
                        this.$state.aiSetupComplete = false
                    }
                    if (this.$state.aiPreferredProvider === undefined) {
                        this.$state.aiPreferredProvider = 'auto'
                    }
                } catch (e) {
                    console.error('Failed to parse settings from storage', e)
                }
            }
        },

        saveToStorage() {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.$state))
            // TASK-1215: Tauri dual-write
            if (isTauriEnv()) {
                getTauriStore().then(store => {
                    if (!store) return
                    store.set(STORAGE_KEY, this.$state).then(() => scheduleTauriSave(STORAGE_KEY))
                })
            }
            // FEATURE-1363: Debounced sync to Supabase for push service
            if (settingsSyncTimer) clearTimeout(settingsSyncTimer)
            settingsSyncTimer = setTimeout(() => syncSettingsToSupabase(this.$state), SETTINGS_SYNC_DEBOUNCE)
        },

        updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
            this.$state[key] = value
            this.saveToStorage()
        }
    }
})
