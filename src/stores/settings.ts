import { defineStore } from 'pinia'

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
}

const STORAGE_KEY = 'pomo-flow-settings-v2'

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
        theme: 'system'
    }),

    actions: {
        loadFromStorage() {
            // Try new key first
            const saved = localStorage.getItem(STORAGE_KEY)

            if (!saved) {
                // Migration from old keys
                const oldTimerSettings = localStorage.getItem('pomo-flow-settings')
                const oldKanbanSettings = localStorage.getItem('pomo-flow-kanban-settings')
                const oldUiState = localStorage.getItem('pomo-flow-ui-state')
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
                    localStorage.removeItem('pomo-flow-settings')
                    localStorage.removeItem('pomo-flow-kanban-settings')
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
        },

        updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
            this.$state[key] = value
            this.saveToStorage()
        }
    }
})
