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
          <div class="provider-name">
            {{ syncStatus.provider }}
          </div>
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
        <div class="url-label">
          Sync URL:
        </div>
        <div class="url-value">
          {{ truncateUrl(syncStatus.syncUrl) }}
        </div>
      </div>
    </div>

    <!-- Provider Selection -->
    <div class="setting-group">
      <label class="setting-label">
        <span>Sync Provider</span>
        <span class="setting-description">Choose where to store your data</span>
      </label>
      <select
        v-model="selectedProvider"
        :disabled="isSyncing"
        class="setting-select"
        @change="onProviderChange"
      >
        <option value="">
          Disabled
        </option>
        <option value="couchdb">
          CouchDB (Self-hosted, cross-device sync)
        </option>
        <option value="jsonbin">
          JSONBin (Free, no account needed)
        </option>
        <option value="github">
          GitHub Gist (Requires token)
        </option>
      </select>
    </div>

    <!-- CouchDB Configuration -->
    <div v-if="selectedProvider === 'couchdb'" class="setting-group couchdb-config">
      <label class="setting-label">
        <span>CouchDB Server</span>
        <span class="setting-description">Your CouchDB server URL and credentials</span>
      </label>
      <div class="couchdb-fields">
        <input
          v-model="couchdbUrl"
          type="text"
          placeholder="http://your-server:5984/database"
          class="token-input"
          :disabled="isSyncing"
        >
        <div class="couchdb-auth">
          <input
            v-model="couchdbUsername"
            type="text"
            placeholder="Username"
            class="token-input"
            :disabled="isSyncing"
          >
          <input
            v-model="couchdbPassword"
            type="password"
            placeholder="Password"
            class="token-input"
            :disabled="isSyncing"
          >
        </div>
        <button :disabled="!couchdbUrl || isSyncing" class="save-token-btn" @click="saveCouchDBConfig">
          <Key :size="16" />
          Save & Test Connection
        </button>
      </div>
      <div v-if="couchdbConnectionStatus" class="connection-test-result" :class="couchdbConnectionStatus">
        {{ couchdbConnectionMessage }}
      </div>
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
        >
        <button :disabled="!githubToken || isSyncing" class="save-token-btn" @click="saveGitHubToken">
          <Key :size="16" />
          Save
        </button>
      </div>
      <div class="token-help">
        <a href="https://github.com/settings/tokens/new?scopes=gist" target="_blank" rel="noopener noreferrer">
          Create GitHub Token →
        </a>
      </div>
    </div>

    <!-- Sync Actions -->
    <div v-if="selectedProvider" class="sync-actions">
      <button
        :disabled="isSyncing"
        class="action-btn"
        :class="syncEnabled ? 'danger' : 'primary'"
        @click="toggleSync"
      >
        <Power v-if="syncEnabled" :size="16" />
        <Cloud v-else :size="16" />
        {{ syncEnabled ? 'Disable Sync' : 'Enable Sync' }}
      </button>

      <button :disabled="!syncEnabled || isSyncing" class="action-btn secondary" @click="manualSync">
        <RefreshCw v-if="isSyncing" :size="16" class="animate-spin" />
        <Download v-else :size="16" />
        {{ isSyncing ? 'Syncing...' : 'Sync Now' }}
      </button>

      <button v-if="syncStatus.syncUrl" class="action-btn secondary" @click="copySyncUrl">
        <Copy :size="16" />
        Copy URL
      </button>
    </div>

    <!-- Live Sync Toggle -->
    <div v-if="selectedProvider === 'couchdb' && syncEnabled" class="setting-group live-sync-toggle">
      <label class="setting-label">
        <span>Live Sync (Auto)</span>
        <span class="setting-description">Automatically sync changes across tabs/browsers in real-time</span>
      </label>
      <div class="live-sync-controls">
        <button
          :disabled="isSyncing"
          class="action-btn"
          :class="liveSyncActive ? 'danger' : 'success'"
          @click="toggleLiveSync"
        >
          <RefreshCw v-if="liveSyncActive" :size="16" class="animate-pulse" />
          <Zap v-else :size="16" />
          {{ liveSyncActive ? 'Stop Live Sync' : 'Start Live Sync' }}
        </button>
        <span v-if="liveSyncActive" class="live-sync-status">
          🟢 Live sync active
        </span>
      </div>
    </div>

    <!-- Device Info -->
    <div v-if="syncEnabled" class="device-info">
      <div class="info-header">
        <Monitor :size="14" />
        <span>This Device</span>
      </div>
      <div class="device-details">
        <div class="device-name">
          {{ syncStatus.deviceName }}
        </div>
        <div class="device-id">
          ID: {{ truncateId(syncStatus.deviceId) }}
        </div>
      </div>
    </div>

    <!-- Sync Progress -->
    <div v-if="isSyncing" class="sync-progress">
      <div class="progress-header">
        <div class="progress-text">
          Syncing data...
        </div>
        <div class="progress-status">
          {{ syncProgress }}
        </div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${progressPercent}%` }" />
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
          <div class="history-time">
            {{ formatTime(entry.timestamp) }}
          </div>
          <div class="history-action">
            {{ entry.action }}
          </div>
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
import { getGlobalReliableSyncManager, type ReliableSyncManagerInstance } from '@/composables/useReliableSyncManager'
import { usePersistentStorage } from '@/composables/usePersistentStorage'
import type { SyncProviderType as _SyncProviderType } from '@/types/sync'
import {
  Wifi, WifiOff, Cloud, Download, RefreshCw, Copy, Key, Power, Monitor, Clock, Zap
} from 'lucide-vue-next'

const reliableSyncManager = getGlobalReliableSyncManager()
const {
  isOnline,
  remoteConnected,
  hasConnectedEver,
  lastSyncTime,
  _isLiveSyncActive,
} = reliableSyncManager as ReliableSyncManagerInstance & {
  configureProvider?: (config: unknown) => Promise<void>
  enableProvider?: () => Promise<void>
  disableProvider?: () => Promise<void>
}
const _persistentStorage = usePersistentStorage()

// State - Initialize from localStorage for persistence across page refreshes
// If hasConnectedEver is true, default to 'couchdb' even if pomo-cloud-provider wasn't explicitly set
const savedProvider = localStorage.getItem('pomo-cloud-provider')
const selectedProvider = ref(savedProvider || (hasConnectedEver.value ? 'couchdb' : ''))
const githubToken = ref(localStorage.getItem('github-token') || '')
const isSyncing = ref(false) // Local UI state for sync in progress
const syncEnabled = ref(!!savedProvider || hasConnectedEver.value)
const syncProgress = ref('')
const progressPercent = ref(0)
const syncHistory = ref<Array<{
  id: string
  timestamp: number
  action: string
  success: boolean
}>>([])

// CouchDB State - Initialize from localStorage
const couchdbUrl = ref(localStorage.getItem('pomo-couchdb-url') || 'http://84.46.253.137:5984/pomoflow-tasks')
const couchdbUsername = ref(localStorage.getItem('pomo-couchdb-username') || 'admin')
const couchdbPassword = ref(localStorage.getItem('pomo-couchdb-password') || 'pomoflow-2024')
const couchdbConnectionStatus = ref<'success' | 'error' | ''>('')
const couchdbConnectionMessage = ref('')

// Live Sync State - Persist to localStorage
const liveSyncActive = ref(localStorage.getItem('pomo-live-sync-active') === 'true')

// WORKAROUND: Poll-based status update to bypass Vue reactivity issues with localStorage
// This counter forces computed properties to re-evaluate
const forceUpdateCounter = ref(0)
let pollInterval: ReturnType<typeof setInterval> | null = null

// Computed
const syncStatus = computed(() => {
  // Force re-evaluation via counter (workaround for reactivity issues)
  void forceUpdateCounter.value
  // Check localStorage for persistent connection status
  // const hasConnectedEver = localStorage.getItem('pomoflow_hasConnectedEver') === 'true' // Now using destructured hasConnectedEver
  // Read lastSyncTime from localStorage for reliable persistence
  const storedLastSync = localStorage.getItem('pomoflow_lastSyncTime')
  const lastSyncTimestamp = storedLastSync ? new Date(storedLastSync).getTime() : 0

  // Determine provider name based on selection, connection status, or connection history
  let providerName = 'Local Only'

  // Check multiple conditions for connection
  const hasConnected = hasConnectedEver.value || remoteConnected.value

  if (selectedProvider.value === 'couchdb') {
    providerName = 'CouchDB'
  } else if (selectedProvider.value === 'jsonbin' && (syncEnabled.value || hasConnected)) {
    providerName = 'JSONBin'
  } else if (selectedProvider.value === 'github' && (syncEnabled.value || hasConnected)) {
    providerName = 'GitHub Gist'
  }

  return {
    isOnline: isOnline.value || hasConnected, // Use the manager's isOnline or our derived hasConnected
    provider: providerName,
    lastSyncTime: lastSyncTimestamp || lastSyncTime.value?.getTime() || 0,
    syncUrl: selectedProvider.value === 'couchdb' ? couchdbUrl.value : '',
    deviceName: 'PomoFlow Device',
    deviceId: localStorage.getItem('pomo-device-id') || 'device-' + Math.random().toString(36).substring(7),
    nextSyncIn: 0
  }
})

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

    // Configure cloud backup provider through unified manager
    const providerConfig = {
      provider: selectedProvider.value as 'jsonbin' | 'github-gist',
      apiKey: selectedProvider.value === 'github-gist' ? githubToken.value : undefined,
      autoSync: true,
      syncInterval: 5 * 60 * 1000, // 5 minutes
      compressionEnabled: true
    }

    await reliableSyncManager.configureProvider?.(providerConfig)
    await reliableSyncManager.enableProvider?.()
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

    await reliableSyncManager.disableProvider?.()
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
    try {
      await reliableSyncManager.triggerSync()
    } catch (syncError) {
      throw new Error((syncError as Error)?.message || 'Failed to upload data')
    }

    // Step 2: Download remote changes
    progressPercent.value = 50
    syncProgress.value = 'Checking for remote changes...'
    try {
      await reliableSyncManager.triggerSync()
    } catch (_syncError) {
      // Sync error on download - still partial success
    }

    progressPercent.value = 100
    syncProgress.value = 'Sync complete'

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
    // Update provider configuration with new GitHub token
    const providerConfig = {
      provider: 'github-gist' as const,
      apiKey: githubToken.value,
      autoSync: true,
      syncInterval: 5 * 60 * 1000, // 5 minutes
      compressionEnabled: true
    }

    await reliableSyncManager.configureProvider?.(providerConfig)
    addHistoryEntry('GitHub token saved', true)
  } catch (error) {
    console.error('Failed to save GitHub token:', error)
    addHistoryEntry('Failed to save GitHub token', false)
  }
}

const saveCouchDBConfig = async () => {
  if (!couchdbUrl.value) return

  couchdbConnectionStatus.value = ''
  couchdbConnectionMessage.value = ''

  try {
    // Test connection to CouchDB server
    const testUrl = couchdbUrl.value.replace(/\/[^/]+$/, '') // Get base URL without database
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${couchdbUsername.value}:${couchdbPassword.value}`)
      }
    })

    if (response.ok) {
      const serverInfo = await response.json()
      couchdbConnectionStatus.value = 'success'
      couchdbConnectionMessage.value = `✅ Connected to CouchDB ${serverInfo.version || ''}`

      // Save config to localStorage
      localStorage.setItem('pomo-couchdb-url', couchdbUrl.value)
      localStorage.setItem('pomo-couchdb-username', couchdbUsername.value)
      localStorage.setItem('pomo-couchdb-password', couchdbPassword.value)
      localStorage.setItem('pomo-cloud-provider', 'couchdb')  // Save provider selection

      selectedProvider.value = 'couchdb'  // Update dropdown to reflect CouchDB
      syncEnabled.value = true
      addHistoryEntry('CouchDB connected', true)
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
  } catch (error) {
    console.error('CouchDB connection test failed:', error)
    couchdbConnectionStatus.value = 'error'
    couchdbConnectionMessage.value = `❌ Connection failed: ${(error as Error).message}`
    addHistoryEntry('CouchDB connection failed', false)
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

// Live Sync Toggle
const toggleLiveSync = async () => {
  if (liveSyncActive.value) {
    // Stop live sync
    try {
      await reliableSyncManager.stopLiveSync()
      liveSyncActive.value = false
      localStorage.setItem('pomo-live-sync-active', 'false')  // Persist state
      addHistoryEntry('Live sync stopped', true)
    } catch (error) {
      console.error('Failed to stop live sync:', error)
      addHistoryEntry('Failed to stop live sync', false)
    }
  } else {
    // Start live sync
    try {
      isSyncing.value = true
      syncProgress.value = 'Starting live sync...'
      const success = await reliableSyncManager.startLiveSync()
      if (success) {
        liveSyncActive.value = true
        selectedProvider.value = 'couchdb'
        syncEnabled.value = true
        couchdbConnectionStatus.value = 'success'
        localStorage.setItem('pomo-live-sync-active', 'true')  // Persist state
        localStorage.setItem('pomo-cloud-provider', 'couchdb')  // Persist provider
        addHistoryEntry('Live sync started', true)
      } else {
        addHistoryEntry('Failed to start live sync', false)
      }
    } catch (error) {
      console.error('Failed to start live sync:', error)
      addHistoryEntry('Failed to start live sync', false)
    } finally {
      isSyncing.value = false
      syncProgress.value = ''
    }
  }
}

// Restore sync state from sync manager or localStorage
const restoreSyncState = async () => {
  const wasLiveSyncActive = localStorage.getItem('pomo-live-sync-active') === 'true'
  const hasConnected = localStorage.getItem('pomoflow_hasConnectedEver') === 'true'

  // First check if live sync is ALREADY running in the sync manager
  if (reliableSyncManager.isLiveSyncActive?.()) {
    console.log('✅ Live sync already active in sync manager')
    liveSyncActive.value = true
    selectedProvider.value = 'couchdb'
    syncEnabled.value = true
    couchdbConnectionStatus.value = 'success'
    localStorage.setItem('pomo-live-sync-active', 'true')
    localStorage.setItem('pomo-cloud-provider', 'couchdb')
    return
  }

  // If not running but should be, auto-start
  if (wasLiveSyncActive || (hasConnected && selectedProvider.value === 'couchdb')) {
    console.log('🔄 Auto-starting live sync from previous session...')
    try {
      const success = await reliableSyncManager.startLiveSync()
      if (success) {
        liveSyncActive.value = true
        selectedProvider.value = 'couchdb'
        syncEnabled.value = true
        couchdbConnectionStatus.value = 'success'
        localStorage.setItem('pomo-live-sync-active', 'true')
        localStorage.setItem('pomo-cloud-provider', 'couchdb')
        console.log('✅ Live sync auto-started successfully')
      }
    } catch (error) {
      console.error('Failed to auto-start live sync:', error)
      localStorage.setItem('pomo-live-sync-active', 'false')  // Reset if failed
      liveSyncActive.value = false
    }
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

  // Load CouchDB settings
  const savedCouchdbUrl = localStorage.getItem('pomo-couchdb-url')
  if (savedCouchdbUrl) {
    couchdbUrl.value = savedCouchdbUrl
  }
  const savedCouchdbUsername = localStorage.getItem('pomo-couchdb-username')
  if (savedCouchdbUsername) {
    couchdbUsername.value = savedCouchdbUsername
  }
  const savedCouchdbPassword = localStorage.getItem('pomo-couchdb-password')
  if (savedCouchdbPassword) {
    couchdbPassword.value = savedCouchdbPassword
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
onMounted(async () => {
  loadSettings()
  statusTimer = setInterval(updateStatus, 30000) // Update every 30 seconds
  // Start polling every 500ms to force computed re-evaluation (workaround for localStorage reactivity)
  pollInterval = setInterval(() => {
    forceUpdateCounter.value++
  }, 500)

  // Restore sync state from sync manager or localStorage
  await restoreSyncState()
})

onUnmounted(() => {
  if (statusTimer) {
    clearInterval(statusTimer)
  }
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  // NOTE: Don't cleanup the global singleton - other components (SyncStatus) depend on it
  // reliableSyncManager.cleanup()
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
  min-width: 80px;
  text-align: right;
  white-space: nowrap;
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

.action-btn.success {
  background: var(--success, #22c55e);
  color: white;
  border-color: var(--success, #22c55e);
}

.action-btn.success:hover:not(:disabled) {
  background: var(--success-dark, #16a34a);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Live Sync Toggle */
.live-sync-toggle {
  margin-top: var(--space-3);
  padding: var(--space-3);
  background: var(--glass-bg-soft);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
}

.live-sync-controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.live-sync-status {
  font-size: var(--text-sm);
  color: var(--success, #22c55e);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.animate-pulse {
  animation: pulse 1s ease-in-out infinite;
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

/* CouchDB Configuration Styles */
.couchdb-config {
  margin-top: var(--space-2);
}

.couchdb-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.couchdb-auth {
  display: flex;
  gap: var(--space-2);
}

.couchdb-auth .token-input {
  flex: 1;
}

.connection-test-result {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  margin-top: var(--space-2);
}

.connection-test-result.success {
  background: rgba(34, 197, 94, 0.1);
  color: var(--success);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.connection-test-result.error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>