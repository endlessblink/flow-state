<script setup lang="ts">
import { useSettingsStore } from '@/stores/settings'
import { useTimerStore } from '@/stores/timer'
import SettingsSection from '../SettingsSection.vue'
import SettingsToggle from '../SettingsToggle.vue'
import SettingsOptionPicker from '../SettingsOptionPicker.vue'
import LanguageSettings from '../LanguageSettings.vue'

const settingsStore = useSettingsStore()
const timerStore = useTimerStore()

const updateSoundEffects = (value: boolean) => {
  settingsStore.updateSetting('playNotificationSounds', value)
  timerStore.settings.playNotificationSounds = value
}

const weekStartOptions = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
]
</script>

<template>
  <div class="appearance-settings-tab">
    <SettingsSection title="🎨 Interface Settings">
      <SettingsToggle
        label="Sound effects"
        :value="settingsStore.playNotificationSounds"
        @update="updateSoundEffects"
      />

      <div class="setting-action">
        <button class="test-sound-btn" @click="timerStore.playStartSound">
          🔊 Test start sound
        </button>
        <button class="test-sound-btn" @click="timerStore.playEndSound">
          🔔 Test end sound
        </button>
      </div>
    </SettingsSection>

    <SettingsSection title="🌍 Language & Region">
      <LanguageSettings />
    </SettingsSection>

    <SettingsSection title="Calendar">
      <SettingsOptionPicker
        label="Start of Week"
        description="Choose which day your week starts on. Affects calendar, weekly plan, and all day-of-week ordering."
        :options="weekStartOptions"
        :value="settingsStore.weekStartsOn"
        @update="val => settingsStore.updateSetting('weekStartsOn', val)"
      />
    </SettingsSection>

    <SettingsSection title="Feedback">
      <SettingsToggle
        label="Show undo/redo notifications"
        description="Display a brief toast when you undo (Ctrl+Z) or redo (Ctrl+Y) an action."
        :value="settingsStore.showUndoRedoToasts"
        @update="val => settingsStore.updateSetting('showUndoRedoToasts', val)"
      />
    </SettingsSection>
  </div>
</template>

<style scoped>
.appearance-settings-tab {
  display: flex;
  flex-direction: column;
}

.setting-action {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.test-sound-btn {
  flex: 1;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.test-sound-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
  transform: translateY(-1px);
}
</style>
