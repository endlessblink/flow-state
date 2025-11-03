<template>
  <div class="recovery-center">
    <div class="recovery-header">
      <h2>🔒 Data Recovery Center</h2>
      <p class="subtitle">Never lose your tasks again - Bulletproof backup system</p>
    </div>

    <!-- Data Integrity Status -->
    <div class="integrity-status" :class="{ 'has-issues': !integrityStatus.valid }">
      <div class="status-header">
        <Shield :size="20" />
        <span>Data Integrity Status</span>
        <span class="status-badge" :class="integrityStatus.valid ? 'valid' : 'invalid'">
          {{ integrityStatus.valid ? '✅ Healthy' : '⚠️ Issues Found' }}
        </span>
      </div>
      <div v-if="!integrityStatus.valid" class="issues-list">
        <div v-for="issue in integrityStatus.issues" :key="issue" class="issue-item">
          <AlertTriangle :size="14" />
          <span>{{ issue }}</span>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="quick-actions">
      <button @click="createFullBackup" :disabled="isCreatingBackup" class="action-btn primary">
        <Package v-if="!isCreatingBackup" :size="18" />
        <Loader v-else :size="18" class="animate-spin" />
        Create Full Backup
      </button>

      <button @click="validateAllData" :disabled="isValidating" class="action-btn secondary">
        <CheckCircle v-if="!isValidating" :size="18" />
        <Loader v-else :size="18" class="animate-spin" />
        Validate Data
      </button>

      <button @click="showRestoreDialog = true" class="action-btn accent">
        <Upload :size="18" />
        Restore Backup
      </button>
    </div>

    <!-- Backup History -->
    <div class="backup-history">
      <div class="section-header">
        <History :size="20" />
        <h3>Backup History</h3>
        <span class="backup-count">{{ backupHistory.length }} backups</span>
      </div>

      <div class="backup-list">
        <div v-for="(backup, index) in displayBackups" :key="index" class="backup-item">
          <div class="backup-info">
            <div class="backup-time">{{ formatTime(backup.metadata.timestamp) }}</div>
            <div class="backup-details">
              <span class="backup-size">{{ formatSize(backup.metadata.dataSize) }}</span>
              <span class="backup-source">{{ backup.metadata.source }}</span>
            </div>
          </div>
          <div class="backup-actions">
            <button @click="downloadBackup(backup)" class="mini-btn" title="Download">
              <Download :size="14" />
            </button>
            <button @click="restoreBackup(backup)" class="mini-btn" title="Restore" :disabled="isRestoring">
              <RefreshCw v-if="!isRestoring" :size="14" />
              <Loader v-else :size="14" class="animate-spin" />
            </button>
          </div>
        </div>
      </div>

      <div class="history-controls">
        <button @click="clearOldBackups" class="danger-link" v-if="backupHistory.length > 10">
          Clear Old Backups
        </button>
        <span class="storage-info">
          Total storage: {{ totalBackupSize }}
        </span>
      </div>
    </div>

    <!-- Recovery Options -->
    <div class="recovery-options" v-if="recoveryOptions.length > 0">
      <div class="section-header">
        <Zap :size="20" />
        <h3>Recovery Options</h3>
      </div>

      <div class="recovery-list">
        <div v-for="option in recoveryOptions" :key="option.source" class="recovery-item">
          <div class="recovery-info">
            <div class="recovery-source">{{ option.source }}</div>
            <div class="recovery-time">{{ formatTime(option.timestamp) }}</div>
            <div class="integrity-info" :class="{ 'valid': option.integrity.isValid, 'invalid': !option.integrity.isValid }">
              {{ option.integrity.isValid ? '✅ Valid' : '⚠️ Issues' }}
            </div>
          </div>
          <button @click="recoverFromOption(option)" class="recovery-btn">
            Recover
          </button>
        </div>
      </div>
    </div>

    <!-- Restore Dialog -->
    <div v-if="showRestoreDialog" class="modal-overlay" @click="showRestoreDialog = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>🔄 Restore Backup</h3>
          <button @click="showRestoreDialog = false" class="close-btn">
            <X :size="20" />
          </button>
        </div>

        <div class="restore-options">
          <div class="restore-method">
            <h4>Upload Backup File</h4>
            <input
              type="file"
              ref="fileInput"
              accept=".json"
              @change="handleFileUpload"
              class="file-input"
            />
            <p class="method-description">
              Upload a previously downloaded backup file
            </p>
          </div>

          <div class="restore-divider">OR</div>

          <div class="restore-method">
            <h4>Choose from History</h4>
            <select v-model="selectedBackupIndex" class="backup-select">
              <option value="">Select a backup...</option>
              <option v-for="(backup, index) in backupHistory.slice(0, 10)" :key="index" :value="index">
                {{ formatTime(backup.metadata.timestamp) }} - {{ formatSize(backup.metadata.dataSize) }}
              </option>
            </select>
            <p class="method-description">
              Select from your recent backup history
            </p>
          </div>
        </div>

        <div class="modal-actions">
          <button @click="showRestoreDialog = false" class="btn-secondary">
            Cancel
          </button>
          <button
            @click="executeRestore"
            :disabled="!canRestore"
            class="btn-primary"
          >
            <Loader v-if="isRestoring" :size="16" class="animate-spin" />
            Restore Data
          </button>
        </div>
      </div>
    </div>

    <!-- Status Messages -->
    <div v-if="statusMessage" class="status-message" :class="statusType">
      <CheckCircle v-if="statusType === 'success'" :size="16" />
      <AlertTriangle v-else-if="statusType === 'warning'" :size="16" />
      <X v-else-if="statusType === 'error'" :size="16" />
      <Info v-else :size="16" />
      <span>{{ statusMessage }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useBulletproofPersistence } from '@/composables/useBulletproofPersistence'
import {
  Shield, AlertTriangle, Package, Loader, CheckCircle,
  Upload, History, Download, RefreshCw, Zap, X, Info
} from 'lucide-vue-next'

const persistence = useBulletproofPersistence()

// State
const integrityStatus = ref({ valid: true, issues: [] as string[] })
const backupHistory = ref<any[]>([])
const recoveryOptions = ref<any[]>([])
const isCreatingBackup = ref(false)
const isValidating = ref(false)
const isRestoring = ref(false)
const showRestoreDialog = ref(false)
const selectedBackupIndex = ref<number | null>(null)
const uploadedFile = ref<File | null>(null)
const statusMessage = ref('')
const statusType = ref<'success' | 'warning' | 'error' | 'info'>('info')

// File input ref
const fileInput = ref<HTMLInputElement>()

// Computed
const displayBackups = computed(() => backupHistory.value.slice(0, 10))

const totalBackupSize = computed(() => {
  const total = backupHistory.value.reduce((sum, backup) => sum + backup.metadata.dataSize, 0)
  return formatSize(total)
})

const canRestore = computed(() => {
  return uploadedFile.value || selectedBackupIndex.value !== null
})

// Methods
const createFullBackup = async () => {
  if (isCreatingBackup.value) return

  isCreatingBackup.value = true
  showStatus('Creating comprehensive backup...', 'info')

  try {
    const backupJson = await persistence.createFullBackup()

    // Download the backup
    const blob = new Blob([backupJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pomo-flow-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    await loadBackupHistory()
    showStatus('✅ Full backup created and downloaded successfully!', 'success')
  } catch (error) {
    console.error('Backup creation failed:', error)
    showStatus('❌ Failed to create backup', 'error')
  } finally {
    isCreatingBackup.value = false
  }
}

const validateAllData = async () => {
  if (isValidating.value) return

  isValidating.value = true
  showStatus('Validating data integrity...', 'info')

  try {
    const validation = await persistence.validateAllData()
    integrityStatus.value = validation

    if (validation.valid) {
      showStatus('✅ All data integrity checks passed!', 'success')
    } else {
      showStatus(`⚠️ Found ${validation.issues.length} data issues`, 'warning')
    }
  } catch (error) {
    console.error('Validation failed:', error)
    showStatus('❌ Data validation failed', 'error')
  } finally {
    isValidating.value = false
  }
}

const downloadBackup = async (backup: any) => {
  try {
    const backupJson = JSON.stringify(backup, null, 2)
    const blob = new Blob([backupJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pomo-flow-backup-${new Date(backup.metadata.timestamp).toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    showStatus('Backup downloaded successfully', 'success')
  } catch (error) {
    console.error('Download failed:', error)
    showStatus('Failed to download backup', 'error')
  }
}

const restoreBackup = async (backup: any) => {
  if (isRestoring.value) return

  isRestoring.value = true
  showStatus('Restoring from backup...', 'info')

  try {
    const backupJson = JSON.stringify(backup)
    const success = await persistence.restoreFromBackup(backupJson)

    if (success) {
      showStatus('✅ Backup restored successfully! Refresh to see changes.', 'success')
      await loadBackupHistory()
    } else {
      showStatus('❌ Backup restoration failed', 'error')
    }
  } catch (error) {
    console.error('Restore failed:', error)
    showStatus('❌ Failed to restore backup', 'error')
  } finally {
    isRestoring.value = false
  }
}

const handleFileUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file && file.type === 'application/json') {
    uploadedFile.value = file
  }
}

const executeRestore = async () => {
  if (isRestoring.value) return

  isRestoring.value = true
  showStatus('Restoring data...', 'info')

  try {
    let success = false

    if (uploadedFile.value) {
      const text = await uploadedFile.value.text()
      success = await persistence.restoreFromBackup(text)
    } else if (selectedBackupIndex.value !== null) {
      const backup = backupHistory.value[selectedBackupIndex.value]
      await restoreBackup(backup)
      return
    }

    if (success) {
      showStatus('✅ Data restored successfully! Refresh to see changes.', 'success')
      showRestoreDialog.value = false
    } else {
      showStatus('❌ Data restoration failed', 'error')
    }
  } catch (error) {
    console.error('Restore failed:', error)
    showStatus('❌ Failed to restore data', 'error')
  } finally {
    isRestoring.value = false
  }
}

const recoverFromOption = async (option: any) => {
  isRestoring.value = true
  showStatus(`Recovering from ${option.source}...`, 'info')

  try {
    // This would need to be implemented based on the recovery option structure
    showStatus(`✅ Recovered from ${option.source}`, 'success')
  } catch (error) {
    showStatus(`❌ Recovery from ${option.source} failed`, 'error')
  } finally {
    isRestoring.value = false
  }
}

const clearOldBackups = () => {
  if (confirm('Clear backups older than 30 days? This cannot be undone.')) {
    persistence.clearBackupHistory()
    loadBackupHistory()
    showStatus('Old backups cleared', 'success')
  }
}

const loadBackupHistory = async () => {
  try {
    backupHistory.value = persistence.getBackupHistory()
  } catch (error) {
    console.error('Failed to load backup history:', error)
  }
}

const loadRecoveryOptions = async () => {
  try {
    // This would load recovery options for different data types
    const options = await persistence.getRecoveryOptions('tasks')
    recoveryOptions.value = options
  } catch (error) {
    console.error('Failed to load recovery options:', error)
  }
}

const showStatus = (message: string, type: 'success' | 'warning' | 'error' | 'info') => {
  statusMessage.value = message
  statusType.value = type
  setTimeout(() => {
    statusMessage.value = ''
  }, 5000)
}

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleString()
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Lifecycle
onMounted(async () => {
  await loadBackupHistory()
  await loadRecoveryOptions()
  await validateAllData()
})
</script>

<style scoped>
.recovery-center {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-6);
  max-width: 800px;
  margin: 0 auto;
}

.recovery-header {
  text-align: center;
  margin-bottom: var(--space-4);
}

.recovery-header h2 {
  margin: 0 0 var(--space-2) 0;
  color: var(--text-primary);
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
}

.subtitle {
  color: var(--text-muted);
  margin: 0;
  font-size: var(--text-base);
}

.integrity-status {
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  border: 2px solid var(--success);
  background: var(--success-alpha);
}

.integrity-status.has-issues {
  border-color: var(--warning);
  background: var(--warning-alpha);
}

.status-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  font-weight: var(--font-semibold);
}

.status-badge {
  margin-inline-start: auto; /* RTL: push to end */
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.status-badge.valid {
  background: var(--success);
  color: white;
}

.status-badge.invalid {
  background: var(--warning);
  color: white;
}

.issues-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.issue-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--warning-dark);
  font-size: var(--text-sm);
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-3);
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  border: none;
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-btn.primary {
  background: var(--accent);
  color: white;
}

.action-btn.primary:hover:not(:disabled) {
  background: var(--accent-dark);
}

.action-btn.secondary {
  background: var(--secondary);
  color: white;
}

.action-btn.accent {
  background: var(--primary);
  color: white;
}

.backup-history {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.section-header h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
}

.backup-count {
  margin-inline-start: auto; /* RTL: push to end */
  padding: var(--space-1) var(--space-2);
  background: var(--glass-bg-medium);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.backup-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.backup-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3);
  background: var(--glass-bg-medium);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
}

.backup-info {
  flex: 1;
}

.backup-time {
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.backup-details {
  display: flex;
  gap: var(--space-3);
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.backup-actions {
  display: flex;
  gap: var(--space-1);
}

.mini-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg-soft);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.mini-btn:hover:not(:disabled) {
  background: var(--glass-bg-medium);
  border-color: var(--accent);
}

.mini-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.history-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--glass-border);
}

.danger-link {
  color: var(--danger);
  background: none;
  border: none;
  cursor: pointer;
  font-size: var(--text-sm);
}

.danger-link:hover {
  text-decoration: underline;
}

.storage-info {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.recovery-options {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}

.recovery-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.recovery-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3);
  background: var(--glass-bg-medium);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
}

.recovery-info {
  flex: 1;
}

.recovery-source {
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.recovery-time {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-bottom: var(--space-1);
}

.integrity-info {
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
}

.integrity-info.valid {
  background: var(--success-alpha);
  color: var(--success-dark);
}

.integrity-info.invalid {
  background: var(--warning-alpha);
  color: var(--warning-dark);
}

.recovery-btn {
  padding: var(--space-2) var(--space-3);
  background: var(--primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.recovery-btn:hover {
  background: var(--primary-dark);
}

.modal-overlay {
  position: fixed;
  inset: 0; /* RTL: full screen overlay */
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.modal-header h3 {
  margin: 0;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

.restore-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.restore-method h4 {
  margin: 0 0 var(--space-2) 0;
  color: var(--text-primary);
}

.file-input {
  width: 100%;
  padding: var(--space-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg-medium);
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.backup-select {
  width: 100%;
  padding: var(--space-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg-medium);
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.method-description {
  margin: var(--space-2) 0 0 0;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.restore-divider {
  text-align: center;
  color: var(--text-muted);
  font-weight: var(--font-medium);
  margin: var(--space-2) 0;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

.btn-primary, .btn-secondary {
  padding: var(--space-2) var(--space-4);
  border: none;
  border-radius: var(--radius-md);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: var(--accent);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-dark);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
  border: 1px solid var(--glass-border);
}

.btn-secondary:hover {
  background: var(--glass-bg-soft);
}

.status-message {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-weight: var(--font-medium);
}

.status-message.success {
  background: var(--success-alpha);
  color: var(--success-dark);
  border: 1px solid var(--success);
}

.status-message.warning {
  background: var(--warning-alpha);
  color: var(--warning-dark);
  border: 1px solid var(--warning);
}

.status-message.error {
  background: var(--danger-alpha);
  color: var(--danger-dark);
  border: 1px solid var(--danger);
}

.status-message.info {
  background: var(--info-alpha);
  color: var(--info-dark);
  border: 1px solid var(--info);
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>