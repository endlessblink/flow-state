<template>
  <div class="backup-settings">
    <div class="settings-header">
      <h3>🔒 Bulletproof Backup System</h3>
      <p class="subtitle">Never lose your tasks again - Multiple redundancy layers</p>
    </div>

    <!-- Data Integrity Status -->
    <div class="integrity-status" :class="{ 'has-issues': !integrityStatus.valid }">
      <div class="status-header">
        <Shield :size="16" />
        <span>Data Integrity</span>
        <span class="status-indicator" :class="integrityStatus.valid ? 'valid' : 'invalid'">
          {{ integrityStatus.valid ? '✅ Healthy' : '⚠️ Issues' }}
        </span>
      </div>
    </div>

    <!-- Scheduler Status -->
    <div class="scheduler-status">
      <div class="status-item">
        <Clock :size="14" />
        <span>Status: {{ schedulerStatus }}</span>
      </div>
      <div class="status-item">
        <Calendar :size="14" />
        <span>Next backup: {{ nextBackupIn }}</span>
      </div>
      <div class="status-item">
        <Database :size="14" />
        <span>Success rate: {{ stats.successRate.toFixed(1) }}%</span>
      </div>
    </div>

    <!-- Backup Settings -->
    <div class="settings-section">
      <h4>⚙️ Backup Settings</h4>

      <div class="setting-group">
        <label class="setting-label">
          <span>Backup Frequency</span>
          <span class="setting-description">How often to automatically create backups</span>
        </label>
        <select v-model="schedule.frequency" @change="updateFrequency" class="setting-select">
          <option value="off">Disabled</option>
          <option value="5min">Every 5 minutes</option>
          <option value="15min">Every 15 minutes</option>
          <option value="30min">Every 30 minutes</option>
          <option value="1hour">Every hour</option>
          <option value="6hours">Every 6 hours</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
      </div>

      <div class="setting-group">
        <label class="setting-label">
          <span>Storage Location</span>
          <span class="setting-description">Where to store your backups</span>
        </label>
        <select v-model="schedule.storageLocation" @change="updateStorageLocation" class="setting-select">
          <option value="local">Local only</option>
          <option value="cloud">Cloud only</option>
          <option value="both">Local + Cloud</option>
        </select>
      </div>

      <div class="setting-group">
        <label class="setting-label">
          <input
            type="checkbox"
            v-model="schedule.autoDownload"
            @change="updateAutoDownload"
          />
          <span>Auto-download backups</span>
          <span class="setting-description">Automatically download backup files to your computer</span>
        </label>
      </div>

      <div class="setting-group">
        <label class="setting-label">
          <span>Maximum backups</span>
          <span class="setting-description">Keep only the most recent backups</span>
        </label>
        <input
          type="number"
          v-model.number="schedule.maxBackups"
          @change="updateMaxBackups"
          min="5"
          max="100"
          class="setting-input"
        />
      </div>
    </div>

    <!-- Scheduler Controls -->
    <div class="scheduler-controls">
      <h4>🎛️ Scheduler Controls</h4>

      <div class="control-buttons">
        <button
          @click="startScheduler"
          :disabled="isSchedulerRunning && !isSchedulerPaused"
          class="control-btn start"
        >
          <Play :size="16" />
          Start
        </button>

        <button
          @click="pauseScheduler"
          :disabled="!isSchedulerRunning || isSchedulerPaused"
          class="control-btn pause"
        >
          <Pause :size="16" />
          Pause
        </button>

        <button
          @click="stopScheduler"
          :disabled="!isSchedulerRunning"
          class="control-btn stop"
        >
          <Square :size="16" />
          Stop
        </button>
      </div>
    </div>

    <!-- Backup Actions -->
    <div class="backup-actions">
      <h4>🚀 Backup Actions</h4>

      <div class="action-buttons">
        <button @click="createManualBackup" :disabled="isCreatingBackup" class="action-btn primary">
          <RefreshCw v-if="isCreatingBackup" :size="16" class="animate-spin" />
          <Download v-else :size="16" />
          Create Backup
        </button>

        <button @click="validateData" :disabled="isValidating" class="action-btn secondary">
          <Shield v-if="!isValidating" :size="16" />
          <Loader v-else :size="16" class="animate-spin" />
          Validate Data
        </button>

        <button @click="viewRecoveryCenter" class="action-btn accent">
          <Activity :size="16" />
          Recovery Center
        </button>
      </div>
    </div>

    <!-- Backup History -->
    <div class="backup-history" v-if="backupHistory.length > 0">
      <h4>📜 Recent History</h4>
      <div class="history-list">
        <div v-for="(backup, index) in backupHistory.slice(0, 5)" :key="index" class="history-item">
          <div class="history-info">
            <span class="history-time">{{ formatTime(backup.timestamp) }}</span>
            <span class="history-status" :class="{ success: backup.success, failed: !backup.success }">
              {{ backup.success ? '✅ Success' : '❌ Failed' }}
            </span>
            <span class="history-size" v-if="backup.success">{{ formatSize(backup.size) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Status Messages -->
    <div v-if="statusMessage" class="status-message" :class="statusType">
      <CheckCircle v-if="statusType === 'success'" :size="14" />
      <AlertTriangle v-else-if="statusType === 'warning'" :size="14" />
      <X v-else-if="statusType === 'error'" :size="14" />
      <Info v-else :size="14" />
      <span>{{ statusMessage }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useBulletproofPersistence } from '@/composables/useBulletproofPersistence'
import { useBackupScheduler, type BackupSchedule } from '@/composables/useBackupScheduler'
import {
  Shield, Clock, Calendar, Database, RefreshCw, Download,
  Play, Pause, Square, Activity, CheckCircle, AlertTriangle,
  X, Info, Loader
} from 'lucide-vue-next'

const persistence = useBulletproofPersistence()
const scheduler = useBackupScheduler()

// State
const integrityStatus = ref({ valid: true, issues: [] as string[] })
const schedule = ref<BackupSchedule>({
  frequency: 'off',
  lastBackup: 0,
  nextBackup: 0,
  autoDownload: false,
  maxBackups: 50,
  storageLocation: 'both'
})
const stats = ref({
  totalBackups: 0,
  totalSize: 0,
  averageSize: 0,
  successRate: 100,
  lastBackupTime: 0,
  nextBackupTime: 0
})
const backupHistory = ref<any[]>([])
const isCreatingBackup = ref(false)
const isValidating = ref(false)
const isSchedulerRunning = ref(false)
const isSchedulerPaused = ref(false)
const statusMessage = ref('')
const statusType = ref<'success' | 'warning' | 'error' | 'info'>('info')

// Update interval
let updateInterval: NodeJS.Timeout

// Computed
const schedulerStatus = computed(() => {
  if (!isSchedulerRunning.value) return 'Stopped'
  if (isSchedulerPaused.value) return 'Paused'
  return 'Running'
})

const nextBackupIn = computed(() => {
  return scheduler.getNextBackupTime()
})

// Methods
const updateFrequency = () => {
  scheduler.updateSchedule({ frequency: schedule.value.frequency })
  showStatus(`Backup frequency updated to ${schedule.value.frequency}`, 'success')
}

const updateStorageLocation = () => {
  scheduler.updateSchedule({ storageLocation: schedule.value.storageLocation })
  showStatus('Storage location updated', 'success')
}

const updateAutoDownload = () => {
  scheduler.updateSchedule({ autoDownload: schedule.value.autoDownload })
  showStatus(`Auto-download ${schedule.value.autoDownload ? 'enabled' : 'disabled'}`, 'success')
}

const updateMaxBackups = () => {
  scheduler.updateSchedule({ maxBackups: schedule.value.maxBackups })
  showStatus(`Maximum backups set to ${schedule.value.maxBackups}`, 'success')
}

const createManualBackup = async () => {
  if (isCreatingBackup.value) return

  isCreatingBackup.value = true
  showStatus('Creating backup...', 'info')

  try {
    const success = await scheduler.triggerBackup(true)
    if (success) {
      showStatus('✅ Manual backup created successfully!', 'success')
      await updateInfo()
    } else {
      showStatus('❌ Failed to create backup', 'error')
    }
  } catch (error) {
    console.error('Manual backup failed:', error)
    showStatus('❌ Backup creation failed', 'error')
  } finally {
    isCreatingBackup.value = false
  }
}

const validateData = async () => {
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
    console.error('Data validation failed:', error)
    showStatus('❌ Data validation failed', 'error')
  } finally {
    isValidating.value = false
  }
}

const viewRecoveryCenter = () => {
  // Open the recovery center component or navigate to it
  showStatus('Opening Recovery Center...', 'info')
  // This would typically open a modal or navigate to a recovery page
}

const startScheduler = () => {
  scheduler.start()
  updateSchedulerStatus()
  showStatus('Backup scheduler started', 'success')
}

const pauseScheduler = () => {
  scheduler.pause()
  updateSchedulerStatus()
  showStatus('Backup scheduler paused', 'info')
}

const stopScheduler = () => {
  scheduler.stop()
  updateSchedulerStatus()
  showStatus('Backup scheduler stopped', 'info')
}

const updateSchedulerStatus = () => {
  isSchedulerRunning.value = scheduler.isRunning()
  isSchedulerPaused.value = scheduler.isPaused()
}

const updateInfo = async () => {
  try {
    // Update schedule info
    schedule.value = scheduler.getSchedule()

    // Update stats
    stats.value = scheduler.getStats()

    // Update backup history
    backupHistory.value = scheduler.getHistory()

    // Update integrity status
    const validation = await persistence.validateAllData()
    integrityStatus.value = validation
  } catch (error) {
    console.error('Failed to update backup info:', error)
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

// Setup backup event listener
const onBackupComplete = (success: boolean, error?: string) => {
  if (success) {
    showStatus('✅ Automatic backup completed', 'success')
  } else {
    showStatus(`❌ Automatic backup failed: ${error}`, 'error')
  }
  updateInfo()
}

// Lifecycle
onMounted(async () => {
  // Load initial data
  await updateInfo()
  updateSchedulerStatus()

  // Setup backup event listener
  scheduler.onBackup(onBackupComplete)

  // Start periodic updates
  updateInterval = setInterval(updateInfo, 30000) // Update every 30 seconds
})

onUnmounted(() => {
  // Clean up
  if (updateInterval) {
    clearInterval(updateInterval)
  }
  scheduler.offBackup(onBackupComplete)
})
</script>

<style scoped>
.backup-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-6);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  max-width: 600px;
}

.settings-header {
  text-align: center;
  margin-bottom: var(--space-4);
}

.settings-header h3 {
  margin: 0 0 var(--space-2) 0;
  color: var(--text-primary);
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
}

.subtitle {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.integrity-status {
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  border: 2px solid var(--success);
  background: var(--success-alpha);
  margin-bottom: var(--space-4);
}

.integrity-status.has-issues {
  border-color: var(--warning);
  background: var(--warning-alpha);
}

.status-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.status-indicator {
  margin-left: auto;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.status-indicator.valid {
  background: var(--success);
  color: white;
}

.status-indicator.invalid {
  background: var(--warning);
  color: white;
}

.scheduler-status {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--glass-bg-medium);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-4);
}

.status-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.settings-section, .scheduler-controls, .backup-actions, .backup-history {
  margin-bottom: var(--space-5);
}

.settings-section h4, .scheduler-controls h4, .backup-actions h4, .backup-history h4 {
  margin: 0 0 var(--space-3) 0;
  color: var(--text-primary);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.setting-label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  color: var(--text-primary);
  cursor: pointer;
}

.setting-label span:first-child {
  font-weight: var(--font-medium);
}

.setting-description {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.setting-select, .setting-input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg-medium);
  color: var(--text-primary);
  font-size: var(--text-sm);
  transition: all 0.2s ease;
}

.setting-select:focus, .setting-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-glow);
}

.setting-label input[type="checkbox"] {
  margin-right: var(--space-2);
}

.control-buttons, .action-buttons {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.control-btn, .action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg-soft);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all 0.2s ease;
}

.control-btn:hover:not(:disabled), .action-btn:hover:not(:disabled) {
  background: var(--glass-bg-medium);
  transform: translateY(-1px);
}

.control-btn:disabled, .action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.control-btn.start {
  background: var(--success);
  color: white;
  border-color: var(--success);
}

.control-btn.pause {
  background: var(--warning);
  color: white;
  border-color: var(--warning);
}

.control-btn.stop {
  background: var(--danger);
  color: white;
  border-color: var(--danger);
}

.action-btn.primary {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.action-btn.secondary {
  background: var(--secondary);
  color: white;
  border-color: var(--secondary);
}

.action-btn.accent {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.history-item {
  padding: var(--space-2);
  background: var(--glass-bg-medium);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
}

.history-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-sm);
}

.history-time {
  color: var(--text-primary);
  font-weight: var(--font-medium);
}

.history-status {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.history-status.success {
  background: var(--success-alpha);
  color: var(--success-dark);
}

.history-status.failed {
  background: var(--danger-alpha);
  color: var(--danger-dark);
}

.history-size {
  color: var(--text-muted);
  margin-left: auto;
}

.status-message {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-weight: var(--font-medium);
  margin-top: var(--space-4);
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

/* Responsive design */
@media (max-width: 640px) {
  .backup-settings {
    padding: var(--space-4);
  }

  .control-buttons, .action-buttons {
    flex-direction: column;
  }

  .control-btn, .action-btn {
    justify-content: center;
  }

  .scheduler-status {
    flex-direction: row;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .status-item {
    flex: 1;
    min-width: 120px;
  }
}
</style>