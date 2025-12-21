<template>
  <div class="notification-preferences">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">
        Notifications
      </h3>
      <label class="flex items-center cursor-pointer">
        <input
          v-model="preferences.isEnabled"
          type="checkbox"
          class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          @change="handleToggle"
        >
        <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
          Enable notifications
        </span>
      </label>
    </div>

    <div v-if="preferences.isEnabled" class="space-y-4">
      <!-- Reminder Times -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Remind me
        </label>
        <div class="space-y-2">
          <label
            v-for="option in reminderOptions"
            :key="option.value"
            class="flex items-center"
          >
            <input
              v-model="selectedReminderTimes"
              type="checkbox"
              :value="option.value"
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              @change="handleReminderTimesChange"
            >
            <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
              {{ option.label }}
            </span>
          </label>
        </div>
      </div>

      <!-- Notification Channels -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Notification channels
        </label>
        <div class="space-y-2">
          <label class="flex items-center">
            <input
              v-model="preferences.notificationChannels.browser"
              type="checkbox"
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              @change="handleChange"
            >
            <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Browser notifications
            </span>
          </label>
          <label class="flex items-center">
            <input
              v-model="preferences.notificationChannels.mobile"
              type="checkbox"
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              @change="handleChange"
            >
            <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Mobile notifications
            </span>
          </label>
        </div>
      </div>

      <!-- Sound Settings -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Sound
        </label>
        <label class="flex items-center">
          <input
            v-model="preferences.soundEnabled"
            type="checkbox"
            class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            @change="handleChange"
          >
          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
            Play sound with notifications
          </span>
        </label>
      </div>

      <!-- Do Not Disturb -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Do Not Disturb
        </label>
        <div class="space-y-2">
          <label class="flex items-center">
            <input
              v-model="preferences.doNotDisturb!.enabled"
              type="checkbox"
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              @change="handleChange"
            >
            <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Enable Do Not Disturb
            </span>
          </label>
          <div v-if="preferences.doNotDisturb?.enabled" class="ml-6 space-y-2">
            <label class="flex items-center">
              <span class="text-sm text-gray-700 dark:text-gray-300 mr-2">From</span>
              <input
                type="time"
                :value="formatTime(preferences.doNotDisturb?.startHour)"
                class="px-2 py-1 border border-gray-300 rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                @input="handleDNDStartChange"
              >
              <span class="ml-2 text-sm text-gray-700 dark:text-gray-300 mr-2">to</span>
              <input
                type="time"
                :value="formatTime(preferences.doNotDisturb?.endHour)"
                class="px-2 py-1 border border-gray-300 rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                @input="handleDNDEndChange"
              >
            </label>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Notifications will be silenced during these hours
            </p>
          </div>
        </div>
      </div>

      <!-- Snooze Duration -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Snooze duration
        </label>
        <select
          v-model="preferences.snoozeDuration"
          class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          @change="handleChange"
        >
          <option v-for="option in snoozeOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>

      <!-- Permission Status -->
      <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-600 dark:text-gray-400">
            Browser permission:
          </span>
          <span
            class="text-sm font-medium"
            :class="[
              isPermissionGranted ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            ]"
          >
            {{ isPermissionGranted ? 'Granted' : 'Not granted' }}
          </span>
        </div>
        <button
          v-if="!isPermissionGranted"
          class="mt-2 w-full px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          @click="requestPermission"
        >
          Request Permission
        </button>
      </div>

      <!-- Test Notification -->
      <div>
        <button
          :disabled="!isPermissionGranted"
          class="w-full px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
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

interface Props {
  taskId: string
  initialPreferences?: NotificationPreferences
}

const props = defineProps<Props>()

const emit = defineEmits<{
  preferencesChanged: [preferences: NotificationPreferences]
}>()

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

const snoozeOptions = [
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' }
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
      body: 'This is a test notification from Pomo-Flow',
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
  @apply space-y-4;
}
</style>