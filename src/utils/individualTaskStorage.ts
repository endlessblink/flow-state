/**
 * Individual Task Storage Utility
 *
 * Stores each task as a separate PouchDB document to prevent conflicts
 * during cross-browser synchronization.
 *
 * Document ID format: task-{taskId}
 *
 * This fixes the sync conflict issue where a single tasks:data document
 * caused data loss when two browsers edited different tasks.
 */

import type { Task } from '@/types/tasks'
import PowerSyncService from '@/services/database/PowerSyncDatabase'
import { toSqlTask, fromSqlTask } from '@/utils/taskMapper'
import type { SqlTask } from '@/services/database/SqlDatabaseTypes'

// Feature Flag: Check if we should use SQLite
const shouldUseSqlite = () => {
  return localStorage.getItem('POWERSYNC_MIGRATION_COMPLETE') === 'true'
}

// PouchDB document interfaces
interface TaskDocument extends PouchDB.Core.IdMeta, PouchDB.Core.GetMeta {
  type: 'task'
  data: Record<string, unknown>
}

interface LegacyTasksDocument extends PouchDB.Core.IdMeta, PouchDB.Core.GetMeta {
  data?: Task[]
}

interface DeletedDocument {
  _id: string
  _rev: string
  _deleted?: boolean
  type?: string
  data?: Record<string, unknown>
}

// Helper type for window with database
interface WindowWithDb {
  pomoFlowDb?: PouchDB.Database
}

// Document prefix for individual task storage
export const TASK_DOC_PREFIX = 'task-'

/**
 * Get the PouchDB document ID for a task
 */
export const getTaskDocId = (taskId: string): string => {
  return `${TASK_DOC_PREFIX}${taskId}`
}

/**
 * Check if a document ID is a task document
 */
export const isTaskDocId = (docId: string): boolean => {
  return docId.startsWith(TASK_DOC_PREFIX) && !docId.includes(':')
}

/**
 * Extract task ID from document ID
 */
export const extractTaskId = (docId: string): string | null => {
  if (!isTaskDocId(docId)) return null
  return docId.substring(TASK_DOC_PREFIX.length)
}

/**
 * Helper to check if error is a connection closing error
 */
const isConnectionClosingError = (error: unknown): boolean => {
  const err = error as { message?: string; name?: string }
  return err?.message?.includes('connection is closing') ||
    err?.name === 'InvalidStateError'
}

/**
 * Helper to get database with retry on connection error
 * This re-fetches the database from window.pomoFlowDb if connection is lost
 */
const getDbWithRetry = async (db: PouchDB.Database): Promise<PouchDB.Database> => {
  try {
    // Test if connection is still valid
    await db.info()
    return db
  } catch (error) {
    if (isConnectionClosingError(error)) {
      console.warn('⚠️ [TASK-STORAGE] Connection closing, getting fresh database instance...')
      // Get fresh database from window
      const freshDb = (window as unknown as { pomoFlowDb?: PouchDB.Database }).pomoFlowDb
      if (freshDb) {
        return freshDb
      }
      // Wait a bit and try again
      await new Promise(resolve => setTimeout(resolve, 300))
      const retryDb = (window as unknown as { pomoFlowDb?: PouchDB.Database }).pomoFlowDb
      if (retryDb) {
        return retryDb
      }
    }
    throw error
  }
}

/**
 * Save a single task as an individual document
 */
export const saveTask = async (
  db: PouchDB.Database,
  task: Task,
  maxRetries: number = 3,
  bypassSql: boolean = false
): Promise<PouchDB.Core.Response | null> => {
  // BUG-060 FIX: Guard against undefined task IDs (causes phantom tasks)
  if (!task?.id) {
    console.error('🛡️ [SAFETY] BLOCKED: Attempted to save task with undefined ID')
    console.error('🛡️ [SAFETY] Stack trace:', new Error().stack)
    return null  // Return null instead of throwing - prevents cascading errors
  }

  const docId = getTaskDocId(task.id)

  // BRANCH: SQLite
  if (shouldUseSqlite() && !bypassSql) {
    try {
      const dbInstance = await PowerSyncService.getInstance()
      const t = toSqlTask(task)

      await dbInstance.execute(`
        INSERT OR REPLACE INTO tasks (
            id, title, description, status, priority,
            project_id, parent_task_id,
            total_pomodoros, estimated_pomodoros, progress,
            due_date, scheduled_date, scheduled_time, estimated_duration,
            instances_json, subtasks_json, depends_on_json, tags_json,
            connection_types_json, recurrence_json, recurring_instances_json, notification_prefs_json,
            canvas_position_x, canvas_position_y, is_in_inbox,
            "order", column_id,
            created_at, updated_at, completed_at,
            is_deleted, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        t.id, t.title, t.description, t.status, t.priority,
        t.project_id, t.parent_task_id,
        t.total_pomodoros, t.estimated_pomodoros, t.progress,
        t.due_date, t.scheduled_date, t.scheduled_time, t.estimated_duration,
        t.instances_json, t.subtasks_json, t.depends_on_json, t.tags_json,
        t.connection_types_json, t.recurrence_json, t.recurring_instances_json, t.notification_prefs_json,
        t.canvas_position_x, t.canvas_position_y, t.is_in_inbox,
        t.order, t.column_id,
        t.created_at, t.updated_at, t.completed_at,
        t.is_deleted, t.deleted_at
      ])

      // If SQLite is active, we are done
      return { ok: true, id: task.id, rev: '1-sqlite' }
    } catch (err) {
      console.error('❌ [SQL-ADAPTER] Save failed:', err)
      throw err
    }
  }

  // PouchDB branch removed during decommissioning
  console.warn('⚠️ [TASK-STORAGE] PouchDB save attempted but disabled.')
  return null
}

/**
 * Save multiple tasks as individual documents
 */
export const saveTasks = async (
  db: PouchDB.Database,
  tasks: Task[],
  maxRetries: number = 3,
  bypassSql: boolean = false
): Promise<(PouchDB.Core.Response | PouchDB.Core.Error)[]> => {
  // BUG-060 FIX: Filter out tasks with undefined IDs before bulk save
  const validTasks = tasks.filter(task => {
    if (!task?.id) {
      console.error('🛡️ [SAFETY] Filtered task with undefined ID from bulk save:', task)
      return false
    }
    return true
  })

  if (validTasks.length === 0) {
    if (tasks.length > 0) console.warn('🛡️ [SAFETY] No valid tasks to save (all had undefined IDs)')
    return []
  }

  // Final results array, initialized with errors (placeholder)
  const finalResults: (PouchDB.Core.Response | PouchDB.Core.Error)[] = new Array(validTasks.length).fill({ error: true, message: 'Unprocessed' } as any)

  // BRANCH: SQLite
  if (shouldUseSqlite() && !bypassSql) {
    try {
      const dbInstance = await PowerSyncService.getInstance()
      await dbInstance.writeTransaction(async (tx) => {
        for (const task of validTasks) {
          const t = toSqlTask(task)
          await tx.execute(`
              INSERT OR REPLACE INTO tasks (
                id, title, description, status, priority,
                project_id, parent_task_id,
                total_pomodoros, estimated_pomodoros, progress,
                due_date, scheduled_date, scheduled_time, estimated_duration,
                instances_json, subtasks_json, depends_on_json, tags_json,
                connection_types_json, recurrence_json, recurring_instances_json, notification_prefs_json,
                canvas_position_x, canvas_position_y, is_in_inbox,
                "order", column_id,
                created_at, updated_at, completed_at,
                is_deleted, deleted_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
            t.id, t.title, t.description, t.status, t.priority,
            t.project_id, t.parent_task_id,
            t.total_pomodoros, t.estimated_pomodoros, t.progress,
            t.due_date, t.scheduled_date, t.scheduled_time, t.estimated_duration,
            t.instances_json, t.subtasks_json, t.depends_on_json, t.tags_json,
            t.connection_types_json, t.recurrence_json, t.recurring_instances_json, t.notification_prefs_json,
            t.canvas_position_x, t.canvas_position_y, t.is_in_inbox,
            t.order, t.column_id,
            t.created_at, t.updated_at, t.completed_at,
            t.is_deleted, t.deleted_at
          ])
        }
      })

      // Continue to PouchDB save unless decommissioned
      return validTasks.map(t => ({ ok: true, id: t.id, rev: '1-sqlite' }))
    } catch (err: any) {
      console.error('❌ [SQL-ADAPTER] Bulk save failed:', err)
      return validTasks.map(t => ({ error: true, name: 'SqlError', message: err.message, status: 500 }))
    }
  }

  // PouchDB branch removed during decommissioning
  console.warn('⚠️ [TASK-STORAGE] PouchDB saveTasks attempted but disabled.')
  return []
}

/**
 * Delete a task document
 */
export const deleteTask = async (
  db: PouchDB.Database,
  taskId: string,
  maxRetries: number = 3,
  hardDelete: boolean = false
): Promise<PouchDB.Core.Response | null> => {
  const docId = getTaskDocId(taskId)

  // BRANCH: SQLite
  if (shouldUseSqlite()) {
    try {
      const dbInstance = await PowerSyncService.getInstance()
      if (hardDelete) {
        await dbInstance.execute('DELETE FROM tasks WHERE id = ?', [taskId])
      } else {
        await dbInstance.execute('UPDATE tasks SET is_deleted = 1, deleted_at = ? WHERE id = ?', [new Date().toISOString(), taskId])
      }
      console.log(`[SQL-ADAPTER] Deleted task ${taskId} from SQLite`)
    } catch (err) {
      console.error('❌ [SQL-ADAPTER] Delete failed:', err)
    }
  }

  // SQLite branch handles the deletion
  return { ok: true, id: taskId, rev: '1-sqlite' }
}

/**
 * Load all tasks from individual documents
 */
export const loadAllTasks = async (db: PouchDB.Database, includeDeleted = false): Promise<Task[]> => {
  const retryCount = 0
  const maxRetries = 3

  // BRANCH: SQLite
  if (shouldUseSqlite()) {
    try {
      const dbInstance = await PowerSyncService.getInstance()
      const sqlQuery = includeDeleted
        ? 'SELECT * FROM tasks'
        : 'SELECT * FROM tasks WHERE is_deleted = 0'
      const sqlTasks = await dbInstance.getAll<SqlTask>(sqlQuery)
      return sqlTasks.map(fromSqlTask)
    } catch (err) {
      console.error('❌ [SQL-ADAPTER] Load failed:', err)
      // Fallback to empty or throw? Throwing is safer to prevent data loss perception
      throw err
    }
  }

  // SQLite branch handles the load
  return []
}

/**
 * Load a single task by ID
 */
export const loadTask = async (
  db: PouchDB.Database,
  taskId: string,
  maxRetries: number = 3
): Promise<Task | null> => {
  const docId = getTaskDocId(taskId)
  try {
    const dbInstance = await PowerSyncService.getInstance()
    const result = await dbInstance.get<SqlTask>('SELECT * FROM tasks WHERE id = ?', [taskId])
    return result ? fromSqlTask(result) : null
  } catch (err) {
    console.error(`❌ [SQL-ADAPTER] Load task ${taskId} failed:`, err)
    return null
  }
}

/**
 * Migrate from legacy tasks:data format to individual documents
 */
export const migrateFromLegacyFormat = async (
  db: PouchDB.Database
): Promise<{ migrated: number; deleted: boolean }> => {
  let migrated = 0
  let deleted = false

  try {
    // Try to get legacy tasks:data document
    const legacyDoc = await db.get('tasks:data') as LegacyTasksDocument

    if (legacyDoc && legacyDoc.data && Array.isArray(legacyDoc.data)) {
      const tasks: Task[] = legacyDoc.data
      console.log(`🔄 [MIGRATION] Migrating ${tasks.length} tasks from legacy format...`)

      // Save each task as individual document
      const saveResults = await saveTasks(db, tasks)

      // CRITICAL: Check if ALL tasks were saved successfully before deleting legacy
      const errorCount = saveResults.filter(r => (r as PouchDB.Core.Error).error).length
      if (errorCount > 0) {
        console.error(`❌ [MIGRATION] Blocked legacy deletion: ${errorCount}/${tasks.length} tasks failed to save.`)
        return { migrated: tasks.length - errorCount, deleted: false }
      }

      migrated = tasks.length

      // Delete the legacy document
      try {
        await db.remove(legacyDoc)
        deleted = true
        console.log('✅ [MIGRATION] Legacy tasks:data document deleted')
      } catch (deleteError) {
        console.warn('⚠️ [MIGRATION] Failed to delete legacy document:', deleteError)
      }

      console.log(`✅ [MIGRATION] Migration complete: ${migrated} tasks migrated`)
    }
  } catch (error) {
    const pouchError = error as { status?: number }
    if (pouchError.status === 404) {
      // console.log('ℹ️ No legacy tasks:data document found, no migration needed')
    } else {
      console.error('❌ [MIGRATION] Error:', error)
      throw error
    }
  }

  return { migrated, deleted }
}

/**
 * Emergency Task Recovery
 * Un-deletes all soft-deleted tasks in the database.
 * Use this to recover from accidental mass-deletions.
 */
export const recoverSoftDeletedTasks = async (db: PouchDB.Database): Promise<number> => {
  console.log('🛡️ [RECOVERY] Scanning for soft-deleted tasks...')
  try {
    const result = await db.allDocs({
      include_docs: true,
      startkey: TASK_DOC_PREFIX,
      endkey: `${TASK_DOC_PREFIX}\ufff0`
    })

    const docsToRecover: any[] = []
    for (const row of result.rows) {
      if (row.doc) {
        const doc = row.doc as any
        const taskData = doc.data || doc

        if (taskData._soft_deleted) {
          console.log(`🛡️ [RECOVERY] Restoring task: ${taskData.title || taskData.id}`)
          docsToRecover.push({
            ...row.doc,
            data: {
              ...taskData,
              _soft_deleted: false,
              recoveredAt: new Date().toISOString()
            }
          })
        }
      }
    }

    if (docsToRecover.length > 0) {
      await db.bulkDocs(docsToRecover)
      console.log(`✅ [RECOVERY] Successfully recovered ${docsToRecover.length} tasks!`)
    } else {
      console.log('ℹ️ [RECOVERY] No soft-deleted tasks found.')
    }

    return docsToRecover.length
  } catch (error) {
    console.error('❌ [RECOVERY] Failed to recover tasks:', error)
    return 0
  }
}

/**
 * Delete multiple tasks
 * Atomic operation using bulkDocs
 */
export const deleteTasks = async (
  db: PouchDB.Database,
  taskIds: string[],
  hardDelete: boolean = false
): Promise<void> => {
  if (!taskIds.length) return

  // 1. Fetch current revisions
  const keys = taskIds.map(id => id.startsWith(TASK_DOC_PREFIX) ? id : `task-${id}`)

  try {
    const result = await db.allDocs({
      keys,
      include_docs: true // Need docs for soft delete (to preserve other fields)
    })

    // 2. Prepare deletion docs
    const docsToDelete = result.rows
      .filter((row): row is PouchDB.Core.AllDocsResponse<Record<string, any>>['rows'][0] & { doc: NonNullable<PouchDB.Core.ExistingDocument<any>> } => !('error' in row) && !!row.doc)
      .map(row => {
        if (hardDelete) {
          return {
            _id: row.id,
            _rev: row.value.rev,
            _deleted: true
          }
        } else {
          const taskData = (row.doc as any).data || {}
          return {
            ...row.doc,
            data: {
              ...taskData,
              _soft_deleted: true,
              deletedAt: new Date().toISOString()
            }
          }
        }
      })

    if (docsToDelete.length > 0) {
      await db.bulkDocs(docsToDelete)
      console.log(`🗑️ Bulk deleted ${docsToDelete.length} tasks`)
    }
  } catch (error) {
    console.error('❌ Bulk delete failed:', error)
    throw error
  }
}

/**
 * Sync deleted tasks - remove documents that no longer exist in the task list
 */
export const syncDeletedTasks = async (
  db: PouchDB.Database,
  currentTaskIds: Set<string>
): Promise<number> => {
  // Branch: SQLite doesn't need this complex logic (handled via WHERE is_deleted=0)
  if (shouldUseSqlite()) return 0;

  const result = await db.allDocs({
    include_docs: true,
    startkey: TASK_DOC_PREFIX,
    endkey: `${TASK_DOC_PREFIX}\ufff0`
  })

  const existingTaskCount = result.rows.length

  // BUG-057 CRITICAL SAFETY: Never delete ALL tasks if current set is empty
  // This prevents catastrophic data loss during sync glitches
  if (currentTaskIds.size === 0 && existingTaskCount > 0) {
    console.warn(`🛡️ [SAFETY] Blocked deletion of ${existingTaskCount} tasks - currentTaskIds is empty`)
    return 0
  }

  let deletedCount = 0
  const docsToDelete: DeletedDocument[] = []

  for (const row of result.rows) {
    const taskId = extractTaskId(row.id)
    // BUG-060 FIX: Skip invalid task IDs like 'undefined' or 'null'
    // These can occur when tasks with undefined IDs are saved
    if (taskId === 'undefined' || taskId === 'null' || !taskId) {
      console.warn(`⚠️ [SAFETY] Skipping invalid task document: ${row.id}`)
      continue
    }
    if (!currentTaskIds.has(taskId) && row.doc) {
      const taskData = (row.doc as any).data || {}

      // If already soft deleted, ignore (it's safe in trash)
      if (taskData._soft_deleted) {
        continue
      }

      // Otherwise, soft delete it
      docsToDelete.push({
        ...row.doc,
        data: {
          ...taskData,
          _soft_deleted: true,
          deletedAt: new Date().toISOString()
        }
      } as any)
      deletedCount++
    }
  }

  // BUG-057 CRITICAL SAFETY: Prevent mass deletion (more than 50% of tasks)
  // This catches edge cases where store is partially loaded
  if (existingTaskCount > 5 && deletedCount > existingTaskCount * 0.5) {
    console.warn(`🛡️ [SAFETY] Blocked mass deletion: ${deletedCount}/${existingTaskCount} tasks (>50%)`)
    return 0
  }

  // BUG-057: TIME-BASED STABILITY GUARD
  // A fresh session should wait at least 15 seconds before cleaning up "orphans"
  // to give sync a chance to populate the store.
  const sessionStart = (window as any).PomoFlowSessionStart || Date.now()
  const sessionAge = Date.now() - sessionStart
  if (deletedCount > 0 && sessionAge < 15000) {
    console.log(`🛡️ [SAFETY] Deferring deletion of ${deletedCount} orphans (Session age: ${Math.round(sessionAge / 1000)}s < 15s)`)
    return 0
  }

  if (docsToDelete.length > 0) {
    await db.bulkDocs(docsToDelete)
    console.log(`🗑️ Deleted ${deletedCount} orphaned task documents`)
  }

  return deletedCount
}
