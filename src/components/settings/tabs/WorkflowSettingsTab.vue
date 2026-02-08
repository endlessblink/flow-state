<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import SettingsSection from '../SettingsSection.vue'
import SettingsToggle from '../SettingsToggle.vue'
import SettingsOptionPicker from '../SettingsOptionPicker.vue'
import type { TimeBlockNotificationSettings, TimeBlockMilestone } from '@/types/timeBlockNotifications'

const settingsStore = useSettingsStore()

// TASK-1219: Time block notification helpers
const timeBlockSettings = computed(() => settingsStore.timeBlockNotifications)

function updateTimeBlockEnabled(val: boolean) {
  settingsStore.updateSetting('timeBlockNotifications', {
    ...settingsStore.timeBlockNotifications,
    enabled: val
  })
}

function updateMilestoneEnabled(milestoneId: string, val: boolean) {
  const updated = {
    ...settingsStore.timeBlockNotifications,
    milestones: settingsStore.timeBlockNotifications.milestones.map(m =>
      m.id === milestoneId ? { ...m, enabled: val } : m
    )
  }
  settingsStore.updateSetting('timeBlockNotifications', updated)
}

function updateDeliveryChannel(channel: keyof TimeBlockNotificationSettings['deliveryChannels'], val: boolean) {
  settingsStore.updateSetting('timeBlockNotifications', {
    ...settingsStore.timeBlockNotifications,
    deliveryChannels: {
      ...settingsStore.timeBlockNotifications.deliveryChannels,
      [channel]: val
    }
  })
}

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

const intensityOptions = [
  {
    value: 'minimal' as const,
    label: 'Minimal',
    description: 'Level badge only. No notifications or effects.',
    accent: 'var(--text-muted)'
  },
  {
    value: 'moderate' as const,
    label: 'Moderate',
    description: 'XP bar, streak, notifications. Cyberflow page accessible.',
    accent: 'var(--state-active-border)'
  },
  {
    value: 'intense' as const,
    label: 'Intense',
    description: 'Full RPG experience. Glitch effects, corruption overlay, all notifications.',
    accent: 'rgba(200, 100, 255, 0.7)'
  }
]

const isGamificationEnabled = computed(() => settingsStore.gamificationEnabled)
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

    <SettingsSection title="💬 Feedback">
      <SettingsToggle
        label="Show undo/redo notifications"
        description="Display a brief toast when you undo (Ctrl+Z) or redo (Ctrl+Y) an action."
        :value="settingsStore.showUndoRedoToasts"
        @update="val => settingsStore.updateSetting('showUndoRedoToasts', val)"
      />
    </SettingsSection>

    <SettingsSection title="Calendar Time Block Alerts">
      <SettingsToggle
        label="Enable time block alerts"
        description="Get notified when calendar time blocks reach milestones (halfway, ending soon, ended)."
        :value="timeBlockSettings.enabled"
        @update="updateTimeBlockEnabled"
      />

      <template v-if="timeBlockSettings.enabled">
        <div class="sub-settings-group">
          <div class="setting-header">
            <label class="setting-label">Milestones</label>
            <p class="setting-description">Choose which progress points trigger alerts.</p>
          </div>

          <SettingsToggle
            v-for="milestone in timeBlockSettings.milestones"
            :key="milestone.id"
            :label="milestone.label"
            :value="milestone.enabled"
            @update="val => updateMilestoneEnabled(milestone.id, val)"
          />
        </div>

        <div class="sub-settings-group">
          <div class="setting-header">
            <label class="setting-label">Delivery Channels</label>
            <p class="setting-description">How you receive time block alerts.</p>
          </div>

          <SettingsToggle
            label="In-app toast"
            description="Show a toast notification inside FlowState."
            :value="timeBlockSettings.deliveryChannels.inAppToast"
            @update="val => updateDeliveryChannel('inAppToast', val)"
          />
          <SettingsToggle
            label="System notification"
            description="Show an OS-level notification (requires permission)."
            :value="timeBlockSettings.deliveryChannels.osNotification"
            @update="val => updateDeliveryChannel('osNotification', val)"
          />
          <SettingsToggle
            label="Sound"
            description="Play a sound with system notifications."
            :value="timeBlockSettings.deliveryChannels.sound"
            @update="val => updateDeliveryChannel('sound', val)"
          />
        </div>
      </template>
    </SettingsSection>

    <SettingsSection title="Gamification">
      <SettingsToggle
        label="Enable gamification"
        description="Earn XP, level up, and track achievements as you complete tasks."
        :value="settingsStore.gamificationEnabled"
        @update="val => settingsStore.updateSetting('gamificationEnabled', val)"
      />

      <div v-if="isGamificationEnabled" class="intensity-selector">
        <div class="setting-header">
          <label class="setting-label">Intensity Level</label>
          <p class="setting-description">
            Control how much gamification you see across the app.
          </p>
        </div>

        <div class="intensity-cards">
          <button
            v-for="option in intensityOptions"
            :key="option.value"
            class="intensity-card"
            :class="{ active: settingsStore.gamificationIntensity === option.value }"
            :style="{ '--card-accent': option.accent }"
            @click="settingsStore.updateSetting('gamificationIntensity', option.value)"
          >
            <div class="intensity-card-header">
              <span class="intensity-card-title">{{ option.label }}</span>
              <span
                v-if="option.value === 'moderate'"
                class="intensity-default-badge"
              >default</span>
            </div>
            <p class="intensity-card-desc">{{ option.description }}</p>
          </button>
        </div>
      </div>
    </SettingsSection>
  </div>
</template>

<style scoped>
.workflow-settings-tab {
  display: flex;
  flex-direction: column;
}

/* TASK-1219: Sub-settings group for nested toggles */
.sub-settings-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-left: var(--space-2);
  border-left: 2px solid var(--glass-border);
}

/* Intensity selector */
.intensity-selector {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.setting-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.setting-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.setting-description {
  font-size: var(--text-xs);
  color: var(--text-muted);
  line-height: 1.4;
  margin: 0;
}

.intensity-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.intensity-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-left: 3px solid var(--card-accent, var(--glass-border));
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  text-align: left;
  color: var(--text-secondary);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.intensity-card:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-medium);
  border-left-color: var(--card-accent, var(--glass-border-medium));
  color: var(--text-primary);
  transform: translateY(-1px);
}

.intensity-card.active {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--card-accent, var(--state-active-border));
  border-left-color: var(--card-accent, var(--state-active-border));
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}

.intensity-card-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.intensity-card-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
}

.intensity-default-badge {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-muted);
  background: var(--glass-bg-soft);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 1px var(--space-1_5);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.intensity-card-desc {
  font-size: var(--text-xs);
  color: var(--text-muted);
  line-height: 1.4;
  margin: 0;
}

.intensity-card.active .intensity-card-desc {
  color: var(--text-secondary);
}
</style>
