<template>
  <div class="cloud-sync-settings">
    <h3>☁️ Cross-Device Synchronization</h3>

    <!-- Sync Status Card -->
    <div class="sync-status-card">
      <div class="status-header">
        <div class="status-indicator" :class="{ 'online': syncStatus.isOnline, 'offline': !syncStatus.isOnline }">
          <Wifi v-if="syncStatus.isOnline" :size="16" />
          <WifiOff v-else :size="16" />
        </div>
        <div class="status-text">
          <div class="provider-name">{{ syncStatus.provider }}</div>
          <div class="connection-status">
            {{ syncStatus.isOnline ? 'Connected' : 'Offline' }}
          </div>
        </div>
        <div class="last-sync">
          <span v-if="syncStatus.lastSyncTime > 0">
            {{ formatLastSync(syncStatus.lastSyncTime) }}
          </span>
          <span v-else>Never synced</span>
        </div>
      </div>

      <div v-if="syncStatus.syncUrl" class="sync-url">
        <div class="url-label">Sync URL:</div>
        <div class="url-value">{{ truncateUrl(syncStatus.syncUrl) }}</div>
      </div>
    </div>

    <!-- Provider Selection -->
    <div class="setting-group">
      <label class="setting-label">
        <span>Sync Provider</span>
        <span class="setting-description">Choose where to store your data</span>
      </label>
      <select v-model="selectedProvider" @change="onProviderChange" :disabled="isSyncing" class="setting-select">
        <option value="">Disabled</option>
        <option value="jsonbin">JSONBin (Free, no account needed)</option>
        <option value="github">GitHub Gist (Requires token)</option>
      </select>
    </div>

    <!-- GitHub Token Input -->
    <div v-if="selectedProvider === 'github'" class="setting-group">
      <label class="setting-label">
        <span>GitHub Token</span>
        <span class="setting-description">Personal access token with gist permissions</span>
      </label>
      <div class="token-input-group">
        <input
          v-model="githubToken"
          type="password"
          placeholder="ghp_xxxxxxxxxxxx"
          class="token-input"
          :disabled="isSyncing"
        />
        <button @click="saveGitHubToken" :disabled="!githubToken || isSyncing" class="save-token-btn">
          <Key :size="16" />
          Save
        </button>
      </div>
      <div class="token-help">
        <a href="https://github.com/settings/tokens/new?scopes=gist" target="_blank" rel="noopener">
          Create GitHub Token →
        </a>
      </div>
    </div>

    <!-- Sync Actions -->
    <div v-if="selectedProvider" class="sync-actions">
      <button @click="toggleSync" :disabled="isSyncing" class="action-btn" :class="syncEnabled ? 'danger' : 'primary'">
        <Power v-if="syncEnabled" :size="16" />
        <Cloud v-else :size="16" />
        {{ syncEnabled ? 'Disable Sync' : 'Enable Sync' }}
      </button>

      <button @click="manualSync" :disabled="!syncEnabled || isSyncing" class="action-btn secondary">
        <RefreshCw v-if="isSyncing" :size="16" class="animate-spin" />
        <Download v-else :size="16" />
        {{ isSyncing ? 'Syncing...' : 'Sync Now' }}
      </button>

      <button v-if="syncStatus.syncUrl" @click="copySyncUrl" class="action-btn secondary">
        <Copy :size="16" />
        Copy URL
      </button>
    </div>

    <!-- Device Info -->
    <div v-if="syncEnabled" class="device-info">
      <div class="info-header">
        <Monitor :size="14" />
        <span>This Device</span>
      </div>
      <div class="device-details">
        <div class="device-name">{{ syncStatus.deviceName }}</div>
        <div class="device-id">ID: {{ truncateId(syncStatus.deviceId) }}</div>
      </div>
    </div>

    <!-- Sync Progress -->
    <div v-if="isSyncing" class="sync-progress">
      <div class="progress-header">
        <div class="progress-text">Syncing data...</div>
        <div class="progress-status">{{ syncProgress }}</div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${progressPercent}%` }"></div>
      </div>
    </div>

    <!-- Sync History -->
    <div v-if="syncHistory.length > 0" class="sync-history">
      <div class="history-header">
        <Clock :size="14" />
        <span>Recent Sync Activity</span>
      </div>
      <div class="history-list">
        <div v-for="entry in syncHistory.slice(0, 3)" :key="entry.id" class="history-item">
          <div class="history-time">{{ formatTime(entry.timestamp) }}</div>
          <div class="history-action">{{ entry.action }}</div>
          <div class="history-status" :class="entry.success ? 'success' : 'error'">
            {{ entry.success ? '✓' : '✗' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useCloudSync } from '@/composables/useCloudSync'
import { usePersistentStorage } from '@/composables/usePersistentStorage'
import {
  Wifi, WifiOff, Cloud, Download, RefreshCw, Copy, Key, Power, Monitor, Clock
} from 'lucide-vue-next'

const cloudSync = useCloudSync()
const persistentStorage = usePersistentStorage()

// State
const selectedProvider = ref('')
const githubToken = ref('')
const isSyncing = ref(false)
const syncEnabled = ref(false)
const syncProgress = ref('')
const progressPercent = ref(0)
const syncHistory = ref<Array<{
  id: string
  timestamp: number
  action: string
  success: boolean
}>>([])

// Computed
const syncStatus = computed(() => cloudSync.syncStatus.value)

// Methods
const onProviderChange = async () => {
  if (selectedProvider.value) {
    await enableSync()
  } else {
    await disableSync()
  }
}

const enableSync = async () => {
  if (!selectedProvider.value) return

  try {
    isSyncing.value = true
    syncProgress.value = 'Initializing sync...'

    await cloudSync.enableSync(selectedProvider.value as 'jsonbin' | 'github')
    syncEnabled.value = true

    addHistoryEntry('Sync enabled', true)

    // Perform initial sync
    await manualSync()

  } catch (error) {
    console.error('Failed to enable sync:', error)
    addHistoryEntry('Failed to enable sync', false)
  } finally {
    isSyncing.value = false
  }
}

const disableSync = async () => {
  try {
    isSyncing.value = true
    syncProgress.value = 'Disabling sync...'

    await cloudSync.disableSync()
    syncEnabled.value = false

    addHistoryEntry('Sync disabled', true)

  } catch (error) {
    console.error('Failed to disable sync:', error)
    addHistoryEntry('Failed to disable sync', false)
  } finally {
    isSyncing.value = false
  }
}

const toggleSync = async () => {
  if (syncEnabled.value) {
    await disableSync()
  } else {
    await enableSync()
  }
}

const manualSync = async () => {
  if (!syncEnabled.value) return

  try {
    isSyncing.value = true
    progressPercent.value = 0
    syncProgress.value = 'Preparing data...'

    // Step 1: Upload current data
    progressPercent.value = 25
    syncProgress.value = 'Uploading local changes...'
    const uploadSuccess = await cloudSync.syncNow()

    if (!uploadSuccess) {
      throw new Error('Failed to upload data')
    }

    // Step 2: Download remote changes
    progressPercent.value = 50
    syncProgress.value = 'Checking for remote changes...'
    const downloadSuccess = await cloudSync.syncFromCloud()

    progressPercent.value = 100
    syncProgress.value = downloadSuccess ? 'Sync complete' : 'No new data found'

    addHistoryEntry('Manual sync completed', true)

    setTimeout(() => {
      isSyncing.value = false
      syncProgress.value = ''
      progressPercent.value = 0
    }, 2000)

  } catch (error) {
    console.error('Manual sync failed:', error)
    syncProgress.value = 'Sync failed'
    addHistoryEntry('Manual sync failed', false)

    setTimeout(() => {
      isSyncing.value = false
      syncProgress.value = ''
      progressPercent.value = 0
    }, 3000)
  }
}

const saveGitHubToken = async () => {
  if (!githubToken.value) return

  try {
    await cloudSync.setGitHubToken(githubToken.value)
    addHistoryEntry('GitHub token saved', true)
  } catch (error) {
    console.error('Failed to save GitHub token:', error)
    addHistoryEntry('Failed to save GitHub token', false)
  }
}

const copySyncUrl = async () => {
  if (!syncStatus.value.syncUrl) return

  try {
    await navigator.clipboard.writeText(syncStatus.value.syncUrl)
    addHistoryEntry('Sync URL copied', true)
  } catch (error) {
    console.error('Failed to copy URL:', error)
    addHistoryEntry('Failed to copy URL', false)
  }
}

const addHistoryEntry = (action: string, success: boolean) => {
  syncHistory.value.unshift({
    id: Date.now().toString(),
    timestamp: Date.now(),
    action,
    success
  })

  // Keep only last 10 entries
  if (syncHistory.value.length > 10) {
    syncHistory.value = syncHistory.value.slice(0, 10)
  }
}

// Formatting functions
const formatLastSync = (timestamp: number) => {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString()
}

const truncateUrl = (url: string) => {
  if (url.length <= 40) return url
  return url.substring(0, 20) + '...' + url.substring(url.length - 15)
}

const truncateId = (id: string) => {
  if (id.length <= 12) return id
  return id.substring(0, 6) + '...' + id.substring(id.length - 4)
}

// Load saved settings
const loadSettings = () => {
  const savedProvider = localStorage.getItem('pomo-cloud-provider')
  if (savedProvider) {
    selectedProvider.value = savedProvider
    syncEnabled.value = !!savedProvider
  }

  const savedToken = localStorage.getItem('github-token')
  if (savedToken) {
    githubToken.value = savedToken
  }
}

// Periodic status update
let statusTimer: NodeJS.Timeout

const updateStatus = () => {
  if (syncEnabled.value && syncStatus.value.lastSyncTime > 0) {
    // Check if we need to show next sync countdown
    const nextSyncIn = syncStatus.value.nextSyncIn
    if (nextSyncIn > 0) {
      const minutes = Math.floor(nextSyncIn / 60000)
      const seconds = Math.floor((nextSyncIn % 60000) / 1000)
      console.log(`Next automatic sync in: ${minutes}m ${seconds}s`)
    }
  }
}

// Lifecycle
onMounted(() => {
  loadSettings()
  statusTimer = setInterval(updateStatus, 30000) // Update every 30 seconds
})

onUnmounted(() => {
  if (statusTimer) {
    clearInterval(statusTimer)
  }
  cloudSync.cleanup()
})
</script>

<style scoped>
.cloud-sync-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
}

.cloud-sync-settings h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
}

.sync-status-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--glass-bg-medium);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
}

.status-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.status-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--glass-bg-soft);
}

.status-indicator.online {
  color: var(--success);
}

.status-indicator.offline {
  color: var(--muted);
}

.status-text {
  flex: 1;
}

.provider-name {
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.connection-status {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.last-sync {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.sync-url {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2);
  background: var(--glass-bg-soft);
  border-radius: var(--radius-sm);
  font-family: monospace;
  font-size: var(--text-xs);
}

.url-label {
  color: var(--text-muted);
}

.url-value {
  color: var(--text-primary);
  word-break: break-all;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.setting-label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  color: var(--text-primary);
}

.setting-label span:first-child {
  font-weight: var(--font-medium);
}

.setting-description {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.setting-select {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg-medium);
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.setting-select:focus {
  outline: none;
  border-color: var(--accent);
}

.token-input-group {
  display: flex;
  gap: var(--space-2);
}

.token-input {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg-medium);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-family: monospace;
}

.token-input:focus {
  outline: none;
  border-color: var(--accent);
}

.save-token-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--accent);
  color: white;
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.save-token-btn:hover:not(:disabled) {
  background: var(--accent-dark);
}

.save-token-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.token-help {
  font-size: var(--text-xs);
}

.token-help a {
  color: var(--accent);
  text-decoration: none;
}

.token-help a:hover {
  text-decoration: underline;
}

.sync-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg-soft);
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover:not(:disabled) {
  background: var(--glass-bg-medium);
}

.action-btn.primary {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.action-btn.primary:hover:not(:disabled) {
  background: var(--accent-dark);
}

.action-btn.secondary {
  background: var(--secondary);
  color: white;
  border-color: var(--secondary);
}

.action-btn.danger {
  background: var(--danger);
  color: white;
  border-color: var(--danger);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.device-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--glass-bg-medium);
  border-radius: var(--radius-md);
}

.info-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.device-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.device-name {
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.device-id {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-family: monospace;
}

.sync-progress {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--glass-bg-medium);
  border-radius: var(--radius-md);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-text {
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.progress-status {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.progress-bar {
  height: 4px;
  background: var(--glass-bg-soft);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s ease;
}

.sync-history {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.history-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.history-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--glass-bg-soft);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
}

.history-time {
  color: var(--text-muted);
  min-width: 60px;
}

.history-action {
  flex: 1;
  color: var(--text-primary);
}

.history-status.success {
  color: var(--success);
}

.history-status.error {
  color: var(--danger);
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>