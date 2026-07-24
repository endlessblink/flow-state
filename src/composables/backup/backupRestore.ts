import {
  BACKUP_SCHEMA_VERSION,
  assertNoTombstoneContradictions,
  calculateChecksum,
  validateAndSortTasksForRestore,
} from './types'
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

type WorkspaceScopedEntity = {
  workspaceId?: string | null
  workspace_id?: string | null
}

function getWorkspaceId(entity: unknown): string | null {
  const scoped = entity as WorkspaceScopedEntity
  return scoped.workspaceId || scoped.workspace_id || null
}

function isSharedEntity(entity: unknown): boolean {
  return Boolean(getWorkspaceId(entity))
}

function getSharedWorkspaceIds(backupData: BackupData): Set<string> {
  return new Set(
    [
      ...(backupData.tasks || []),
      ...(backupData.projects || []),
      ...(backupData.groups || []),
    ]
      .map(entity => getWorkspaceId(entity))
      .filter((workspaceId): workspaceId is string => Boolean(workspaceId))
  )
}

function buildPersonalRecoveryPartition(backupData: BackupData): {
  tasks: BackupData['tasks']
  projects: BackupData['projects']
  groups: BackupData['groups']
} {
  const sharedTaskIds = new Set(
    backupData.tasks.filter(isSharedEntity).map(task => task.id)
  )
  const sharedProjectIds = new Set(
    (backupData.projects || []).filter(isSharedEntity).map(project => project.id)
  )
  const sharedGroupIds = new Set(
    (backupData.groups || []).filter(isSharedEntity).map(group => group.id)
  )
  const sourceUserId = backupData.source?.kind === 'account'
    ? backupData.source.userId
    : null

  const tasks = backupData.tasks
    .filter(task => !isSharedEntity(task))
    .map(task => {
      const connectionTypes = task.connectionTypes
        ? Object.fromEntries(
          Object.entries(task.connectionTypes)
            .filter(([targetTaskId]) => !sharedTaskIds.has(targetTaskId))
        )
        : task.connectionTypes
      return {
        ...task,
        projectId: sharedProjectIds.has(task.projectId) ? '' : task.projectId,
        parentId: task.parentId && sharedGroupIds.has(task.parentId)
          ? undefined
          : task.parentId,
        parentTaskId: task.parentTaskId && sharedTaskIds.has(task.parentTaskId)
          ? null
          : task.parentTaskId,
        recurrenceParentId: task.recurrenceParentId
          && sharedTaskIds.has(task.recurrenceParentId)
          ? undefined
          : task.recurrenceParentId,
        dependsOn: task.dependsOn?.filter(taskId => !sharedTaskIds.has(taskId)),
        connectionTypes,
        assignedTo: task.assignedTo
          && task.assignedTo !== sourceUserId
          ? null
          : task.assignedTo,
      }
    })
  const projects = (backupData.projects || [])
    .filter(project => !isSharedEntity(project))
    .map(project => ({
      ...project,
      parentId: project.parentId && sharedProjectIds.has(project.parentId)
        ? null
        : project.parentId,
    }))
  const groups = (backupData.groups || [])
    .filter(group => !isSharedEntity(group))
    .map(group => ({
      ...group,
      parentGroupId: group.parentGroupId && sharedGroupIds.has(group.parentGroupId)
        ? null
        : group.parentGroupId,
      linkedParentTaskId: group.linkedParentTaskId
        && sharedTaskIds.has(group.linkedParentTaskId)
        ? null
        : group.linkedParentTaskId,
    }))

  return { tasks, projects, groups }
}

export function createRestoreOperations(
  ctx: BackupContext,
  coreOps: CoreOperations,
  _goldenOps: GoldenOperations
): RestoreOperations {
  const getAuthorityBlockReason = async (backupData: BackupData): Promise<string | null> => {
    const { useAuthStore } = await import('@/stores/auth')
    const currentUserId = useAuthStore().user?.id ?? null

    if (backupData.version === BACKUP_SCHEMA_VERSION && !backupData.source) {
      return 'Backup source account is required for the current schema'
    }
    if (!backupData.source && currentUserId) {
      return (
        'Legacy backups created before source-account provenance cannot be restored while signed in; ' +
        'recover them from guest mode first'
      )
    }
    if (backupData.source?.kind === 'account') {
      if (currentUserId !== backupData.source.userId) {
        return 'Backup belongs to a different account and cannot be restored into this account'
      }
    }

    return null
  }

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
    const authorityBlockReason = await getAuthorityBlockReason(backupData)
    if (authorityBlockReason) {
      return {
        backup: backupData,
        tasks: { total: backupData.tasks?.length || 0, available: 0, existsActive: 0, existsDeleted: 0, tombstoned: 0, toRestore: [], skipped: [] },
        projects: { total: backupData.projects?.length || 0, toRestore: 0, skipped: backupData.projects?.length || 0 },
        groups: { total: backupData.groups?.length || 0, toRestore: 0, skipped: backupData.groups?.length || 0 },
        tombstones: { total: backupData.tombstones?.length || 0, toRestore: 0 },
        warnings: [authorityBlockReason],
        canProceed: false,
      }
    }

    // Validate backup structure
    if (!backupData.tasks || !Array.isArray(backupData.tasks)) {
      return {
        backup: backupData,
        tasks: { total: 0, available: 0, existsActive: 0, existsDeleted: 0, tombstoned: 0, toRestore: [], skipped: [] },
        projects: { total: 0, toRestore: 0, skipped: 0 },
        groups: { total: 0, toRestore: 0, skipped: 0 },
        tombstones: { total: 0, toRestore: 0 },
        warnings: ['Invalid backup: missing tasks array'],
        canProceed: false
      }
    }

    const sharedWorkspaceIds = getSharedWorkspaceIds(backupData)
    const personalPartition = buildPersonalRecoveryPartition(backupData)
    const personalTasks = personalPartition.tasks
    const sharedTasks = backupData.tasks.filter(task => isSharedEntity(task))

    // Get personal task IDs to check. Shared data remains in the verified
    // artifact but needs its own ownership-aware restore transaction.
    const taskIds = personalTasks.map(t => t.id)

    // Check availability using TASK-344 batch check
    const availabilityResults = await ctx.db.checkTaskIdsAvailability(taskIds)
    const availabilityMap = new Map<string, TaskIdAvailability>()
    for (const result of availabilityResults) {
      availabilityMap.set(result.taskId, result)
    }

    // Categorize tasks
    const toRestore: any[] = []
    const skipped: RestoreAnalysis['tasks']['skipped'] = []
    let existsActive = 0
    let existsDeleted = 0
    let tombstoned = 0

    for (const task of personalTasks) {
      const availability = availabilityMap.get(task.id)
      if (!availability || availability.status === 'available') {
        toRestore.push(task)
      } else {
        skipped.push({
          task,
          reason: availability.reason,
          status: availability.status,
        })
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
    for (const task of sharedTasks) {
      skipped.push({
        task,
        reason: 'Shared workspace restore requires an explicit authorized recovery policy',
        status: 'shared_workspace',
      })
    }
    if (sharedWorkspaceIds.size > 0) {
      warnings.push(
        `${sharedTasks.length} shared workspace task${sharedTasks.length === 1 ? '' : 's'} ` +
        `from ${[...sharedWorkspaceIds].join(', ')} will be preserved in the artifact but not restored`
      )
      if ((backupData.tombstones?.length || 0) > 0) {
        warnings.push(
          `${backupData.tombstones!.length} tombstones have no workspace provenance and will not be restored from a mixed-scope backup`
        )
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

    const projectsToRestore = personalPartition.projects.filter(p =>
      !deletedProjectIds.has(p.id)
      && !projectTombstones.has(p.id)
    )
    const groupsToRestore = personalPartition.groups.filter(g =>
      !deletedGroupIds.has(g.id)
      && !groupTombstones.has(g.id)
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
      tombstones: {
        total: backupData.tombstones?.length || 0,
        toRestore: sharedWorkspaceIds.size > 0 ? 0 : backupData.tombstones?.length || 0,
      },
      warnings,
      canProceed: toRestore.length > 0
        || projectsToRestore.length > 0
        || groupsToRestore.length > 0
        || (sharedWorkspaceIds.size === 0 && (backupData.tombstones?.length || 0) > 0)
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
    ctx.state.value.warning = null

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

      if (backupData.version === BACKUP_SCHEMA_VERSION && !backupData.checksum) {
        throw new Error('Backup checksum is required for the current schema')
      }
      if (backupData.version === BACKUP_SCHEMA_VERSION && !backupData.metadata) {
        throw new Error('Backup count metadata is required for the current schema')
      }
      const authorityBlockReason = await getAuthorityBlockReason(backupData)
      if (authorityBlockReason) {
        throw new Error(authorityBlockReason)
      }

      const countChecks = [
        ['task', backupData.metadata?.taskCount, backupData.tasks.length],
        ['active task', backupData.metadata?.activeTaskCount, backupData.tasks.filter(task => !task._soft_deleted).length],
        ['deleted task', backupData.metadata?.deletedTaskCount, backupData.tasks.filter(task => task._soft_deleted).length],
        ['completion record', backupData.metadata?.completionRecordCount, backupData.tasks.filter(task => task.isCompletionRecord).length],
        ['workspace task', backupData.metadata?.workspaceTaskCount, backupData.tasks.filter(task => Boolean(task.workspaceId)).length],
        ['tombstone', backupData.metadata?.tombstoneCount, backupData.tombstones?.length || 0],
        ['project', backupData.metadata?.projectCount, backupData.projects?.length || 0],
        ['group', backupData.metadata?.groupCount, backupData.groups?.length || 0],
      ] as const
      for (const [entity, expected, actual] of countChecks) {
        if (typeof expected === 'number' && expected !== actual) {
          throw new Error(
            `Backup ${entity} count mismatch: metadata says ${expected}, artifact contains ${actual}`
          )
        }
      }

      // Verify checksum if present
      if (backupData.checksum) {
        const checksumPayload = {
          ...(backupData.source ? { source: backupData.source } : {}),
          tasks: backupData.tasks,
          projects: backupData.projects,
          groups: backupData.groups,
          ...(backupData.tombstones ? { tombstones: backupData.tombstones } : {}),
        }
        const currentChecksum = calculateChecksum(checksumPayload)
        if (currentChecksum !== backupData.checksum) {
          if (backupData.version === BACKUP_SCHEMA_VERSION) {
            throw new Error('Backup checksum mismatch: restore refused because the backup may be corrupted')
          }
          console.warn(
            `[Backup] Legacy ${backupData.version} checksum is not serialization-stable; ` +
            'continuing only after structural count validation'
          )
        }
      }

      assertNoTombstoneContradictions({
        tasks: backupData.tasks,
        projects: backupData.projects || [],
        groups: backupData.groups || [],
        tombstones: backupData.tombstones,
      })

      // A restore must never discard the only durable copy of an offline edit.
      // Resolve or explicitly discard queued work through the sync UI before
      // restoring so backup rows cannot race or overwrite unresolved intent.
      const { getStats } = await import('@/services/offline/writeQueueDB')
      const queueStats = await getStats()
      const unresolvedQueueCount = queueStats.pendingCount
        + queueStats.syncingCount
        + queueStats.failedCount
        + queueStats.conflictCount
      if (unresolvedQueueCount > 0) {
        throw new Error(
          `Restore blocked: ${unresolvedQueueCount} unsynced local change${unresolvedQueueCount === 1 ? '' : 's'} must be resolved first`
        )
      }

      ctx.state.value.restoreProgress = 10

      // TASK-344: Analyze and filter tasks before restore
      const sharedWorkspaceIds = getSharedWorkspaceIds(backupData)
      const personalPartition = buildPersonalRecoveryPartition(backupData)
      const personalArtifactTasks = personalPartition.tasks
      let tasksToRestore = personalArtifactTasks
      const existingParentIds = new Set<string>()
      let projectsToRestore = personalPartition.projects
      let groupsToRestore = personalPartition.groups
      const tombstonesToRestore = sharedWorkspaceIds.size > 0
        ? []
        : backupData.tombstones || []

      if (sharedWorkspaceIds.size > 0) {
        ctx.state.value.warning =
          `Shared workspace data from ${[...sharedWorkspaceIds].join(', ')} remains in the verified backup but was not restored.`
      }

      if (!options.skipDedupCheck) {
        console.log('[Backup] Analyzing task ID availability (TASK-344 deduplication)...')
        const analysis = await analyzeRestore(backupData)

        tasksToRestore = analysis.tasks.toRestore
        for (const skipped of analysis.tasks.skipped) {
          if (skipped.status === 'active') {
            existingParentIds.add(skipped.task.id)
          }
        }
        ctx.state.value.restoreProgress = 20

        // Log dedup decisions for audit trail
        for (const { task, reason, status } of analysis.tasks.skipped) {
          if (status === 'shared_workspace') continue
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

        projectsToRestore = personalPartition.projects.filter(p =>
          !deletedProjectIds.has(p.id)
          && !projectTombstones.has(p.id)
        )
        groupsToRestore = personalPartition.groups.filter(g =>
          !deletedGroupIds.has(g.id)
          && !groupTombstones.has(g.id)
        )

        console.log(`[Backup] TASK-344 Deduplication results:`)
        console.log(`  Tasks: ${tasksToRestore.length}/${backupData.tasks.length} will be restored`)
        console.log(`  Projects: ${projectsToRestore.length}/${backupData.projects?.length || 0} will be restored`)
        console.log(`  Groups: ${groupsToRestore.length}/${backupData.groups?.length || 0} will be restored`)
      }

      tasksToRestore = validateAndSortTasksForRestore(
        personalArtifactTasks,
        tasksToRestore,
        existingParentIds,
      )
      if (
        tasksToRestore.length === 0
        && projectsToRestore.length === 0
        && groupsToRestore.length === 0
        && tombstonesToRestore.length === 0
      ) {
        throw new Error(
          'Backup contains only shared workspace data; shared workspace restore requires an explicit authorized recovery policy'
        )
      }
      ctx.state.value.restoreProgress = 30

      // Create emergency backup before restore (rollback point)
      const emergencyBackup = await coreOps.createBackup('emergency')
      if (!emergencyBackup) {
        throw new Error(
          'Restore refused because the emergency rollback backup could not be created'
        )
      }
      ctx.state.value.restoreProgress = 40

      const atomicReceipt = typeof ctx.db.restoreBackupTransaction === 'function'
        ? await ctx.db.restoreBackupTransaction({
            operationId: backupData.id,
            artifactHash: backupData.checksum,
            schemaVersion: backupData.version,
            tasks: tasksToRestore,
            projects: projectsToRestore,
            groups: groupsToRestore,
            tombstones: tombstonesToRestore,
          })
        : null

      // Restore to Supabase using safeCreateTask for each task
      // TASK-344: This ensures immutable IDs - no duplicates even with race conditions
      if (!atomicReceipt && tasksToRestore.length > 0) {
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
        if (created !== tasksToRestore.length) {
          throw new Error(
            `Task restore incomplete: ${tasksToRestore.length - created} of ${tasksToRestore.length} tasks could not be recreated`
          )
        }

        const restoredIds = tasksToRestore.map(task => task.id)
        const readback = await ctx.db.checkTaskIdsAvailability(restoredIds)
        const expectedStatusById = new Map(
          tasksToRestore.map(task => [
            task.id,
            task._soft_deleted ? 'soft_deleted' : 'active',
          ])
        )
        const readableIds = new Set(readback
          .filter((result: TaskIdAvailability) => (
            result.status === expectedStatusById.get(result.taskId)
          ))
          .map((result: TaskIdAvailability) => result.taskId))
        const missingIds = restoredIds.filter(taskId => !readableIds.has(taskId))
        if (missingIds.length > 0) {
          throw new Error(
            `Task restore incomplete: ${missingIds.length} of ${restoredIds.length} tasks are not readable after restore`
          )
        }
      }
      if (atomicReceipt && tasksToRestore.length > 0) {
        try {
          const restoredIds = tasksToRestore.map(task => task.id)
          const readback = await ctx.db.checkTaskIdsAvailability(restoredIds)
          const expectedStatusById = new Map(
            tasksToRestore.map(task => [
              task.id,
              task._soft_deleted ? 'soft_deleted' : 'active',
            ])
          )
          const readableIds = new Set(readback
            .filter((result: TaskIdAvailability) => (
              result.status === expectedStatusById.get(result.taskId)
            ))
            .map((result: TaskIdAvailability) => result.taskId))
          const missingIds = restoredIds.filter(taskId => !readableIds.has(taskId))
          if (missingIds.length > 0) {
            ctx.state.value.warning =
              `Restore committed, but ${missingIds.length} of ${restoredIds.length} tasks could not be verified yet. Refresh is required.`
            console.warn(`[Backup] ${ctx.state.value.warning}`)
          }
        } catch (readbackError) {
          ctx.state.value.warning =
            'Restore committed, but task verification is temporarily unavailable. Refresh is required.'
          console.warn(`[Backup] ${ctx.state.value.warning}`, readbackError)
        }
      }
      ctx.state.value.restoreProgress = 60

      // Restore Projects
      if (!atomicReceipt && projectsToRestore.length > 0) {
        console.log(`[Backup] Restoring ${projectsToRestore.length} projects...`)
        await ctx.db.saveProjects(projectsToRestore)
      }
      ctx.state.value.restoreProgress = 70

      // Restore Groups
      if (!atomicReceipt && groupsToRestore.length > 0) {
        console.log(`[Backup] Restoring ${groupsToRestore.length} groups...`)
        for (const group of groupsToRestore) {
          await ctx.db.saveGroup(group)
        }
      }
      ctx.state.value.restoreProgress = 80

      // Apply irreversible permanent-deletion markers only after all recoverable
      // entities have been recreated successfully.
      if (!atomicReceipt) {
        for (const tombstone of tombstonesToRestore) {
          await ctx.db.recordTombstone(tombstone.entityType, tombstone.entityId)
        }
      }
      if (tombstonesToRestore.length > 0) {
        try {
          const restoredTombstones = await ctx.db.fetchTombstones()
          const restoredKeys = new Set(
            restoredTombstones.map((tombstone: { entityType: string; entityId: string }) =>
              `${tombstone.entityType}:${tombstone.entityId}`
            )
          )
          const missingTombstones = tombstonesToRestore.filter(
            tombstone => !restoredKeys.has(`${tombstone.entityType}:${tombstone.entityId}`)
          )
          if (missingTombstones.length > 0) {
            const message =
              `${missingTombstones.length} of ${tombstonesToRestore.length} permanent deletions are not readable after restore`
            if (!atomicReceipt) {
              throw new Error(`Tombstone restore incomplete: ${message}`)
            }
            ctx.state.value.warning =
              `Restore committed, but ${message} yet. Refresh is required.`
            console.warn(`[Backup] ${ctx.state.value.warning}`)
          }
        } catch (readbackError) {
          if (!atomicReceipt) throw readbackError
          ctx.state.value.warning =
            'Restore committed, but permanent-deletion verification is temporarily unavailable. Refresh is required.'
          console.warn(`[Backup] ${ctx.state.value.warning}`, readbackError)
        }
      }

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
      try {
        if (ctx.taskStore.loadFromDatabase) await ctx.taskStore.loadFromDatabase()
        if (ctx.projectStore.loadProjectsFromDatabase) await ctx.projectStore.loadProjectsFromDatabase()
        if (ctx.canvasStore.loadFromDatabase) await ctx.canvasStore.loadFromDatabase()
      } catch (reloadError) {
        if (!atomicReceipt) throw reloadError
        ctx.state.value.warning =
          'Restore committed, but the refreshed data could not be loaded yet. Refresh is required.'
        console.warn(`[Backup] ${ctx.state.value.warning}`, reloadError)
      }

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
