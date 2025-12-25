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
  _deleted: true
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
  maxRetries: number = 3
): Promise<PouchDB.Core.Response> => {
  const docId = getTaskDocId(task.id)
  let retryCount = 0

  while (retryCount < maxRetries) {
    try {
      // Get valid database connection
      const validDb = await getDbWithRetry(db)

      // Try to get existing document for revision
      const existingDoc = await validDb.get(docId).catch(() => null)

      const doc = {
        _id: docId,
        _rev: existingDoc?._rev,
        type: 'task',
        data: {
          ...task,
          // Ensure dates are serializable
          createdAt: task.createdAt instanceof Date ? task.createdAt.toISOString() : task.createdAt,
          updatedAt: task.updatedAt instanceof Date ? task.updatedAt.toISOString() : task.updatedAt,
          dueDate: task.dueDate || null
        }
      }

      return await validDb.put(doc)
    } catch (error) {
      retryCount++
      const pouchError = error as { status?: number; message?: string }

      // Handle connection closing error - retry
      if (isConnectionClosingError(error) && retryCount < maxRetries) {
        console.warn(`⚠️ [TASK-STORAGE] Connection closing on task ${task.id} (attempt ${retryCount}/${maxRetries}), retrying...`)
        await new Promise(resolve => setTimeout(resolve, 300 * retryCount))
        // Update db reference from window
        db = (window as unknown as WindowWithDb).pomoFlowDb || db
        continue
      }

      // Handle conflict by refetching and retrying
      if (pouchError.status === 409) {
        console.log(`🔄 Conflict saving task ${task.id}, refetching and retrying...`)
        const freshDoc = await db.get(docId)
        const doc = {
          _id: docId,
          _rev: freshDoc._rev,
          type: 'task',
          data: {
            ...task,
            createdAt: task.createdAt instanceof Date ? task.createdAt.toISOString() : task.createdAt,
            updatedAt: task.updatedAt instanceof Date ? task.updatedAt.toISOString() : task.updatedAt,
            dueDate: task.dueDate || null
          }
        }
        return await db.put(doc)
      }
      throw error
    }
  }
  throw new Error(`Failed to save task ${task.id} after ${maxRetries} attempts`)
}

/**
 * Save multiple tasks as individual documents
 */
export const saveTasks = async (
  db: PouchDB.Database,
  tasks: Task[],
  maxRetries: number = 3
): Promise<(PouchDB.Core.Response | PouchDB.Core.Error)[]> => {
  let retryCount = 0

  while (retryCount < maxRetries) {
    try {
      // Get valid database connection
      const validDb = await getDbWithRetry(db)

      // Get all existing task documents for revisions (metadata only is faster)
      const existingDocs = await validDb.allDocs({
        include_docs: false,
        startkey: TASK_DOC_PREFIX,
        endkey: `${TASK_DOC_PREFIX}\ufff0`
      })

      const revMap = new Map<string, string>()
      existingDocs.rows.forEach(row => {
        if (row.value?.rev) {
          revMap.set(row.id, row.value.rev)
        }
      })

      // Prepare documents for bulk insert
      const docs = tasks.map(task => {
        const docId = getTaskDocId(task.id)
        return {
          _id: docId,
          _rev: revMap.get(docId),
          type: 'task',
          data: {
            ...task,
            createdAt: task.createdAt instanceof Date ? task.createdAt.toISOString() : task.createdAt,
            updatedAt: task.updatedAt instanceof Date ? task.updatedAt.toISOString() : task.updatedAt,
            dueDate: task.dueDate || null
          }
        }
      })

      // Use bulkDocs for efficiency
      const results = await validDb.bulkDocs(docs)

      // Log any errors
      results.forEach((result, index) => {
        const errorResult = result as PouchDB.Core.Error
        if (errorResult.error) {
          console.error(`❌ Failed to save task ${tasks[index].id}:`, errorResult.message)
        }
      })

      return results
    } catch (error) {
      retryCount++

      // Handle connection closing error - retry
      if (isConnectionClosingError(error) && retryCount < maxRetries) {
        console.warn(`⚠️ [TASK-STORAGE] Connection closing on bulk save (attempt ${retryCount}/${maxRetries}), retrying...`)
        await new Promise(resolve => setTimeout(resolve, 300 * retryCount))
        // Update db reference from window
        db = (window as unknown as WindowWithDb).pomoFlowDb || db
        continue
      }

      throw error
    }
  }
  throw new Error(`Failed to save ${tasks.length} tasks after ${maxRetries} attempts`)
}

/**
 * Delete a task document
 */
export const deleteTask = async (
  db: PouchDB.Database,
  taskId: string,
  maxRetries: number = 3
): Promise<PouchDB.Core.Response | null> => {
  const docId = getTaskDocId(taskId)
  let retryCount = 0

  while (retryCount < maxRetries) {
    try {
      const validDb = await getDbWithRetry(db)
      const doc = await validDb.get(docId)
      return await validDb.remove(doc)
    } catch (error) {
      const pouchError = error as { status?: number }
      if (pouchError.status === 404) {
        console.log(`Task ${taskId} not found, already deleted`)
        return null
      }

      retryCount++

      // Handle connection closing error - retry
      if (isConnectionClosingError(error) && retryCount < maxRetries) {
        console.warn(`⚠️ [TASK-STORAGE] Connection closing on delete ${taskId} (attempt ${retryCount}/${maxRetries}), retrying...`)
        await new Promise(resolve => setTimeout(resolve, 300 * retryCount))
        db = (window as unknown as WindowWithDb).pomoFlowDb || db
        continue
      }

      throw error
    }
  }
  throw new Error(`Failed to delete task ${taskId} after ${maxRetries} attempts`)
}

/**
 * Load all tasks from individual documents
 */
export const loadAllTasks = async (
  db: PouchDB.Database,
  maxRetries: number = 3
): Promise<Task[]> => {
  let retryCount = 0

  while (retryCount < maxRetries) {
    try {
      const validDb = await getDbWithRetry(db)
      const result = await validDb.allDocs({
        include_docs: true,
        startkey: TASK_DOC_PREFIX,
        endkey: `${TASK_DOC_PREFIX}\ufff0`
      })

      const tasks: Task[] = []

      for (const row of result.rows) {
        if (row.doc) {
          const doc = row.doc as unknown as Record<string, unknown>
          let taskData: Record<string, unknown> | null = null

          // Handle nested format: { data: { id, title, ... } }
          if ('data' in doc && doc.data && typeof doc.data === 'object') {
            taskData = doc.data as Record<string, unknown>
          }
          // Handle flat format: { id, title, ... } (legacy/direct format)
          else if ('id' in doc && 'title' in doc) {
            // Extract task data from root, excluding PouchDB internal fields
            const { _id, _rev, _attachments, _conflicts, ...rest } = doc
            taskData = rest as Record<string, unknown>
          }

          if (taskData && taskData.id) {
            tasks.push({
              ...taskData,
              createdAt: new Date(taskData.createdAt as string || Date.now()),
              updatedAt: new Date(taskData.updatedAt as string || Date.now())
            } as Task)
          }
        }
      }

      // BUG-026: Reduced logging - only log if significant
      if (tasks.length > 0) {
        console.log(`📂 Loaded ${tasks.length} tasks`)
      }
      return tasks
    } catch (error) {
      retryCount++

      // Handle connection closing error - retry
      if (isConnectionClosingError(error) && retryCount < maxRetries) {
        console.warn(`⚠️ [TASK-STORAGE] Connection closing on loadAllTasks (attempt ${retryCount}/${maxRetries}), retrying...`)
        await new Promise(resolve => setTimeout(resolve, 300 * retryCount))
        db = (window as unknown as WindowWithDb).pomoFlowDb || db
        continue
      }

      throw error
    }
  }
  throw new Error(`Failed to load tasks after ${maxRetries} attempts`)
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
  let retryCount = 0

  while (retryCount < maxRetries) {
    try {
      const validDb = await getDbWithRetry(db)
      const doc = await validDb.get(docId) as TaskDocument
      if (doc.data) {
        const taskData = doc.data as Record<string, unknown>
        return {
          ...taskData,
          createdAt: new Date(taskData.createdAt as string),
          updatedAt: new Date(taskData.updatedAt as string)
        } as Task
      }
      return null
    } catch (error) {
      const pouchError = error as { status?: number }
      if (pouchError.status === 404) {
        return null
      }

      retryCount++

      // Handle connection closing error - retry
      if (isConnectionClosingError(error) && retryCount < maxRetries) {
        console.warn(`⚠️ [TASK-STORAGE] Connection closing on loadTask ${taskId} (attempt ${retryCount}/${maxRetries}), retrying...`)
        await new Promise(resolve => setTimeout(resolve, 300 * retryCount))
        db = (window as unknown as WindowWithDb).pomoFlowDb || db
        continue
      }

      throw error
    }
  }
  throw new Error(`Failed to load task ${taskId} after ${maxRetries} attempts`)
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
      console.log(`🔄 Migrating ${tasks.length} tasks from legacy format...`)

      // Save each task as individual document
      await saveTasks(db, tasks)
      migrated = tasks.length

      // Delete the legacy document
      try {
        await db.remove(legacyDoc)
        deleted = true
        console.log('✅ Legacy tasks:data document deleted')
      } catch (deleteError) {
        console.warn('⚠️ Failed to delete legacy document:', deleteError)
      }

      console.log(`✅ Migration complete: ${migrated} tasks migrated`)
    }
  } catch (error) {
    const pouchError = error as { status?: number }
    if (pouchError.status === 404) {
      console.log('ℹ️ No legacy tasks:data document found, no migration needed')
    } else {
      console.error('❌ Migration error:', error)
      throw error
    }
  }

  return { migrated, deleted }
}

/**
 * Delete multiple tasks
 * Atomic operation using bulkDocs
 */
export const deleteTasks = async (
  db: PouchDB.Database,
  taskIds: string[]
): Promise<void> => {
  if (!taskIds.length) return

  // 1. Fetch current revisions
  const keys = taskIds.map(id => id.startsWith(TASK_DOC_PREFIX) ? id : `task-${id}`)

  try {
    const result = await db.allDocs({
      keys,
      include_docs: false
    })

    // 2. Prepare deletion docs
    const docsToDelete = result.rows
      .filter((row): row is PouchDB.Core.AllDocsResponse<unknown>['rows'][0] & { value: { rev: string } } => !('error' in row) && !!row.value)
      .map(row => ({
        _id: row.id,
        _rev: row.value.rev,
        _deleted: true
      }))

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
  const result = await db.allDocs({
    include_docs: true,
    startkey: TASK_DOC_PREFIX,
    endkey: `${TASK_DOC_PREFIX}\ufff0`
  })

  let deletedCount = 0
  const docsToDelete: DeletedDocument[] = []

  for (const row of result.rows) {
    const taskId = extractTaskId(row.id)
    if (taskId && !currentTaskIds.has(taskId) && row.doc) {
      docsToDelete.push({
        _id: row.id,
        _rev: row.doc._rev,
        _deleted: true
      })
      deletedCount++
    }
  }

  if (docsToDelete.length > 0) {
    await db.bulkDocs(docsToDelete)
    console.log(`🗑️ Deleted ${deletedCount} orphaned task documents`)
  }

  return deletedCount
}
