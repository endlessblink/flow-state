<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { storeToRefs } from 'pinia'
import {
  Database,
  Download,
  Upload,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Clock,
  History,
  CloudLightning,
  RefreshCw,
  Cloud,
  HardDrive
} from 'lucide-vue-next'
import useBackupSystem from '@/composables/useBackupSystem'
import SettingsSection from '../SettingsSection.vue'
import SettingsToggle from '../SettingsToggle.vue'
import SettingsOptionPicker from '../SettingsOptionPicker.vue'
import { isTauri, getTauriMode, setTauriMode } from '@/composables/useTauriStartup'
import { EXTERNAL_URLS } from '@/config/urls'
import { useTaskStore } from '@/stores/tasks'
import { useAuthStore } from '@/stores/auth'
import { clearAll as clearAllOperations } from '@/services/offline/writeQueueDB'

const {
  config,
  backupHistory,
  createBackup,
  downloadBackup,
  restoreFromFile,
  restoreFromGoldenBackupByIndex,
  getGoldenBackupValidation,
  getGoldenBackups,
  fetchShadowBackup,
  restoreFromShadow,
  restoreBackup
} = useBackupSystem()

const isRestoring = ref(false)
const validationInfo = ref<Awaited<ReturnType<typeof getGoldenBackupValidation>> | null>(null)
const shadowSnapshot = ref<any | null>(null)
const showValidation = ref(false)
const isScanningShadow = ref(false)
const goldenRotation = ref<unknown[]>([])

// Tauri mode state (only shown in Tauri desktop app)
const showTauriMode = computed(() => isTauri())
const currentTauriMode = ref<'cloud' | 'local'>(getTauriMode())
const authStore = useAuthStore()
const { isDev } = storeToRefs(authStore)

type LocalBackupPolicy = {
  intervalMinutes: number
  sqlKeepBackups: number
  shadowDbBackupEvery: number
  shadowDbKeepBackups: number
  shadowDbBackupMinIntervalMinutes: number
  envLocalPath: string
}

// The Rust command edits repo-local .env.local, so this control is only valid
// when running the Tauri app from the dev checkout.
const showLocalBackupPolicy = computed(() => showTauriMode.value && isDev.value && import.meta.env.DEV)
const isLoadingLocalBackupPolicy = ref(false)
const isSavingLocalBackupPolicy = ref(false)
const localBackupPolicy = ref<LocalBackupPolicy | null>(null)
const localBackupPolicyError = ref<string | null>(null)
const localBackupPolicyStatus = ref<string | null>(null)

const backupIntervals = [
  { value: 60000, label: '1 min' },
  { value: 300000, label: '5 min' },
  { value: 900000, label: '15 min' },
  { value: 3600000, label: '1 hour' }
]

const daemonIntervalOptions = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: 180, label: '3 hours' }
]

const sqlRetentionOptions = [
  { value: 5, label: '5' },
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 50, label: '50' }
]

const shadowBackupEveryOptions = [
  { value: 6, label: 'Every 6' },
  { value: 12, label: 'Every 12' },
  { value: 24, label: 'Every 24' }
]

const shadowCopyRetentionOptions = [
  { value: 3, label: '3' },
  { value: 5, label: '5' },
  { value: 10, label: '10' }
]

const shadowCopyMinIntervalOptions = [
  { value: 60, label: '1 hour' },
  { value: 180, label: '3 hours' },
  { value: 360, label: '6 hours' },
  { value: 720, label: '12 hours' }
]

const historySizes = [
  { value: 5, label: '5' },
  { value: 10, label: '10' },
  { value: 25, label: '25' },
  { value: 50, label: '50' }
]

const handleModeChange = (mode: 'cloud' | 'local') => {
  currentTauriMode.value = mode
  setTauriMode(mode)

  // Warn user they need to restart the app
  alert(`Mode changed to ${mode === 'cloud' ? 'Cloud' : 'Local'}. Please restart the app for changes to take effect.`)
}

const updateLocalBackupPolicy = (key: keyof LocalBackupPolicy, value: number | string) => {
  if (!localBackupPolicy.value) return
  localBackupPolicy.value = {
    ...localBackupPolicy.value,
    [key]: value
  } as LocalBackupPolicy
}

const loadLocalBackupPolicy = async () => {
  if (!showLocalBackupPolicy.value) return

  isLoadingLocalBackupPolicy.value = true
  localBackupPolicyError.value = null

  try {
    const { invoke } = await import('@tauri-apps/api/core')
    localBackupPolicy.value = await invoke<LocalBackupPolicy>('get_local_backup_policy')
  } catch (e) {
    localBackupPolicyError.value = e instanceof Error ? e.message : 'Could not load local backup policy'
  } finally {
    isLoadingLocalBackupPolicy.value = false
  }
}

const saveLocalBackupPolicy = async () => {
  if (!localBackupPolicy.value) return

  isSavingLocalBackupPolicy.value = true
  localBackupPolicyError.value = null
  localBackupPolicyStatus.value = null

  try {
    const { invoke } = await import('@tauri-apps/api/core')
    localBackupPolicy.value = await invoke<LocalBackupPolicy>('set_local_backup_policy', {
      policy: {
        intervalMinutes: localBackupPolicy.value.intervalMinutes,
        sqlKeepBackups: localBackupPolicy.value.sqlKeepBackups,
        shadowDbBackupEvery: localBackupPolicy.value.shadowDbBackupEvery,
        shadowDbKeepBackups: localBackupPolicy.value.shadowDbKeepBackups,
        shadowDbBackupMinIntervalMinutes: localBackupPolicy.value.shadowDbBackupMinIntervalMinutes
      }
    })
    localBackupPolicyStatus.value = 'Saved to .env.local. Restart the dev stack to apply the new policy.'
  } catch (e) {
    localBackupPolicyError.value = e instanceof Error ? e.message : 'Could not save local backup policy'
  } finally {
    isSavingLocalBackupPolicy.value = false
  }
}

const handleCreateBackup = async () => {
  await createBackup('manual')
}

const handleDownloadLatest = async () => {
  await downloadBackup()
}

const handleFileUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    const success = await restoreFromFile(file)
    if (success) {
      alert('Backup restored successfully!')
    }
  }
}



const checkShadowHub = async () => {
  isScanningShadow.value = true
  shadowSnapshot.value = await fetchShadowBackup()
  isScanningShadow.value = false
}

const handleShadowRestore = async () => {
  if (!shadowSnapshot.value) return
  if (!confirm('This will overwrite all local data with the latest cloud snapshot. Continue?')) return
  
  isRestoring.value = true
  const success = await restoreFromShadow(shadowSnapshot.value)
  isRestoring.value = false
  if (success) {
    alert('Restored from Shadow Hub successfully!')
  }
}

const handleGoldenRestore = async (index: number) => {
  isRestoring.value = true
  const success = await restoreFromGoldenBackupByIndex(index, true)
  isRestoring.value = false
  if (success) {
    alert(`Golden backup #${index + 1} restored!`)
  }
}

// TASK-1183: Data cleanup handlers
const taskStore = useTaskStore()
const isCleaningUp = ref(false)
const isClearingSyncQueue = ref(false)
const cleanupResult = ref<{ success: boolean; message: string } | null>(null)

const handleCleanupTasks = async () => {
  isCleaningUp.value = true
  cleanupResult.value = null
  try {
    const fixed = await taskStore.cleanupCorruptedTasks()
    cleanupResult.value = {
      success: true,
      message: fixed > 0 ? `Fixed ${fixed} corrupted task(s)` : 'No corrupted tasks found'
    }
  } catch (e) {
    cleanupResult.value = {
      success: false,
      message: `Error: ${e instanceof Error ? e.message : 'Unknown error'}`
    }
  } finally {
    isCleaningUp.value = false
  }
}

const handleClearSyncQueue = async () => {
  if (!confirm('This will clear all pending sync operations. Continue?')) return

  isClearingSyncQueue.value = true
  cleanupResult.value = null
  try {
    await clearAllOperations()
    cleanupResult.value = {
      success: true,
      message: 'Sync queue cleared successfully'
    }
  } catch (e) {
    cleanupResult.value = {
      success: false,
      message: `Error: ${e instanceof Error ? e.message : 'Unknown error'}`
    }
  } finally {
    isClearingSyncQueue.value = false
  }
}

onMounted(async () => {
    // Initial checks
    validationInfo.value = await getGoldenBackupValidation()
    goldenRotation.value = getGoldenBackups()
    checkShadowHub()
    await loadLocalBackupPolicy()
})
</script>

<template>
  <div class="storage-settings-tab">
    <!-- Tauri Desktop Mode Selector (only shown in desktop app) -->
    <SettingsSection v-if="showTauriMode" title="💻 Desktop Connection Mode">
      <div class="mode-selector-panel">
        <p class="mode-description">
          Choose how your desktop app connects to your data
        </p>

        <div class="mode-options">
          <button
            class="mode-option"
            :class="{ active: currentTauriMode === 'cloud' }"
            @click="handleModeChange('cloud')"
          >
            <div class="mode-option-icon">
              <Cloud :size="24" />
            </div>
            <div class="mode-option-content">
              <h4 class="mode-option-title">
                Cloud Mode
                <span v-if="currentTauriMode === 'cloud'" class="mode-badge">Active</span>
              </h4>
              <p class="mode-option-desc">
                Connect to {{ EXTERNAL_URLS.PRODUCTION_SITE }} (VPS)
              </p>
              <ul class="mode-option-features">
                <li>✓ Sync across devices</li>
                <li>✓ No local setup required</li>
                <li>✓ Automatic backups</li>
              </ul>
            </div>
          </button>

          <button
            class="mode-option"
            :class="{ active: currentTauriMode === 'local' }"
            @click="handleModeChange('local')"
          >
            <div class="mode-option-icon">
              <HardDrive :size="24" />
            </div>
            <div class="mode-option-content">
              <h4 class="mode-option-title">
                Local Mode
                <span v-if="currentTauriMode === 'local'" class="mode-badge">Active</span>
              </h4>
              <p class="mode-option-desc">
                Run your own database (Docker)
              </p>
              <ul class="mode-option-features">
                <li>✓ Full data control</li>
                <li>✓ Works offline</li>
                <li>⚠️ Requires Docker setup</li>
              </ul>
            </div>
          </button>
        </div>

        <p class="mode-help-text">
          <AlertTriangle :size="14" />
          Changing modes requires an app restart. Your data will not be lost.
        </p>
      </div>
    </SettingsSection>

    <SettingsSection title="🛡️ Backup Strategy">
      <SettingsToggle
        label="Auto-Backup Enabled"
        description="Automatically save your data locally every few minutes."
        :value="config.enabled"
        @update="val => config.enabled = val"
      />
      
      <SettingsOptionPicker
        label="Backup Interval"
        description="How often to perform automatic snapshots."
        :options="backupIntervals"
        :value="config.autoSaveInterval"
        @update="val => config.autoSaveInterval = Number(val)"
      />

      <SettingsOptionPicker
        label="History Retention"
        description="Maximum number of historical snapshots to keep."
        :options="historySizes"
        :value="config.maxHistorySize"
        @update="val => config.maxHistorySize = Number(val)"
      />

      <SettingsToggle
        label="Filter Test Data"
        description="Exclude mock/test tasks from backups."
        :value="config.filterMockTasks"
        @update="val => config.filterMockTasks = val"
      />
    </SettingsSection>

    <SettingsSection v-if="showLocalBackupPolicy" title="🧪 Local Backup Policy">
      <div class="local-policy-panel">
        <p class="local-policy-description">
          Developer-only controls for the Node backup daemon that writes local disk copies in Tauri/dev mode.
        </p>

        <p v-if="localBackupPolicy?.envLocalPath" class="local-policy-path">
          Writing to {{ localBackupPolicy.envLocalPath }}
        </p>

        <p v-if="isLoadingLocalBackupPolicy" class="local-policy-muted">
          Loading current policy...
        </p>

        <template v-else-if="localBackupPolicy">
          <SettingsOptionPicker
            label="Daemon Interval"
            description="How often the dev backup daemon runs."
            :options="daemonIntervalOptions"
            :value="localBackupPolicy.intervalMinutes"
            @update="val => updateLocalBackupPolicy('intervalMinutes', Number(val))"
          />

          <SettingsOptionPicker
            label="SQL Dump Retention"
            description="How many SQL dump files to keep."
            :options="sqlRetentionOptions"
            :value="localBackupPolicy.sqlKeepBackups"
            @update="val => updateLocalBackupPolicy('sqlKeepBackups', Number(val))"
          />

          <SettingsOptionPicker
            label="Shadow Copy Check"
            description="Only consider a full SQLite copy after this many snapshots."
            :options="shadowBackupEveryOptions"
            :value="localBackupPolicy.shadowDbBackupEvery"
            @update="val => updateLocalBackupPolicy('shadowDbBackupEvery', Number(val))"
          />

          <SettingsOptionPicker
            label="Shadow Copy Retention"
            description="How many full shadow DB copy files to keep."
            :options="shadowCopyRetentionOptions"
            :value="localBackupPolicy.shadowDbKeepBackups"
            @update="val => updateLocalBackupPolicy('shadowDbKeepBackups', Number(val))"
          />

          <SettingsOptionPicker
            label="Shadow Copy Minimum Gap"
            description="Minimum time between full SQLite copy files."
            :options="shadowCopyMinIntervalOptions"
            :value="localBackupPolicy.shadowDbBackupMinIntervalMinutes"
            @update="val => updateLocalBackupPolicy('shadowDbBackupMinIntervalMinutes', Number(val))"
          />

          <div class="local-policy-actions">
            <button class="cleanup-btn" :disabled="isSavingLocalBackupPolicy" @click="saveLocalBackupPolicy">
              <Database :size="16" />
              {{ isSavingLocalBackupPolicy ? 'Saving...' : 'Save Local Policy' }}
            </button>
            <button class="cleanup-btn secondary" :disabled="isLoadingLocalBackupPolicy" @click="loadLocalBackupPolicy">
              <RefreshCw :size="16" :class="{ spinning: isLoadingLocalBackupPolicy }" />
              Reload
            </button>
          </div>

          <p class="local-policy-muted">
            Changes apply to the local machine backup daemon after the dev stack restarts.
          </p>
        </template>

        <p v-if="localBackupPolicyStatus" class="cleanup-result success">
          {{ localBackupPolicyStatus }}
        </p>
        <p v-if="localBackupPolicyError" class="cleanup-result">
          {{ localBackupPolicyError }}
        </p>
      </div>
    </SettingsSection>

    <SettingsSection title="💾 Manual Actions">
      <div class="action-grid">
        <button class="action-card" @click="handleCreateBackup">
          <Database :size="20" />
          <div class="action-info">
            <span class="action-title">Snapshot Now</span>
            <span class="action-desc">Save current state to local history</span>
          </div>
        </button>

        <button class="action-card" @click="handleDownloadLatest">
          <Download :size="20" />
          <div class="action-info">
            <span class="action-title">Download Backup</span>
            <span class="action-desc">Save latest backup as a .json file</span>
          </div>
        </button>

        <label class="action-card upload-card">
          <Upload :size="20" />
          <div class="action-info">
            <span class="action-title">Import File</span>
            <span class="action-desc">Restore from a previously saved file</span>
          </div>
          <input
            type="file"
            hidden
            accept=".json"
            @change="handleFileUpload"
          >
        </label>
      </div>
    </SettingsSection>

    <SettingsSection title="☁️ Shadow Hub (Always-On Sync)">
      <div class="shadow-panel" :class="{ 'is-loading': isScanningShadow }">
        <div class="shadow-header">
          <div class="hub-icon">
            <CloudLightning :size="24" />
          </div>
          <div class="shadow-meta">
            <span class="shadow-title">System 3: Mirror Daemon</span>
            <span v-if="shadowSnapshot" class="shadow-active">Connected • Monitoring Database</span>
            <span v-else class="shadow-idle">Connecting to local daemon...</span>
          </div>
          <button class="refresh-btn" :disabled="isScanningShadow" @click="checkShadowHub">
            <RefreshCw :size="14" :class="{ 'spinning': isScanningShadow }" />
          </button>
        </div>

        <div v-if="shadowSnapshot" class="shadow-stats">
          <div class="shadow-stat">
            <span class="stat-label">Last Sync</span>
            <span class="stat-value">{{ new Date(shadowSnapshot.meta.timestamp).toLocaleTimeString() }}</span>
          </div>
          <div class="shadow-stat">
            <span class="stat-label">Tasks</span>
            <span class="stat-value">{{ shadowSnapshot.meta.counts.tasks }}</span>
          </div>
        </div>

        <div v-if="shadowSnapshot" class="shadow-actions">
          <button class="shadow-restore-btn" :disabled="isRestoring" @click="handleShadowRestore">
            <RotateCcw :size="16" />
            <span>{{ isRestoring ? 'Restoring...' : 'Restore Latest Cloud Snapshot' }}</span>
          </button>
          <p class="shadow-help">
            Best for: Recovering from sync errors or data loss on other devices.
          </p>
        </div>
      </div>
    </SettingsSection>

    <SettingsSection title="🌟 Disaster Recovery (Golden Backup Rotation)">
      <div v-if="goldenRotation.length > 0" class="golden-panel">
        <div class="golden-header">
          <ShieldCheck class="icon-success" :size="32" />
          <div class="golden-meta">
            <span class="golden-title">Peak Task Snapshots</span>
            <span class="golden-status">{{ goldenRotation.length }} recovery point{{ goldenRotation.length > 1 ? 's' : '' }} available</span>
          </div>
        </div>

        <div v-if="validationInfo?.ageWarning" class="warning-box">
          <AlertTriangle :size="16" />
          <span>{{ validationInfo.ageWarning }}</span>
        </div>

        <!-- TASK-332: Show all golden backups in rotation -->
        <div class="golden-rotation-list">
          <div
            v-for="(backup, index) in goldenRotation"
            :key="backup.id"
            class="golden-rotation-item"
            :class="{ 'is-primary': index === 0 }"
          >
            <div class="rotation-rank">
              <span class="rank-badge">{{ index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉' }}</span>
            </div>
            <div class="rotation-info">
              <span class="rotation-tasks">{{ backup.metadata?.taskCount || 0 }} tasks</span>
              <span class="rotation-date">{{ new Date(backup.timestamp).toLocaleDateString() }}</span>
            </div>
            <button
              class="rotation-restore-btn"
              :disabled="isRestoring"
              @click="handleGoldenRestore(index)"
            >
              <RotateCcw :size="14" />
              <span>Restore</span>
            </button>
          </div>
        </div>

        <div v-if="validationInfo?.warnings?.length > 0" class="detailed-warnings">
          <p class="warning-title">
            Smart Filtering (for top peak):
          </p>
          <ul>
            <li v-for="(warn, i) in validationInfo.warnings" :key="i">
              {{ warn }}
            </li>
          </ul>
        </div>

        <p class="golden-help">
          Golden backups capture your highest task counts. The system keeps up to 3 peaks for flexible recovery.
        </p>
      </div>
      <div v-else class="no-golden">
        <History :size="32" />
        <p>No Golden Backup found yet. Keep working to create one!</p>
      </div>
    </SettingsSection>

    <SettingsSection title="🕒 Local History">
      <div class="history-list">
        <div v-for="item in backupHistory" :key="item.id" class="history-item">
          <div class="item-icon">
            <Clock :size="14" />
          </div>
          <div class="item-details">
            <span class="item-time">{{ new Date(item.timestamp).toLocaleString() }}</span>
            <span class="item-meta">{{ item.metadata?.taskCount }} tasks • {{ item.type }}</span>
          </div>
          <button class="item-restore" @click="restoreBackup(item)">
            Restore
          </button>
        </div>
      </div>
    </SettingsSection>

    <!-- TASK-1183: Data Cleanup Section -->
    <SettingsSection title="🧹 Data Cleanup">
      <div class="cleanup-section">
        <p class="cleanup-description">
          Fix corrupted data that may cause sync errors. Run this if you see sync errors about invalid UUIDs.
        </p>
        <div class="cleanup-actions">
          <button class="cleanup-btn" :disabled="isCleaningUp" @click="handleCleanupTasks">
            <RefreshCw :size="16" :class="{ spinning: isCleaningUp }" />
            {{ isCleaningUp ? 'Cleaning...' : 'Fix Corrupted Tasks' }}
          </button>
          <button class="cleanup-btn secondary" :disabled="isClearingSyncQueue" @click="handleClearSyncQueue">
            <RotateCcw :size="16" />
            {{ isClearingSyncQueue ? 'Clearing...' : 'Clear Sync Queue' }}
          </button>
        </div>
        <p v-if="cleanupResult" class="cleanup-result" :class="{ success: cleanupResult.success }">
          {{ cleanupResult.message }}
        </p>
      </div>
    </SettingsSection>
  </div>
</template>

<style scoped>
.storage-settings-tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.local-policy-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.local-policy-description,
.local-policy-muted,
.local-policy-path {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.local-policy-path {
  font-family: var(--font-mono, monospace);
  font-size: var(--text-xs);
  color: var(--text-muted);
  word-break: break-all;
}

.local-policy-actions {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

/* Tauri Mode Selector */
.mode-selector-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.mode-description {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.mode-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-3);
}

.mode-option {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--glass-bg-soft);
  border: 2px solid var(--glass-border);
  border-radius: var(--radius-xl);
  cursor: pointer;
  transition: all var(--duration-normal);
  text-align: start;
}

.mode-option:hover {
  border-color: var(--glass-border-strong);
  background: var(--glass-bg-medium);
  transform: translateY(-1px);
}

.mode-option.active {
  border-color: var(--color-success);
  background: rgba(var(--color-success-rgb, 16, 185, 129), 0.1);
}

.mode-option-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg-medium);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
}

.mode-option.active .mode-option-icon {
  background: var(--color-success);
  color: white;
}

.mode-option-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.mode-option-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.mode-badge {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--color-success);
  background: rgba(var(--color-success-rgb, 16, 185, 129), 0.2);
  padding: var(--space-0_5) var(--space-2);
  border-radius: var(--radius-full);
}

.mode-option-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.mode-option-features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.mode-option-features li {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.mode-help-text {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-warning);
  background: rgba(var(--color-warning-rgb, 245, 158, 11), 0.1);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-lg);
  margin: 0;
}

.action-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-2);
}

.action-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--duration-normal);
  text-align: start;
  width: 100%;
}

.shadow-panel {
  background: linear-gradient(135deg, rgba(var(--color-primary-rgb), 0.05) 0%, rgba(var(--color-primary-rgb), 0.1) 100%);
  border: 1px solid var(--glass-border-strong);
  border-radius: var(--radius-2xl);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  transition: all var(--duration-slow) var(--ease-out);
}

.shadow-panel.is-loading {
  opacity: 0.7;
}

.shadow-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.hub-icon {
  width: 48px;
  height: 48px;
  background: var(--state-active-bg);
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
}

.shadow-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.shadow-title {
  font-size: var(--text-sm);
  font-weight: var(--font-bold);
  color: var(--text-primary);
}

.shadow-active {
  font-size: var(--text-xs);
  color: var(--color-success);
}

.shadow-idle {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.refresh-btn {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.shadow-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.shadow-stat {
  background: var(--glass-bg-soft);
  padding: var(--space-3);
  border-radius: var(--radius-xl);
  display: flex;
  flex-direction: column;
}

.shadow-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.shadow-restore-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  background: var(--state-active-bg);
  color: var(--text-primary);
  border: 1px solid var(--state-active-border);
  padding: var(--space-3);
  border-radius: var(--radius-xl);
  font-weight: var(--font-bold);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.shadow-restore-btn:hover:not(:disabled) {
  background: var(--state-active-border);
  transform: translateY(-1px);
}

.shadow-help {
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-align: center;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.action-card:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-strong);
  transform: translateY(-2px);
}

.action-info {
  display: flex;
  flex-direction: column;
}

.action-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
}

.action-desc {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.upload-card {
  margin-bottom: 0;
}

.golden-panel {
  background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.05) 0%, rgba(var(--primary-rgb), 0.1) 100%);
  border: 1px solid var(--state-active-border);
  border-radius: var(--radius-2xl);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.golden-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.icon-success {
  color: var(--color-success);
}

.golden-meta {
  display: flex;
  flex-direction: column;
}

.golden-title {
  font-size: var(--text-sm);
  font-weight: var(--font-bold);
  color: var(--text-primary);
}

.golden-status {
  font-size: var(--text-xs);
  color: var(--color-success);
}

.warning-box {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: rgba(var(--color-warning-rgb), 0.1);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-lg);
  color: var(--color-warning);
  font-size: var(--text-xs);
}

.stats-preview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}

.stat-item {
  background: var(--glass-bg-soft);
  padding: var(--space-3);
  border-radius: var(--radius-xl);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.stat-value {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--text-primary);
}

.stat-sub {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.detailed-warnings {
  font-size: var(--text-xs);
  color: var(--text-muted);
  background: var(--glass-bg-soft);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
}

.warning-title {
  font-weight: var(--font-bold);
  margin-bottom: var(--space-1);
}

.detailed-warnings ul {
  padding-inline-start: var(--space-4);
  margin: 0;
}

/* TASK-332: Golden backup rotation styles */
.golden-rotation-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.golden-rotation-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  transition: all var(--duration-normal);
}

.golden-rotation-item.is-primary {
  background: linear-gradient(135deg, rgba(var(--color-success-rgb), 0.1) 0%, rgba(var(--color-success-rgb), 0.05) 100%);
  border-color: var(--color-success);
}

.rotation-rank {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rank-badge {
  font-size: var(--text-lg);
}

.rotation-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.rotation-tasks {
  font-size: var(--text-sm);
  font-weight: var(--font-bold);
  color: var(--text-primary);
}

.rotation-date {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.rotation-restore-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.rotation-restore-btn:hover:not(:disabled) {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  color: var(--text-primary);
}

.rotation-restore-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.golden-help {
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-align: center;
  margin-top: var(--space-2);
}

.restore-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  background: var(--text-primary);
  color: var(--bg-primary);
  border: none;
  padding: var(--space-3);
  border-radius: var(--radius-xl);
  font-weight: var(--font-bold);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.restore-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  filter: brightness(1.1);
}

.restore-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.history-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-soft);
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
}

.item-icon {
  color: var(--text-muted);
}

.item-details {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.item-time {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.item-meta {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.item-restore {
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.item-restore:hover {
  background: var(--glass-border);
  color: var(--text-primary);
}

.no-golden {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8);
  color: var(--text-muted);
  text-align: center;
}

.loader {
  width: 18px;
  height: 18px;
  border: 2px solid currentColor;
  border-bottom-color: transparent;
  border-radius: 50%;
  animation: rotation 1s linear infinite;
}

@keyframes rotation {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* TASK-1183: Data Cleanup Section */
.cleanup-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.cleanup-description {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.cleanup-actions {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.cleanup-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2_5) var(--space-4);
  background: var(--color-warning);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.cleanup-btn:hover:not(:disabled) {
  background: var(--color-priority-medium);
  transform: translateY(-1px);
}

.cleanup-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cleanup-btn.secondary {
  background: var(--glass-bg-medium);
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
}

.cleanup-btn.secondary:hover:not(:disabled) {
  background: var(--glass-bg-strong);
  border-color: var(--glass-border-strong);
}

.cleanup-result {
  font-size: var(--text-sm);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--danger-bg-subtle);
  color: var(--color-danger);
}

.cleanup-result.success {
  background: var(--brand-primary-subtle);
  color: var(--color-success);
}
</style>
