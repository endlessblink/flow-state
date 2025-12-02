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
 * Save a single task as an individual document
 */
export const saveTask = async (
  db: PouchDB.Database,
  task: Task
): Promise<PouchDB.Core.Response> => {
  const docId = getTaskDocId(task.id)

  try {
    // Try to get existing document for revision
    const existingDoc = await db.get(docId).catch(() => null)

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

    return await db.put(doc)
  } catch (error: any) {
    // Handle conflict by refetching and retrying
    if (error.status === 409) {
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

/**
 * Save multiple tasks as individual documents
 */
export const saveTasks = async (
  db: PouchDB.Database,
  tasks: Task[]
): Promise<(PouchDB.Core.Response | PouchDB.Core.Error)[]> => {
  // Get all existing task documents for revisions
  const existingDocs = await db.allDocs({
    include_docs: true,
    startkey: TASK_DOC_PREFIX,
    endkey: `${TASK_DOC_PREFIX}\ufff0`
  })

  const revMap = new Map<string, string>()
  existingDocs.rows.forEach(row => {
    if (row.doc?._rev) {
      revMap.set(row.id, row.doc._rev)
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
  const results = await db.bulkDocs(docs)

  // Log any errors
  results.forEach((result: any, index) => {
    if (result.error) {
      console.error(`❌ Failed to save task ${tasks[index].id}:`, result.message)
    }
  })

  return results
}

/**
 * Delete a task document
 */
export const deleteTask = async (
  db: PouchDB.Database,
  taskId: string
): Promise<PouchDB.Core.Response | null> => {
  const docId = getTaskDocId(taskId)

  try {
    const doc = await db.get(docId)
    return await db.remove(doc)
  } catch (error: any) {
    if (error.status === 404) {
      console.log(`Task ${taskId} not found, already deleted`)
      return null
    }
    throw error
  }
}

/**
 * Load all tasks from individual documents
 */
export const loadAllTasks = async (
  db: PouchDB.Database
): Promise<Task[]> => {
  const result = await db.allDocs({
    include_docs: true,
    startkey: TASK_DOC_PREFIX,
    endkey: `${TASK_DOC_PREFIX}\ufff0`
  })

  const tasks: Task[] = []

  for (const row of result.rows) {
    if (row.doc && 'data' in row.doc) {
      const taskData = (row.doc as any).data
      if (taskData && taskData.id) {
        tasks.push({
          ...taskData,
          createdAt: new Date(taskData.createdAt),
          updatedAt: new Date(taskData.updatedAt)
        })
      }
    }
  }

  console.log(`📂 Loaded ${tasks.length} tasks from individual documents`)
  return tasks
}

/**
 * Load a single task by ID
 */
export const loadTask = async (
  db: PouchDB.Database,
  taskId: string
): Promise<Task | null> => {
  const docId = getTaskDocId(taskId)

  try {
    const doc = await db.get(docId) as any
    if (doc.data) {
      return {
        ...doc.data,
        createdAt: new Date(doc.data.createdAt),
        updatedAt: new Date(doc.data.updatedAt)
      }
    }
    return null
  } catch (error: any) {
    if (error.status === 404) {
      return null
    }
    throw error
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
    const legacyDoc = await db.get('tasks:data') as any

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
  } catch (error: any) {
    if (error.status === 404) {
      console.log('ℹ️ No legacy tasks:data document found, no migration needed')
    } else {
      console.error('❌ Migration error:', error)
      throw error
    }
  }

  return { migrated, deleted }
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
  const docsToDelete: any[] = []

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
