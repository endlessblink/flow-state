/**
 * Unified Backup System — Orchestrator
 *
 * Consolidates 4 competing backup implementations into a single, cohesive system.
 * Replaces: useBackupManager, useSimpleBackup, useAutoBackup, useBackupRestoration
 *
 * TASK-1156: Refactored from monolith into modular sub-composables.
 * See backup/ directory for individual modules.
 *
 * @version 2.0.0
 * @since 2025-12-03
 */

import { ref, computed, onMounted, onUnmounted, getCurrentInstance } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'
import { useCanvasStore } from '@/stores/canvas'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'

import {
  DEFAULT_CONFIG,
  BACKUP_SCHEMA_VERSION,
  formatTimestamp
} from './types'
import type {
  BackupConfig,
  BackupStats,
  BackupSystemState,
  BackupData,
  BackupContext
} from './types'

import { createHistoryOperations } from './backupHistory'
import { createGoldenOperations } from './backupGolden'
import { createCoreOperations } from './backupCore'
import { createRestoreOperations } from './backupRestore'
import { createExportOperations } from './backupExport'

export function useBackupSystem(userConfig: Partial<BackupConfig> = {}) {
  // Merge user config with defaults
  const config = ref<BackupConfig>({ ...DEFAULT_CONFIG, ...userConfig })

  // Dependencies
  const taskStore = useTaskStore()
  const projectStore = useProjectStore()
  const canvasStore = useCanvasStore()
  const db = useSupabaseDatabase()

  // State
  const state = ref<BackupSystemState>({
    isReady: false,
    isRestoring: false,
    restoreProgress: 0,
    error: null
  })

  const stats = ref<BackupStats>({
    lastBackupTime: null,
    totalBackups: 0,
    isBackupInProgress: false,
    historyCount: 0
  })

  const backupHistory = ref<BackupData[]>([])

  // Timers
  let autoBackupInterval: NodeJS.Timeout | null = null

  // ============================================================================
  // Create Shared Context
  // ============================================================================

  const ctx: BackupContext = {
    config,
    state,
    stats,
    backupHistory,
    taskStore,
    projectStore,
    canvasStore,
    db
  }

  // ============================================================================
  // Compose Operations via Factory Functions
  // ============================================================================

  const historyOps = createHistoryOperations(ctx)
  const goldenOps = createGoldenOperations(ctx)
  const coreOps = createCoreOperations(ctx, historyOps, goldenOps)
  const restoreOps = createRestoreOperations(ctx, coreOps, goldenOps)
  const exportOps = createExportOperations(ctx, coreOps, restoreOps, historyOps)

  // ============================================================================
  // Auto-Backup
  // ============================================================================

  /**
   * Start automatic backup scheduler
   */
  function startAutoBackup(): void {
    if (autoBackupInterval) {
      stopAutoBackup()
    }

    if (!config.value.enabled || config.value.autoSaveInterval <= 0) {
      return
    }

    console.log(`[Backup] Starting auto-backup every ${config.value.autoSaveInterval / 1000}s`)

    autoBackupInterval = setInterval(async () => {
      if (config.value.enabled) {
        await coreOps.createBackup('auto')
      }
    }, config.value.autoSaveInterval)
  }

  /**
   * Stop automatic backup scheduler
   */
  function stopAutoBackup(): void {
    if (autoBackupInterval) {
      clearInterval(autoBackupInterval)
      autoBackupInterval = null
      console.log('[Backup] Auto-backup stopped')
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Check if backup contains Hebrew content
   */
  function hasHebrewContent(backup: BackupData): boolean {
    if (!backup?.tasks) return false
    const hebrewRegex = /[\u0590-\u05FF]/
    return backup.tasks.some(task => task.title && hebrewRegex.test(task.title))
  }

  /**
   * Get backup status summary
   */
  function getStatus() {
    return {
      isReady: state.value.isReady,
      isEnabled: config.value.enabled,
      lastBackupTime: stats.value.lastBackupTime,
      formattedLastBackup: stats.value.lastBackupTime
        ? formatTimestamp(stats.value.lastBackupTime)
        : 'Never',
      historyCount: stats.value.historyCount,
      isBackupInProgress: stats.value.isBackupInProgress,
      isRestoring: state.value.isRestoring,
      error: state.value.error
    }
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Initialize backup system
   */
  async function initialize(): Promise<void> {
    console.log('[Backup] Initializing...')

    // Load history
    historyOps.loadHistory()

    // Wait for tasks to be available
    await waitForTasks()

    // Start auto-backup
    startAutoBackup()

    // Create initial backup if none exists
    if (!historyOps.getLatestBackup()) {
      await coreOps.createBackup('auto')
    }

    state.value.isReady = true
    console.log('[Backup] Initialized successfully')
  }

  /**
   * Wait for task store to be ready
   */
  async function waitForTasks(timeout = 10000): Promise<void> {
    const startTime = Date.now()

    return new Promise((resolve) => {
      const check = () => {
        if (Array.isArray(taskStore.tasks)) {
          resolve()
          return
        }

        if (Date.now() - startTime > timeout) {
          console.warn('[Backup] Timeout waiting for tasks')
          resolve()
          return
        }

        setTimeout(check, 100)
      }
      check()
    })
  }

  // Lifecycle hooks
  if (getCurrentInstance()) {
    onMounted(() => {
      // Delay initialization to ensure stores are ready
      setTimeout(initialize, 1500)
    })

    onUnmounted(() => {
      stopAutoBackup()
    })
  }

  // ============================================================================
  // Return Public API (same shape as original monolith)
  // ============================================================================

  return {
    // State
    config,
    state: computed(() => state.value),
    stats: computed(() => stats.value),
    backupHistory: computed(() => backupHistory.value),

    // Core operations
    createBackup: coreOps.createBackup,
    restoreBackup: restoreOps.restoreBackup,

    // TASK-344: Dry-run analysis (preview before restore)
    analyzeRestore: restoreOps.analyzeRestore,

    // History
    getLatestBackup: historyOps.getLatestBackup,
    clearHistory: historyOps.clearHistory,

    // Auto-backup
    startAutoBackup,
    stopAutoBackup,

    // Export/Import
    exportBackup: exportOps.exportBackup,
    importBackup: exportOps.importBackup,
    downloadBackup: exportOps.downloadBackup,
    restoreFromFile: exportOps.restoreFromFile,

    // Utilities
    hasHebrewContent,
    getStatus,

    // Initialize (can be called manually if needed)
    initialize,

    // BUG-059 FIX: Golden backup and safety methods
    getGoldenBackup: goldenOps.getGoldenBackup,
    getMaxTaskCount: coreOps.getMaxTaskCount,

    // TASK-332: Get all golden backups in rotation (for UI display)
    getGoldenBackups: goldenOps.getGoldenBackups,

    // TASK-153: Validate golden backup before restore
    validateGoldenBackup: goldenOps.validateGoldenBackup,

    // Restore from golden backup (last known good state)
    // TASK-153: Now filters out items deleted in Supabase before restoring
    restoreFromGoldenBackup: async (skipValidation: boolean = false) => {
      const golden = goldenOps.getGoldenBackup()
      if (!golden) {
        console.error('[Backup] No golden backup available')
        return false
      }

      // TASK-153: Validate and warn about age/deleted items
      if (!skipValidation) {
        const validation = await goldenOps.validateGoldenBackup()
        if (validation) {
          if (validation.warnings.length > 0) {
            console.warn('[Backup] Golden backup validation warnings:', validation.warnings)
          }
          console.log(`[Backup] Golden backup preview:`, {
            tasks: `${validation.preview.tasks.toRestore}/${validation.preview.tasks.total} (${validation.preview.tasks.filtered} filtered)`,
            projects: `${validation.preview.projects.toRestore}/${validation.preview.projects.total} (${validation.preview.projects.filtered} filtered)`,
            groups: `${validation.preview.groups.toRestore}/${validation.preview.groups.total} (${validation.preview.groups.filtered} filtered)`
          })
        }
      }

      // TASK-153: Filter out items that are deleted in Supabase
      const filteredGolden = await goldenOps.filterGoldenBackupData(golden)

      console.log(`[Backup] Restoring from golden backup: ${filteredGolden.metadata?.taskCount} tasks (filtered from ${golden.metadata?.taskCount})`)
      // TASK-344: Explicitly specify no dry-run to get boolean return
      const result = await restoreOps.restoreBackup(filteredGolden, { dryRun: false, backupSource: 'golden' })
      return result === true
    },

    // TASK-332: Restore from a specific golden backup in the rotation (by index)
    restoreFromGoldenBackupByIndex: async (index: number, skipValidation: boolean = false) => {
      const rotation = goldenOps.getGoldenBackups()
      if (index < 0 || index >= rotation.length) {
        console.error(`[Backup] Invalid golden backup index: ${index}. Available: 0-${rotation.length - 1}`)
        return false
      }

      const golden = rotation[index]
      if (!skipValidation) {
        console.log(`[Backup] Restoring from golden backup #${index + 1}: ${golden.metadata?.taskCount} tasks`)
      }

      // TASK-153: Filter out items that are deleted in Supabase
      const filteredGolden = await goldenOps.filterGoldenBackupData(golden)

      console.log(`[Backup] Restoring from golden backup #${index + 1}: ${filteredGolden.metadata?.taskCount} tasks (filtered from ${golden.metadata?.taskCount})`)
      const result = await restoreOps.restoreBackup(filteredGolden, { dryRun: false, backupSource: `golden-${index}` })
      return result === true
    },

    // TASK-153: Get validation info for UI display before restore
    getGoldenBackupValidation: goldenOps.validateGoldenBackup,

    // TASK-154: Shadow Mirror (System 3) Recovery
    fetchShadowBackup: async () => {
      try {
        const response = await fetch('/shadow-latest.json?t=' + Date.now())
        if (!response.ok) throw new Error('Shadow snapshot not found')
        return await response.json()
      } catch (error) {
        console.warn('[Backup] Shadow sync info not available:', error)
        return null
      }
    },

    restoreFromShadow: async (shadowData: any) => {
      console.log(`[Backup] Restoring from Shadow Hub: ${shadowData.meta?.counts?.tasks} tasks`)
      // TASK-344: Explicitly specify no dry-run to get boolean return
      const result = await restoreOps.restoreBackup({
        ...shadowData,
        id: `shadow_${shadowData.meta.timestamp}`,
        timestamp: shadowData.meta.timestamp,
        type: 'emergency',
        version: BACKUP_SCHEMA_VERSION,
        checksum: '',
        metadata: {
          taskCount: shadowData.meta.counts.tasks,
          projectCount: shadowData.meta.counts.projects,
          groupCount: shadowData.meta.counts.groups
        }
      } as BackupData, { dryRun: false, backupSource: 'shadow' })
      return result === true
    }
  }
}

// Default export for convenience
export default useBackupSystem
