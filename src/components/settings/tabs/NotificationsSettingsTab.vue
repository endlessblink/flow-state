<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import SettingsSection from '../SettingsSection.vue'
import SettingsToggle from '../SettingsToggle.vue'
import type { TimeBlockNotificationSettings } from '@/types/timeBlockNotifications'

const settingsStore = useSettingsStore()

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
</script>

<template>
  <div class="notifications-settings-tab">
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
  </div>
</template>

<style scoped>
.notifications-settings-tab {
  display: flex;
  flex-direction: column;
}

.sub-settings-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-left: var(--space-2);
  border-left: 2px solid var(--glass-border);
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
</style>
