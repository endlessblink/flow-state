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
  bottom: var(--space-6);
  right: var(--space-6);
  z-index: var(--z-toast);
  max-width: 420px;
  width: calc(100% - calc(var(--space-6) * 2));
}

.notification-card {
  background: var(--surface-primary) !important;
  border: 1px solid var(--glass-border) !important;
  box-shadow: var(--shadow-xl) !important;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.notification-content {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--space-9);
  height: var(--space-9);
  border-radius: var(--radius-full);
  flex-shrink: 0;
  margin-top: var(--space-0_5);
}

.icon-wrapper.indigo {
  background: var(--purple-bg-subtle);
  color: var(--color-info);
}

.icon-wrapper.green {
  background: var(--success-bg-subtle);
  color: var(--color-work);
}

.icon-wrapper.red {
  background: var(--danger-bg-subtle);
  color: var(--color-danger);
}

.text-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  line-height: var(--leading-tight);
  min-width: 0;
}

.title {
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.description {
  font-size: var(--text-xs);
  margin-top: var(--space-0_5);
  word-break: break-word;
  color: var(--text-secondary);
}

.download-progress {
  margin-top: var(--space-2);
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
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
  transition: all var(--duration-slow) var(--spring-bounce);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(var(--space-5)) scale(0.95);
}
</style>
