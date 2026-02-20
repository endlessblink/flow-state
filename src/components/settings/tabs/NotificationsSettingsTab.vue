<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { usePushSubscription } from '@/composables/usePushSubscription'
import SettingsSection from '../SettingsSection.vue'
import SettingsToggle from '../SettingsToggle.vue'
import SettingsOptionPicker from '../SettingsOptionPicker.vue'
import type { TimeBlockNotificationSettings } from '@/types/timeBlockNotifications'
import type { NotificationCategoryConfig } from '@/types/pushNotifications'

const settingsStore = useSettingsStore()
const { isSubscribed, subscribe, canUsePush } = usePushSubscription()

const timeBlockSettings = computed(() => settingsStore.timeBlockNotifications)
const pushSettings = computed(() => settingsStore.pushNotifications)

const isTauri = ref(!!(window as any).__TAURI_INTERNALS__)

// Push notification settings helpers
function updatePushMasterToggle(val: boolean) {
  settingsStore.updateSetting('pushNotifications', {
    ...settingsStore.pushNotifications,
    enabled: val
  })
}

function updateCategoryToggle(category: keyof typeof pushSettings.value.categories, val: boolean) {
  settingsStore.updateSetting('pushNotifications', {
    ...settingsStore.pushNotifications,
    categories: {
      ...settingsStore.pushNotifications.categories,
      [category]: {
        ...settingsStore.pushNotifications.categories[category],
        enabled: val
      }
    }
  })
}

function updateCategoryChannel(
  category: keyof typeof pushSettings.value.categories,
  channel: keyof NotificationCategoryConfig,
  val: boolean
) {
  if (channel === 'enabled') return // Use updateCategoryToggle for enabled

  settingsStore.updateSetting('pushNotifications', {
    ...settingsStore.pushNotifications,
    categories: {
      ...settingsStore.pushNotifications.categories,
      [category]: {
        ...settingsStore.pushNotifications.categories[category],
        [channel]: val
      }
    }
  })
}

function updateQuietHoursEnabled(val: boolean) {
  settingsStore.updateSetting('pushNotifications', {
    ...settingsStore.pushNotifications,
    quietHours: {
      ...settingsStore.pushNotifications.quietHours,
      enabled: val
    }
  })
}

function updateQuietHoursStart(val: number) {
  settingsStore.updateSetting('pushNotifications', {
    ...settingsStore.pushNotifications,
    quietHours: {
      ...settingsStore.pushNotifications.quietHours,
      startHour: val
    }
  })
}

function updateQuietHoursEnd(val: number) {
  settingsStore.updateSetting('pushNotifications', {
    ...settingsStore.pushNotifications,
    quietHours: {
      ...settingsStore.pushNotifications.quietHours,
      endHour: val
    }
  })
}

function updateCooldown(val: number) {
  settingsStore.updateSetting('pushNotifications', {
    ...settingsStore.pushNotifications,
    cooldownMinutes: val
  })
}

function updateDailyDigestHour(val: number) {
  settingsStore.updateSetting('pushNotifications', {
    ...settingsStore.pushNotifications,
    dailyDigestHour: val
  })
}

function toggleLeadTime(minutes: number) {
  const current = settingsStore.pushNotifications.taskReminderLeadTimes
  const hasIt = current.includes(minutes)

  const updated = hasIt
    ? current.filter(m => m !== minutes)
    : [...current, minutes].sort((a, b) => a - b)

  settingsStore.updateSetting('pushNotifications', {
    ...settingsStore.pushNotifications,
    taskReminderLeadTimes: updated
  })
}

// Time block settings helpers (existing)
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

// Option arrays
const hourOptions = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i.toString().padStart(2, '0')}:00`
}))

const cooldownOptions = [
  { value: 1, label: '1 min' },
  { value: 5, label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' }
]

const digestHourOptions = [
  { value: 6, label: '6:00 AM' },
  { value: 7, label: '7:00 AM' },
  { value: 8, label: '8:00 AM' },
  { value: 9, label: '9:00 AM' },
  { value: 10, label: '10:00 AM' }
]

const categories = [
  {
    key: 'taskReminders' as const,
    label: 'Task Reminders',
    description: 'Get notified before tasks are due'
  },
  {
    key: 'dailyDigest' as const,
    label: 'Daily Planning Nudge',
    description: 'Start your day with a summary of upcoming tasks'
  },
  {
    key: 'overdueAlerts' as const,
    label: 'Overdue Alerts',
    description: 'Be reminded about tasks past their due date'
  },
  {
    key: 'achievements' as const,
    label: 'Achievement Alerts',
    description: 'Celebrate when you earn XP or unlock achievements'
  }
]

const permissionDenied = computed(() => {
  if (!canUsePush.value || isTauri.value) return false
  return Notification.permission === 'denied'
})

async function handleSubscribe() {
  await subscribe()
}
</script>

<template>
  <div class="notifications-settings-tab">
    <!-- Section 1: Push Notifications -->
    <SettingsSection title="Push Notifications">
      <SettingsToggle
        label="Enable push notifications"
        description="Get notified about tasks, reminders, and updates even when the browser is closed."
        :value="pushSettings.enabled"
        @update="updatePushMasterToggle"
      />

      <!-- Status Chip -->
      <div v-if="pushSettings.enabled" class="push-status">
        <div v-if="isTauri" class="status-info-note">
          <span class="info-icon">ℹ️</span>
          <p>Push notifications are not available in the desktop app. OS notifications are used instead.</p>
        </div>
        <div v-else-if="permissionDenied" class="status-warning">
          <span class="warning-icon">⚠️</span>
          <p>Browser notification permission was denied. Please enable it in your browser settings to use push notifications.</p>
        </div>
        <div v-else-if="isSubscribed" class="status-chip subscribed">
          <span class="status-indicator" />
          <span>Subscribed</span>
        </div>
        <button v-else-if="!isSubscribed" class="subscribe-btn" @click="handleSubscribe">
          Subscribe to Push Notifications
        </button>
      </div>

      <!-- Per-Category Toggles -->
      <template v-if="pushSettings.enabled">
        <div class="sub-settings-group">
          <div class="setting-header">
            <label class="setting-label">Notification Categories</label>
            <p class="setting-description">
              Choose which types of notifications you want to receive and how.
            </p>
          </div>

          <div
            v-for="category in categories"
            :key="category.key"
            class="category-card"
          >
            <div class="category-header">
              <div class="category-info">
                <span class="category-label">{{ category.label }}</span>
                <p class="category-description">
                  {{ category.description }}
                </p>
              </div>
              <div class="category-toggle">
                <input
                  :id="`category-${category.key}`"
                  type="checkbox"
                  :checked="pushSettings.categories[category.key].enabled"
                  @change="updateCategoryToggle(category.key, ($event.target as HTMLInputElement).checked)"
                >
                <span class="toggle-slider" />
              </div>
            </div>

            <div v-if="pushSettings.categories[category.key].enabled" class="category-channels">
              <label class="channel-checkbox">
                <input
                  type="checkbox"
                  :checked="pushSettings.categories[category.key].inApp"
                  @change="updateCategoryChannel(category.key, 'inApp', ($event.target as HTMLInputElement).checked)"
                >
                <span class="checkbox-custom" />
                <span class="channel-label">In-app</span>
              </label>
              <label class="channel-checkbox">
                <input
                  type="checkbox"
                  :checked="pushSettings.categories[category.key].webPush"
                  :disabled="isTauri"
                  @change="updateCategoryChannel(category.key, 'webPush', ($event.target as HTMLInputElement).checked)"
                >
                <span class="checkbox-custom" />
                <span class="channel-label">Web push</span>
              </label>
            </div>
          </div>
        </div>
      </template>
    </SettingsSection>

    <!-- Section 2: Notification Timing -->
    <SettingsSection v-if="pushSettings.enabled" title="Notification Timing">
      <SettingsToggle
        label="Quiet hours"
        description="Pause notifications during specified hours."
        :value="pushSettings.quietHours.enabled"
        @update="updateQuietHoursEnabled"
      />

      <template v-if="pushSettings.quietHours.enabled">
        <div class="sub-settings-group">
          <SettingsOptionPicker
            label="Start time"
            description="When quiet hours begin."
            :options="hourOptions"
            :value="pushSettings.quietHours.startHour"
            @update="updateQuietHoursStart"
          />

          <SettingsOptionPicker
            label="End time"
            description="When quiet hours end."
            :options="hourOptions"
            :value="pushSettings.quietHours.endHour"
            @update="updateQuietHoursEnd"
          />
        </div>
      </template>

      <SettingsOptionPicker
        label="Notification cooldown"
        description="Minimum time between notifications of the same type."
        :options="cooldownOptions"
        :value="pushSettings.cooldownMinutes"
        @update="updateCooldown"
      />

      <SettingsOptionPicker
        label="Daily digest time"
        description="When to send your daily task summary."
        :options="digestHourOptions"
        :value="pushSettings.dailyDigestHour"
        @update="updateDailyDigestHour"
      />

      <div class="setting-group">
        <div class="setting-header">
          <label class="setting-label">Task reminder lead times</label>
          <p class="setting-description">
            How far in advance to notify you before tasks are due.
          </p>
        </div>

        <div class="lead-times">
          <label class="lead-time-checkbox">
            <input
              type="checkbox"
              :checked="pushSettings.taskReminderLeadTimes.includes(15)"
              @change="toggleLeadTime(15)"
            >
            <span class="checkbox-custom" />
            <span class="lead-time-label">15 minutes before</span>
          </label>
          <label class="lead-time-checkbox">
            <input
              type="checkbox"
              :checked="pushSettings.taskReminderLeadTimes.includes(60)"
              @change="toggleLeadTime(60)"
            >
            <span class="checkbox-custom" />
            <span class="lead-time-label">1 hour before</span>
          </label>
          <label class="lead-time-checkbox">
            <input
              type="checkbox"
              :checked="pushSettings.taskReminderLeadTimes.includes(1440)"
              @change="toggleLeadTime(1440)"
            >
            <span class="checkbox-custom" />
            <span class="lead-time-label">1 day before</span>
          </label>
        </div>
      </div>
    </SettingsSection>

    <!-- Section 3: Calendar Time Block Alerts (existing, unchanged) -->
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
            <p class="setting-description">
              Choose which progress points trigger alerts.
            </p>
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
            <p class="setting-description">
              How you receive time block alerts.
            </p>
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

.setting-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Push Status */
.push-status {
  margin-top: var(--space-2);
}

.status-info-note {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  backdrop-filter: blur(8px);
}

.info-icon {
  font-size: var(--text-lg);
  flex-shrink: 0;
}

.status-info-note p {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: 0;
  line-height: 1.4;
}

.status-warning {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-md);
  backdrop-filter: blur(8px);
}

.warning-icon {
  font-size: var(--text-lg);
  flex-shrink: 0;
}

.status-warning p {
  font-size: var(--text-xs);
  color: var(--color-warning);
  margin: 0;
  line-height: 1.4;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  backdrop-filter: blur(8px);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.status-chip.subscribed {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--brand-primary);
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.subscribe-btn {
  background: var(--glass-bg-soft);
  border: 1px solid var(--brand-primary);
  color: var(--brand-primary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  backdrop-filter: blur(8px);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.subscribe-btn:hover {
  background: var(--glass-bg-medium);
  border-color: var(--brand-primary-hover);
  color: var(--brand-primary-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

/* Category Cards */
.category-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  backdrop-filter: blur(8px);
}

.category-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.category-info {
  flex: 1;
}

.category-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  display: block;
}

.category-description {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: var(--space-1) 0 0 0;
  line-height: 1.4;
}

.category-toggle {
  position: relative;
  flex-shrink: 0;
}

.category-toggle input {
  display: none;
}

.toggle-slider {
  display: block;
  width: 2.5rem;
  height: 1.25rem;
  background: var(--glass-bg-heavy);
  border-radius: var(--radius-full);
  position: relative;
  transition: all var(--duration-normal) var(--spring-smooth);
  cursor: pointer;
}

.toggle-slider::after {
  content: '';
  position: absolute;
  top: var(--space-0_5);
  left: var(--space-0_5);
  width: 1rem;
  height: 1rem;
  background: var(--text-primary);
  border-radius: var(--radius-full);
  transition: all var(--duration-normal) var(--spring-bounce);
  box-shadow: var(--shadow-sm);
}

.category-toggle input:checked + .toggle-slider {
  background: var(--state-active-bg);
}

.category-toggle input:checked + .toggle-slider::after {
  left: calc(100% - 1.125rem);
}

.toggle-slider:hover {
  background: var(--glass-bg-tint);
}

.category-toggle input:checked + .toggle-slider:hover {
  background: var(--state-active-bg);
  opacity: 0.9;
}

.category-channels {
  display: flex;
  gap: var(--space-4);
  padding-left: var(--space-2);
}

.channel-checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.channel-checkbox input {
  display: none;
}

.checkbox-custom {
  width: 16px;
  height: 16px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.channel-checkbox input:checked + .checkbox-custom {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
}

.channel-checkbox input:checked + .checkbox-custom::after {
  content: '✓';
  color: var(--bg-primary);
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
}

.channel-checkbox:hover .checkbox-custom {
  border-color: var(--brand-primary);
}

.channel-checkbox input:disabled + .checkbox-custom {
  opacity: 0.4;
  cursor: not-allowed;
}

.channel-checkbox input:disabled ~ .channel-label {
  opacity: 0.4;
  cursor: not-allowed;
}

.channel-label {
  user-select: none;
}

/* Lead Times */
.lead-times {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.lead-time-checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.lead-time-checkbox input {
  display: none;
}

.lead-time-checkbox .checkbox-custom {
  width: 18px;
  height: 18px;
}

.lead-time-label {
  user-select: none;
}
</style>
