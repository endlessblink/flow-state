<script setup lang="ts">
import { useSettingsStore } from '@/stores/settings'
import SettingsSection from '../SettingsSection.vue'
import SettingsToggle from '../SettingsToggle.vue'
import SettingsOptionPicker from '../SettingsOptionPicker.vue'

const settingsStore = useSettingsStore()

const powerGroupModes = [
  { value: 'always', label: 'Always update' },
  { value: 'only_empty', label: 'Only if empty' },
  { value: 'ask', label: 'Ask each time' }
]

const boardDensities = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
  { value: 'ultrathin', label: 'Ultrathin' }
]


</script>

<template>
  <div class="workflow-settings-tab">
    <SettingsSection title="📋 Kanban Settings">
      <SettingsToggle
        label="Show 'Done' column"
        description="Hide the done column to reduce visual clutter and focus on active tasks."
        :value="settingsStore.showDoneColumn"
        @update="val => settingsStore.updateSetting('showDoneColumn', val)"
      />
      
      <SettingsOptionPicker
        label="Board Density"
        description="Adjust the vertical and horizontal spacing of cards."
        :options="boardDensities"
        :value="settingsStore.boardDensity"
        @update="val => settingsStore.updateSetting('boardDensity', val)"
      />
    </SettingsSection>

    <SettingsSection title="🎨 Canvas Settings">
      <SettingsOptionPicker
        label="Power Group Behavior"
        description="When dropping tasks on power groups (Today, High Priority, etc.)"
        :options="powerGroupModes"
        :value="settingsStore.powerGroupOverrideMode"
        @update="val => settingsStore.updateSetting('powerGroupOverrideMode', val)"
      />
    </SettingsSection>

    <SettingsSection title="⚡ Quick Sort">
      <SettingsToggle
        label="Smart defaults + Enter to save"
        description="Press Enter to save and advance. Untouched fields auto-fill: priority → Medium, due → Today, project → last used. Turn off to require explicit choices."
        :value="settingsStore.quickSortSmartDefaults"
        @update="val => settingsStore.updateSetting('quickSortSmartDefaults', val)"
      />
    </SettingsSection>

  </div>
</template>

<style scoped>
.workflow-settings-tab {
  display: flex;
  flex-direction: column;
}

</style>
