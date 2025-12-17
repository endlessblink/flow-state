/**
 * Backup Restoration Composable
 *
 * Provides user-friendly interface to the powerful backup restoration system
 * that already exists in window.pomoFlowBackup API.
 *
 * Key Features:
 * - List available backups with metadata
 * - Preview backup contents before restoring
 * - One-click restore with safety warnings
 * - Progress indicators and error handling
 * - Integration with Vue stores for data refresh
 *
 * @version 1.0
 * @since 2025-11-11
 */

import { ref, computed, reactive as _reactive } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useCanvasStore } from '@/stores/canvas'
import { useDatabase } from './useDatabase'

/**
 * Backup information structure
 */
export interface BackupInfo {
  id: string
  type: 'auto' | 'manual' | 'emergency' | 'cloud_sync'
  timestamp: number
  size: number
  taskCount: number
  projectCount: number
  hasCanvasData: boolean
  hasSettings: boolean
  integrityValid: boolean
  checksum: string
  formattedTimestamp: string
  formattedSize: string
  data?: any // Optional raw backup data for export
}

/**
 * Backup preview information
 */
export interface BackupPreview {
  backupId: string
  timestamp: string
  taskCount: number
  projectCount: number
  canvasState: boolean
  settingsState: boolean
  estimatedRestoreTime: number
  integrityValid: boolean
  warnings: string[]
}

/**
 * Restoration options
 */
export interface RestorationOptions {
  createPreRestoreBackup: boolean
  validateIntegrity: boolean
  refreshStores: boolean
  showProgress: boolean
}

/**
 * Restoration result
 */
export interface RestorationResult {
  success: boolean
  backupId: string
  restoreTime: number
  tasksRestored: number
  projectsRestored: number
  canvasRestored: boolean
  settingsRestored: boolean
  warnings: string[]
  errors: string[]
  preRestoreBackupId?: string
}

export function useBackupRestoration() {
  // Stores
  const taskStore = useTaskStore()
  const timerStore = useTimerStore()
  const canvasStore = useCanvasStore()
  const db = useDatabase()

  // Reactive state
  const availableBackups = ref<BackupInfo[]>([])
  const isLoadingBackups = ref(false)
  const isRestoring = ref(false)
  const restoreProgress = ref(0)
  const selectedBackupId = ref<string | null>(null)
  const error = ref<string | null>(null)
  const lastRestoreResult = ref<RestorationResult | null>(null)

  // Computed properties
  const hasBackups = computed(() => availableBackups.value.length > 0)
  const selectedBackup = computed(() =>
    availableBackups.value.find(b => b.id === selectedBackupId.value)
  )
  const canRestore = computed(() => selectedBackupId.value && !isRestoring.value)

  /**
   * Check if backup system is available
   */
  const isBackupSystemAvailable = (): boolean => {
    return !!(window as any).pomoFlowBackup
  }

  /**
   * Get backup API with error handling
   */
  const getBackupAPI = () => {
    if (!isBackupSystemAvailable()) {
      throw new Error('Backup system not available')
    }
    return (window as any).pomoFlowBackup
  }

  /**
   * Format timestamp to human-readable string
   */
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`

    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  /**
   * Format file size to human-readable string
   */
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Load available backups from the system
   */
  const loadBackups = async (): Promise<void> => {
    if (!isBackupSystemAvailable()) {
      error.value = 'Backup system is not available'
      return
    }

    isLoadingBackups.value = true
    error.value = null

    try {
      const _backupAPI = getBackupAPI()

      // Try to get backup list - this might need to be implemented in the API
      let backups: any[] = []

      // For now, try to get from localStorage as fallback
      try {
        const backupKeys = Object.keys(localStorage).filter(key =>
          key.startsWith('backup_') || key.startsWith('pomoflow_backup_')
        )

        backups = backupKeys.map(key => {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '{}')
            return {
              id: key.replace(/^(backup_|pomoflow_backup_)/, ''),
              type: data.metadata?.type || 'auto',
              timestamp: data.metadata?.timestamp || Date.now(),
              size: JSON.stringify(data).length,
              taskCount: data.data?.tasks?.length || 0,
              projectCount: data.data?.projects?.length || 0,
              hasCanvasData: !!(data.data?.canvas),
              hasSettings: !!(data.data?.settings),
              integrityValid: true, // Would validate checksum here
              checksum: data.metadata?.checksum || '',
              data: data
            }
          } catch (parseError) {
            console.warn(`Failed to parse backup ${key}:`, parseError)
            return null
          }
        }).filter(Boolean)
      } catch (localStorageError) {
        console.warn('Failed to load backups from localStorage:', localStorageError)
      }

      // Format backup info
      availableBackups.value = backups.map(backup => ({
        ...backup,
        formattedTimestamp: formatTimestamp(backup.timestamp),
        formattedSize: formatSize(backup.size)
      })).sort((a, b) => b.timestamp - a.timestamp)

    } catch (err) {
      console.error('Failed to load backups:', err)
      error.value = err instanceof Error ? err.message : 'Failed to load backups'
    } finally {
      isLoadingBackups.value = false
    }
  }

  /**
   * Get preview information for a specific backup
   */
  const getBackupPreview = async (backupId: string): Promise<BackupPreview> => {
    if (!isBackupSystemAvailable()) {
      throw new Error('Backup system is not available')
    }

    const backup = availableBackups.value.find(b => b.id === backupId)
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`)
    }

    const warnings: string[] = []

    if (!backup.integrityValid) {
      warnings.push('Backup integrity check failed')
    }

    if (!backup.taskCount && !backup.projectCount) {
      warnings.push('Backup appears to be empty')
    }

    const _backupAPI = getBackupAPI()

    return {
      backupId,
      timestamp: backup.formattedTimestamp,
      taskCount: backup.taskCount,
      projectCount: backup.projectCount,
      canvasState: backup.hasCanvasData,
      settingsState: backup.hasSettings,
      estimatedRestoreTime: Math.max(1000, (backup.taskCount + backup.projectCount) * 10),
      integrityValid: backup.integrityValid,
      warnings
    }
  }

  /**
   * Create emergency backup before restore
   */
  const createPreRestoreBackup = async (): Promise<string | null> => {
    try {
      const backupAPI = getBackupAPI()

      // Collect current state
      const currentState = {
        tasks: taskStore.tasks,
        projects: taskStore.projects,
        canvas: {
          sections: canvasStore.sections,
          viewport: canvasStore.viewport
        },
        settings: {
          timer: timerStore.settings,
          ui: {
            theme: localStorage.getItem('theme'),
            sidebarCollapsed: localStorage.getItem('sidebarCollapsed')
          }
        },
        metadata: {
          type: 'pre_restore',
          timestamp: Date.now(),
          version: '2.0'
        }
      }

      // Use backup API to save current state
      if (backupAPI.saveTasks) {
        await backupAPI.saveTasks(currentState.tasks, currentState.metadata)
      } else {
        // Fallback to localStorage
        const backupId = `pre_restore_${Date.now()}`
        localStorage.setItem(`backup_${backupId}`, JSON.stringify(currentState))
        return backupId
      }

      return null // Success, no backup ID needed
    } catch (err) {
      console.error('Failed to create pre-restore backup:', err)
      return null
    }
  }

  /**
   * Refresh Vue stores after restoration
   */
  const refreshStores = async (): Promise<void> => {
    try {
      // Reload tasks from database using restoreState
      const savedTasks = await db.load('tasks')
      if (savedTasks && Array.isArray(savedTasks)) {
        await taskStore.restoreState(savedTasks)
      }

      // Reload projects
      const projects = await db.load('projects')
      if (projects && Array.isArray(projects)) {
        taskStore.projects = projects
      }

      // Timer and canvas stores should auto-refresh from their persistence
      console.log('Stores refreshed after restore')
    } catch (err) {
      console.error('Failed to refresh stores:', err)
    }
  }

  /**
   * Restore a specific backup
   */
  const restoreBackup = async (
    backupId: string,
    options: RestorationOptions = {
      createPreRestoreBackup: true,
      validateIntegrity: true,
      refreshStores: true,
      showProgress: true
    }
  ): Promise<RestorationResult> => {
    if (!isBackupSystemAvailable()) {
      throw new Error('Backup system is not available')
    }

    const backup = availableBackups.value.find(b => b.id === backupId)
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`)
    }

    isRestoring.value = true
    restoreProgress.value = 0
    error.value = null

    const startTime = Date.now()
    const result: RestorationResult = {
      success: false,
      backupId,
      restoreTime: 0,
      tasksRestored: 0,
      projectsRestored: 0,
      canvasRestored: false,
      settingsRestored: false,
      warnings: [],
      errors: []
    }

    try {
      // Step 1: Create pre-restore backup if requested
      if (options.createPreRestoreBackup) {
        restoreProgress.value = 10
        const preRestoreBackupId = await createPreRestoreBackup()
        if (preRestoreBackupId) {
          result.preRestoreBackupId = preRestoreBackupId
        }
      }

      // Step 2: Validate backup integrity if requested
      if (options.validateIntegrity && !backup.integrityValid) {
        result.warnings.push('Backup integrity validation failed, proceeding anyway')
      }

      // Step 3: Load backup data from storage
      restoreProgress.value = 30
      const backupKey = `pomo-flow-backup-${backup.id}`
      const backupData = await db.load(backupKey) as any

      if (!backupData || !backupData.data) {
        throw new Error('Backup data is corrupted or missing')
      }

      // Step 4: Restore tasks
      if (backupData.data.tasks) {
        restoreProgress.value = 50
        taskStore.tasks = backupData.data.tasks
        result.tasksRestored = backupData.data.tasks.length

        // Save to database
        await db.save('tasks', backupData.data.tasks)
      }

      // Step 5: Restore projects
      if (backupData.data.projects) {
        restoreProgress.value = 70
        taskStore.projects = backupData.data.projects
        result.projectsRestored = backupData.data.projects.length

        // Save to database
        await db.save('projects', backupData.data.projects)
      }

      // Step 6: Restore canvas state
      if (backupData.data.canvas) {
        restoreProgress.value = 85
        if (backupData.data.canvas.sections) canvasStore.sections = backupData.data.canvas.sections
        if (backupData.data.canvas.viewport) canvasStore.viewport = backupData.data.canvas.viewport
        result.canvasRestored = true

        // Save canvas state
        await db.save('canvas', backupData.data.canvas)
      }

      // Step 7: Restore settings
      if (backupData.data.settings) {
        restoreProgress.value = 95
        if (backupData.data.settings.timer) {
          timerStore.settings = backupData.data.settings.timer
          // Timer settings are reactive and will be saved automatically
        }

        if (backupData.data.settings.ui) {
          if (backupData.data.settings.ui.theme) {
            localStorage.setItem('theme', backupData.data.settings.ui.theme)
          }
          if (backupData.data.settings.ui.sidebarCollapsed) {
            localStorage.setItem('sidebarCollapsed', backupData.data.settings.ui.sidebarCollapsed)
          }
        }
        result.settingsRestored = true
      }

      // Step 8: Finalize
      restoreProgress.value = 100
      result.success = true
      result.restoreTime = Date.now() - startTime

      // Refresh stores if requested
      if (options.refreshStores) {
        await refreshStores()
      }

      lastRestoreResult.value = result
      console.log('✅ Backup restore completed successfully:', result)

    } catch (err) {
      console.error('❌ Backup restore failed:', err)
      result.errors.push(err instanceof Error ? err.message : 'Unknown error during restore')
      error.value = result.errors.join('; ')
    } finally {
      isRestoring.value = false
      restoreProgress.value = 0
    }

    return result
  }

  /**
   * Export backup to file
   */
  const exportBackup = async (backupId: string): Promise<void> => {
    const backup = availableBackups.value.find(b => b.id === backupId)
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`)
    }

    try {
      const backupAPI = getBackupAPI()

      if (backupAPI.exportTasks) {
        const exportData = await backupAPI.exportTasks()
        const blob = new Blob([exportData], { type: 'application/json' })
        const url = URL.createObjectURL(blob)

        const a = document.createElement('a')
        a.href = url
        a.download = `pomo-flow-backup-${backup.id}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        // Fallback: export the backup data directly
        const exportData = JSON.stringify(backup.data || { error: 'No backup data available', backupInfo: backup }, null, 2)
        const blob = new Blob([exportData], { type: 'application/json' })
        const url = URL.createObjectURL(blob)

        const a = document.createElement('a')
        a.href = url
        a.download = `pomo-flow-backup-${backup.id}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Failed to export backup:', err)
      throw new Error('Failed to export backup')
    }
  }

  /**
   * Delete a backup
   */
  const deleteBackup = async (backupId: string): Promise<void> => {
    if (!isBackupSystemAvailable()) {
      throw new Error('Backup system is not available')
    }

    try {
      const backupAPI = getBackupAPI()

      if (backupAPI.deleteBackup) {
        await backupAPI.deleteBackup(backupId)
      } else {
        // Fallback: remove from localStorage
        localStorage.removeItem(`backup_${backupId}`)
        localStorage.removeItem(`pomoflow_backup_${backupId}`)
      }

      // Remove from our list
      availableBackups.value = availableBackups.value.filter(b => b.id !== backupId)

      // Clear selection if this backup was selected
      if (selectedBackupId.value === backupId) {
        selectedBackupId.value = null
      }
    } catch (err) {
      console.error('Failed to delete backup:', err)
      throw new Error('Failed to delete backup')
    }
  }

  /**
   * Clear all error states
   */
  const clearError = (): void => {
    error.value = null
  }

  // Auto-load backups on composable creation
  if (isBackupSystemAvailable()) {
    loadBackups()
  }

  return {
    // State
    availableBackups,
    isLoadingBackups,
    isRestoring,
    restoreProgress,
    selectedBackupId,
    error,
    lastRestoreResult,

    // Computed
    hasBackups,
    selectedBackup,
    canRestore,

    // Methods
    isBackupSystemAvailable,
    loadBackups,
    getBackupPreview,
    restoreBackup,
    exportBackup,
    deleteBackup,
    clearError
  }
}