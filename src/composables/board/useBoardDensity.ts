import { computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'

export function useBoardDensity() {
    const settingsStore = useSettingsStore()

    // Reactive source of truth from settings store
    const showDoneColumn = computed(() => settingsStore.showDoneColumn)

    const toggleDoneColumn = () => {
        settingsStore.updateSetting('showDoneColumn', !settingsStore.showDoneColumn)
    }

    // These are now handled by settingsStore.loadFromStorage() in app init or store init
    const loadSettings = async () => {
        // No-op for compatibility if needed, or remove
    }

    const handleSettingsChange = () => {
        // No-op for compatibility, logic removed in favor of Pinia reactivity
    }

    return {
        showDoneColumn,
        toggleDoneColumn,
        loadSettings,
        handleSettingsChange
    }
}
