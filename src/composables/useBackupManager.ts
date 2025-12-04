/**
 * 🛡️ BACKUP MANAGER
 * Integrates RobustBackupSystem with application stores and provides automatic backup triggers
 */

import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useUIStore } from '@/stores/ui'
import { useCanvasStore } from '@/stores/canvas'
import { useTimerStore } from '@/stores/timer'
import { RobustBackupSystem } from '@/utils/RobustBackupSystem'

export interface BackupTriggerConfig {
  enabled: boolean
  autoSaveInterval: number // in milliseconds
  debounceDelay: number // in milliseconds
  throttleEvents: boolean
}

export interface BackupStats {
  lastBackupTime: string | null
  totalBackups: number
  successfulBackups: number
  failedBackups: number
  backupInProgress: boolean
  lastBackupDuration: number
  nextBackupTime: number | null
}

export function useBackupManager(config: Partial<BackupTriggerConfig> = {}) {
  // Default configuration
  const backupConfig = ref<BackupTriggerConfig>({
    enabled: true,
    autoSaveInterval: 5 * 60 * 1000, // 5 minutes
    debounceDelay: 2000, // 2 seconds
    throttleEvents: true,
    ...config
  })

  const taskStore = useTaskStore()
  const uiStore = useUIStore()
  const canvasStore = useCanvasStore()
  const timerStore = useTimerStore()

  // Backup statistics
  const backupStats = ref<BackupStats>({
    lastBackupTime: null,
    totalBackups: 0,
    successfulBackups: 0,
    failedBackups: 0,
    backupInProgress: false,
    lastBackupDuration: 0,
    nextBackupTime: null
  })

  // Debounce timer
  let backupDebounceTimer: NodeJS.Timeout | null = null
  let autoSaveInterval: NodeJS.Timeout | null = null

  // Throttle function for rapid changes
  let lastBackupTime = 0
  const throttleTime = 5000 // 5 seconds

  // Get current application state
  const getApplicationState = () => {
    return {
      tasks: taskStore.tasks || [],
      projects: taskStore.projects || [],
      canvas: {
        nodes: canvasStore.nodes || [],
        edges: canvasStore.edges || [],
        viewport: canvasStore.viewport || {},
        sections: canvasStore.sections || []
      },
      timer: {
        sessions: timerStore.sessions || [],
        settings: timerStore.settings || {},
        currentSession: timerStore.currentSession || null
      },
      ui: {
        theme: uiStore.theme || 'dark',
        sidebarCollapsed: uiStore.sidebarCollapsed || false,
        activeView: uiStore.activeView || 'board'
      },
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        userAgent: navigator.userAgent,
        url: window.location.href
      }
    }
  }

  // Create backup function
  const createBackup = async (): Promise<boolean> => {
    if (!backupConfig.value.enabled || backupStats.value.backupInProgress) {
      console.log('⏸️ Backup skipped - disabled or in progress')
      return false
    }

    const startTime = performance.now()
    backupStats.value.backupInProgress = true

    try {
      const appState = getApplicationState()
      console.log('💾 Creating backup...', {
        tasksCount: appState.tasks.length,
        projectsCount: appState.projects.length,
        canvasNodesCount: appState.canvas.nodes.length,
        timerSessionsCount: appState.timer.sessions.length
      })

      const results = await RobustBackupSystem.createMultiLayerBackup(appState)

      backupStats.value.totalBackups++
      backupStats.value.lastBackupTime = new Date().toISOString()
      backupStats.value.lastBackupDuration = performance.now() - startTime

      const successfulBackups = results.filter(r => r.success).length
      backupStats.value.successfulBackups += successfulBackups
      backupStats.value.failedBackups += (results.length - successfulBackups)

      console.log('✅ Backup completed:', {
        totalBackups: backupStats.value.totalBackups,
        successfulBackups: successfulBackups,
        failedBackups: results.length - successfulBackups,
        duration: `${backupStats.value.lastBackupDuration.toFixed(2)}ms`,
        results: results.map(r => ({
          location: r.location,
          success: r.success,
          error: r.error
        }))
      })

      return successfulBackups > 0

    } catch (error) {
      console.error('❌ Backup failed:', error)
      backupStats.value.totalBackups++
      backupStats.value.failedBackups++
      backupStats.value.lastBackupDuration = performance.now() - startTime
      return false

    } finally {
      backupStats.value.backupInProgress = false
      // Update next backup time
      if (backupConfig.value.autoSaveInterval > 0) {
        backupStats.value.nextBackupTime = Date.now() + backupConfig.value.autoSaveInterval
      }
    }
  }

  // Debounced backup function
  const debouncedCreateBackup = (): void => {
    if (backupDebounceTimer) {
      clearTimeout(backupDebounceTimer)
    }

    backupDebounceTimer = setTimeout(() => {
      createBackup()
    }, backupConfig.value.debounceDelay)
  }

  // Throttled backup function for rapid changes
  const throttledCreateBackup = (): void => {
    const now = Date.now()
    if (now - lastBackupTime < throttleTime) {
      return // Skip to prevent too rapid backups
    }

    lastBackupTime = now
    createBackup()
  }

  // Setup automatic backup triggers
  const setupAutomaticTriggers = (): void => {
    // 1. Auto-save interval
    if (backupConfig.value.autoSaveInterval > 0) {
      autoSaveInterval = setInterval(() => {
        if (backupConfig.value.enabled) {
          createBackup()
        }
      }, backupConfig.value.autoSaveInterval)

      backupStats.value.nextBackupTime = Date.now() + backupConfig.value.autoSaveInterval
      console.log('🕐️ Auto-save interval set to', backupConfig.value.autoSaveInterval / 1000, 'seconds')
    }

    // SYNC FIX: Consolidated single watcher instead of 4 separate deep watchers
    // This prevents the "thundering herd" problem where all 4 watchers fire simultaneously
    // and create cascading backup operations during sync
    const unwatchAll = watch(
      () => ({
        // Track only essential change indicators (not full deep objects)
        taskCount: taskStore.$state.tasks?.length || 0,
        taskUpdates: taskStore.$state.tasks?.map(t => t.updatedAt).join(',') || '',
        projectCount: taskStore.$state.projects?.length || 0,
        sectionCount: canvasStore.sections?.length || 0,
        sessionCount: timerStore.sessions?.length || 0
      }),
      () => {
        // Use debounced backup for all store changes
        // This consolidates what was previously 4 separate triggers into 1
        if (backupConfig.value.throttleEvents) {
          throttledCreateBackup()
        } else {
          debouncedCreateBackup()
        }
      },
      { deep: false } // Shallow watch on the computed object is sufficient
    )

    // Cleanup functions
    onUnmounted(() => {
      if (autoSaveInterval) {
        clearInterval(autoSaveInterval)
        autoSaveInterval = null
      }
      if (backupDebounceTimer) {
        clearTimeout(backupDebounceTimer)
        backupDebounceTimer = null
      }
      unwatchAll()
    })

    console.log('✅ Automatic backup triggers setup completed')
  }

  // Manual backup function
  const manualBackup = async (): Promise<boolean> => {
    console.log('🔄 Manual backup triggered')
    return createBackup()
  }

  // Restore backup function
  const restoreBackup = async (): Promise<any | null> => {
    try {
      console.log('🔄 Starting backup restoration...')
      const restoredData = await RobustBackupSystem.restoreFromBackup()

      if (restoredData) {
        console.log('✅ Backup restored successfully:', {
          tasksCount: restoredData.tasks?.length || 0,
          projectsCount: restoredData.projects?.length || 0
        })

        // NOTE: Data restoration to stores requires careful state merging logic
        // Implementation pending due to complexity of store state synchronization

        return restoredData
      } else {
        console.log('ℹ️ No backup found for restoration')
        return null
      }
    } catch (error) {
      console.error('❌ Backup restoration failed:', error)
      return null
    }
  }

  // Get backup status
  const getBackupStatus = () => {
    const robustStatus = RobustBackupSystem.getBackupStatus()
    return {
      ...robustStatus,
      ...backupStats.value,
      autoSaveInterval: backupConfig.value.autoSaveInterval,
      enabled: backupConfig.value.enabled
    }
  }

  // Initialize backup system
  const initializeBackup = async (): Promise<void> => {
    try {
      console.log('🛡️ Initializing backup manager...')

      // Check current backup status
      const status = getBackupStatus()
      console.log('📊 Current backup status:', status)

      // Setup automatic triggers
      setupAutomaticTriggers()

      // Create initial backup if enabled
      if (backupConfig.value.enabled) {
        console.log('🚀 Creating initial backup...')
        await createBackup()
      }

      console.log('✅ Backup manager initialization completed')
    } catch (error) {
      console.error('❌ Backup manager initialization failed:', error)
    }
  }

  // Lifecycle
  onMounted(() => {
    // Initialize after a short delay to ensure stores are ready
    setTimeout(initializeBackup, 2000)
  })

  return {
    // Configuration
    backupConfig,

    // Statistics
    backupStats: computed(() => backupStats.value),

    // Methods
    createBackup,
    manualBackup,
    restoreBackup,
    getBackupStatus,

    // Utilities
    getApplicationState
  }
}