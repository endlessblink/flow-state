<template>
  <div class="sync-status-indicator" :class="statusClasses">
    <!-- Status Icon -->
    <div class="sync-icon" :title="statusTooltip">
      <div v-if="syncStatus === 'syncing' || (syncStatus as any) === 'retrying'" class="sync-spinner">
        <svg
          class="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>

      <div v-else-if="syncStatus === 'offline'" class="offline-icon">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      </div>

      <div v-else-if="syncStatus === 'error' || needsUserIntervention" class="error-icon">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <div v-else-if="syncStatus === 'complete'" class="success-icon">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <div v-else class="idle-icon">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
      </div>
    </div>

    <!-- Status Text -->
    <div v-if="showText" class="sync-text">
      <span class="status-message">{{ statusMessage }}</span>
      <span v-if="lastSyncTimeFormatted" class="last-sync">{{ lastSyncTimeFormatted }}</span>
    </div>

    <!-- Detailed Status Panel (when expanded) -->
    <div v-if="showDetails" class="sync-details">
      <div class="detail-row">
        <span class="detail-label">Status:</span>
        <span class="detail-value" :class="syncStatus">{{ syncStatus }}</span>
      </div>

      <div v-if="consecutiveFailures > 0" class="detail-row">
        <span class="detail-label">Failures:</span>
        <span class="detail-value error">{{ consecutiveFailures }} / {{ maxRetries }}</span>
      </div>

      <div v-if="averageLatency > 0" class="detail-row">
        <span class="detail-label">Latency:</span>
        <span class="detail-value">{{ averageLatency }}ms</span>
      </div>

      <div v-if="totalRetries > 0" class="detail-row">
        <span class="detail-label">Total Retries:</span>
        <span class="detail-value">{{ totalRetries }}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Connection:</span>
        <span class="detail-value" :class="{ online: isOnline, offline: !isOnline }">
          {{ isOnline ? 'Online' : 'Offline' }}
        </span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Remote:</span>
        <span class="detail-value" :class="{ connected: remoteConnected, disconnected: !remoteConnected }">
          {{ remoteConnected ? 'Connected' : 'Disconnected' }}
        </span>
      </div>

      <!-- Error Details -->
      <div v-if="syncErrors.length > 0" class="error-details">
        <h4 class="error-title">
          Recent Errors ({{ syncErrors.length }})
        </h4>
        <div v-for="(error, index) in recentErrors" :key="index" class="error-item">
          <div class="error-message">
            {{ error.message }}
          </div>
          <div class="error-meta">
            {{ formatTimestamp(error.timestamp) }} •
            {{ error.direction ? error.direction.toUpperCase() : 'UNKNOWN' }}
            <span v-if="(error as any).retryCount">• Retry {{ (error as any).retryCount }}</span>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="sync-actions">
        <button
          v-if="syncStatus === 'error' || needsUserIntervention"
          class="btn btn-primary btn-sm"
          :disabled="isSyncing"
          @click="retrySync"
        >
          Retry Sync
        </button>

        <button
          v-if="(syncStatus as any) === 'paused'"
          class="btn btn-primary btn-sm"
          @click="resumeSync"
        >
          Resume
        </button>

        <button
          v-if="syncStatus === 'syncing' || (syncStatus as any) === 'retrying'"
          class="btn btn-secondary btn-sm"
          @click="pauseSync"
        >
          Pause
        </button>

        <button
          class="btn btn-secondary btn-sm"
          :disabled="isSyncing || !canSync"
          @click="triggerManualSync"
        >
          Manual Sync
        </button>

        <button
          v-if="syncErrors.length > 0"
          class="btn btn-outline btn-sm"
          @click="clearErrors"
        >
          Clear Errors
        </button>
      </div>
    </div>

    <!-- Progress Bar (when syncing) -->
    <div v-if="showProgress && (syncStatus === 'syncing' || (syncStatus as any) === 'retrying')" class="sync-progress">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${syncProgress}%` }" />
      </div>
      <div class="progress-text">
        {{ syncProgressText }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { getGlobalReliableSyncManager } from '@/composables/useReliableSyncManager'

interface Props {
  showText?: boolean
  showDetails?: boolean
  showProgress?: boolean
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showText: true,
  showDetails: false,
  showProgress: false,
  compact: false
})

// Reliable sync manager (consolidated sync system)
const syncManager = getGlobalReliableSyncManager()

// Reactive state
const isExpanded = ref(false)
const syncProgress = ref(0)
const syncProgressText = ref('')

// Computed properties (adapted for ReliableSyncManager API)
const syncStatus = computed(() => syncManager.syncStatus.value)
const error = computed(() => syncManager.error.value)
const lastSyncTime = computed(() => syncManager.lastSyncTime.value)
const isOnline = computed(() => syncManager.isOnline.value)
const remoteConnected = computed(() => syncManager.remoteConnected.value)
const isSyncing = computed(() => syncManager.isSyncing.value)
const hasErrors = computed(() => syncManager.hasErrors.value)
const conflicts = computed(() => syncManager.conflicts.value)

// Create compatibility properties for the UI
const syncErrors = computed(() => {
  const errors = []
  if (error.value) {
    errors.push({
      message: error.value,
      timestamp: new Date(),
      direction: 'sync'
    })
  }
  return errors
})

const needsUserIntervention = computed(() => conflicts.value.length > 0)
const consecutiveFailures = computed(() => 0) // ReliableSyncManager doesn't expose this directly
const maxRetries = 3 // Default max retries
const canSync = computed(() => isOnline.value && remoteConnected.value)

// Get sync metrics from ReliableSyncManager
const syncMetrics = computed(() => syncManager.getSyncMetrics())
const totalRetries = computed(() => syncMetrics.value.failedSyncs)
const averageLatency = computed(() => 0) // Not directly available in ReliableSyncManager

// Status classes for styling
const statusClasses = computed(() => ({
  'syncing': syncStatus.value === 'syncing' || (syncStatus.value as any) === 'retrying',
  'offline': syncStatus.value === 'offline',
  'error': syncStatus.value === 'error' || needsUserIntervention.value,
  'complete': syncStatus.value === 'complete',
  'paused': (syncStatus.value as any) === 'paused',
  'compact': props.compact,
  'expanded': isExpanded.value,
  'has-errors': hasErrors.value
}))

// Status message for display (adapted for ReliableSyncManager statuses)
const statusMessage = computed(() => {
  switch (syncStatus.value) {
    case 'syncing':
      return 'Syncing...'
    case 'resolving_conflicts':
      return 'Resolving Conflicts...'
    case 'validating':
      return 'Validating...'
    case 'complete':
      return 'Synced'
    case 'offline':
      return 'Offline'
    case 'error':
      return needsUserIntervention.value ? 'Needs Attention' : 'Sync Error'
    default:
      return 'Idle'
  }
})

// Tooltip text
const statusTooltip = computed(() => {
  const baseStatus = statusMessage.value
  const details = []

  if (lastSyncTime.value) {
    details.push(`Last sync: ${formatTimestamp(lastSyncTime.value)}`)
  }

  if (consecutiveFailures.value > 0) {
    details.push(`Failures: ${consecutiveFailures.value}/${maxRetries}`)
  }

  if (averageLatency.value > 0) {
    details.push(`Latency: ${averageLatency.value}ms`)
  }

  return details.length > 0 ? `${baseStatus}\n${details.join(' • ')}` : baseStatus
})

// Formatted last sync time
const lastSyncTimeFormatted = computed(() => {
  if (!lastSyncTime.value) return null
  return formatRelativeTime(lastSyncTime.value)
})

// Recent errors (show last 3)
const recentErrors = computed(() => {
  return syncErrors.value.slice(-3)
})

// Methods
const formatTimestamp = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date)
}

const formatRelativeTime = (date: Date): string => {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  return `${Math.floor(diffInSeconds / 86400)}d ago`
}

const retrySync = async () => {
  try {
    await syncManager.triggerSync()
  } catch (error) {
    console.error('Failed to retry sync:', error)
  }
}

const resumeSync = async () => {
  try {
    // ReliableSyncManager doesn't have pause/resume, so reinitialize sync
    await syncManager.init()
  } catch (error) {
    console.error('Failed to resume sync:', error)
  }
}

const pauseSync = async () => {
  try {
    // ReliableSyncManager doesn't have pause, so cleanup to stop sync
    await syncManager.cleanup()
  } catch (error) {
    console.error('Failed to pause sync:', error)
  }
}

const triggerManualSync = async () => {
  try {
    syncProgress.value = 0
    syncProgressText.value = 'Starting manual sync...'

    // Simulate progress (in real implementation, this would come from sync events)
    const progressInterval = setInterval(() => {
      if (syncProgress.value < 90) {
        syncProgress.value += Math.random() * 20
        syncProgressText.value = `Syncing... ${Math.round(syncProgress.value)}%`
      } else {
        clearInterval(progressInterval)
      }
    }, 500)

    await syncManager.triggerSync()

    clearInterval(progressInterval)
    syncProgress.value = 100
    syncProgressText.value = 'Complete!'

    setTimeout(() => {
      syncProgress.value = 0
      syncProgressText.value = ''
    }, 2000)
  } catch (error) {
    console.error('Manual sync failed:', error)
    syncProgress.value = 0
    syncProgressText.value = 'Failed'
  }
}

const clearErrors = () => {
  syncManager.clearSyncErrors()
}

// Listen for sync events
const handleSyncChange = (event: CustomEvent) => {
  const { documentCount, direction } = event.detail
  console.log(`Sync change: ${direction} ${documentCount} documents`)

  // Update progress if showing
  if (props.showProgress && syncStatus.value === 'syncing') {
    syncProgress.value = Math.min(syncProgress.value + 10, 90)
    syncProgressText.value = `Processing ${documentCount} documents...`
  }
}

const handleSyncError = (event: CustomEvent) => {
  const { error, needsUserIntervention: needsAttention } = event.detail
  console.error('Sync error event:', error)

  if (needsAttention) {
    // Could show a notification here
    console.warn('Sync needs user intervention')
  }
}

// Lifecycle
onMounted(() => {
  window.addEventListener('sync-change', handleSyncChange as EventListener)
  window.addEventListener('sync-error', handleSyncError as EventListener)
})

onUnmounted(() => {
  window.removeEventListener('sync-change', handleSyncChange as EventListener)
  window.removeEventListener('sync-error', handleSyncError as EventListener)
})
</script>

<style scoped>
.sync-status-indicator {
  @apply flex items-center gap-2 p-2 rounded-lg transition-all duration-200;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.sync-status-indicator.compact {
  @apply p-1;
}

.sync-status-indicator.syncing {
  @apply bg-blue-500/20 text-blue-200;
}

.sync-status-indicator.retrying {
  @apply bg-orange-500/20 text-orange-200;
}

.sync-status-indicator.offline {
  @apply bg-gray-500/20 text-gray-400;
}

.sync-status-indicator.error {
  @apply bg-red-500/20 text-red-200;
}

.sync-status-indicator.complete {
  @apply bg-green-500/20 text-green-200;
}

.sync-status-indicator.paused {
  @apply bg-yellow-500/20 text-yellow-200;
}

.sync-icon {
  @apply flex-shrink-0;
}

.sync-text {
  @apply flex flex-col text-xs;
}

.status-message {
  @apply font-medium;
}

.last-sync {
  @apply opacity-75 text-xs;
}

.sync-details {
  @apply mt-3 p-3 bg-black/20 rounded-lg space-y-2;
}

.detail-row {
  @apply flex justify-between text-xs;
}

.detail-label {
  @apply opacity-75;
}

.detail-value {
  @apply font-mono;
}

.detail-value.online,
.detail-value.connected {
  @apply text-green-400;
}

.detail-value.offline,
.detail_value.disconnected {
  @apply text-red-400;
}

.detail-value.error {
  @apply text-red-400;
}

.error-details {
  @apply mt-3 pt-3 border-t border-white/10;
}

.error-title {
  @apply text-xs font-medium mb-2 text-red-400;
}

.error-item {
  @apply mb-2 p-2 bg-red-500/10 rounded text-xs;
}

.error-message {
  @apply text-red-200 mb-1;
}

.error-meta {
  @apply opacity-75 text-red-300;
}

.sync-actions {
  @apply mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-2;
}

.btn {
  @apply px-3 py-1 rounded text-xs font-medium transition-colors duration-200;
}

.btn-primary {
  @apply bg-blue-600 hover:bg-blue-700 text-white;
}

.btn-secondary {
  @apply bg-gray-600 hover:bg-gray-700 text-white;
}

.btn-outline {
  @apply border border-gray-600 hover:bg-gray-600/50 text-gray-300;
}

.btn:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.sync-progress {
  @apply mt-2 w-full;
}

.progress-bar {
  @apply w-full bg-gray-700 rounded-full h-1.5;
}

.progress-fill {
  @apply bg-blue-500 h-1.5 rounded-full transition-all duration-300 ease-out;
}

.progress-text {
  @apply text-xs opacity-75 mt-1;
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .sync-status-indicator {
    background: rgba(0, 0, 0, 0.3);
  }
}
</style>