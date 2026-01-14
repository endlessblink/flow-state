<script setup lang="ts">
import { ref, onMounted } from 'vue'
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
  RefreshCw
} from 'lucide-vue-next'
import useBackupSystem from '@/composables/useBackupSystem'
import SettingsSection from '../SettingsSection.vue'
import SettingsToggle from '../SettingsToggle.vue'
import SettingsOptionPicker from '../SettingsOptionPicker.vue'

const { 
  config, 
  backupHistory, 
  createBackup, 
  downloadBackup, 
  restoreFromFile,
  restoreFromGoldenBackup,
  getGoldenBackupValidation,
  fetchShadowBackup,
  restoreFromShadow,
  restoreBackup
} = useBackupSystem()

const isRestoring = ref(false)
const validationInfo = ref<any>(null)
const shadowSnapshot = ref<any>(null)
const showValidation = ref(false)
const isScanningShadow = ref(false)

const backupIntervals = [
  { value: 60000, label: '1 min' },
  { value: 300000, label: '5 min' },
  { value: 900000, label: '15 min' },
  { value: 3600000, label: '1 hour' }
]

const historySizes = [
  { value: 5, label: '5' },
  { value: 10, label: '10' },
  { value: 25, label: '25' },
  { value: 50, label: '50' }
]

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



const confirmGoldenRestore = async () => {
  isRestoring.value = true
  const success = await restoreFromGoldenBackup(true) // skip validation since we just did it
  isRestoring.value = false
  if (success) {
    alert('Golden backup restored!')
    showValidation.value = false
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

onMounted(async () => {
    // Initial checks
    validationInfo.value = await getGoldenBackupValidation()
    checkShadowHub()
})
</script>

<template>
  <div class="storage-settings-tab">
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
        @update="val => config.autoSaveInterval = val"
      />

      <SettingsOptionPicker
        label="History Retention"
        description="Maximum number of historical snapshots to keep."
        :options="historySizes"
        :value="config.maxHistorySize"
        @update="val => config.maxHistorySize = val"
      />

      <SettingsToggle
        label="Filter Test Data"
        description="Exclude mock/test tasks from backups."
        :value="config.filterMockTasks"
        @update="val => config.filterMockTasks = val"
      />
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

    <SettingsSection title="🌟 Disaster Recovery (Golden Backup)">
      <div v-if="validationInfo" class="golden-panel">
        <div class="golden-header">
          <ShieldCheck v-if="validationInfo.isValid" class="icon-success" :size="32" />
          <div class="golden-meta">
            <span class="golden-title">Golden Backup Status</span>
            <span class="golden-status">Ready for recovery</span>
          </div>
        </div>

        <div v-if="validationInfo.ageWarning" class="warning-box">
          <AlertTriangle :size="16" />
          <span>{{ validationInfo.ageWarning }}</span>
        </div>

        <div class="stats-preview">
          <div class="stat-item">
            <span class="stat-label">Tasks</span>
            <span class="stat-value">{{ validationInfo.preview.tasks.toRestore }}</span>
            <span class="stat-sub">/ {{ validationInfo.preview.tasks.total }} items</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Projects</span>
            <span class="stat-value">{{ validationInfo.preview.projects.toRestore }}</span>
            <span class="stat-sub">/ {{ validationInfo.preview.projects.total }} items</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Groups</span>
            <span class="stat-value">{{ validationInfo.preview.groups.toRestore }}</span>
            <span class="stat-sub">/ {{ validationInfo.preview.groups.total }} items</span>
          </div>
        </div>

        <div v-if="validationInfo.warnings.length > 0" class="detailed-warnings">
          <p class="warning-title">
            Smart Filtering Summary:
          </p>
          <ul>
            <li v-for="(warn, i) in validationInfo.warnings" :key="i">
              {{ warn }}
            </li>
          </ul>
        </div>

        <button 
          class="restore-btn" 
          :disabled="isRestoring"
          @click="confirmGoldenRestore"
        >
          <RotateCcw v-if="!isRestoring" :size="18" />
          <span v-else class="loader" />
          <span>{{ isRestoring ? 'Restoring...' : 'Restore Golden State' }}</span>
        </button>
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
  </div>
</template>

<style scoped>
.storage-settings-tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
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
  text-align: left;
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
  transition: all 0.3s ease;
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
  transition: all 0.2s;
}

.shadow-restore-btn:hover:not(:disabled) {
  background: var(--state-active-border);
  transform: translateY(-1px);
}

.shadow-help {
  font-size: 10px;
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
  font-size: 10px;
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
  padding-left: var(--space-4);
  margin: 0;
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
  font-size: 10px;
  color: var(--text-muted);
}

.item-restore {
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: 4px 12px;
  border-radius: var(--radius-md);
  font-size: 10px;
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
</style>
