<script setup lang="ts">
/**
 * TauriUpdateNotification.vue
 *
 * Shows a notification when a new version of the app is available.
 * Only renders in Tauri environment. Checks for updates on mount
 * and provides download + install functionality.
 *
 * TASK-1114: Tauri Auto-Update from GitHub Releases
 */
import { ref, onMounted, computed } from 'vue'
import { Download, X, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-vue-next'
import { NButton, NCard, NText, NProgress } from 'naive-ui'
import { useTauriUpdater, type UpdateStatus } from '@/composables/useTauriUpdater'
import { isTauri } from '@/composables/useTauriStartup'
import { useSettingsStore } from '@/stores/settings'

// --- State ---
const {
  status,
  updateInfo,
  error,
  downloadProgress,
  hasUpdate,
  isChecking,
  isDownloading,
  checkForUpdates,
  downloadAndInstall,
  restart
} = useTauriUpdater()

const dismissed = ref(false)

// --- Computed ---
const showNotification = computed(() => {
  if (!isTauri() || dismissed.value) return false
  // Show when: update available, downloading, ready to install, or error
  return ['available', 'downloading', 'ready', 'error'].includes(status.value)
})

const statusIcon = computed(() => {
  switch (status.value) {
    case 'available':
      return Download
    case 'downloading':
      return RefreshCw
    case 'ready':
      return CheckCircle2
    case 'error':
      return AlertCircle
    default:
      return Download
  }
})

const statusColor = computed(() => {
  switch (status.value) {
    case 'available':
    case 'downloading':
      return 'indigo'
    case 'ready':
      return 'green'
    case 'error':
      return 'red'
    default:
      return 'indigo'
  }
})

const statusTitle = computed(() => {
  switch (status.value) {
    case 'available':
      return 'Update Available'
    case 'downloading':
      return 'Downloading Update...'
    case 'ready':
      return 'Ready to Install'
    case 'error':
      return 'Update Failed'
    default:
      return 'Update'
  }
})

const statusDescription = computed(() => {
  if (status.value === 'error') {
    return error.value || 'An error occurred while checking for updates.'
  }
  if (status.value === 'ready') {
    return `Version ${updateInfo.value?.version} is ready. Restart to apply.`
  }
  if (updateInfo.value) {
    return `Version ${updateInfo.value.version} is available (current: ${updateInfo.value.currentVersion})`
  }
  return 'A new version of FlowState is available.'
})

// --- Methods ---
const handleDismiss = () => {
  dismissed.value = true
}

const handleDownload = async () => {
  await downloadAndInstall()
}

const handleRestart = async () => {
  await restart()
}

const handleRetry = async () => {
  dismissed.value = false
  await checkForUpdates()
}

// --- Lifecycle ---
onMounted(async () => {
  if (!isTauri()) return

  // Check for updates after a short delay to not block startup
  setTimeout(async () => {
    console.log('[TauriUpdater] Checking for updates...')
    const hasNewVersion = await checkForUpdates()
    if (hasNewVersion) {
      console.log('[TauriUpdater] Update available:', updateInfo.value?.version)
      // FEATURE-1194: Auto-download if enabled in settings
      const settingsStore = useSettingsStore()
      if (settingsStore.autoUpdateEnabled) {
        console.log('[TauriUpdater] Auto-update enabled, downloading...')
        await downloadAndInstall()
      }
    } else if (status.value === 'error') {
      // Don't show error notification for "no releases yet" - this is expected
      // when there's no published release or latest.json doesn't exist
      console.log('[TauriUpdater] No update manifest found (expected if no releases published)')
      dismissed.value = true // Hide the error notification
    } else {
      console.log('[TauriUpdater] App is up to date')
    }
  }, 3000)
})
</script>

<template>
  <Transition name="slide-up">
    <div v-if="showNotification" class="tauri-update-notification">
      <NCard class="notification-card" size="small" :bordered="false">
        <div class="notification-content">
          <!-- Icon -->
          <div class="icon-wrapper" :class="statusColor">
            <component
              :is="statusIcon"
              :class="{ 'icon-spin': status === 'downloading' }"
              :size="20"
            />
          </div>

          <!-- Text Content -->
          <div class="text-content">
            <NText strong class="title">
              {{ statusTitle }}
            </NText>
            <NText depth="3" class="description">
              {{ statusDescription }}
            </NText>

            <!-- Progress bar for downloading -->
            <NProgress
              v-if="status === 'downloading'"
              type="line"
              :percentage="downloadProgress"
              :show-indicator="false"
              :height="4"
              class="download-progress"
            />
          </div>

          <!-- Actions -->
          <div class="actions">
            <!-- Download button (when update available) -->
            <NButton
              v-if="status === 'available'"
              secondary
              type="primary"
              size="small"
              @click="handleDownload"
            >
              Download
            </NButton>

            <!-- Restart button (when ready to install) -->
            <NButton
              v-if="status === 'ready'"
              secondary
              type="success"
              size="small"
              @click="handleRestart"
            >
              Restart Now
            </NButton>

            <!-- Retry button (on error) -->
            <NButton
              v-if="status === 'error'"
              secondary
              type="warning"
              size="small"
              @click="handleRetry"
            >
              Retry
            </NButton>

            <!-- Dismiss button -->
            <NButton
              v-if="status !== 'downloading'"
              quaternary
              circle
              size="small"
              @click="handleDismiss"
            >
              <template #icon>
                <X :size="16" />
              </template>
            </NButton>
          </div>
        </div>
      </NCard>
    </div>
  </Transition>
</template>

<style scoped>
.tauri-update-notification {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  max-width: 420px;
  width: calc(100% - 48px);
}

.notification-card {
  background: var(--bg-secondary) !important;
  border: 1px solid var(--border-default) !important;
  box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.2),
    0 4px 6px -2px rgba(0, 0, 0, 0.1) !important;
  backdrop-filter: blur(8px);
}

.notification-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 2px;
}

.icon-wrapper.indigo {
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
}

.icon-wrapper.green {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.icon-wrapper.red {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.text-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  line-height: 1.3;
  min-width: 0;
}

.title {
  font-size: 14px;
}

.description {
  font-size: 12px;
  margin-top: 2px;
  word-break: break-word;
}

.download-progress {
  margin-top: 8px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.icon-spin {
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Transitions */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}
</style>
