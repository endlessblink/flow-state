import { ref } from 'vue'
import type { useUIStore } from '@/stores/ui'
import type { useSupabaseDatabase } from '@/composables/useSupabaseDatabaseV2'

interface BoardDensityDependencies {
    uiStore: ReturnType<typeof useUIStore>
    supabaseDb: ReturnType<typeof useSupabaseDatabase>
}

interface KanbanSettings {
    showDoneColumn: boolean
}

export function useBoardDensity(deps: BoardDensityDependencies) {
    const { uiStore, supabaseDb } = deps
    const showDoneColumn = ref(false)

    const toggleDoneColumn = async () => {
        showDoneColumn.value = !showDoneColumn.value
        await saveSettings()

        // Emit custom event to keep other components in sync if needed
        window.dispatchEvent(new CustomEvent('kanban-settings-changed', {
            detail: { showDoneColumn: showDoneColumn.value }
        }))
    }

    const saveSettings = async () => {
        const kanbanSettings: KanbanSettings = {
            showDoneColumn: showDoneColumn.value
        }

        // Always save to localStorage first
        localStorage.setItem('pomo-flow-kanban-settings', JSON.stringify(kanbanSettings))

        try {
            const currentSettings = await supabaseDb.fetchUserSettings() || {}
            await supabaseDb.saveUserSettings({
                ...currentSettings,
                kanban_settings: kanbanSettings
            })
        } catch (error) {
            // Failed to save to Supabase
        }
    }

    const loadSettings = async () => {
        // Load from localStorage first
        try {
            const localSaved = localStorage.getItem('pomo-flow-kanban-settings')
            if (localSaved) {
                const settings = JSON.parse(localSaved)
                showDoneColumn.value = settings.showDoneColumn || false
            }
        } catch (e) {
            // Failed to load from localStorage
        }

        // Then load from Supabase
        try {
            const settings = await supabaseDb.fetchUserSettings()
            if (settings?.kanban_settings) {
                const kanban = settings.kanban_settings as KanbanSettings
                showDoneColumn.value = kanban.showDoneColumn || false
            }
        } catch (error) {
            // Failed to load from Supabase
        }
    }

    const handleSettingsChange = (event: Event) => {
        const customEvent = event as CustomEvent
        if (customEvent.detail && typeof customEvent.detail.showDoneColumn === 'boolean') {
            showDoneColumn.value = customEvent.detail.showDoneColumn
        }
    }

    return {
        showDoneColumn,
        toggleDoneColumn,
        saveSettings,
        loadSettings,
        handleSettingsChange
    }
}
