<script setup lang="ts">
import { useSettingsStore } from '@/stores/settings'
import { useTimerStore } from '@/stores/timer'
import SettingsSection from '../SettingsSection.vue'
import SettingsToggle from '../SettingsToggle.vue'
import LanguageSettings from '../LanguageSettings.vue'

const settingsStore = useSettingsStore()
const timerStore = useTimerStore()

const updateSoundEffects = (value: boolean) => {
  settingsStore.updateSetting('playNotificationSounds', value)
  timerStore.settings.playNotificationSounds = value
}
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
