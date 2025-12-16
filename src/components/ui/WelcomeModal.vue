<template>
  <div class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <div class="modal-header">
        <h2 class="modal-title">
          <span class="emoji">🍅</span>
          Welcome to Pomo-Flow
        </h2>
        <button
          class="close-btn"
          aria-label="Close welcome modal"
          @click="closeModal"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line
              x1="18"
              y1="6"
              x2="6"
              y2="18"
            />
            <line
              x1="6"
              y1="6"
              x2="18"
              y2="18"
            />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <!-- Local User Status -->
        <div class="user-status">
          <div class="status-icon">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M20 6L9 17L4 12" />
            </svg>
          </div>
          <div class="status-text">
            <h3>Local Profile Created</h3>
            <p v-if="authStore.isNewSession">
              Your anonymous profile has been created. All data is stored privately on this device.
            </p>
            <p v-else>
              Welcome back! You've used Pomo-Flow for {{ userStats?.daysSinceCreation || 0 }} days.
            </p>
          </div>
        </div>

        <!-- User Name Setup -->
        <div class="name-setup">
          <label for="displayName" class="input-label">
            Your Display Name (Optional)
          </label>
          <div class="input-group">
            <input
              id="displayName"
              v-model="displayName"
              type="text"
              placeholder="Enter your name"
              class="name-input"
              maxlength="50"
            >
            <button
              :disabled="!displayName || displayName === currentDisplayName"
              class="save-btn"
              @click="saveDisplayName"
            >
              Save
            </button>
          </div>
          <p class="input-help">
            This is only stored locally and helps personalize your experience.
          </p>
        </div>

        <!-- Key Features -->
        <div class="features">
          <h4>What Makes Pomo-Flow Special:</h4>
          <div class="feature-list">
            <div class="feature-item">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="2"
                  ry="2"
                />
                <line
                  x1="9"
                  y1="9"
                  x2="15"
                  y2="9"
                />
                <line
                  x1="9"
                  y1="15"
                  x2="15"
                  y2="15"
                />
              </svg>
              <div>
                <strong>Task Management</strong>
                <p>Organize tasks across Board, Calendar, and Canvas views</p>
              </div>
            </div>
            <div class="feature-item">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <div>
                <strong>Pomodoro Timer</strong>
                <p>Stay focused with built-in time management techniques</p>
              </div>
            </div>
            <div class="feature-item">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                <path d="M2 17L12 22L22 17" />
                <path d="M2 12L12 17L22 12" />
              </svg>
              <div>
                <strong>100% Private</strong>
                <p>Your data stays on your device - no sign-up required</p>
              </div>
            </div>
            <div class="feature-item">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <div>
                <strong>Works Offline</strong>
                <p>Full functionality without internet connection</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="primary-btn" @click="closeModal">
          Start Being Productive
        </button>
        <div class="secondary-actions">
          <button class="secondary-btn" @click="exportData">
            📤 Export Data
          </button>
          <button class="secondary-btn" @click="showSettings = true">
            ⚙️ Settings
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useLocalAuthStore } from '@/stores/local-auth'

interface Props {
  isOpen: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  showSettings: []
}>()

const authStore = useLocalAuthStore()
const displayName = ref('')
const showSettings = ref(false)

const userStats = computed(() => authStore.getUserStats())
const currentDisplayName = computed(() => authStore.localUser?.displayName || '')

onMounted(() => {
  // Set initial display name
  displayName.value = currentDisplayName.value
})

const closeModal = () => {
  emit('close')
}

const saveDisplayName = () => {
  if (displayName.value && displayName.value !== currentDisplayName.value) {
    authStore.updateDisplayName(displayName.value.trim())
  }
}

const exportData = () => {
  try {
    const data = authStore.exportUserData()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pomo-flow-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Failed to export data:', error)
  }
}
</script>

<style scoped>
.modal-overlay {
  @apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50;
}

.modal-content {
  @apply bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto;
}

.modal-header {
  @apply flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700;
}

.modal-title {
  @apply text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2;
}

.emoji {
  @apply text-2xl;
}

.close-btn {
  @apply text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 rounded-md transition-colors;
}

.modal-body {
  @apply p-6 space-y-6;
}

.user-status {
  @apply bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3;
}

.status-icon {
  @apply text-green-600 dark:text-green-400 flex-shrink-0 mt-1;
}

.status-text h3 {
  @apply font-medium text-green-900 dark:text-green-100 mb-1;
}

.status-text p {
  @apply text-green-800 dark:text-green-200 text-sm;
}

.name-setup {
  @apply space-y-2;
}

.input-label {
  @apply block text-sm font-medium text-gray-700 dark:text-gray-300;
}

.input-group {
  @apply flex gap-2;
}

.name-input {
  @apply flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
}

.save-btn {
  @apply px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors;
}

.input-help {
  @apply text-sm text-gray-500 dark:text-gray-400;
}

.features h4 {
  @apply font-medium text-gray-900 dark:text-gray-100 mb-3;
}

.feature-list {
  @apply grid grid-cols-1 sm:grid-cols-2 gap-4;
}

.feature-item {
  @apply flex items-start gap-3;
}

.feature-item svg {
  @apply text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5;
}

.feature-item strong {
  @apply block text-gray-900 dark:text-gray-100 font-medium;
}

.feature-item p {
  @apply text-sm text-gray-600 dark:text-gray-400 mt-1;
}

.modal-footer {
  @apply p-6 border-t border-gray-200 dark:border-gray-700 space-y-4;
}

.primary-btn {
  @apply w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md transition-colors text-base;
}

.secondary-actions {
  @apply flex flex-wrap gap-2 justify-center;
}

.secondary-btn {
  @apply px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-md transition-colors;
}
</style>