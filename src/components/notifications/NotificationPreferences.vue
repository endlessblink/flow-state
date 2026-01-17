<template>
  <div class="notification-preferences">
    <div class="pref-header">
      <h3 class="pref-title">
        Notifications
      </h3>
      <label class="toggle-container">
        <input
          v-model="preferences.isEnabled"
          type="checkbox"
          class="checkbox-input"
          @change="handleToggle"
        >
        <span class="toggle-label">
          Enable notifications
        </span>
      </label>
    </div>

    <div v-if="preferences.isEnabled" class="pref-body">
      <!-- Reminder Times -->
      <div class="pref-section">
        <label class="section-label">
          Remind me
        </label>
        <div class="checkbox-group">
          <label
            v-for="option in reminderOptions"
            :key="option.value"
            class="checkbox-item"
          >
            <input
              v-model="selectedReminderTimes"
              type="checkbox"
              :value="option.value"
              class="checkbox-input"
              @change="handleReminderTimesChange"
            >
            <span class="checkbox-label">
              {{ option.label }}
            </span>
          </label>
        </div>
      </div>

      <div class="pref-section">
        <label class="section-label">
          Notification channels
        </label>
        <div class="checkbox-group">
          <label class="checkbox-item">
            <input
              v-model="preferences.notificationChannels.browser"
              type="checkbox"
              class="checkbox-input"
              @change="handleChange"
            >
            <span class="checkbox-label">
              Browser notifications
            </span>
          </label>
          <label class="checkbox-item">
            <input
              v-model="preferences.notificationChannels.mobile"
              type="checkbox"
              class="checkbox-input"
              @change="handleChange"
            >
            <span class="checkbox-label">
              Mobile notifications
            </span>
          </label>
        </div>
      </div>

      <div class="pref-section">
        <label class="section-label">
          Sound
        </label>
        <label class="checkbox-item">
          <input
            v-model="preferences.soundEnabled"
            type="checkbox"
            class="checkbox-input"
            @change="handleChange"
          >
          <span class="checkbox-label">
            Play sound with notifications
          </span>
        </label>
      </div>

      <div class="pref-section">
        <label class="section-label">
          Do Not Disturb
        </label>
        <div class="checkbox-group">
          <label class="checkbox-item">
            <input
              v-model="preferences.doNotDisturb!.enabled"
              type="checkbox"
              class="checkbox-input"
              @change="handleChange"
            >
            <span class="checkbox-label">
              Enable Do Not Disturb
            </span>
          </label>
          <div v-if="preferences.doNotDisturb?.enabled" class="dnd-times">
            <div class="time-range">
              <span class="range-label">From</span>
              <input
                type="time"
                :value="formatTime(preferences.doNotDisturb?.startHour)"
                class="time-input"
                @input="handleDNDStartChange"
              >
              <span class="range-label">to</span>
              <input
                type="time"
                :value="formatTime(preferences.doNotDisturb?.endHour)"
                class="time-input"
                @input="handleDNDEndChange"
              >
            </div>
            <p class="helper-text">
              Notifications will be silenced during these hours
            </p>
          </div>
        </div>
      </div>

      <div class="pref-section">
        <label class="section-label">
          Snooze duration
        </label>
        <CustomSelect
          :model-value="String(preferences.snoozeDuration)"
          :options="snoozeSelectOptions"
          placeholder="Select snooze duration..."
          @update:model-value="(val) => { preferences.snoozeDuration = Number(val); handleChange() }"
        />
      </div>

      <div class="permission-status">
        <div class="status-row">
          <span class="status-label">
            Browser permission:
          </span>
          <span
            class="status-badge"
            :class="[isPermissionGranted ? 'granted' : 'denied']"
          >
            {{ isPermissionGranted ? 'Granted' : 'Not granted' }}
          </span>
        </div>
        <button
          v-if="!isPermissionGranted"
          class="btn btn-primary btn-full"
          @click="requestPermission"
        >
          Request Permission
        </button>
      </div>

      <!-- Test Notification -->
      <div class="test-action">
        <button
          :disabled="!isPermissionGranted"
          class="btn btn-secondary btn-full"
          @click="sendTestNotification"
        >
          Send Test Notification
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useNotificationStore } from '@/stores/notifications'
import type { NotificationPreferences } from '@/types/recurrence'
import CustomSelect from '@/components/common/CustomSelect.vue'

const props = defineProps<Props>()

const emit = defineEmits<{
  preferencesChanged: [preferences: NotificationPreferences]
}>()

// Snooze duration options for CustomSelect
const snoozeSelectOptions = [
  { label: '5 minutes', value: '5' },
  { label: '10 minutes', value: '10' },
  { label: '15 minutes', value: '15' },
  { label: '30 minutes', value: '30' },
  { label: '1 hour', value: '60' }
]

interface Props {
  taskId: string
  initialPreferences?: NotificationPreferences
}

const notificationStore = useNotificationStore()

// Local state
const preferences = ref<NotificationPreferences>(
  props.initialPreferences || {
    taskId: props.taskId,
    isEnabled: true,
    reminderTimes: [15, 60, 1440],
    soundEnabled: true,
    vibrationEnabled: true,
    notificationChannels: {
      browser: true,
      mobile: true
    },
    doNotDisturb: {
      startHour: 22,
      endHour: 8,
      enabled: true
    },
    snoozeDuration: 10
  }
)

const selectedReminderTimes = ref<number[]>([...preferences.value.reminderTimes])

// Constants
const reminderOptions = [
  { value: 5, label: '5 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' }
]



// Computed
const isPermissionGranted = computed(() => notificationStore.isPermissionGranted)

// Methods
const handleToggle = () => {
  emitChange()
}

const handleChange = () => {
  emitChange()
}

const handleReminderTimesChange = () => {
  preferences.value.reminderTimes = [...selectedReminderTimes.value]
  emitChange()
}

const handleDNDStartChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const [hours] = target.value.split(':').map(Number)
  if (preferences.value.doNotDisturb) {
    preferences.value.doNotDisturb.startHour = hours
  }
  emitChange()
}

const handleDNDEndChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const [hours] = target.value.split(':').map(Number)
  if (preferences.value.doNotDisturb) {
    preferences.value.doNotDisturb.endHour = hours
  }
  emitChange()
}

const formatTime = (hour: number): string => {
  return `${hour.toString().padStart(2, '0')}:00`
}

const emitChange = () => {
  emit('preferencesChanged', { ...preferences.value })
}

const requestPermission = async () => {
  await notificationStore.checkNotificationPermission()
}

const sendTestNotification = async () => {
  if (!isPermissionGranted.value) return

  try {
    const notification = new Notification('Test Notification', {
      body: 'This is a test notification from FlowState',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'test-notification',
      requireInteraction: false
    })

    setTimeout(() => {
      notification.close()
    }, 3000)
  } catch (error) {
    console.error('Error sending test notification:', error)
  }
}

// Initialize
onMounted(async () => {
  await notificationStore.checkNotificationPermission()
})

// Watch for prop changes
watch(() => props.initialPreferences, (newPreferences) => {
  if (newPreferences) {
    preferences.value = { ...newPreferences }
    selectedReminderTimes.value = [...newPreferences.reminderTimes]
  }
}, { immediate: true, deep: true })
</script>

<style scoped>
.notification-preferences {
  width: 100%;
}

.pref-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.pref-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.toggle-container {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.toggle-label {
  margin-left: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.pref-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.pref-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.section-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.checkbox-item {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.checkbox-input {
  width: 16px;
  height: 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: rgba(0, 0, 0, 0.2);
  cursor: pointer;
}

.checkbox-label {
  margin-left: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.dnd-times {
  margin-left: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.time-range {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.range-label {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
}

.time-input {
  padding: var(--space-1) var(--space-2);
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

.helper-text {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
}

.select-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.select-input:focus {
  outline: none;
  border-color: var(--brand-primary);
}

.permission-status {
  padding: var(--space-3);
  background: var(--glass-bg-tint);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.status-badge {
  font-size: var(--font-size-sm);
  font-weight: var(--font-medium);
}

.status-badge.granted {
  color: var(--color-success);
}

.status-badge.denied {
  color: #f87171;
}

.btn {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-weight: var(--font-medium);
  font-size: var(--font-size-sm);
  transition: all var(--duration-normal);
  cursor: pointer;
  border: none;
}

.btn-full {
  width: 100%;
}

.btn-primary {
  background: var(--brand-primary);
  color: white;
}

.btn-secondary {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
}

.btn-secondary:hover {
  background: var(--glass-border);
  color: var(--text-primary);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.test-action {
  margin-top: var(--space-2);
}
</style>