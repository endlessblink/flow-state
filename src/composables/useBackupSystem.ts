/**
 * Unified Backup System
 *
 * Consolidates 4 competing backup implementations into a single, cohesive system.
 * Replaces: useBackupManager, useSimpleBackup, useAutoBackup, useBackupRestoration
 *
 * @version 1.0.0
 * @since 2025-12-03
 */

import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useDatabase, DB_KEYS } from '@/composables/useDatabase'
import { filterMockTasks } from '@/utils/mockTaskDetector'

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface BackupData {
  id: string
  tasks: any[]
  projects: any[]
  canvas: any
  timestamp: number
  version: string
  checksum: string
  type: 'auto' | 'manual' | 'emergency'
  metadata?: {
    taskCount: number
    projectCount: number
    exportedAt?: string
  }
}

export interface BackupConfig {
  enabled: boolean
  autoSaveInterval: number // milliseconds (default: 5 min)
  maxHistorySize: number   // max backups to keep (default: 10)
  filterMockTasks: boolean // remove mock/test tasks (default: true)
}

export interface BackupStats {
  lastBackupTime: number | null
  totalBackups: number
  isBackupInProgress: boolean
  historyCount: number
}

export interface BackupSystemState {
  isReady: boolean
  isRestoring: boolean
  restoreProgress: number
  error: string | null
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  HISTORY: 'pomo-flow-backup-history',
  LATEST: 'pomo-flow-latest-backup',
  STATS: 'pomo-flow-backup-stats'
} as const

const DEFAULT_CONFIG: BackupConfig = {
  enabled: true,
  autoSaveInterval: 5 * 60 * 1000, // 5 minutes
  maxHistorySize: 10,
  filterMockTasks: true
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate simple checksum for data integrity verification
 */
function calculateChecksum(data: any): string {
  const str = JSON.stringify(data)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(16)
}

/**
 * Generate unique backup ID
 */
function generateBackupId(): string {
  return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Format timestamp to human-readable string
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString()
}

// ============================================================================
// Main Composable
// ============================================================================

export function useBackupSystem(userConfig: Partial<BackupConfig> = {}) {
  // Merge user config with defaults
  const config = ref<BackupConfig>({ ...DEFAULT_CONFIG, ...userConfig })

  // Dependencies
  const taskStore = useTaskStore()
  const canvasStore = useCanvasStore()
  const db = useDatabase()

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
  // Core Backup Operations
  // ============================================================================

  /**
   * Create a new backup
   */
  async function createBackup(type: 'auto' | 'manual' | 'emergency' = 'manual'): Promise<BackupData | null> {
    if (stats.value.isBackupInProgress) {
      console.log('[Backup] Skipping - backup already in progress')
      return null
    }

    stats.value.isBackupInProgress = true
    state.value.error = null

    try {
      console.log(`[Backup] Creating ${type} backup...`)

      // Get tasks from store (use any[] to allow mock task filtering)
      let tasks: any[] = taskStore.tasks || []

      // Validate tasks
      if (!Array.isArray(tasks)) {
        console.warn('[Backup] Tasks is not an array, using empty array')
        tasks = []
      }

      // Filter mock tasks if enabled
      if (config.value.filterMockTasks && tasks.length > 0) {
        const filterResult = filterMockTasks(tasks, { confidence: 'medium', logResults: false })
        if (filterResult.mockTasks.length > 0) {
          console.log(`[Backup] Filtered ${filterResult.mockTasks.length} mock tasks`)
        }
        tasks = filterResult.cleanTasks
      }

      // Get other data
      const [projects, canvas] = await Promise.all([
        db.load(DB_KEYS.PROJECTS),
        db.load(DB_KEYS.CANVAS)
      ])

      // Create backup object
      const backupData: BackupData = {
        id: generateBackupId(),
        tasks,
        projects: Array.isArray(projects) ? projects : [],
        canvas: canvas || {},
        timestamp: Date.now(),
        version: '2.0.0',
        checksum: '',
        type,
        metadata: {
          taskCount: tasks.length,
          projectCount: Array.isArray(projects) ? projects.length : 0
        }
      }

      // Calculate checksum
      backupData.checksum = calculateChecksum({
        tasks: backupData.tasks,
        projects: backupData.projects,
        canvas: backupData.canvas
      })

      // Save to localStorage
      saveToHistory(backupData)

      // Update stats
      stats.value.lastBackupTime = backupData.timestamp
      stats.value.totalBackups++

      console.log(`[Backup] Created successfully: ${backupData.metadata?.taskCount} tasks, ${backupData.metadata?.projectCount} projects`)

      return backupData

    } catch (error) {
      console.error('[Backup] Failed to create backup:', error)
      state.value.error = error instanceof Error ? error.message : 'Backup failed'
      return null

    } finally {
      stats.value.isBackupInProgress = false
    }
  }

  /**
   * Restore from a backup
   */
  async function restoreBackup(backup: BackupData | string): Promise<boolean> {
    state.value.isRestoring = true
    state.value.restoreProgress = 0
    state.value.error = null

    try {
      console.log('[Backup] Starting restore...')

      // Parse if string
      const backupData: BackupData = typeof backup === 'string'
        ? JSON.parse(backup)
        : backup

      // Validate backup
      if (!backupData.tasks || !Array.isArray(backupData.tasks)) {
        throw new Error('Invalid backup: missing tasks array')
      }

      // Verify checksum if present
      if (backupData.checksum) {
        const currentChecksum = calculateChecksum({
          tasks: backupData.tasks,
          projects: backupData.projects,
          canvas: backupData.canvas
        })
        if (currentChecksum !== backupData.checksum) {
          console.warn('[Backup] Checksum mismatch - backup may be corrupted')
        }
      }

      state.value.restoreProgress = 20

      // Create emergency backup before restore
      await createBackup('emergency')
      state.value.restoreProgress = 40

      // Restore using atomic transaction
      await db.atomicTransaction([
        () => db.save(DB_KEYS.TASKS, backupData.tasks),
        () => db.save(DB_KEYS.PROJECTS, backupData.projects || []),
        () => db.save(DB_KEYS.CANVAS, backupData.canvas || {})
      ], 'restore-backup')

      state.value.restoreProgress = 80

      // Reload stores (cast to any[] to bypass strict type checking on backup data)
      if (taskStore.restoreState) {
        await taskStore.restoreState(backupData.tasks as any)
      }

      state.value.restoreProgress = 100

      console.log(`[Backup] Restored successfully: ${backupData.tasks.length} tasks`)
      return true

    } catch (error) {
      console.error('[Backup] Restore failed:', error)
      state.value.error = error instanceof Error ? error.message : 'Restore failed'
      return false

    } finally {
      state.value.isRestoring = false
      state.value.restoreProgress = 0
    }
  }

  // ============================================================================
  // History Management
  // ============================================================================

  /**
   * Save backup to history (localStorage)
   */
  function saveToHistory(backup: BackupData): void {
    try {
      // Add to beginning of history
      backupHistory.value.unshift(backup)

      // Trim to max size
      if (backupHistory.value.length > config.value.maxHistorySize) {
        backupHistory.value = backupHistory.value.slice(0, config.value.maxHistorySize)
      }

      // Save to localStorage
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(backupHistory.value))
      localStorage.setItem(STORAGE_KEYS.LATEST, JSON.stringify(backup))

      stats.value.historyCount = backupHistory.value.length

    } catch (error) {
      console.error('[Backup] Failed to save to history:', error)
    }
  }

  /**
   * Load backup history from localStorage
   */
  function loadHistory(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.HISTORY)
      if (stored) {
        backupHistory.value = JSON.parse(stored)
        stats.value.historyCount = backupHistory.value.length
      }

      // Load last backup time from latest
      const latest = localStorage.getItem(STORAGE_KEYS.LATEST)
      if (latest) {
        const latestBackup = JSON.parse(latest)
        stats.value.lastBackupTime = latestBackup.timestamp
      }
    } catch (error) {
      console.error('[Backup] Failed to load history:', error)
    }
  }

  /**
   * Get the latest backup
   */
  function getLatestBackup(): BackupData | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LATEST)
      return stored ? JSON.parse(stored) : null
    } catch (error) {
      console.error('[Backup] Failed to get latest backup:', error)
      return null
    }
  }

  /**
   * Clear all backup history
   */
  function clearHistory(): void {
    backupHistory.value = []
    localStorage.removeItem(STORAGE_KEYS.HISTORY)
    localStorage.removeItem(STORAGE_KEYS.LATEST)
    stats.value.historyCount = 0
  }

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
        await createBackup('auto')
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
  // Export/Import
  // ============================================================================

  /**
   * Export backup as JSON string
   */
  async function exportBackup(): Promise<string> {
    const backup = await createBackup('manual')
    if (!backup) {
      throw new Error('Failed to create backup for export')
    }

    return JSON.stringify({
      ...backup,
      metadata: {
        ...backup.metadata,
        exportedAt: new Date().toISOString()
      }
    }, null, 2)
  }

  /**
   * Import backup from JSON string
   */
  async function importBackup(jsonString: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonString)
      return await restoreBackup(data)
    } catch (error) {
      console.error('[Backup] Import failed:', error)
      state.value.error = 'Invalid backup file format'
      return false
    }
  }

  /**
   * Download backup as file
   */
  async function downloadBackup(backup?: BackupData): Promise<void> {
    const data = backup || getLatestBackup()
    if (!data) {
      throw new Error('No backup available to download')
    }

    const filename = `pomo-flow-backup-${new Date().toISOString().split('T')[0]}.json`
    const content = JSON.stringify(data, null, 2)
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    console.log('[Backup] Downloaded:', filename)
  }

  /**
   * Restore from uploaded file
   */
  async function restoreFromFile(file: File): Promise<boolean> {
    try {
      const text = await file.text()
      return await importBackup(text)
    } catch (error) {
      console.error('[Backup] Failed to restore from file:', error)
      state.value.error = 'Failed to read backup file'
      return false
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
    loadHistory()

    // Wait for tasks to be available
    await waitForTasks()

    // Start auto-backup
    startAutoBackup()

    // Create initial backup if none exists
    if (!getLatestBackup()) {
      await createBackup('auto')
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
  onMounted(() => {
    // Delay initialization to ensure stores are ready
    setTimeout(initialize, 1500)
  })

  onUnmounted(() => {
    stopAutoBackup()
  })

  // ============================================================================
  // Return Public API
  // ============================================================================

  return {
    // State
    config,
    state: computed(() => state.value),
    stats: computed(() => stats.value),
    backupHistory: computed(() => backupHistory.value),

    // Core operations
    createBackup,
    restoreBackup,

    // History
    getLatestBackup,
    clearHistory,

    // Auto-backup
    startAutoBackup,
    stopAutoBackup,

    // Export/Import
    exportBackup,
    importBackup,
    downloadBackup,
    restoreFromFile,

    // Utilities
    hasHebrewContent,
    getStatus,

    // Initialize (can be called manually if needed)
    initialize
  }
}

// ============================================================================
// Singleton Export for Legacy Compatibility
// ============================================================================

/**
 * Singleton instance for components using the old object pattern
 * @deprecated Use useBackupSystem() composable instead
 */
let singletonInstance: ReturnType<typeof useBackupSystem> | null = null

export const backupSystem = {
  getInstance() {
    if (!singletonInstance) {
      // Create a minimal instance for legacy usage
      console.warn('[Backup] Using legacy singleton - migrate to useBackupSystem() composable')
    }
    return singletonInstance
  },

  // Legacy method mappings
  async createBackup() {
    const instance = this.getInstance()
    return instance?.createBackup('manual') || null
  },

  getLatestBackup() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LATEST)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  },

  async exportTasks() {
    const backup = this.getLatestBackup()
    return backup ? JSON.stringify(backup, null, 2) : ''
  },

  downloadBackup() {
    const backup = this.getLatestBackup()
    if (!backup) throw new Error('No backup available')

    const filename = `pomo-flow-backup-${new Date().toISOString().split('T')[0]}.json`
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  },

  getStatus() {
    const latest = this.getLatestBackup()
    return {
      isTasksReady: true,
      isBackupReady: !!latest,
      isOperational: !!latest
    }
  },

  hasHebrewContent(backup: BackupData) {
    if (!backup?.tasks) return false
    const hebrewRegex = /[\u0590-\u05FF]/
    return backup.tasks.some(task => task.title && hebrewRegex.test(task.title))
  },

  getHebrewTaskCount(backup: BackupData) {
    if (!backup?.tasks) return 0
    const hebrewRegex = /[\u0590-\u05FF]/
    return backup.tasks.filter(task => task.title && hebrewRegex.test(task.title)).length
  }
}

// Default export for convenience
export default useBackupSystem
