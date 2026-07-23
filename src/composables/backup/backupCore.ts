import {
  STORAGE_KEYS,
  DATA_LOSS_THRESHOLD,
  BACKUP_SCHEMA_VERSION,
  assertNoTombstoneContradictions,
  calculateChecksum,
  generateBackupId
} from './types'
import type { BackupContext, BackupData } from './types'
import type { HistoryOperations } from './backupHistory'
import type { GoldenOperations } from './backupGolden'
import { filterMockTasks } from '@/utils/mockTaskDetector'

export interface CoreOperations {
  createBackup: (type?: 'auto' | 'manual' | 'emergency') => Promise<BackupData | null>
  isBackupSuspicious: (taskCount: number, type: 'auto' | 'manual' | 'emergency') => { suspicious: boolean; reason: string }
  getMaxTaskCount: () => number
  updateMaxTaskCount: (currentCount: number) => void
}

export function createCoreOperations(
  ctx: BackupContext,
  historyOps: HistoryOperations,
  goldenOps: GoldenOperations
): CoreOperations {
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
   * BUG-059 FIX: Check if backup looks suspicious (potential data loss)
   */
  function isBackupSuspicious(taskCount: number, type: 'auto' | 'manual' | 'emergency'): { suspicious: boolean; reason: string } {
    const maxCount = getMaxTaskCount()
    const golden = goldenOps.getGoldenBackup()
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
    if (ctx.stats.value.isBackupInProgress) {
      console.log('[Backup] Skipping - backup already in progress')
      return null
    }

    ctx.stats.value.isBackupInProgress = true
    ctx.state.value.error = null

    try {
      console.log(`[Backup] Creating ${type} backup...`)

      // Backups are an absolute inventory, not a view export. The renderer store
      // may hold only the active workspace, while local optimistic rows may be
      // newer than Supabase. Merge all remote scopes, then local intent, then Trash.
      const { useAuthStore } = await import('@/stores/auth')
      const isAuthenticated = Boolean(useAuthStore().user?.id)
      const remoteActiveTasks = isAuthenticated && typeof ctx.db.fetchTasks === 'function'
        ? await ctx.db.fetchTasks(undefined, { forceFresh: true })
        : []
      let trashReadFailed = false
      const trashTasks = isAuthenticated && typeof ctx.db.fetchTrash === 'function'
        ? await ctx.db.fetchTrash({ onError: () => { trashReadFailed = true } })
        : []
      if (trashReadFailed) {
        throw new Error('Backup refused because deleted-task inventory could not be read')
      }
      let tombstoneReadFailed = false
      const tombstones = isAuthenticated && typeof ctx.db.fetchTombstones === 'function'
        ? await ctx.db.fetchTombstones({ onError: () => { tombstoneReadFailed = true } })
        : []
      if (tombstoneReadFailed) {
        throw new Error('Backup refused because permanent-delete inventory could not be read')
      }
      const tasksById = new Map(
        [...remoteActiveTasks, ...(ctx.taskStore._rawTasks || []), ...trashTasks]
          .map(task => [task.id, task])
      )
      let tasks = [...tasksById.values()]
      const projects = [...(ctx.projectStore.projects || [])]
      const groups = [...(ctx.canvasStore.groups || [])]

      assertNoTombstoneContradictions({ tasks, projects, groups, tombstones })

      // Filter mock tasks if enabled
      if (ctx.config.value.filterMockTasks && tasks.length > 0) {
        const filterResult = filterMockTasks(tasks as unknown as Record<string, unknown>[], { confidence: 'medium', logResults: false })
        if (filterResult.mockTasks.length > 0) {
          console.log(`[Backup] Filtered ${filterResult.mockTasks.length} mock tasks`)
        }
        tasks = filterResult.cleanTasks as unknown as any[]
      }

      // BUG-059 FIX: Check if this backup looks suspicious before saving
      const suspiciousCheck = isBackupSuspicious(tasks.length, type)
      if (suspiciousCheck.suspicious) {
        ctx.state.value.error = suspiciousCheck.reason
        return null
      }

      const deletedTaskCount = tasks.filter(task => task._soft_deleted).length
      const completionRecordCount = tasks.filter(task => task.isCompletionRecord).length
      const workspaceTaskCount = tasks.filter(task => Boolean(task.workspaceId)).length

      // Bug 3 fix: capture settings (exclude sensitive tokens/keys)
      let settings: Record<string, unknown> = {}
      try {
        const { useSettingsStore } = await import('@/stores/settings')
        const settingsStore = useSettingsStore()
        const SETTINGS_EXCLUDE = new Set([
          'googleProviderToken', 'googleProviderRefreshToken', 'googleProviderTokenExpiry',
          'groqApiKey'
        ])
        settings = Object.fromEntries(
          Object.entries(settingsStore.$state as unknown as Record<string, unknown>).filter(([k]) => !SETTINGS_EXCLUDE.has(k))
        )
      } catch {
        // Settings are optional in backup
      }

      // Create backup object
      const backupData: BackupData = {
        id: generateBackupId(),
        tasks,
        projects,
        groups,
        tombstones,
        settings,
        timestamp: Date.now(),
        version: BACKUP_SCHEMA_VERSION,
        checksum: '',
        type,
        metadata: {
          taskCount: tasks.length,
          activeTaskCount: tasks.length - deletedTaskCount,
          deletedTaskCount,
          completionRecordCount,
          workspaceTaskCount,
          tombstoneCount: tombstones.length,
          projectCount: projects.length,
          groupCount: groups.length
        }
      }

      // Calculate checksum
      backupData.checksum = calculateChecksum({
        tasks: backupData.tasks,
        projects: backupData.projects,
        groups: backupData.groups,
        tombstones: backupData.tombstones
      })

      // Calculate approximate size
      const size = new TextEncoder().encode(JSON.stringify(backupData)).length
      if (backupData.metadata) {
        backupData.metadata.size = size
      }

      // Save to localStorage
      if (!historyOps.saveToHistory(backupData)) {
        throw new Error('Backup could not be persisted and verified')
      }

      // BUG-059 FIX: Update max task count and golden backup
      const taskCount = backupData.metadata?.taskCount || 0
      updateMaxTaskCount(taskCount)
      goldenOps.saveGoldenBackup(backupData)

      // Update stats
      ctx.stats.value.lastBackupTime = backupData.timestamp
      ctx.stats.value.totalBackups++

      console.log(`[Backup] Created successfully: ${backupData.metadata?.taskCount} tasks, ${backupData.metadata?.projectCount} projects, ${backupData.metadata?.groupCount} groups`)

      return backupData

    } catch (error) {
      console.error('[Backup] Failed to create backup:', error)
      ctx.state.value.error = error instanceof Error ? error.message : 'Backup failed'
      return null

    } finally {
      ctx.stats.value.isBackupInProgress = false
    }
  }

  return {
    createBackup,
    isBackupSuspicious,
    getMaxTaskCount,
    updateMaxTaskCount
  }
}
