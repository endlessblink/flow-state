import IntegrityService from '@/utils/integrity'
import { isTauri } from '@/composables/useTauriStartup'
import { FILE_DIALOG_TIMEOUT_MS } from '@/config/timing'

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
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import type { TaskIdAvailability } from '@/composables/useSupabaseDatabase'
import { filterMockTasks } from '@/utils/mockTaskDetector'
import type { Task, Project } from '@/types/tasks'
import type { CanvasGroup } from '@/types/canvas'

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
  HISTORY: 'flowstate-backup-history',
  LATEST: 'flowstate-backup-latest',
  STATS: 'flowstate-backup-stats',
  // BUG-059 FIX: Golden backup that can NEVER be overwritten by auto-backups
  // Only updated when manually triggered OR when task count reaches new maximum
  GOLDEN: 'flowstate-backup-golden',
  // TASK-332: Array of golden backups for rotation (keeps last 3 peaks)
  GOLDEN_ROTATION: 'flowstate-backup-golden-rotation',
  // Tracks the maximum task count ever seen - used to detect data loss
  MAX_TASK_COUNT: 'flowstate-max-task-count'
} as const

// TASK-332: Maximum number of golden backups to keep in rotation
const MAX_GOLDEN_BACKUPS = 3

// BUG-059 FIX: Threshold for detecting suspicious data loss
// If new backup has less than this % of previous max tasks, block auto-backup
const DATA_LOSS_THRESHOLD = 0.5 // 50%

// TASK-153: Maximum age for golden backup before warning (7 days in ms)
const GOLDEN_BACKUP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

// TASK-156: Maximum age for backup history entries (30 days in ms)
const BACKUP_HISTORY_TTL_MS = 30 * 24 * 60 * 60 * 1000

// TASK-156: Current backup schema version
const BACKUP_SCHEMA_VERSION = '3.1.0'

// TASK-153: Types for golden backup validation
export interface GoldenBackupValidation {
  isValid: boolean
  ageMs: number
  ageWarning: string | null
  preview: {
    tasks: { total: number; filtered: number; toRestore: number }
    projects: { total: number; filtered: number; toRestore: number }
    groups: { total: number; filtered: number; toRestore: number }
  }
  warnings: string[]
}

// TASK-344: Dry-run restore analysis result
export interface RestoreAnalysis {
  backup: BackupData
  tasks: {
    total: number
    available: number      // Can be created
    existsActive: number   // Already exists (active)
    existsDeleted: number  // Already exists (soft-deleted)
    tombstoned: number     // Permanently deleted - cannot restore
    toRestore: Task[]      // Tasks that will be restored
    skipped: Array<{ task: Task; reason: string }>  // Tasks that will be skipped
  }
  projects: {
    total: number
    toRestore: number
    skipped: number
  }
  groups: {
    total: number
    toRestore: number
    skipped: number
  }
  warnings: string[]
  canProceed: boolean
}

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
  return `backup_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
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
   * TASK-332: Get all golden backups from rotation (most recent first)
   * Returns up to MAX_GOLDEN_BACKUPS entries, sorted by task count descending
   */
  function getGoldenBackups(): BackupData[] {
    try {
      // Try new rotation key first
      const rotationStored = localStorage.getItem(STORAGE_KEYS.GOLDEN_ROTATION)
      if (rotationStored) {
        const rotation = JSON.parse(rotationStored) as BackupData[]
        return rotation.sort((a, b) => (b.metadata?.taskCount || 0) - (a.metadata?.taskCount || 0))
      }

      // Fallback: migrate from legacy single golden backup
      const legacyStored = localStorage.getItem(STORAGE_KEYS.GOLDEN)
      if (legacyStored) {
        const legacy = JSON.parse(legacyStored) as BackupData
        // Migrate to rotation array
        const rotation = [legacy]
        localStorage.setItem(STORAGE_KEYS.GOLDEN_ROTATION, JSON.stringify(rotation))
        console.log('[Backup] 🔄 Migrated legacy golden backup to rotation array')
        return rotation
      }

      return []
    } catch {
      return []
    }
  }

  /**
   * BUG-059 FIX: Get golden backup (most recent peak from rotation)
   * Returns the backup with the highest task count from the rotation
   */
  function getGoldenBackup(): BackupData | null {
    const rotation = getGoldenBackups()
    return rotation.length > 0 ? rotation[0] : null
  }

  /**
   * TASK-332: Save golden backup with rotation (keeps last 3 peaks)
   * Only adds to rotation if task count is a new peak or close to existing peaks
   */
  function saveGoldenBackup(backup: BackupData, force: boolean = false): boolean {
    const rotation = getGoldenBackups()
    const newTaskCount = backup.metadata?.taskCount || 0
    const highestPeak = rotation[0]?.metadata?.taskCount || 0

    // Only save if this is a new peak or force is true
    if (!force && newTaskCount <= highestPeak) {
      return false
    }

    // Check if this count is significantly different from existing peaks
    // (at least 5% more tasks than the lowest in rotation, or rotation isn't full)
    const shouldAdd = force ||
      rotation.length < MAX_GOLDEN_BACKUPS ||
      newTaskCount > highestPeak

    if (!shouldAdd) {
      return false
    }

    // Add to rotation
    const updatedRotation = [backup, ...rotation]

    // Keep only unique peak values (remove duplicates with same task count)
    const uniquePeaks = updatedRotation.reduce((acc, curr) => {
      const existingWithSameCount = acc.find(b =>
        b.metadata?.taskCount === curr.metadata?.taskCount
      )
      if (!existingWithSameCount) {
        acc.push(curr)
      } else if (curr.timestamp > existingWithSameCount.timestamp) {
        // Replace with newer backup of same peak
        const idx = acc.indexOf(existingWithSameCount)
        acc[idx] = curr
      }
      return acc
    }, [] as BackupData[])

    // Sort by task count descending and keep only top MAX_GOLDEN_BACKUPS
    const finalRotation = uniquePeaks
      .sort((a, b) => (b.metadata?.taskCount || 0) - (a.metadata?.taskCount || 0))
      .slice(0, MAX_GOLDEN_BACKUPS)

    // Save rotation
    localStorage.setItem(STORAGE_KEYS.GOLDEN_ROTATION, JSON.stringify(finalRotation))
    // Also save legacy key for backward compatibility
    localStorage.setItem(STORAGE_KEYS.GOLDEN, JSON.stringify(finalRotation[0]))

    console.log(`[Backup] 💛 Golden backup rotation updated: ${newTaskCount} tasks. Rotation: [${finalRotation.map(b => b.metadata?.taskCount).join(', ')}]`)
    return true
  }

  /**
   * TASK-153: Validate golden backup before restore
   * - Checks age and warns if > 7 days old
   * - Cross-references with current Supabase data to filter deleted items
   * - Returns preview of what will be restored
   */
  async function validateGoldenBackup(): Promise<GoldenBackupValidation | null> {
    const golden = getGoldenBackup()
    if (!golden) {
      console.warn('[Backup] No golden backup to validate')
      return null
    }

    const warnings: string[] = []
    const now = Date.now()
    const ageMs = now - golden.timestamp

    // Check age warning
    let ageWarning: string | null = null
    if (ageMs > GOLDEN_BACKUP_MAX_AGE_MS) {
      const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000))
      ageWarning = `Golden backup is ${ageDays} days old (created ${new Date(golden.timestamp).toLocaleDateString()})`
      warnings.push(ageWarning)
    }

    // Get current deleted item IDs from Supabase
    let deletedTaskIds: Set<string> = new Set()
    let deletedProjectIds: Set<string> = new Set()
    let deletedGroupIds: Set<string> = new Set()

    try {
      // Fetch deleted items from Supabase to filter them out
      if (db.fetchDeletedTaskIds) {
        deletedTaskIds = new Set(await db.fetchDeletedTaskIds())
      }
      if (db.fetchDeletedProjectIds) {
        deletedProjectIds = new Set(await db.fetchDeletedProjectIds())
      }
      if (db.fetchDeletedGroupIds) {
        deletedGroupIds = new Set(await db.fetchDeletedGroupIds())
      }
    } catch (error) {
      console.warn('[Backup] Could not fetch deleted item IDs from Supabase:', error)
      warnings.push('Could not verify deleted items against Supabase - some deleted items may be restored')
    }

    // Calculate what would be restored after filtering
    const tasksToRestore = golden.tasks.filter(t => !deletedTaskIds.has(t.id))
    const projectsToRestore = (golden.projects || []).filter(p => !deletedProjectIds.has(p.id))
    const groupsToRestore = (golden.groups || []).filter(g => !deletedGroupIds.has(g.id))

    const filteredTasks = golden.tasks.length - tasksToRestore.length
    const filteredProjects = (golden.projects?.length || 0) - projectsToRestore.length
    const filteredGroups = (golden.groups?.length || 0) - groupsToRestore.length

    if (filteredTasks > 0) {
      warnings.push(`${filteredTasks} tasks will be skipped (deleted in Supabase)`)
    }
    if (filteredProjects > 0) {
      warnings.push(`${filteredProjects} projects will be skipped (deleted in Supabase)`)
    }
    if (filteredGroups > 0) {
      warnings.push(`${filteredGroups} groups will be skipped (deleted in Supabase)`)
    }

    return {
      isValid: true,
      ageMs,
      ageWarning,
      preview: {
        tasks: {
          total: golden.tasks.length,
          filtered: filteredTasks,
          toRestore: tasksToRestore.length
        },
        projects: {
          total: golden.projects?.length || 0,
          filtered: filteredProjects,
          toRestore: projectsToRestore.length
        },
        groups: {
          total: golden.groups?.length || 0,
          filtered: filteredGroups,
          toRestore: groupsToRestore.length
        }
      },
      warnings
    }
  }

  /**
   * TASK-153: Filter golden backup data to exclude items deleted in Supabase
   */
  async function filterGoldenBackupData(golden: BackupData): Promise<BackupData> {
    let deletedTaskIds: Set<string> = new Set()
    let deletedProjectIds: Set<string> = new Set()
    let deletedGroupIds: Set<string> = new Set()

    try {
      if (db.fetchDeletedTaskIds) {
        deletedTaskIds = new Set(await db.fetchDeletedTaskIds())
      }
      if (db.fetchDeletedProjectIds) {
        deletedProjectIds = new Set(await db.fetchDeletedProjectIds())
      }
      if (db.fetchDeletedGroupIds) {
        deletedGroupIds = new Set(await db.fetchDeletedGroupIds())
      }
    } catch (error) {
      console.warn('[Backup] Could not fetch deleted IDs, restoring all items:', error)
    }

    return {
      ...golden,
      tasks: golden.tasks.filter(t => !deletedTaskIds.has(t.id)),
      projects: (golden.projects || []).filter(p => !deletedProjectIds.has(p.id)),
      groups: (golden.groups || []).filter(g => !deletedGroupIds.has(g.id)),
      metadata: {
        ...golden.metadata,
        taskCount: golden.tasks.filter(t => !deletedTaskIds.has(t.id)).length,
        projectCount: (golden.projects || []).filter(p => !deletedProjectIds.has(p.id)).length,
        groupCount: (golden.groups || []).filter(g => !deletedGroupIds.has(g.id)).length
      }
    }
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
        version: BACKUP_SCHEMA_VERSION, // TASK-156: Use constant for schema version
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

  // ==========================================================================
  // TASK-344: Immutable Task ID System - Deduplication on Restore
  // ==========================================================================

  /**
   * TASK-344: Analyze a backup before restore (dry-run mode)
   * Checks which tasks can be restored vs skipped due to existing IDs
   */
  async function analyzeRestore(backup: BackupData | string): Promise<RestoreAnalysis> {
    // Parse if string
    const backupData: BackupData = typeof backup === 'string'
      ? JSON.parse(backup)
      : backup

    const warnings: string[] = []

    // Validate backup structure
    if (!backupData.tasks || !Array.isArray(backupData.tasks)) {
      return {
        backup: backupData,
        tasks: { total: 0, available: 0, existsActive: 0, existsDeleted: 0, tombstoned: 0, toRestore: [], skipped: [] },
        projects: { total: 0, toRestore: 0, skipped: 0 },
        groups: { total: 0, toRestore: 0, skipped: 0 },
        warnings: ['Invalid backup: missing tasks array'],
        canProceed: false
      }
    }

    // Get task IDs to check
    const taskIds = backupData.tasks.map(t => t.id)

    // Check availability using TASK-344 batch check
    const availabilityResults = await db.checkTaskIdsAvailability(taskIds)
    const availabilityMap = new Map<string, TaskIdAvailability>()
    for (const result of availabilityResults) {
      availabilityMap.set(result.taskId, result)
    }

    // Categorize tasks
    const toRestore: Task[] = []
    const skipped: Array<{ task: Task; reason: string }> = []
    let existsActive = 0
    let existsDeleted = 0
    let tombstoned = 0

    for (const task of backupData.tasks) {
      const availability = availabilityMap.get(task.id)
      if (!availability || availability.status === 'available') {
        toRestore.push(task)
      } else {
        skipped.push({ task, reason: availability.reason })
        switch (availability.status) {
          case 'active':
            existsActive++
            break
          case 'soft_deleted':
            existsDeleted++
            break
          case 'tombstoned':
            tombstoned++
            break
        }
      }
    }

    // Add warnings based on analysis
    if (existsActive > 0) {
      warnings.push(`${existsActive} tasks already exist (active) - will be skipped`)
    }
    if (existsDeleted > 0) {
      warnings.push(`${existsDeleted} tasks already exist (soft-deleted) - will be skipped`)
    }
    if (tombstoned > 0) {
      warnings.push(`${tombstoned} tasks were permanently deleted - cannot restore`)
    }

    // For projects and groups, do a simpler check using existing fetch functions
    const deletedProjectIds = new Set(await db.fetchDeletedProjectIds())
    const deletedGroupIds = new Set(await db.fetchDeletedGroupIds())
    const tombstones = await db.fetchTombstones()
    const projectTombstones = new Set(tombstones.filter(t => t.entityType === 'project').map(t => t.entityId))
    const groupTombstones = new Set(tombstones.filter(t => t.entityType === 'group').map(t => t.entityId))

    const projectsToRestore = (backupData.projects || []).filter(p =>
      !deletedProjectIds.has(p.id) && !projectTombstones.has(p.id)
    )
    const groupsToRestore = (backupData.groups || []).filter(g =>
      !deletedGroupIds.has(g.id) && !groupTombstones.has(g.id)
    )

    const projectsSkipped = (backupData.projects?.length || 0) - projectsToRestore.length
    const groupsSkipped = (backupData.groups?.length || 0) - groupsToRestore.length

    if (projectsSkipped > 0) {
      warnings.push(`${projectsSkipped} projects will be skipped (deleted or tombstoned)`)
    }
    if (groupsSkipped > 0) {
      warnings.push(`${groupsSkipped} groups will be skipped (deleted or tombstoned)`)
    }

    return {
      backup: backupData,
      tasks: {
        total: backupData.tasks.length,
        available: toRestore.length,
        existsActive,
        existsDeleted,
        tombstoned,
        toRestore,
        skipped
      },
      projects: {
        total: backupData.projects?.length || 0,
        toRestore: projectsToRestore.length,
        skipped: projectsSkipped
      },
      groups: {
        total: backupData.groups?.length || 0,
        toRestore: groupsToRestore.length,
        skipped: groupsSkipped
      },
      warnings,
      canProceed: toRestore.length > 0 || projectsToRestore.length > 0 || groupsToRestore.length > 0
    }
  }

  /**
   * Restore from a backup
   * TASK-344: Now supports dry-run mode and filters out duplicate task IDs
   *
   * @param backup - The backup data or JSON string
   * @param options - Restore options (dryRun, skipDedupCheck)
   */
  async function restoreBackup(
    backup: BackupData | string,
    options: { dryRun?: boolean; skipDedupCheck?: boolean; backupSource?: string } = {}
  ): Promise<boolean | RestoreAnalysis> {
    // Dry-run mode: just analyze and return
    if (options.dryRun) {
      console.log('[Backup] Running dry-run analysis...')
      return await analyzeRestore(backup)
    }

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

      state.value.restoreProgress = 10

      // TASK-344: Analyze and filter tasks before restore
      let tasksToRestore = backupData.tasks
      let projectsToRestore = backupData.projects || []
      let groupsToRestore = backupData.groups || []

      if (!options.skipDedupCheck) {
        console.log('[Backup] Analyzing task ID availability (TASK-344 deduplication)...')
        const analysis = await analyzeRestore(backupData)

        tasksToRestore = analysis.tasks.toRestore
        state.value.restoreProgress = 20

        // Log dedup decisions for audit trail
        for (const { task, reason } of analysis.tasks.skipped) {
          await db.logDedupDecision(
            'restore',
            task.id,
            reason.includes('tombstoned') ? 'skipped_tombstoned' : 'skipped_exists',
            reason,
            options.backupSource
          )
        }

        // Filter projects and groups
        const deletedProjectIds = new Set(await db.fetchDeletedProjectIds())
        const deletedGroupIds = new Set(await db.fetchDeletedGroupIds())
        const tombstones = await db.fetchTombstones()
        const projectTombstones = new Set(tombstones.filter(t => t.entityType === 'project').map(t => t.entityId))
        const groupTombstones = new Set(tombstones.filter(t => t.entityType === 'group').map(t => t.entityId))

        projectsToRestore = (backupData.projects || []).filter(p =>
          !deletedProjectIds.has(p.id) && !projectTombstones.has(p.id)
        )
        groupsToRestore = (backupData.groups || []).filter(g =>
          !deletedGroupIds.has(g.id) && !groupTombstones.has(g.id)
        )

        console.log(`[Backup] TASK-344 Deduplication results:`)
        console.log(`  Tasks: ${tasksToRestore.length}/${backupData.tasks.length} will be restored`)
        console.log(`  Projects: ${projectsToRestore.length}/${backupData.projects?.length || 0} will be restored`)
        console.log(`  Groups: ${groupsToRestore.length}/${backupData.groups?.length || 0} will be restored`)
      }

      state.value.restoreProgress = 30

      // Create emergency backup before restore (rollback point)
      await createBackup('emergency')
      state.value.restoreProgress = 40

      // Restore to Supabase using safeCreateTask for each task
      // TASK-344: This ensures immutable IDs - no duplicates even with race conditions
      if (tasksToRestore.length > 0) {
        console.log(`[Backup] Restoring ${tasksToRestore.length} tasks using safeCreateTask...`)
        let created = 0
        let skipped = 0

        for (const task of tasksToRestore) {
          const result = await db.safeCreateTask(task)

          if (result.status === 'created') {
            created++
          } else {
            skipped++
            console.log(`[Backup] Task ${task.id.slice(0, 8)}... skipped: ${result.message}`)
          }

          // Log decision to audit table
          await db.logDedupDecision(
            'restore',
            task.id,
            result.status === 'created' ? 'created' :
              result.status === 'tombstoned' ? 'skipped_tombstoned' : 'skipped_exists',
            result.message,
            options.backupSource
          )
        }

        console.log(`[Backup] Task restore complete: ${created} created, ${skipped} skipped`)
      }
      state.value.restoreProgress = 60

      // Restore Projects
      if (projectsToRestore.length > 0) {
        console.log(`[Backup] Restoring ${projectsToRestore.length} projects...`)
        await db.saveProjects(projectsToRestore)
      }
      state.value.restoreProgress = 70

      // Restore Groups
      if (groupsToRestore.length > 0) {
        console.log(`[Backup] Restoring ${groupsToRestore.length} groups...`)
        for (const group of groupsToRestore) {
          await db.saveGroup(group)
        }
      }
      state.value.restoreProgress = 80

      // Reload stores from database
      if (taskStore.loadFromDatabase) await taskStore.loadFromDatabase()
      if (projectStore.loadProjectsFromDatabase) await projectStore.loadProjectsFromDatabase()
      if (canvasStore.loadFromDatabase) await canvasStore.loadFromDatabase()

      state.value.restoreProgress = 100

      console.log(`[Backup] Restored successfully: ${tasksToRestore.length}/${backupData.tasks.length} tasks (TASK-344 filtered)`)
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
   * TASK-156: Added TTL pruning for old backups
   */
  function loadHistory(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.HISTORY)
      if (stored) {
        const rawHistory: BackupData[] = JSON.parse(stored)
        const now = Date.now()

        // TASK-156: Filter out backups older than TTL (30 days)
        const validBackups: BackupData[] = []
        const expiredBackups: BackupData[] = []

        for (const backup of rawHistory) {
          const age = now - backup.timestamp
          if (age > BACKUP_HISTORY_TTL_MS) {
            expiredBackups.push(backup)
          } else {
            validBackups.push(backup)
          }
        }

        backupHistory.value = validBackups
        stats.value.historyCount = validBackups.length

        // Log pruned backups
        if (expiredBackups.length > 0) {
          console.log(`🧹 [TASK-156] Pruned ${expiredBackups.length} backups older than 30 days`)
          // Save updated history without expired backups
          localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(validBackups))
        }
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
   * TASK-344: Updated to handle new restore signature
   */
  async function importBackup(jsonString: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonString)
      const result = await restoreBackup(data, { dryRun: false, backupSource: 'import' })
      return result === true
    } catch (error) {
      console.error('[Backup] Import failed:', error)
      state.value.error = 'Invalid backup file format'
      return false
    }
  }

  /**
   * Download backup as file
   * BUG-336: Fixed for Tauri - uses native file dialog instead of browser download
   */
  async function downloadBackup(backup?: BackupData): Promise<void> {
    const data = backup || getLatestBackup()
    if (!data) {
      throw new Error('No backup available to download')
    }

    const filename = `flow-state-backup-${new Date().toISOString().split('T')[0]}.json`
    const content = JSON.stringify(data, null, 2)

    // BUG-336: Use Tauri dialog for file save in desktop app
    if (isTauri()) {
      console.log('[Backup] Tauri detected, attempting native save dialog...')

      try {
        // Method 1: Try dynamic imports (preferred)
        console.log('[Backup] Importing Tauri plugins...')
        const dialogModule = await import('@tauri-apps/plugin-dialog')
        const fsModule = await import('@tauri-apps/plugin-fs')
        const pathModule = await import('@tauri-apps/api/path')

        console.log('[Backup] Plugins loaded successfully')

        // Get downloads directory for default path
        let defaultPath = filename
        try {
          const downloadsPath = await pathModule.downloadDir()
          // Ensure proper path separator (join not available in path module)
          const separator = downloadsPath.includes('\\') ? '\\' : '/'
          const cleanPath = downloadsPath.endsWith(separator) ? downloadsPath : downloadsPath + separator
          defaultPath = `${cleanPath}${filename}`
          console.log('[Backup] Default path:', defaultPath)
        } catch (pathError) {
          console.warn('[Backup] Could not get downloads dir, using filename only:', pathError)
        }

        // Open save dialog - the selected path is automatically added to FS scope
        // TASK-332: Add timeout to prevent hanging on XDG Portal issues
        console.log('[Backup] Opening save dialog...')

        const dialogPromise = dialogModule.save({
          defaultPath,
          filters: [{
            name: 'JSON',
            extensions: ['json']
          }]
        })

        // Race against a 30-second timeout (XDG Portal can sometimes hang)
        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error('Dialog timeout after 30s - falling back to browser')), FILE_DIALOG_TIMEOUT_MS)
        })

        const filePath = await Promise.race([dialogPromise, timeoutPromise])

        console.log('[Backup] Dialog result:', filePath)

        if (filePath) {
          // Write file to selected path (scope automatically granted by dialog)
          console.log('[Backup] Writing file to:', filePath)
          await fsModule.writeTextFile(filePath, content)
          console.log('[Backup] Downloaded successfully (Tauri):', filePath)
        } else {
          console.log('[Backup] Download cancelled by user')
        }
        return
      } catch (error) {
        console.error('[Backup] Tauri save failed:', error)

        // Method 2: Try global __TAURI__ object as fallback
        const win = window as any
        if (win.__TAURI__?.dialog?.save && win.__TAURI__?.fs?.writeTextFile) {
          console.log('[Backup] Attempting fallback via __TAURI__ global...')
          try {
            const filePath = await win.__TAURI__.dialog.save({
              defaultPath: filename,
              filters: [{ name: 'JSON', extensions: ['json'] }]
            })
            if (filePath) {
              await win.__TAURI__.fs.writeTextFile(filePath, content)
              console.log('[Backup] Downloaded via __TAURI__ global:', filePath)
              return
            }
          } catch (fallbackError) {
            console.error('[Backup] __TAURI__ fallback also failed:', fallbackError)
          }
        }

        console.warn('[Backup] All Tauri methods failed, falling back to browser download')
        // Fall through to browser method
      }
    }

    // Browser fallback method
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

    // TASK-344: Dry-run analysis (preview before restore)
    analyzeRestore,

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

    // TASK-332: Get all golden backups in rotation (for UI display)
    getGoldenBackups,

    // TASK-153: Validate golden backup before restore
    validateGoldenBackup,

    // Restore from golden backup (last known good state)
    // TASK-153: Now filters out items deleted in Supabase before restoring
    restoreFromGoldenBackup: async (skipValidation: boolean = false) => {
      const golden = getGoldenBackup()
      if (!golden) {
        console.error('[Backup] No golden backup available')
        return false
      }

      // TASK-153: Validate and warn about age/deleted items
      if (!skipValidation) {
        const validation = await validateGoldenBackup()
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
      const filteredGolden = await filterGoldenBackupData(golden)

      console.log(`[Backup] Restoring from golden backup: ${filteredGolden.metadata?.taskCount} tasks (filtered from ${golden.metadata?.taskCount})`)
      // TASK-344: Explicitly specify no dry-run to get boolean return
      const result = await restoreBackup(filteredGolden, { dryRun: false, backupSource: 'golden' })
      return result === true
    },

    // TASK-332: Restore from a specific golden backup in the rotation (by index)
    restoreFromGoldenBackupByIndex: async (index: number, skipValidation: boolean = false) => {
      const rotation = getGoldenBackups()
      if (index < 0 || index >= rotation.length) {
        console.error(`[Backup] Invalid golden backup index: ${index}. Available: 0-${rotation.length - 1}`)
        return false
      }

      const golden = rotation[index]
      if (!skipValidation) {
        console.log(`[Backup] Restoring from golden backup #${index + 1}: ${golden.metadata?.taskCount} tasks`)
      }

      // TASK-153: Filter out items that are deleted in Supabase
      const filteredGolden = await filterGoldenBackupData(golden)

      console.log(`[Backup] Restoring from golden backup #${index + 1}: ${filteredGolden.metadata?.taskCount} tasks (filtered from ${golden.metadata?.taskCount})`)
      const result = await restoreBackup(filteredGolden, { dryRun: false, backupSource: `golden-${index}` })
      return result === true
    },

    // TASK-153: Get validation info for UI display before restore
    getGoldenBackupValidation: validateGoldenBackup,

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
      const result = await restoreBackup({
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
      }, { dryRun: false, backupSource: 'shadow' })
      return result === true
    }
  }
}

// Default export for convenience
export default useBackupSystem
