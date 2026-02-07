import { defineStore } from 'pinia'
// TASK-1215: Tauri dual-write for settings persistence
import { getTauriStore, isTauriEnv, scheduleTauriSave } from '@/composables/usePersistentRef'

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

    // Miscellaneous UI State (Persisted)
    sidebarCollapsed?: boolean
    kanbanSettings?: Record<string, unknown>
    canvasViewport?: { x: number; y: number; zoom: number } | null
}

const STORAGE_KEY = 'flow-state-settings-v2'

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

        // Miscellaneous defaults
        sidebarCollapsed: false,
        kanbanSettings: {},
        canvasViewport: null
    }),

    actions: {
        loadFromStorage() {
            // Try new key first
            const saved = localStorage.getItem(STORAGE_KEY)

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
        },

        updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
            this.$state[key] = value
            this.saveToStorage()
        }
    }
})
