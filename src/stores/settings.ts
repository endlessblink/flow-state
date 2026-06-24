import { defineStore } from 'pinia'
// TASK-1215: Tauri dual-write for settings persistence
import { getTauriStore, isTauriEnv, scheduleTauriSave } from '@/composables/usePersistentRef'
// TASK-1219: Time block notification types
import type { TimeBlockNotificationSettings } from '@/types/timeBlockNotifications'
import { DEFAULT_TIME_BLOCK_NOTIFICATION_SETTINGS } from '@/types/timeBlockNotifications'
// TASK-1338: Push notification preferences
import type { PushNotificationPreferences } from '@/types/pushNotifications'
import { DEFAULT_PUSH_NOTIFICATION_PREFERENCES } from '@/types/pushNotifications'
// FEATURE-1162: Saved Views / Smart Filters
import type { SavedView } from '@/types/savedViews'
import type { TranscriptionProviderId } from '@/services/transcription/types'

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
    theme: 'light' | 'dark' | 'auto'

    // Suggestions
    enableDayGroupSuggestions: boolean
    enableDayGroupPositionRotation: boolean

    // Feedback
    showUndoRedoToasts: boolean

    // FEATURE-1194: Auto-updater
    autoUpdateEnabled: boolean

    // FEATURE-1317: AI Work Profile learning
    aiLearningEnabled: boolean

    // TASK-1500: Smart AI model routing
    aiSmartRouting: boolean
    aiPremiumModel: string
    aiMonthlyBudgetCents: number

    // TASK-1327: Weekly plan model override
    weeklyPlanProvider: 'auto' | 'groq' | 'ollama' | 'openrouter'
    weeklyPlanModel: string

    // TASK-1219: Time block progress notifications
    timeBlockNotifications: TimeBlockNotificationSettings

    // TASK-1338: Push notification preferences
    pushNotifications: PushNotificationPreferences

    // TASK-1317: External calendar (iCal) sync
    externalCalendars: ExternalCalendarConfig[]
    externalCalendarSyncInterval: number // minutes, 0 = manual only

    // TASK-1283: Google integration (Calendar + Drive)
    // FEATURE-1414: Renamed from googleCalendarToken/etc to googleProviderToken/etc
    //   (same OAuth token now covers both Calendar and Drive scopes)
    googleProviderToken: string
    googleProviderRefreshToken: string
    googleProviderTokenExpiry: number  // Unix ms — when access token expires (0 = unknown)
    googleConnected: boolean
    googleCalendars: GoogleCalendarConfig[]
    showGoogleCalendarEvents: boolean

    // TASK-1350: AI Setup (BYOK Groq + first-time wizard)
    groqApiKey: string
    aiSetupComplete: boolean
    aiPreferredProvider: 'auto' | 'groq' | 'ollama' | 'openrouter'

    // TASK-1814: Subscription brain via VPS bridge (Claude/Codex CLIs)
    aiUseSubscription: boolean
    aiBrain: 'claude' | 'codex'

    // Android/mobile voice transcription
    voiceTranscriptionProvider: TranscriptionProviderId
    // BUG-1885: spoken-language hint for cloud Whisper ('auto' = detect, for mixed Hebrew+English)
    voiceTranscriptionLanguage: 'auto' | 'he' | 'en'
    androidGemmaModelPath: string

    // FEATURE-1162: Saved Views / Smart Filters
    savedViews: SavedView[]

    // Miscellaneous UI State (Persisted)
    sidebarCollapsed?: boolean
    kanbanSettings?: Record<string, unknown>
    canvasViewport?: { x: number; y: number; zoom: number } | null
}

const STORAGE_KEY = 'flowstate-settings-v2'

// FEATURE-1363 / TASK-1573: Debounced sync of ALL settings to Supabase
// The push service reads user_settings.settings to determine delivery preferences.
// TASK-1573: Expanded to write the full AppSettings blob so timer durations,
// AI preferences, saved views, etc. all reach Supabase on every change.
let settingsSyncTimer: ReturnType<typeof setTimeout> | null = null
const SETTINGS_SYNC_DEBOUNCE = 2000 // 2 seconds

// Fields that must NOT be written to Supabase in the auto-sync path.
// These are OAuth tokens / API keys that are either:
//   • Per-device credentials (Google OAuth tokens tied to a specific auth flow)
//   • User secrets that must not leave the device via an unauthenticated write path
// The explicit saveUserSettings() flow in the settings UI ALSO uses toSupabaseUserSettings()
// which serialises the full blob — so these fields still reach Supabase when the user
// explicitly saves, but we skip them here for safety.
const SENSITIVE_FIELDS_TO_OMIT: (keyof AppSettings)[] = [
    'googleProviderToken',
    'googleProviderRefreshToken',
    'googleProviderTokenExpiry',
    'groqApiKey',
]

async function syncSettingsToSupabase(state: AppSettings) {
    try {
        console.log('[SETTINGS] syncSettingsToSupabase called')
        // Lazily import the singleton auth client (same client used by all DB operations)
        const { supabase } = await import('@/services/auth/supabase')
        if (!supabase) {
            console.warn('[SETTINGS] Supabase client not available — skipping sync')
            return
        }
        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.id) {
            console.warn('[SETTINGS] No authenticated user — will retry settings sync in 5s')
            // Auth not ready yet — retry once after 5 seconds
            setTimeout(async () => {
                try {
                    const { supabase: sb } = await import('@/services/auth/supabase')
                    if (!sb) return
                    const { data: { user: retryUser } } = await sb.auth.getUser()
                    if (!retryUser?.id) {
                        console.warn('[SETTINGS] Retry: still no authenticated user — giving up')
                        return
                    }
                    await doSettingsUpsert(sb, retryUser.id, state)
                } catch (e) {
                    console.warn('[SETTINGS] Retry failed:', e)
                }
            }, 5000)
            return
        }

        await doSettingsUpsert(supabase, user.id, state)
    } catch (error) {
        console.warn('[SETTINGS] Failed to sync settings to Supabase:', error)
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function doSettingsUpsert(supabase: any, userId: string, state: AppSettings) {
    // Build a settings blob with sensitive/device-specific fields stripped out
    const safeSettings: Record<string, unknown> = { ...state }
    for (const field of SENSITIVE_FIELDS_TO_OMIT) {
        delete safeSettings[field]
    }

    // Mirror the shape used by toSupabaseUserSettings() so the full settings
    // blob lands in the settings JSONB column and individual legacy columns
    // are kept in sync for backwards-compatibility.
    const { error } = await supabase
        .from('user_settings')
        .upsert({
            user_id: userId,
            // Individual legacy columns
            work_duration: state.workDuration,
            short_break_duration: state.shortBreakDuration,
            long_break_duration: state.longBreakDuration,
            auto_start_breaks: state.autoStartBreaks,
            auto_start_pomodoros: state.autoStartPomodoros,
            play_notification_sounds: state.playNotificationSounds,
            theme: state.theme || 'auto',
            language: state.language || 'en',
            sidebar_collapsed: state.sidebarCollapsed || false,
            board_density: state.boardDensity || 'comfortable',
            kanban_settings: state.kanbanSettings || {},
            canvas_viewport: state.canvasViewport || null,
            // Full settings blob (sensitive fields omitted)
            settings: safeSettings,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })

    if (error) {
        console.error('[SETTINGS] Supabase upsert failed:', error.message, error.code)
    } else {
        console.log('[SETTINGS] Settings synced to Supabase successfully')
    }
}

// Eagerly read persisted settings so the store is born hydrated.
// Previously loadFromStorage() was only called from BoardView, causing defaults
// (e.g. googleCalendarConnected=false) when other views accessed the store first.
function getPersistedSettings(): Partial<AppSettings> | null {
    if (typeof window === 'undefined') return null
    try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) return JSON.parse(saved)
        // Migration: check old key
        const old = localStorage.getItem('flow-state-settings-v2')
        if (old) return JSON.parse(old)
    } catch { /* parse error — use defaults */ }
    return null
}
const _persisted = getPersistedSettings()

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
        theme: 'auto',

        // Suggestions defaults
        enableDayGroupSuggestions: true,
        enableDayGroupPositionRotation: true,

        // Feedback defaults
        showUndoRedoToasts: true,

        // FEATURE-1194: Auto-updater defaults
        autoUpdateEnabled: false,

        // FEATURE-1317: AI Work Profile learning (default: on)
        aiLearningEnabled: true,

        // TASK-1500: Smart AI model routing defaults
        aiSmartRouting: _persisted?.aiSmartRouting ?? false,
        aiPremiumModel: _persisted?.aiPremiumModel ?? 'anthropic/claude-sonnet-4-6',
        aiMonthlyBudgetCents: _persisted?.aiMonthlyBudgetCents ?? 500,
        weeklyPlanProvider: _persisted?.weeklyPlanProvider ?? 'auto',
        weeklyPlanModel: _persisted?.weeklyPlanModel ?? '',

        // TASK-1219: Time block notification defaults
        timeBlockNotifications: { ...DEFAULT_TIME_BLOCK_NOTIFICATION_SETTINGS },

        // TASK-1338: Push notification defaults
        pushNotifications: { ...DEFAULT_PUSH_NOTIFICATION_PREFERENCES },

        // TASK-1317: External calendar defaults
        externalCalendars: [],
        externalCalendarSyncInterval: 30,

        // TASK-1283: Google integration defaults (FEATURE-1414: renamed from googleCalendarToken/etc)
        googleProviderToken: '',
        googleProviderRefreshToken: '',
        googleProviderTokenExpiry: 0,
        googleConnected: false,
        googleCalendars: [],
        showGoogleCalendarEvents: true,

        // TASK-1350: AI Setup defaults (BYOK Groq + first-time wizard)
        groqApiKey: '',
        aiSetupComplete: false,
        aiPreferredProvider: 'auto' as 'auto' | 'groq' | 'ollama' | 'openrouter',

        // TASK-1814: subscription brain on by default; Claude is the default brain
        aiUseSubscription: _persisted?.aiUseSubscription ?? true,
        aiBrain: (_persisted?.aiBrain ?? 'claude') as 'claude' | 'codex',
        voiceTranscriptionProvider: (_persisted?.voiceTranscriptionProvider ?? 'auto') as TranscriptionProviderId,
        voiceTranscriptionLanguage: (_persisted?.voiceTranscriptionLanguage ?? 'auto') as 'auto' | 'he' | 'en',
        androidGemmaModelPath: _persisted?.androidGemmaModelPath ?? '',

        // FEATURE-1162: Saved Views defaults
        savedViews: [],

        // Miscellaneous defaults
        sidebarCollapsed: false,
        kanbanSettings: {},
        canvasViewport: null,

        // Spread persisted values last — overrides defaults with saved state
        ...(_persisted || {})
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
                    // TASK-1338: Backfill push notification preferences
                    if (!this.$state.pushNotifications) {
                        this.$state.pushNotifications = JSON.parse(JSON.stringify(DEFAULT_PUSH_NOTIFICATION_PREFERENCES))
                    }
                    // TASK-1283 / FEATURE-1414: Backfill Google integration fields
                    //   (renamed from googleCalendarToken/etc to googleProviderToken/etc)
                    if (this.$state.googleProviderToken === undefined) {
                        this.$state.googleProviderToken = ''
                    }
                    if (this.$state.googleProviderRefreshToken === undefined) {
                        this.$state.googleProviderRefreshToken = ''
                    }
                    if (this.$state.googleConnected === undefined) {
                        this.$state.googleConnected = false
                    }
                    if (!this.$state.googleCalendars) {
                        this.$state.googleCalendars = []
                    }
                    if (this.$state.showGoogleCalendarEvents === undefined) {
                        this.$state.showGoogleCalendarEvents = true
                    }
                    if (this.$state.googleProviderTokenExpiry === undefined) {
                        this.$state.googleProviderTokenExpiry = 0
                    }
                    // FEATURE-1414: Migrate calendar-specific token keys to generic Google provider keys
                    // One-time migration: copy old keys to new keys then remove old keys
                    if ((this.$state as unknown as Record<string, unknown>).googleCalendarToken !== undefined && this.$state.googleProviderToken === '') {
                        this.$state.googleProviderToken = (this.$state as unknown as Record<string, unknown>).googleCalendarToken as string || ''
                        this.$state.googleProviderRefreshToken = (this.$state as unknown as Record<string, unknown>).googleCalendarRefreshToken as string || ''
                        this.$state.googleProviderTokenExpiry = (this.$state as unknown as Record<string, unknown>).googleCalendarTokenExpiry as number || 0
                        this.$state.googleConnected = (this.$state as unknown as Record<string, unknown>).googleCalendarConnected as boolean || false
                        // Remove old keys from persisted state
                        delete (this.$state as unknown as Record<string, unknown>).googleCalendarToken
                        delete (this.$state as unknown as Record<string, unknown>).googleCalendarRefreshToken
                        delete (this.$state as unknown as Record<string, unknown>).googleCalendarTokenExpiry
                        delete (this.$state as unknown as Record<string, unknown>).googleCalendarConnected
                        try { this.saveToStorage() } catch (_) { /* non-fatal */ }
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
                    // TASK-1814: Backfill subscription brain fields
                    if (this.$state.aiUseSubscription === undefined) {
                        this.$state.aiUseSubscription = true
                    }
                    if (this.$state.aiBrain === undefined) {
                        this.$state.aiBrain = 'claude'
                    }
                    if (this.$state.voiceTranscriptionProvider === undefined) {
                        this.$state.voiceTranscriptionProvider = 'auto'
                    }
                    if (this.$state.voiceTranscriptionLanguage === undefined) {
                        this.$state.voiceTranscriptionLanguage = 'auto'
                    }
                    if (this.$state.androidGemmaModelPath === undefined) {
                        this.$state.androidGemmaModelPath = ''
                    }
                    // Backfill day group position rotation
                    if (this.$state.enableDayGroupPositionRotation === undefined) {
                        this.$state.enableDayGroupPositionRotation = true
                    }
                    // FEATURE-1162: Backfill savedViews
                    if (!this.$state.savedViews) {
                        this.$state.savedViews = []
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
        },

        // FEATURE-1162: Saved Views CRUD
        addSavedView(view: SavedView) {
            if (!this.$state.savedViews) this.$state.savedViews = []
            this.$state.savedViews.push(view)
            this.saveToStorage()
        },

        updateSavedView(id: string, updates: Partial<SavedView>) {
            if (!this.$state.savedViews) return
            const idx = this.$state.savedViews.findIndex(v => v.id === id)
            if (idx !== -1) {
                this.$state.savedViews[idx] = {
                    ...this.$state.savedViews[idx],
                    ...updates,
                    updatedAt: new Date().toISOString()
                }
                this.saveToStorage()
            }
        },

        deleteSavedView(id: string) {
            if (!this.$state.savedViews) return
            this.$state.savedViews = this.$state.savedViews.filter(v => v.id !== id)
            this.saveToStorage()
        }
    }
})
