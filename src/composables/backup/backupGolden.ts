import { STORAGE_KEYS, MAX_GOLDEN_BACKUPS, GOLDEN_BACKUP_MAX_AGE_MS, calculateChecksum } from './types'
import type { BackupContext, BackupData, GoldenBackupValidation } from './types'

export interface GoldenOperations {
  getGoldenBackups: () => BackupData[]
  getGoldenBackup: () => BackupData | null
  saveGoldenBackup: (backup: BackupData, force?: boolean) => boolean
  validateGoldenBackup: () => Promise<GoldenBackupValidation | null>
  filterGoldenBackupData: (golden: BackupData) => Promise<BackupData>
}

export function createGoldenOperations(ctx: BackupContext): GoldenOperations {
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
      if (ctx.db.fetchDeletedTaskIds) {
        deletedTaskIds = new Set(await ctx.db.fetchDeletedTaskIds())
      }
      if (ctx.db.fetchDeletedProjectIds) {
        deletedProjectIds = new Set(await ctx.db.fetchDeletedProjectIds())
      }
      if (ctx.db.fetchDeletedGroupIds) {
        deletedGroupIds = new Set(await ctx.db.fetchDeletedGroupIds())
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
      if (ctx.db.fetchDeletedTaskIds) {
        deletedTaskIds = new Set(await ctx.db.fetchDeletedTaskIds())
      }
      if (ctx.db.fetchDeletedProjectIds) {
        deletedProjectIds = new Set(await ctx.db.fetchDeletedProjectIds())
      }
      if (ctx.db.fetchDeletedGroupIds) {
        deletedGroupIds = new Set(await ctx.db.fetchDeletedGroupIds())
      }
    } catch (error) {
      console.warn('[Backup] Could not fetch deleted IDs, restoring all items:', error)
    }

    const filtered: BackupData = {
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
    filtered.checksum = calculateChecksum({
      tasks: filtered.tasks,
      projects: filtered.projects,
      groups: filtered.groups
    })
    return filtered
  }

  return {
    getGoldenBackups,
    getGoldenBackup,
    saveGoldenBackup,
    validateGoldenBackup,
    filterGoldenBackupData
  }
}
