<template>
  <div class="sync-status" :class="statusClass">
    <!-- Sync Status Icon -->
    <div class="sync-icon">
      <component
        :is="statusIcon"
        :size="16"
        :class="{ 'animate-spin': localIsSyncing }"
      />
    </div>

    <!-- Status Text -->
    <div class="sync-text">
      <span class="status-label">{{ statusText }}</span>
      <span class="last-sync">
        {{ isManualSyncing ? progressText : (lastSyncTime ? formatTime(lastSyncTime) : 'Never') }}
      </span>

      <!-- Error Message Display -->
      <div v-if="error && hasErrors" class="error-message" :title="error">
        {{ getErrorSummary(error) }}
      </div>

      <!-- Phase 2 Status Indicators -->
      <div v-if="showDetails || showMetrics || showQueue" class="phase2-indicators">
        <span v-if="conflicts.length > 0" class="conflict-indicator">
          ⚔️ {{ conflicts.length }}
        </span>
        <span v-if="queueStats.length > 0" class="queue-indicator">
          📝 {{ queueStats.length }}
        </span>
        <span v-if="lastValidation && lastValidation.issues.length > 0" class="validation-error">
          ❌ {{ lastValidation.issues.filter(i => i.severity === 'error').length }}
        </span>
      </div>
    </div>

    <!-- Manual Controls -->
    <div v-if="showControls" class="sync-controls">
      <button
        :disabled="!canManualSync"
        class="sync-btn primary"
        :class="{ 'loading': localIsSyncing }"
        title="Manual sync"
        @click="triggerManualSync"
      >
        <RefreshCw :size="14" :class="{ 'animate-spin': localIsSyncing }" />
      </button>

      <button
        class="sync-btn"
        title="Advanced sync options"
        @click="showAdvancedMenu = !showAdvancedMenu"
      >
        <Settings :size="14" />
      </button>

      <button
        v-if="remoteConnected"
        class="sync-btn"
        :class="{ 'active': syncStatus !== 'paused' }"
        :title="syncStatus === 'paused' ? 'Resume sync' : 'Pause sync'"
        @click="toggleSync"
      >
        <component
          :is="syncStatus === 'paused' ? Play : Pause"
          :size="14"
        />
      </button>
    </div>

    <!-- Progress Indicator (progress bar only, text shown in last-sync) -->
    <div v-if="localIsSyncing && props.showControls" class="sync-progress">
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: `${syncProgress}%` }"
        />
      </div>
    </div>

    <!-- Advanced Menu -->
    <div v-if="showAdvancedMenu" class="advanced-menu" @click.stop>
      <div class="menu-item" @click="forceFullSync">
        <Database :size="16" />
        <span>Force Full Sync</span>
      </div>
      <div class="menu-item" @click="clearSyncErrors">
        <Trash2 :size="16" />
        <span>Clear Sync Errors</span>
      </div>
      <div class="menu-item" @click="openHealthDashboard">
        <Heart :size="16" />
        <span>Health Dashboard</span>
      </div>
      <div class="menu-item" @click="exportSyncLogs">
        <Download :size="16" />
        <span>Export Logs</span>
      </div>
    </div>

    <!-- Connection Status -->
    <div class="connection-indicator" :class="{ 'offline': !isOnline }">
      <component
        :is="isOnline ? Wifi : WifiOff"
        :size="12"
      />
    </div>

    <!-- Details Button -->
    <button
      v-if="showDetails"
      class="details-button"
      :title="showDetailsPanel ? 'Hide Details' : 'Show Details'"
      @click="toggleDetails"
    >
      <Activity :size="14" />
    </button>

    <!-- Details Panel -->
    <div v-if="showDetailsPanel" class="sync-details-panel">
      <!-- Sync Health -->
      <div class="details-section">
        <h4 class="section-title">
          <Shield :size="16" />
          Sync Health
        </h4>
        <div class="health-grid">
          <div class="health-item">
            <span class="health-label">Status:</span>
            <span class="health-value" :class="`status-${syncHealth.syncStatus}`">
              {{ syncHealth.syncStatus }}
            </span>
          </div>
          <div class="health-item">
            <span class="health-label">Online:</span>
            <span class="health-value" :class="{ 'online': syncHealth.isOnline, 'offline': !syncHealth.isOnline }">
              {{ syncHealth.isOnline ? 'Yes' : 'No' }}
            </span>
          </div>
          <div class="health-item">
            <span class="health-label">Remote:</span>
            <span class="health-value" :class="{ 'connected': remoteConnected, 'disconnected': !remoteConnected }">
              {{ remoteConnected ? 'Connected' : 'Disconnected' }}
            </span>
          </div>
          <div class="health-item">
            <span class="health-label">Conflicts:</span>
            <span class="health-value" :class="{ 'has-conflicts': syncHealth.conflictCount > 0 }">
              {{ syncHealth.conflictCount }}
            </span>
          </div>
          <div class="health-item">
            <span class="health-label">Uptime:</span>
            <span class="health-value">
              {{ formatUptime(syncHealth.uptime) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Conflicts Section -->
      <div v-if="conflicts.length > 0" class="details-section">
        <h4 class="section-title">
          ⚔️ Recent Conflicts
        </h4>
        <div class="conflicts-list">
          <div
            v-for="conflict in conflicts.slice(0, 3)"
            :key="conflict.documentId"
            class="conflict-item"
            :class="`severity-${conflict.severity}`"
          >
            <div class="conflict-info">
              <div class="conflict-id">
                {{ conflict.documentId }}
              </div>
              <div class="conflict-type">
                {{ conflict.conflictType }}
              </div>
              <div class="conflict-resolution">
                {{ conflict.autoResolvable ? 'Auto-resolved' : 'Manual required' }}
              </div>
            </div>
          </div>
          <div v-if="conflicts.length > 3" class="conflicts-more">
            +{{ conflicts.length - 3 }} more conflicts
          </div>
        </div>
      </div>

      <!-- Queue Status -->
      <div v-if="showQueue && queueStats.length > 0" class="details-section">
        <h4 class="section-title">
          📝 Offline Queue
        </h4>
        <div class="queue-info">
          <div class="queue-item">
            <span class="queue-label">Queued:</span>
            <span class="queue-value">{{ queueStats.length }}</span>
          </div>
          <div class="queue-item">
            <span class="queue-label">Processing:</span>
            <span class="queue-value">{{ queueStats.processing ? 'Yes' : 'No' }}</span>
          </div>
          <div class="queue-item">
            <span class="queue-label">Oldest:</span>
            <span class="queue-value">
              {{ queueStats.oldestOperation ? formatTime(new Date(queueStats.oldestOperation)) : 'N/A' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Validation Results -->
      <div v-if="lastValidation" class="details-section">
        <h4 class="section-title">
          🔍 Last Validation
        </h4>
        <div class="validation-info">
          <div class="validation-item">
            <span class="validation-label">Valid Docs:</span>
            <span class="validation-value">
              {{ lastValidation.validDocuments }}/{{ lastValidation.totalValidated }}
            </span>
          </div>
          <div class="validation-item">
            <span class="validation-label">Issues:</span>
            <span class="validation-value" :class="{ 'has-issues': lastValidation.issues.length > 0 }">
              {{ lastValidation.issues.length }}
            </span>
          </div>
          <div class="validation-item">
            <span class="validation-label">Duration:</span>
            <span class="validation-value">
              {{ lastValidation.duration }}ms
            </span>
          </div>
        </div>

        <!-- Validation Issues -->
        <div v-if="lastValidation.issues.length > 0" class="validation-issues">
          <div
            v-for="issue in lastValidation.issues.slice(0, 5)"
            :key="issue.message"
            class="issue-item"
            :class="`severity-${issue.severity}`"
          >
            <div class="issue-message">
              {{ issue.message }}
            </div>
            <div v-if="issue.field" class="issue-field">
              Field: {{ issue.field }}
            </div>
          </div>
          <div v-if="lastValidation.issues.length > 5" class="validation-more">
            +{{ lastValidation.issues.length - 5 }} more issues
          </div>
        </div>
      </div>

      <!-- Metrics -->
      <div v-if="showMetrics" class="details-section">
        <h4 class="section-title">
          <Clock :size="16" />
          Sync Metrics
        </h4>
        <div class="metrics-grid">
          <div class="metric-item">
            <span class="metric-label">Total Syncs:</span>
            <span class="metric-value">{{ syncMetrics.totalSyncs }}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Success Rate:</span>
            <span class="metric-value">{{ Math.round((syncMetrics.successRate || 0) * 100) }}%</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Conflicts Rate:</span>
            <span class="metric-value">{{ Math.round((syncMetrics.conflictsRate || 0) * 100) }}%</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Avg Time:</span>
            <span class="metric-value">{{ Math.round(syncMetrics.averageSyncTime) }}ms</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { getGlobalReliableSyncManager, type SyncValidationResult } from '@/composables/useReliableSyncManager'
import { getLogger } from '@/utils/productionLogger'
import type { QueueStats } from '@/utils/offlineQueue'
import { RefreshCw, Wifi, WifiOff, Cloud, CloudOff, AlertCircle, Pause, Play, Shield, Activity, Clock, Settings, Database, Trash2, Heart, Download } from 'lucide-vue-next'

interface Props {
  showControls?: boolean
  showText?: boolean
  compact?: boolean
  showDetails?: boolean
  showMetrics?: boolean
  showQueue?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showControls: false,
  showText: true,
  compact: false,
  showDetails: false,
  showMetrics: false,
  showQueue: false
})

const reliableSync = getGlobalReliableSyncManager()

// DEBUG: Log singleton ID to verify same instance
console.log('🔍 [SyncStatus] Sync manager instance:', reliableSync)

// Use reliable sync manager properties directly
const {
  syncStatus,
  error,
  lastSyncTime,
  isSyncing,
  hasErrors,
  conflicts,
  metrics,
  isOnline,
  remoteConnected,
  triggerSync,
  manualConflictResolution,
  getSyncHealth,
  getOfflineQueueStats,
  toggleSync
} = reliableSync

// Local state for manual sync feedback
const syncProgress = ref(0)
const progressText = ref('')

// Polling removed - using direct reactivity
// const forceUpdateCounter = ref(0) 

onMounted(() => {
  // console.log('🚀 [SyncStatus] Component mounted')
})

onUnmounted(() => {
  // cleanup
})

// Alias for backward compatibility
const _activeConflicts = conflicts
const syncNow = triggerSync
const _resolveConflict = manualConflictResolution
const _getHealth = getSyncHealth

// Get queue stats for display
const queueStats = computed(() => getOfflineQueueStats() as QueueStats)

// Reactive state
const isManualSyncing = ref(false)
const showDetailsPanel = ref(false)
const lastValidation = ref<SyncValidationResult | null>(null)
const syncHealth = computed(() => getSyncHealth())
const syncMetrics = computed(() => metrics.value)

// Enhanced sync state
const showAdvancedMenu = ref(false)
// syncProgress imported from useReliableSyncManager
const syncStartTime = ref<Date | null>(null)
const currentPhase = ref('')
const logger = getLogger()

// Computed properties
const statusClass = computed(() => ({
  'sync-status--offline': !isOnline?.value,
  'sync-status--syncing': isSyncing?.value || isManualSyncing.value,
  'sync-status--error': hasErrors?.value,
  'sync-status--complete': syncStatus?.value === 'complete',
  'sync-status--paused': syncStatus?.value === 'paused',
  'sync-status--compact': props.compact,
  'has-remote-sync': remoteConnected?.value
}))

const localIsSyncing = computed(() => isSyncing?.value || isManualSyncing.value)

const statusIcon = computed(() => {
  // Force re-evaluation removed


  // Read from localStorage for guaranteed persistence
  const hasConnected = localStorage.getItem('pomoflow_hasConnectedEver') === 'true'
  const manager = getGlobalReliableSyncManager()
  const currentSyncStatus = manager.syncStatus?.value

  if (!isOnline?.value) return WifiOff
  if (localIsSyncing.value) return RefreshCw
  if (hasErrors?.value) return AlertCircle
  if (currentSyncStatus === 'complete' && hasConnected) return Cloud
  if (currentSyncStatus === 'paused') return CloudOff
  return Cloud
})

const statusText = computed(() => {
  // Force re-evaluation removed


  // Read directly from localStorage for guaranteed persistence
  const hasConnected = localStorage.getItem('pomoflow_hasConnectedEver') === 'true'
  const manager = getGlobalReliableSyncManager()
  const currentSyncStatus = manager.syncStatus?.value

  if (!isOnline?.value) return 'Offline'
  if (localIsSyncing.value) return 'Syncing...'
  if (hasErrors?.value) return 'Sync Error'
  if (currentSyncStatus === 'complete' && hasConnected) return 'Synced'
  if (currentSyncStatus === 'paused') return 'Sync Paused'
  if (hasConnected) return 'Online'  // Use localStorage-backed flag
  return 'Local Only'
})

const canManualSync = computed(() => {
  return isOnline.value && !isSyncing.value && remoteConnected
})

// Methods
const formatTime = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleDateString()
}

const triggerManualSync = async () => {
  // SYNC RE-ENABLED: Safe after Phase 1 watcher fixes (Dec 2025)
  console.log('🔄 [SyncStatus] Manual sync button clicked')

  if (!canManualSync.value) return

  isManualSyncing.value = true
  syncStartTime.value = new Date()
  syncProgress.value = 0
  progressText.value = 'Starting sync...'
  currentPhase.value = 'initialization'

  try {
    console.log('🔄 [SyncStatus] Triggering enhanced manual sync')

    // Start progress tracking
    const progressInterval = setInterval(() => {
      if (syncProgress.value < 90) {
        syncProgress.value += Math.random() * 10
      }
    }, 500)

    await syncNow()

    // Complete progress
    syncProgress.value = 100
    progressText.value = 'Sync completed successfully'

    clearInterval(progressInterval)

    logger.info('user', 'Manual sync triggered by user', {
      duration: Date.now() - (syncStartTime.value?.getTime() || 0)
    })

  } catch (error) {
    console.error('Manual sync failed:', error)
    progressText.value = 'Sync failed'
    syncProgress.value = 0

    logger.error('user', 'Manual sync failed', {
      error: (error as Error).message,
      duration: Date.now() - (syncStartTime.value?.getTime() || 0)
    })
  } finally {
    setTimeout(() => {
      isManualSyncing.value = false
      syncStartTime.value = null
      currentPhase.value = ''
    }, 1000)
  }
}

// Enhanced methods for advanced functionality
const forceFullSync = async () => {
  showAdvancedMenu.value = false
  progressText.value = 'Starting full sync...'
  syncProgress.value = 0

  try {
    const syncManager = getGlobalReliableSyncManager()
    if (syncManager && syncManager.throttledSync) {
      await syncManager.throttledSync('high')
    }

    logger.info('user', 'Force full sync triggered', {})
  } catch (error) {
    logger.error('user', 'Force full sync failed', { error: (error as Error).message })
  }
}

const clearSyncErrors = async () => {
  showAdvancedMenu.value = false

  try {
    const syncManager = getGlobalReliableSyncManager()
    if (syncManager && syncManager.clearSyncErrors) {
      await syncManager.clearSyncErrors()
    }

    logger.info('user', 'Sync errors cleared by user', {})
  } catch (error) {
    logger.error('user', 'Failed to clear sync errors', { error: (error as Error).message })
  }
}

const openHealthDashboard = () => {
  showAdvancedMenu.value = false
  // This would typically open the health dashboard component
  logger.info('user', 'Health dashboard opened', {})
}

const exportSyncLogs = () => {
  showAdvancedMenu.value = false

  try {
    const logs = logger.getLogs({ limit: 1000 })
    const metrics = logger.getMetrics()
    const health = logger.getSystemHealth()

    const exportData = {
      timestamp: new Date().toISOString(),
      logs,
      metrics,
      health,
      syncStatus: syncStatus.value,
      lastSyncTime: lastSyncTime.value
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sync-logs-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)

    logger.info('user', 'Sync logs exported', { logCount: logs.length })
  } catch (error) {
    logger.error('user', 'Failed to export sync logs', { error: (error as Error).message })
  }
}

const toggleDetails = () => {
  showDetailsPanel.value = !showDetailsPanel.value
}

const formatUptime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

const getErrorSummary = (errorMessage: string): string => {
  if (!errorMessage) return ''

  // Common error patterns for user-friendly messages
  if (errorMessage.includes('network') || errorMessage.includes('connection')) {
    return 'Network connection issue'
  }
  if (errorMessage.includes('timeout')) {
    return 'Request timeout'
  }
  if (errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
    return 'Authentication failed'
  }
  if (errorMessage.includes('conflict')) {
    return 'Data conflict detected'
  }
  if (errorMessage.includes('validation')) {
    return 'Data validation error'
  }
  if (errorMessage.includes('offline')) {
    return 'Offline mode'
  }

  // For unknown errors, return first 30 characters
  return errorMessage.length > 30
    ? errorMessage.substring(0, 30) + '...'
    : errorMessage
}

// Listen for sync events
const handleSyncEvent = (event: CustomEvent) => {
  const { direction, documentCount, conflictsDetected } = event.detail
  console.log(`Reliable sync event: ${direction} with ${documentCount} documents${conflictsDetected ? `, ${conflictsDetected} conflicts` : ''}`)
}

const handleReliableSyncChange = (event: CustomEvent) => {
  const { documentCount, conflictsDetected, timestamp: _timestamp } = event.detail
  console.log(`Phase 2 sync change: ${documentCount} documents, ${conflictsDetected} conflicts detected`)
}

// Click outside handler for advanced menu
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  const syncElement = target.closest('.sync-status')

  if (!syncElement) {
    showAdvancedMenu.value = false
  }
}

onMounted(() => {
  window.addEventListener('sync-change', handleSyncEvent as EventListener)
  window.addEventListener('reliable-sync-change', handleReliableSyncChange as EventListener)
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('sync-change', handleSyncEvent as EventListener)
  window.removeEventListener('reliable-sync-change', handleReliableSyncChange as EventListener)
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.sync-status {
  @apply flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors duration-200;
  @apply bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600;
  @apply text-slate-700 dark:text-slate-300;
  font-size: 0.875rem;
}

.sync-status--offline {
  @apply bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800;
  @apply text-amber-700 dark:text-amber-300;
}

.sync-status--syncing {
  @apply bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800;
  @apply text-blue-700 dark:text-blue-300;
}

.sync-status--error {
  @apply bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800;
  @apply text-red-700 dark:text-red-300;
}

.sync-status--complete {
  @apply bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800;
  @apply text-green-700 dark:text-green-300;
}

.sync-status--paused {
  @apply bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-700;
  @apply text-slate-600 dark:text-slate-400;
}

.sync-status--compact {
  @apply px-2 py-1 gap-1;
  font-size: 0.75rem;
}

.sync-icon {
  @apply flex items-center justify-center;
}

.sync-text {
  @apply flex flex-col;
  min-width: 80px;
}

.status-label {
  @apply font-medium;
  white-space: nowrap;
  min-width: 70px;
  display: inline-block;
}

.last-sync {
  @apply text-xs opacity-75;
  white-space: nowrap;
  min-width: 75px;
  display: inline-block;
}

.error-message {
  @apply text-xs font-medium text-red-600 dark:text-red-400 mt-1;
  @apply bg-red-100 dark:bg-red-900/20 px-2 py-1 rounded;
  @apply border border-red-200 dark:border-red-800;
  @apply truncate max-w-full;
  animation: errorFadeIn 0.3s ease-in-out;
}

@keyframes errorFadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.sync-controls {
  @apply flex items-center gap-1;
}

.sync-btn {
  @apply p-1 rounded transition-colors duration-200;
  @apply hover:bg-slate-200 dark:hover:bg-slate-700;
  @apply disabled:opacity-50 disabled:cursor-not-allowed;
}

.sync-btn.active {
  @apply bg-blue-100 dark:bg-blue-900/30;
  @apply text-blue-600 dark:text-blue-400;
}

.sync-btn.loading {
  @apply animate-pulse;
}

.connection-indicator {
  @apply flex items-center justify-center w-4 h-4 rounded-full;
  @apply bg-green-100 dark:bg-green-900/30;
  @apply text-green-600 dark:text-green-400;
}

.connection-indicator.offline {
  @apply bg-red-100 dark:bg-red-900/30;
  @apply text-red-600 dark:text-red-400;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Compact mode adjustments */
.sync-status--compact .sync-text {
  @apply flex-row items-center gap-1;
}

.sync-status--compact .last-sync {
  @apply hidden;
}

/* Phase 2 Features */
.phase2-indicators {
  @apply flex items-center gap-1 mt-1 text-xs;
}

.conflict-indicator {
  @apply bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 px-1 py-0.5 rounded font-medium;
}

.queue-indicator {
  @apply bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-1 py-0.5 rounded font-medium;
}

.validation-error {
  @apply bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-1 py-0.5 rounded font-medium;
}

/* Enhanced sync controls */
.sync-btn.primary {
  @apply bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-blue-400;
}

.sync-progress {
  @apply mt-2 space-y-1;
}

.progress-bar {
  @apply w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden;
}

.progress-fill {
  @apply bg-blue-600 h-full transition-all duration-300 ease-out;
}

.progress-text {
  @apply text-xs text-slate-600 dark:text-slate-400 text-center;
}

/* Advanced menu */
.advanced-menu {
  @apply absolute top-full right-0 mt-1 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-50;
}

.menu-item {
  @apply flex items-center gap-3 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-sm text-slate-700 dark:text-slate-300 first:rounded-t-lg last:rounded-b-lg;
}

.menu-item:hover {
  @apply bg-slate-50 dark:bg-slate-700;
}

/* Enhanced button animations */
.sync-btn.loading {
  @apply opacity-75 cursor-not-allowed;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.details-button {
  @apply p-1 rounded transition-colors duration-200;
  @apply hover:bg-gray-100 dark:hover:bg-gray-700;
  @apply text-gray-600 dark:text-gray-400;
  @apply cursor-pointer;
  border: 1px solid transparent;
}

.details-button:hover {
  @apply bg-blue-50 dark:bg-blue-900/30;
  @apply text-blue-600 dark:text-blue-400;
  @apply border-blue-200 dark:border-blue-800;
}

.sync-details-panel {
  @apply mt-2 p-4 border-t border-gray-200 dark:border-gray-700;
  @apply bg-white dark:bg-gray-800 rounded-lg shadow-lg;
  @apply text-sm;
  @apply space-y-4;
  @apply max-w-md;
  @apply z-10;
}

.details-section {
  @apply space-y-2;
}

.section-title {
  @apply flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-200;
  @apply mb-3;
}

.health-grid {
  @apply grid grid-cols-2 gap-2;
}

.health-item, .queue-item, .validation-item, .metric-item {
  @apply flex justify-between items-center;
}

.health-value, .queue-value, .validation-value, .metric-value {
  @apply font-medium;
}

.health-label, .queue-label, .validation-label, .metric-label {
  @apply text-gray-600 dark:text-gray-400;
}

.health-value.status-complete {
  @apply text-green-600 dark:text-green-400;
}

.health-value.status-error {
  @apply text-red-600 dark:text-red-400;
}

.health-value.status-syncing, .health-value.status-resolving_conflicts {
  @apply text-blue-600 dark:text-blue-400;
}

.health-value.status-offline {
  @apply text-gray-600 dark:text-gray-400;
}

.health-value.online {
  @apply text-green-600 dark:text-green-400;
}

.health-value.offline {
  @apply text-red-600 dark:text-red-400;
}

.health-value.connected {
  @apply text-green-600 dark:text-green-400;
}

.health-value.disconnected {
  @apply text-orange-600 dark:text-orange-400;
}

.health-value.has-conflicts {
  @apply text-orange-600 dark:text-orange-400;
}

.conflicts-list {
  @apply space-y-2;
}

.conflict-item {
  @apply p-2 rounded border;
}

.conflict-item.severity-low {
  @apply border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20;
}

.conflict-item.severity-medium {
  @apply border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20;
}

.conflict-item.severity-high {
  @apply border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20;
}

.conflict-info {
  @apply space-y-1;
}

.conflict-id {
  @apply font-medium text-gray-900 dark:text-gray-100;
}

.conflict-type {
  @apply text-xs text-gray-600 dark:text-gray-400;
  font-family: monospace;
}

.conflict-resolution {
  @apply text-xs text-gray-500 dark:text-gray-500;
}

.conflicts-more {
  @apply text-center text-xs text-gray-500 dark:text-gray-500;
  padding-top: 1;
}

.queue-info {
  @apply space-y-1;
}

.validation-info {
  @apply space-y-1;
}

.validation-value.has-issues {
  @apply text-orange-600 dark:text-orange-400;
}

.validation-issues {
  @apply space-y-2 mt-2;
}

.issue-item {
  @apply p-2 rounded border;
  @apply text-xs;
}

.issue-item.severity-error {
  @apply border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20;
  @apply text-red-700 dark:text-red-300;
}

.issue-item.severity-warning {
  @apply border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20;
  @apply text-yellow-700 dark:text-yellow-300;
}

.issue-item.severity-info {
  @apply border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20;
  @apply text-blue-700 dark:text-blue-300;
}

.issue-message {
  @apply font-medium;
}

.issue-field {
  @apply text-xs text-gray-500 dark:text-gray-400;
  margin-top: 0.25rem;
}

.validation-more, .conflicts-more {
  @apply text-center text-xs text-gray-500 dark:text-gray-500;
  padding-top: 0.5rem;
  font-style: italic;
}

.metrics-grid {
  @apply grid grid-cols-2 gap-2;
}
</style>