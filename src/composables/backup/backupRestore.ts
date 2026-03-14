import { calculateChecksum } from './types'
import type { BackupContext, BackupData, RestoreAnalysis } from './types'
import type { CoreOperations } from './backupCore'
import type { GoldenOperations } from './backupGolden'
import type { TaskIdAvailability } from '@/composables/useSupabaseDatabase'

export interface RestoreOperations {
  analyzeRestore: (backup: BackupData | string) => Promise<RestoreAnalysis>
  restoreBackup: (
    backup: BackupData | string,
    options?: { dryRun?: boolean; skipDedupCheck?: boolean; backupSource?: string }
  ) => Promise<boolean | RestoreAnalysis>
}

export function createRestoreOperations(
  ctx: BackupContext,
  coreOps: CoreOperations,
  _goldenOps: GoldenOperations
): RestoreOperations {
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
    const availabilityResults = await ctx.db.checkTaskIdsAvailability(taskIds)
    const availabilityMap = new Map<string, TaskIdAvailability>()
    for (const result of availabilityResults) {
      availabilityMap.set(result.taskId, result)
    }

    // Categorize tasks
    const toRestore: any[] = []
    const skipped: Array<{ task: any; reason: string }> = []
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
    const deletedProjectIds = new Set(await ctx.db.fetchDeletedProjectIds())
    const deletedGroupIds = new Set(await ctx.db.fetchDeletedGroupIds())
    const tombstones = await ctx.db.fetchTombstones()
    const projectTombstones = new Set(tombstones.filter((t: any) => t.entityType === 'project').map((t: any) => t.entityId))
    const groupTombstones = new Set(tombstones.filter((t: any) => t.entityType === 'group').map((t: any) => t.entityId))

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

    ctx.state.value.isRestoring = true
    ctx.state.value.restoreProgress = 0
    ctx.state.value.error = null

    // Bug 1 fix: clear stale sync queue ops before restoring to prevent conflicts
    try {
      const { clearAll } = await import('@/services/offline/writeQueueDB')
      await clearAll()
      console.log('[Backup] Cleared sync queue before restore')
    } catch {
      // Non-critical — proceed even if queue clear fails
    }

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

      ctx.state.value.restoreProgress = 10

      // TASK-344: Analyze and filter tasks before restore
      let tasksToRestore = backupData.tasks
      let projectsToRestore = backupData.projects || []
      let groupsToRestore = backupData.groups || []

      if (!options.skipDedupCheck) {
        console.log('[Backup] Analyzing task ID availability (TASK-344 deduplication)...')
        const analysis = await analyzeRestore(backupData)

        tasksToRestore = analysis.tasks.toRestore
        ctx.state.value.restoreProgress = 20

        // Log dedup decisions for audit trail
        for (const { task, reason } of analysis.tasks.skipped) {
          await ctx.db.logDedupDecision(
            'restore',
            task.id,
            reason.includes('tombstoned') ? 'skipped_tombstoned' : 'skipped_exists',
            reason,
            options.backupSource
          )
        }

        // Filter projects and groups
        const deletedProjectIds = new Set(await ctx.db.fetchDeletedProjectIds())
        const deletedGroupIds = new Set(await ctx.db.fetchDeletedGroupIds())
        const tombstones = await ctx.db.fetchTombstones()
        const projectTombstones = new Set(tombstones.filter((t: any) => t.entityType === 'project').map((t: any) => t.entityId))
        const groupTombstones = new Set(tombstones.filter((t: any) => t.entityType === 'group').map((t: any) => t.entityId))

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

      ctx.state.value.restoreProgress = 30

      // Create emergency backup before restore (rollback point)
      await coreOps.createBackup('emergency')
      ctx.state.value.restoreProgress = 40

      // Restore to Supabase using safeCreateTask for each task
      // TASK-344: This ensures immutable IDs - no duplicates even with race conditions
      if (tasksToRestore.length > 0) {
        console.log(`[Backup] Restoring ${tasksToRestore.length} tasks using safeCreateTask...`)
        let created = 0
        let skipped = 0

        for (const task of tasksToRestore) {
          const result = await ctx.db.safeCreateTask(task)

          if (result.status === 'created') {
            created++
          } else {
            skipped++
            console.log(`[Backup] Task ${task.id.slice(0, 8)}... skipped: ${result.message}`)
          }

          // Log decision to audit table
          await ctx.db.logDedupDecision(
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
      ctx.state.value.restoreProgress = 60

      // Restore Projects
      if (projectsToRestore.length > 0) {
        console.log(`[Backup] Restoring ${projectsToRestore.length} projects...`)
        await ctx.db.saveProjects(projectsToRestore)
      }
      ctx.state.value.restoreProgress = 70

      // Restore Groups
      if (groupsToRestore.length > 0) {
        console.log(`[Backup] Restoring ${groupsToRestore.length} groups...`)
        for (const group of groupsToRestore) {
          await ctx.db.saveGroup(group)
        }
      }
      ctx.state.value.restoreProgress = 80

      // Bug 3 fix: restore settings if present in backup
      if (backupData.settings && Object.keys(backupData.settings).length > 0) {
        try {
          const { useSettingsStore } = await import('@/stores/settings')
          const settingsStore = useSettingsStore()
          // Exclude sensitive/session fields that should not be overwritten from backup
          const SETTINGS_EXCLUDE = new Set([
            'googleProviderToken', 'googleProviderRefreshToken', 'googleProviderTokenExpiry',
            'groqApiKey'
          ])
          const safe = Object.fromEntries(
            Object.entries(backupData.settings).filter(([k]) => !SETTINGS_EXCLUDE.has(k))
          )
          Object.assign(settingsStore.$state, safe)
          settingsStore.saveToStorage()
          console.log('[Backup] Settings restored from backup')
        } catch {
          // Non-critical — settings restore failure should not abort the whole restore
          console.warn('[Backup] Could not restore settings (non-fatal)')
        }
      }

      // Reload stores from database
      if (ctx.taskStore.loadFromDatabase) await ctx.taskStore.loadFromDatabase()
      if (ctx.projectStore.loadProjectsFromDatabase) await ctx.projectStore.loadProjectsFromDatabase()
      if (ctx.canvasStore.loadFromDatabase) await ctx.canvasStore.loadFromDatabase()

      ctx.state.value.restoreProgress = 100

      console.log(`[Backup] Restored successfully: ${tasksToRestore.length}/${backupData.tasks.length} tasks (TASK-344 filtered)`)
      return true

    } catch (error) {
      console.error('[Backup] Restore failed:', error)
      ctx.state.value.error = error instanceof Error ? error.message : 'Restore failed'
      return false

    } finally {
      ctx.state.value.isRestoring = false
      ctx.state.value.restoreProgress = 0
    }
  }

  return {
    analyzeRestore,
    restoreBackup
  }
}
