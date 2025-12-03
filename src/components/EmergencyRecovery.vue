<template>
  <div class="emergency-recovery">
    <!-- Backup Status -->
    <div class="backup-status">
      <div class="status-header">
        <h3>🛡️ Data Protection Status</h3>
        <button
          @click="showDetails = !showDetails"
          class="toggle-details"
        >
          {{ showDetails ? 'Hide' : 'Show' }} Details
        </button>
      </div>

      <div class="status-indicators">
        <div class="indicator" :class="{ active: autoBackup.isBackupEnabled }">
          <span class="icon">💾</span>
          <span>Auto-Backup</span>
        </div>
        <div class="indicator" :class="{ active: lastBackupTime }">
          <span class="icon">✅</span>
          <span>Last Backup</span>
        </div>
        <div class="indicator" :class="{ active: backupHistory.length > 0 }">
          <span class="icon">📦</span>
          <span>{{ backupHistory.length }} Backups</span>
        </div>
      </div>

      <div v-if="showDetails" class="backup-details">
        <p v-if="lastBackupTime">
          Last backup: {{ formatTime(lastBackupTime) }}
        </p>
        <p v-else class="warning">
          No backups available yet
        </p>
      </div>
    </div>

    <!-- Recovery Actions -->
    <div class="recovery-actions">
      <h4>🔄 Emergency Recovery</h4>

      <div class="action-group">
        <button
          @click="createManualBackup"
          class="action-button primary"
        >
          💾 Create Manual Backup
        </button>

        <button
          @click="showRestoreDialog = true"
          :disabled="backupHistory.length === 0"
          class="action-button secondary"
        >
          🔄 Restore from Backup
        </button>

        <button
          @click="triggerFileUpload"
          class="action-button secondary"
        >
          📁 Restore from File
        </button>

        <button
          @click="downloadLatestBackup"
          :disabled="backupHistory.length === 0"
          class="action-button tertiary"
        >
          💾 Download Backup
        </button>
      </div>
    </div>

    <!-- Restore Dialog -->
    <div v-if="showRestoreDialog" class="restore-dialog-overlay" @click="closeRestoreDialog">
      <div class="restore-dialog" @click.stop>
        <div class="dialog-header">
          <h3>🔄 Restore from Backup</h3>
          <button @click="closeRestoreDialog" class="close-button">×</button>
        </div>

        <div class="backup-list">
          <div
            v-for="(backup, index) in backupHistory.slice(0, 5)"
            :key="backup.timestamp"
            class="backup-item"
            @click="selectBackup(backup)"
            :class="{ selected: selectedBackup?.timestamp === backup.timestamp }"
          >
            <div class="backup-info">
              <div class="backup-time">{{ formatTime(backup.timestamp) }}</div>
              <div class="backup-details">
                {{ backup.tasks.length }} tasks,
                {{ backup.projects.length }} projects
              </div>
            </div>
            <div class="backup-actions">
              <button @click.stop="downloadBackup(backup)" class="download-btn">
                💾
              </button>
            </div>
          </div>
        </div>

        <div class="dialog-actions">
          <button
            @click="confirmRestore"
            :disabled="!selectedBackup"
            class="action-button primary"
          >
            🔄 Restore Selected
          </button>
          <button @click="closeRestoreDialog" class="action-button secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- Hidden file input -->
    <input
      ref="fileInput"
      type="file"
      accept=".json"
      style="display: none"
      @change="handleFileUpload"
    />

    <!-- Success/Error Messages -->
    <div v-if="message" class="message" :class="messageType">
      {{ message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import useBackupSystem, { type BackupData } from '@/composables/useBackupSystem'

// Use unified backup system
const backup = useBackupSystem()
const showDetails = ref(false)
const showRestoreDialog = ref(false)
const selectedBackup = ref<BackupData | null>(null)
const message = ref('')
const messageType = ref<'success' | 'error' | 'warning'>('success')
const fileInput = ref<HTMLInputElement>()

// Computed - map to unified system
const lastBackupTime = computed(() => backup.stats.value.lastBackupTime)
const backupHistory = computed(() => backup.backupHistory.value)

// Legacy compatibility object for template
const autoBackup = {
  isBackupEnabled: computed(() => backup.config.value.enabled)
}

// Methods
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleString()
}

const showMessage = (msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
  message.value = msg
  messageType.value = type
  setTimeout(() => {
    message.value = ''
  }, 5000)
}

const createManualBackup = async () => {
  try {
    await backup.createBackup('manual')
    showMessage('✅ Manual backup created successfully', 'success')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    showMessage(`❌ Backup failed: ${errorMessage}`, 'error')
  }
}

const downloadLatestBackup = async () => {
  try {
    await backup.downloadBackup()
    showMessage('💾 Backup downloaded successfully', 'success')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    showMessage(`❌ Download failed: ${errorMessage}`, 'error')
  }
}

const downloadBackup = async (backupItem: BackupData) => {
  try {
    await backup.downloadBackup(backupItem)
    showMessage('💾 Backup downloaded successfully', 'success')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    showMessage(`❌ Download failed: ${errorMessage}`, 'error')
  }
}

const triggerFileUpload = () => {
  fileInput.value?.click()
}

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  try {
    await backup.restoreFromFile(file)
    showMessage('✅ Restored from file successfully', 'success')

    // Reset file input
    target.value = ''
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    showMessage(`❌ Restore failed: ${errorMessage}`, 'error')
  }
}

const selectBackup = (backupItem: BackupData) => {
  selectedBackup.value = backupItem
}

const closeRestoreDialog = () => {
  showRestoreDialog.value = false
  selectedBackup.value = null
}

const confirmRestore = async () => {
  if (!selectedBackup.value) return

  try {
    await backup.restoreBackup(selectedBackup.value)
    showMessage('✅ Restored from backup successfully', 'success')
    closeRestoreDialog()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    showMessage(`❌ Restore failed: ${errorMessage}`, 'error')
  }
}

onMounted(() => {
  console.log('🛡️ Emergency Recovery component mounted')
})
</script>

<style scoped>
.emergency-recovery {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

.backup-status {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.status-header h3 {
  margin: 0;
  color: #3b82f6;
}

.toggle-details {
  background: none;
  border: 1px solid #3b82f6;
  color: #3b82f6;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.status-indicators {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0.3;
  transition: opacity 0.2s;
}

.indicator.active {
  opacity: 1;
}

.indicator .icon {
  font-size: 16px;
}

.backup-details {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(59, 130, 246, 0.2);
}

.backup-details p {
  margin: 0;
  font-size: 14px;
  color: #64748b;
}

.backup-details .warning {
  color: #f59e0b;
}

.recovery-actions h4 {
  margin: 0 0 16px 0;
  color: #374151;
}

.action-group {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.action-button {
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-button.primary {
  background: transparent;
  border: 1px solid var(--brand-primary);
  color: var(--brand-primary);
}

.action-button.primary:hover:not(:disabled) {
  background: rgba(78, 205, 196, 0.08);
  border-color: var(--brand-hover);
  color: var(--brand-hover);
}

.action-button.secondary {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-secondary);
}

.action-button.secondary:hover:not(:disabled) {
  background: var(--state-hover-bg);
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.action-button.tertiary {
  background: transparent;
  border: 1px solid var(--border-light);
  color: var(--text-muted);
}

.action-button.tertiary:hover:not(:disabled) {
  background: var(--state-hover-bg);
  border-color: var(--border-medium);
  color: var(--text-secondary);
}

.restore-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.restore-dialog {
  background: var(--surface-elevated);
  border-radius: 12px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.dialog-header h3 {
  margin: 0;
  color: #1f2937;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6b7280;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.backup-list {
  margin-bottom: 20px;
}

.backup-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.backup-item:hover {
  background: #f9fafb;
}

.backup-item.selected {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.05);
}

.backup-info {
  flex: 1;
}

.backup-time {
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 4px;
}

.backup-details {
  font-size: 14px;
  color: #6b7280;
}

.download-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.message {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 12px 16px;
  border-radius: 8px;
  font-weight: 500;
  z-index: 2000;
  animation: slideIn 0.3s ease-out;
}

.message.success {
  background: #10b981;
  color: white;
}

.message.error {
  background: #ef4444;
  color: white;
}

.message.warning {
  background: #f59e0b;
  color: white;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>