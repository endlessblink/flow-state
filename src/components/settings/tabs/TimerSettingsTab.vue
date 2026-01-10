<script setup lang="ts">
import { useSettingsStore } from '@/stores/settings'
import { useTimerStore } from '@/stores/timer'
import SettingsSection from '../SettingsSection.vue'
import SettingsDurationPicker from '../SettingsDurationPicker.vue'
import SettingsToggle from '../SettingsToggle.vue'

const settingsStore = useSettingsStore()
const timerStore = useTimerStore()

const workDurations = [15, 20, 25, 30]
const shortBreakDurations = [3, 5, 10]
const longBreakDurations = [10, 15, 20]

const updateWorkDuration = (minutes: number) => {
  settingsStore.updateSetting('workDuration', minutes * 60)
  // Sync with timerStore directly for immediate effect
  timerStore.settings.workDuration = minutes * 60
}

const updateShortBreak = (minutes: number) => {
  settingsStore.updateSetting('shortBreakDuration', minutes * 60)
  timerStore.settings.shortBreakDuration = minutes * 60
}

const updateLongBreak = (minutes: number) => {
  settingsStore.updateSetting('longBreakDuration', minutes * 60)
  timerStore.settings.longBreakDuration = minutes * 60
}

const updateAutoStartBreaks = (value: boolean) => {
  settingsStore.updateSetting('autoStartBreaks', value)
  timerStore.settings.autoStartBreaks = value
}

const updateAutoStartPomodoros = (value: boolean) => {
  settingsStore.updateSetting('autoStartPomodoros', value)
  timerStore.settings.autoStartPomodoros = value
}
</script>

<template>
  <div class="timer-settings-tab">
    <SettingsSection title="🍅 Pomodoro Settings">
      <SettingsDurationPicker
        label="Work Duration"
        :options="workDurations"
        :value="settingsStore.workDuration / 60"
        @update="updateWorkDuration"
      />

      <SettingsDurationPicker
        label="Short Break"
        :options="shortBreakDurations"
        :value="settingsStore.shortBreakDuration / 60"
        @update="updateShortBreak"
      />

      <SettingsDurationPicker
        label="Long Break"
        :options="longBreakDurations"
        :value="settingsStore.longBreakDuration / 60"
        @update="updateLongBreak"
      />

      <SettingsToggle
        label="Auto-start breaks"
        :value="settingsStore.autoStartBreaks"
        @update="updateAutoStartBreaks"
      />

      <SettingsToggle
        label="Auto-start work sessions"
        :value="settingsStore.autoStartPomodoros"
        @update="updateAutoStartPomodoros"
      />
    </SettingsSection>
  </div>
</template>

<style scoped>
.timer-settings-tab {
  display: flex;
  flex-direction: column;
}
</style>
