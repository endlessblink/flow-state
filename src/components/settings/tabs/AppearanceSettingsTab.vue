<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import { useTimerStore } from '@/stores/timer'
import SettingsSection from '../SettingsSection.vue'
import SettingsToggle from '../SettingsToggle.vue'
import SettingsOptionPicker from '../SettingsOptionPicker.vue'
import LanguageSettings from '../LanguageSettings.vue'

const { t } = useI18n({ useScope: 'global' })
const settingsStore = useSettingsStore()
const timerStore = useTimerStore()

const updateSoundEffects = (value: boolean) => {
  settingsStore.updateSetting('playNotificationSounds', value)
  timerStore.settings.playNotificationSounds = value
}

const weekStartOptions = computed(() => [
  { value: 0, label: t('settings.sunday') },
  { value: 1, label: t('settings.monday') },
])
</script>

<template>
  <div class="appearance-settings-tab">
    <SettingsSection :title="`🎨 ${t('settings.interface_settings')}`">
      <SettingsToggle
        :label="t('settings.sound_effects')"
        :value="settingsStore.playNotificationSounds"
        @update="updateSoundEffects"
      />

      <div class="setting-action">
        <button class="test-sound-btn" @click="timerStore.playStartSound">
          🔊 {{ t('settings.test_start_sound') }}
        </button>
        <button class="test-sound-btn" @click="timerStore.playEndSound">
          🔔 {{ t('settings.test_end_sound') }}
        </button>
      </div>
    </SettingsSection>

    <SettingsSection :title="`🌍 ${t('settings.language_region')}`">
      <LanguageSettings />
    </SettingsSection>

    <SettingsSection :title="t('settings.calendar')">
      <SettingsOptionPicker
        :label="t('settings.start_of_week')"
        :description="t('settings.start_of_week_description')"
        :options="weekStartOptions"
        :value="settingsStore.weekStartsOn"
        @update="val => settingsStore.updateSetting('weekStartsOn', val)"
      />
    </SettingsSection>

    <SettingsSection :title="t('settings.feedback')">
      <SettingsToggle
        :label="t('settings.show_undo_redo')"
        :description="t('settings.show_undo_redo_description')"
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
