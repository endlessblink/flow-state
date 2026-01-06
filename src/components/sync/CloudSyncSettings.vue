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
      <CustomSelect
        :model-value="selectedProvider"
        :options="syncProviderOptions"
        :disabled="isSyncing"
        placeholder="Select provider..."
        @update:model-value="(val) => { selectedProvider = String(val); onProviderChange() }"
      />
    </div>

    <!-- Supabase Configuration -->
    <div v-if="selectedProvider === 'supabase'" class="setting-group">
      <label class="setting-label">
        <span>Authentication</span>
        <span class="setting-description">Sign in to sync your data</span>
      </label>
        
      <div v-if="!authStore.user" class="supabase-auth-actions" style="margin-top: 8px;">
        <div class="auth-message" style="margin-bottom: 12px; font-size: 0.9em; color: var(--text-muted);">
          Sign in to synchronize your tasks across devices.
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="action-btn success" @click="uiStore.openAuthModal('login')">
            Log In
          </button>
          <button class="action-btn secondary" @click="uiStore.openAuthModal('signup')">
            Create Account
          </button>
        </div>
      </div>

      <div v-else class="supabase-user-info" style="background: var(--glass-bg-soft); padding: 12px; border-radius: 8px; border: 1px solid var(--glass-border);">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
          <div style="background: var(--brand-primary); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white;">
            <User :size="16" />
          </div>
          <div>
            <div style="font-weight: 600; font-size: 0.9em;">
              {{ authStore.user.email }}
            </div>
            <div style="font-size: 0.8em; color: var(--success);">
              ● Authenticated
            </div>
          </div>
        </div>
        <button class="action-btn danger" style="width: 100%; justify-content: center;" @click="authStore.signOut()">
          <LogOut :size="14" />
          Sign Out
        </button>
      </div>
    </div>

    <!-- Sync History (Placeholder for Supabase events) -->
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
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import type { SyncProviderType as _SyncProviderType } from '@/types/sync'
import {
  Wifi, WifiOff, Cloud, Download, RefreshCw, Copy, Key, Power, Monitor, Clock, Zap, LogOut, User
} from 'lucide-vue-next'
import CustomSelect from '@/components/common/CustomSelect.vue'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'

const authStore = useAuthStore()
const uiStore = useUIStore()

// Sync provider options for CustomSelect
const syncProviderOptions = [
  { label: 'Disabled', value: '' },
  { label: 'Supabase (Cloud/Local)', value: 'supabase' },
  { label: 'CouchDB (Legacy)', value: 'couchdb' },
  { label: 'JSONBin (Free, no account needed)', value: 'jsonbin' },
  { label: 'GitHub Gist (Requires token)', value: 'github' }
]

const { fetchStatus } = useSupabaseDatabase()

// State
const selectedProvider = ref('supabase')
const isSyncing = ref(false)
const syncEnabled = ref(true)
const syncProgress = ref('')
const progressPercent = ref(0)
const syncHistory = ref<Array<{
  id: string
  timestamp: number
  action: string
  success: boolean
}>>([])

// WORKAROUND: Poll-based status update to bypass Vue reactivity issues with localStorage
// This counter forces computed properties to re-evaluate
const forceUpdateCounter = ref(0)
let pollInterval: ReturnType<typeof setInterval> | null = null

// Computed
// Computed status for Supabase
const syncStatus = computed(() => {
  const user = authStore.user
  return {
    isOnline: !!user,
    provider: 'Supabase',
    lastSyncTime: Date.now(), // Realtime is active
    syncUrl: 'Supabase Cloud',
    deviceName: 'This Device',
    deviceId: 'default'
  }
})

// Methods
// Placeholder methods for Supabase sync
const onProviderChange = () => {}
const toggleSync = () => {}
const manualSync = () => {}
const copySyncUrl = () => {}
const toggleLiveSync = () => {}
const restoreSyncState = () => {}

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