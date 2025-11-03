<template>
  <div class="persistent-memory-manager">
    <!-- Storage Health Indicator -->
    <div class="health-indicator" :class="healthClass">
      <div class="health-icon">
        <Database v-if="healthStatus.isHealthy" :size="16" />
        <AlertTriangle v-else :size="16" />
      </div>
      <div class="health-text">
        <div class="health-title">Storage Status</div>
        <div class="health-details">{{ healthMessage }}</div>
      </div>
    </div>

    <!-- Backup Controls -->
    <div class="backup-controls">
      <button
        @click="createBackup"
        :disabled="isCreatingBackup"
        class="backup-btn primary"
        title="Create immediate backup"
      >
        <RefreshCw v-if="isCreatingBackup" :size="14" class="animate-spin" />
        <Download v-else :size="14" />
        Backup Now
      </button>

      <button
        @click="showRestoreDialog = true"
        :disabled="availableBackups.length === 0"
        class="backup-btn secondary"
        title="Restore from backup"
      >
        <Upload :size="14" />
        Restore ({{ availableBackups.length }})
      </button>

      <button
        @click="exportBackup"
        class="backup-btn secondary"
        title="Export backup file"
      >
        <FileText :size="14" />
        Export
      </button>
    </div>

    <!-- Last Backup Info -->
    <div v-if="lastBackupTime" class="last-backup">
      <Clock :size="12" />
      Last backup: {{ formatBackupTime(lastBackupTime) }}
    </div>

    <!-- Restore Dialog -->
    <BaseModal
      v-if="showRestoreDialog"
      :is-open="showRestoreDialog"
      title="Restore from Backup"
      size="md"
      @close="showRestoreDialog = false"
    >
      <div class="restore-dialog">
        <div class="backup-list">
          <div
            v-for="backup in availableBackups"
            :key="backup.timestamp"
            class="backup-item"
            :class="{ active: selectedBackup?.timestamp === backup.timestamp }"
            @click="selectBackup(backup)"
          >
            <div class="backup-info">
              <div class="backup-date">{{ formatBackupTime(backup.timestamp) }}</div>
              <div class="backup-stats">
                {{ backup.metadata?.totalTasks || 0 }} tasks,
                {{ backup.metadata?.totalProjects || 0 }} projects
              </div>
            </div>
            <div class="backup-actions">
              <button
                @click.stop="restoreBackup(backup)"
                :disabled="isRestoring"
                class="restore-btn"
                :class="{ loading: isRestoring }"
              >
                <RefreshCw v-if="isRestoring && selectedBackup?.timestamp === backup.timestamp" :size="14" class="animate-spin" />
                <Check v-else :size="14" />
                Restore
              </button>
            </div>
          </div>
        </div>

        <div v-if="availableBackups.length === 0" class="no-backups">
          <Database :size="32" />
          <p>No backups available</p>
          <p class="text-muted">Create a backup to enable restore functionality</p>
        </div>

        <div class="dialog-actions">
          <BaseButton variant="secondary" @click="showRestoreDialog = false">
            Cancel
          </BaseButton>
        </div>
      </div>
    </BaseModal>

    <!-- Import Backup Dialog -->
    <BaseModal
      v-if="showImportDialog"
      :is-open="showImportDialog"
      title="Import Backup File"
      size="sm"
      @close="showImportDialog = false"
    >
      <div class="import-dialog">
        <div class="import-instructions">
          <p>Select a backup file to restore your tasks and settings:</p>
          <input
            ref="fileInput"
            type="file"
            accept=".json"
            @change="handleFileImport"
            style="display: none"
          />
          <BaseButton @click="$refs.fileInput.click()">
            <Upload :size="16" />
            Choose File
          </BaseButton>
        </div>

        <div v-if="importError" class="import-error">
          <AlertCircle :size="16" />
          {{ importError }}
        </div>

        <div class="dialog-actions">
          <BaseButton variant="secondary" @click="showImportDialog = false">
            Cancel
          </BaseButton>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePersistentStorage } from '@/composables/usePersistentStorage'
import { useTaskStore } from '@/stores/tasks'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import {
  Database,
  AlertTriangle,
  RefreshCw,
  Download,
  Upload,
  FileText,
  Clock,
  Check,
  AlertCircle
} from 'lucide-vue-next'

const persistentStorage = usePersistentStorage()
const taskStore = useTaskStore()

// State
const showRestoreDialog = ref(false)
const showImportDialog = ref(false)
const selectedBackup = ref<any>(null)
const availableBackups = ref<any[]>([])
const isCreatingBackup = ref(false)
const isRestoring = ref(false)
const lastBackupTime = ref<number>(0)
const importError = ref('')
const fileInput = ref<HTMLInputElement>()

// Health monitoring
const healthStatus = computed(() => persistentStorage.healthStatus.value)
const healthClass = computed(() => ({
  'healthy': healthStatus.value.isHealthy,
  'warning': !healthStatus.value.isHealthy && healthStatus.value.availableLayers.length > 0,
  'error': !healthStatus.value.isHealthy && healthStatus.value.availableLayers.length === 0
}))

const healthMessage = computed(() => {
  if (healthStatus.value.isHealthy) {
    return `${healthStatus.value.availableLayers.length} storage layers available`
  } else {
    return 'Storage issues detected'
  }
})

// Methods
const createBackup = async () => {
  if (isCreatingBackup.value) return

  isCreatingBackup.value = true
  try {
    await persistentStorage.createBackup()
    await loadBackups()
    console.log('✅ Manual backup created successfully')
  } catch (error) {
    console.error('Failed to create backup:', error)
  } finally {
    isCreatingBackup.value = false
  }
}

const loadBackups = async () => {
  try {
    availableBackups.value = await persistentStorage.getAllBackups()
    if (availableBackups.value.length > 0) {
      lastBackupTime.value = availableBackups.value[0].timestamp
    }
  } catch (error) {
    console.error('Failed to load backups:', error)
  }
}

const selectBackup = (backup: any) => {
  selectedBackup.value = backup
}

const restoreBackup = async (backup: any) => {
  if (isRestoring.value) return

  if (!confirm('Are you sure you want to restore from this backup? This will replace all current tasks and settings.')) {
    return
  }

  isRestoring.value = true
  try {
    const success = await persistentStorage.restoreFromBackup(backup)
    if (success) {
      // Reload the task store to refresh data
      await taskStore.loadFromDatabase()
      showRestoreDialog.value = false
      console.log('✅ Backup restored successfully')
    } else {
      console.error('Failed to restore backup')
    }
  } catch (error) {
    console.error('Restore failed:', error)
  } finally {
    isRestoring.value = false
  }
}

const exportBackup = async () => {
  try {
    // Create a backup first
    await persistentStorage.createBackup()

    // Get the latest backup
    const backups = await persistentStorage.getAllBackups()
    if (backups.length > 0) {
      const backup = backups[0]
      const dataStr = JSON.stringify(backup, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })

      const url = URL.createObjectURL(dataBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pomo-flow-backup-${new Date().toISOString().split('T')[0]}.json`
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      console.log('✅ Backup exported successfully')
    }
  } catch (error) {
    console.error('Failed to export backup:', error)
  }
}

const handleFileImport = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  importError.value = ''

  try {
    const text = await file.text()
    const backup = JSON.parse(text)

    if (!backup.tasks && !backup.projects) {
      throw new Error('Invalid backup file format')
    }

    const success = await persistentStorage.restoreFromBackup(backup)
    if (success) {
      await taskStore.loadFromDatabase()
      showImportDialog.value = false
      await loadBackups()
      console.log('✅ Backup imported successfully')
    } else {
      throw new Error('Failed to restore imported backup')
    }
  } catch (error) {
    importError.value = error instanceof Error ? error.message : 'Import failed'
  }

  // Reset file input
  target.value = ''
}

const formatBackupTime = (timestamp: number) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} minutes ago`
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`
  return date.toLocaleDateString()
}

// Lifecycle
onMounted(async () => {
  await loadBackups()

  // Update backups every 30 seconds
  const interval = setInterval(loadBackups, 30000)

  onUnmounted(() => {
    clearInterval(interval)
  })
})
</script>

<style scoped>
.persistent-memory-manager {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
}

.health-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.health-indicator.healthy {
  background: var(--success-bg-subtle);
  border: 1px solid var(--success-bg-light);
}

.health-indicator.warning {
  background: var(--warning-bg-subtle);
  border: 1px solid var(--warning-bg-light);
}

.health-indicator.error {
  background: var(--danger-bg-subtle);
  border: 1px solid var(--danger-bg-light);
}

.health-icon {
  color: var(--text-primary);
}

.health-title {
  font-weight: var(--font-semibold);
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.health-details {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.backup-controls {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.backup-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg-soft);
  color: var(--text-primary);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all 0.2s ease;
}

.backup-btn:hover:not(:disabled) {
  background: var(--glass-bg-medium);
  border-color: var(--accent);
}

.backup-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.backup-btn.primary {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.backup-btn.primary:hover:not(:disabled) {
  background: var(--accent-dark);
}

.last-backup {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.restore-dialog {
  max-height: 400px;
  overflow-y: auto;
}

.backup-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.backup-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
}

.backup-item:hover {
  background: var(--glass-bg-soft);
  border-color: var(--accent);
}

.backup-item.active {
  background: var(--accent-bg-subtle);
  border-color: var(--accent);
}

.backup-info {
  flex: 1;
}

.backup-date {
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.backup-stats {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.restore-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  background: var(--success);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all 0.2s ease;
}

.restore-btn:hover:not(:disabled) {
  background: var(--success-dark);
}

.restore-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.no-backups {
  text-align: center;
  padding: var(--space-6);
  color: var(--text-muted);
}

.no-backups svg {
  margin-bottom: var(--space-3);
  opacity: 0.5;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--glass-border);
}

.import-dialog {
  text-align: center;
}

.import-instructions {
  margin-bottom: var(--space-4);
}

.import-error {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--danger-bg-subtle);
  border: 1px solid var(--danger-bg-light);
  border-radius: var(--radius-md);
  color: var(--danger);
  font-size: var(--text-sm);
  margin-bottom: var(--space-4);
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>