import IntegrityService from '@/utils/integrity'

/**
 * Unified Backup System
 *
 * Consolidates 4 competing backup implementations into a single, cohesive system.
 * Replaces: useBackupManager, useSimpleBackup, useAutoBackup, useBackupRestoration
 *
 * @version 1.0.0
 * @since 2025-12-03
 */

import { ref, computed, onMounted, onUnmounted, getCurrentInstance } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'
import { useCanvasStore } from '@/stores/canvas'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabaseV2'
import { filterMockTasks } from '@/utils/mockTaskDetector'
import type { Task, Project } from '@/types/tasks'
import type { CanvasGroup } from '@/stores/canvas'

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface BackupData {
  id: string
  tasks: Task[]
  projects: Project[]
  groups: CanvasGroup[]
  timestamp: number
  version: string
  checksum: string
  type: 'auto' | 'manual' | 'emergency'
  metadata?: {
    taskCount: number
    projectCount: number
    groupCount: number
    size?: number
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
  STATS: 'pomo-flow-backup-stats',
  // BUG-059 FIX: Golden backup that can NEVER be overwritten by auto-backups
  // Only updated when manually triggered OR when task count reaches new maximum
  GOLDEN: 'pomo-flow-golden-backup',
  // Tracks the maximum task count ever seen - used to detect data loss
  MAX_TASK_COUNT: 'pomo-flow-max-task-count'
} as const

// BUG-059 FIX: Threshold for detecting suspicious data loss
// If new backup has less than this % of previous max tasks, block auto-backup
const DATA_LOSS_THRESHOLD = 0.5 // 50%

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
function calculateChecksum(data: unknown): string {
  return IntegrityService.calculateChecksum(data)
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
  // Core Backup Operations
  // ============================================================================

  /**
   * BUG-059 FIX: Get the maximum task count ever recorded
   */
  function getMaxTaskCount(): number {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MAX_TASK_COUNT)
      return stored ? parseInt(stored, 10) : 0
    } catch {
      return 0
    }
  }

  /**
   * BUG-059 FIX: Update the maximum task count if current is higher
   */
  function updateMaxTaskCount(currentCount: number): void {
    const maxCount = getMaxTaskCount()
    if (currentCount > maxCount) {
      localStorage.setItem(STORAGE_KEYS.MAX_TASK_COUNT, currentCount.toString())
      console.log(`[Backup] 🏆 New maximum task count: ${currentCount} (was ${maxCount})`)
    }
  }

  /**
   * BUG-059 FIX: Get golden backup (immutable high-water mark backup)
   */
  function getGoldenBackup(): BackupData | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.GOLDEN)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }

  /**
   * BUG-059 FIX: Save golden backup (only if task count is higher than previous)
   */
  function saveGoldenBackup(backup: BackupData, force: boolean = false): boolean {
    const golden = getGoldenBackup()
    const goldenTaskCount = golden?.metadata?.taskCount || 0
    const newTaskCount = backup.metadata?.taskCount || 0

    if (force || newTaskCount > goldenTaskCount) {
      localStorage.setItem(STORAGE_KEYS.GOLDEN, JSON.stringify(backup))
      console.log(`[Backup] 💛 Golden backup updated: ${newTaskCount} tasks (was ${goldenTaskCount})`)
      return true
    }
    return false
  }

  /**
   * BUG-059 FIX: Check if backup looks suspicious (potential data loss)
   */
  function isBackupSuspicious(taskCount: number, type: 'auto' | 'manual' | 'emergency'): { suspicious: boolean; reason: string } {
    const maxCount = getMaxTaskCount()
    const golden = getGoldenBackup()
    const goldenCount = golden?.metadata?.taskCount || 0

    // For manual/emergency backups, allow any state (user explicitly requested)
    if (type !== 'auto') {
      return { suspicious: false, reason: '' }
    }

    // If we've never seen tasks before, can't detect data loss
    if (maxCount === 0 && goldenCount === 0) {
      return { suspicious: false, reason: '' }
    }

    const referenceCount = Math.max(maxCount, goldenCount)

    // CRITICAL: Block auto-backup if task count dropped by more than threshold
    if (referenceCount > 5 && taskCount < referenceCount * DATA_LOSS_THRESHOLD) {
      return {
        suspicious: true,
        reason: `Task count dropped from ${referenceCount} to ${taskCount} (>${(1 - DATA_LOSS_THRESHOLD) * 100}% loss)`
      }
    }

    // CRITICAL: Block auto-backup if tasks went to 0 when we had tasks before
    if (taskCount === 0 && referenceCount > 0) {
      return {
        suspicious: true,
        reason: `All ${referenceCount} tasks disappeared - blocking auto-backup`
      }
    }

    return { suspicious: false, reason: '' }
  }

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

      // Get tasks from store
      let tasks = [...(taskStore.tasks || [])]

      // Filter mock tasks if enabled
      if (config.value.filterMockTasks && tasks.length > 0) {
        const filterResult = filterMockTasks(tasks as unknown as Record<string, unknown>[], { confidence: 'medium', logResults: false })
        if (filterResult.mockTasks.length > 0) {
          console.log(`[Backup] Filtered ${filterResult.mockTasks.length} mock tasks`)
        }
        tasks = filterResult.cleanTasks as unknown as Task[]
      }

      // BUG-059 FIX: Check if this backup looks suspicious before saving
      const suspiciousCheck = isBackupSuspicious(tasks.length, type)
      if (suspiciousCheck.suspicious) {
        state.value.error = suspiciousCheck.reason
        return null
      }

      // Get projects and groups from stores
      const projects = [...(projectStore.projects || [])]
      const groups = [...(canvasStore.groups || [])]

      // Create backup object
      const backupData: BackupData = {
        id: generateBackupId(),
        tasks,
        projects,
        groups,
        timestamp: Date.now(),
        version: '3.0.0', // Version bump for Supabase-backed backup
        checksum: '',
        type,
        metadata: {
          taskCount: tasks.length,
          projectCount: projects.length,
          groupCount: groups.length
        }
      }

      // Calculate checksum
      backupData.checksum = calculateChecksum({
        tasks: backupData.tasks,
        projects: backupData.projects,
        groups: backupData.groups
      })

      // Calculate approximate size
      const size = new TextEncoder().encode(JSON.stringify(backupData)).length
      if (backupData.metadata) {
        backupData.metadata.size = size
      }

      // Save to localStorage
      saveToHistory(backupData)

      // BUG-059 FIX: Update max task count and golden backup
      const taskCount = backupData.metadata?.taskCount || 0
      updateMaxTaskCount(taskCount)
      saveGoldenBackup(backupData)

      // Update stats
      stats.value.lastBackupTime = backupData.timestamp
      stats.value.totalBackups++

      console.log(`[Backup] Created successfully: ${backupData.metadata?.taskCount} tasks, ${backupData.metadata?.projectCount} projects, ${backupData.metadata?.groupCount} groups`)

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
          groups: backupData.groups
        })
        if (currentChecksum !== backupData.checksum) {
          console.warn('[Backup] Checksum mismatch - backup may be corrupted')
        }
      }

      state.value.restoreProgress = 20

      // Create emergency backup before restore
      await createBackup('emergency')
      state.value.restoreProgress = 40

      // Restore to Supabase
      // Note: We're doing serial saves for stability, but could be Promise.all
      // Restore Tasks
      await db.saveTasks(backupData.tasks)
      state.value.restoreProgress = 60

      // Restore Projects
      await db.saveProjects(backupData.projects || [])
      state.value.restoreProgress = 70

      // Restore Groups
      if (backupData.groups && Array.isArray(backupData.groups)) {
        for (const group of backupData.groups) {
          await db.saveGroup(group)
        }
      }
      state.value.restoreProgress = 80

      // Reload stores from database
      if (taskStore.loadFromDatabase) await taskStore.loadFromDatabase()
      if (projectStore.loadProjectsFromDatabase) await projectStore.loadProjectsFromDatabase()
      if (canvasStore.loadFromDatabase) await canvasStore.loadFromDatabase()

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
    initialize,

    // BUG-059 FIX: Golden backup and safety methods
    getGoldenBackup,
    getMaxTaskCount,

    // Restore from golden backup (last known good state)
    restoreFromGoldenBackup: async () => {
      const golden = getGoldenBackup()
      if (!golden) {
        console.error('[Backup] No golden backup available')
        return false
      }
      console.log(`[Backup] Restoring from golden backup: ${golden.metadata?.taskCount} tasks`)
      return await restoreBackup(golden)
    }
  }
}

// Default export for convenience
export default useBackupSystem
