/**
 * Individual Project Storage Utility
 *
 * Stores each project as a separate PouchDB document to prevent conflicts
 * during cross-browser synchronization.
 *
 * Document ID format: project-{projectId}
 *
 * TASK-048: This fixes the sync conflict issue where a single projects:data document
 * caused data loss when two browsers edited different projects.
 */

import type { Project } from '@/types/tasks'

// PouchDB document interfaces
interface ProjectDocument extends PouchDB.Core.IdMeta, PouchDB.Core.GetMeta {
  type: 'project'
  data: Record<string, unknown>
}

interface LegacyProjectsDocument extends PouchDB.Core.IdMeta, PouchDB.Core.GetMeta {
  data?: Project[]
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

// Document prefix for individual project storage
export const PROJECT_DOC_PREFIX = 'project-'

/**
 * Get the PouchDB document ID for a project
 */
export const getProjectDocId = (projectId: string): string => {
  return `${PROJECT_DOC_PREFIX}${projectId}`
}

/**
 * Check if a document ID is a project document
 */
export const isProjectDocId = (docId: string): boolean => {
  return docId.startsWith(PROJECT_DOC_PREFIX) && !docId.includes(':')
}

/**
 * Extract project ID from document ID
 */
export const extractProjectId = (docId: string): string | null => {
  if (!isProjectDocId(docId)) return null
  return docId.substring(PROJECT_DOC_PREFIX.length)
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
 */
const getDbWithRetry = async (db: PouchDB.Database): Promise<PouchDB.Database> => {
  try {
    await db.info()
    return db
  } catch (error) {
    if (isConnectionClosingError(error)) {
      console.warn('⚠️ [PROJECT-STORAGE] Connection closing, getting fresh database instance...')
      const freshDb = (window as unknown as WindowWithDb).pomoFlowDb
      if (freshDb) {
        return freshDb
      }
      await new Promise(resolve => setTimeout(resolve, 300))
      const retryDb = (window as unknown as WindowWithDb).pomoFlowDb
      if (retryDb) {
        return retryDb
      }
    }
    throw error
  }
}

/**
 * Save a single project as an individual document
 */
export const saveProject = async (
  db: PouchDB.Database,
  project: Project,
  maxRetries: number = 3
): Promise<PouchDB.Core.Response> => {
  const docId = getProjectDocId(project.id)
  let retryCount = 0

  while (retryCount < maxRetries) {
    try {
      const validDb = await getDbWithRetry(db)
      const existingDoc = await validDb.get(docId).catch(() => null)

      const doc = {
        _id: docId,
        _rev: existingDoc?._rev,
        type: 'project',
        data: {
          ...project,
          createdAt: project.createdAt instanceof Date ? project.createdAt.toISOString() : project.createdAt
        }
      }

      return await validDb.put(doc)
    } catch (error) {
      retryCount++
      const pouchError = error as { status?: number; message?: string }

      if (isConnectionClosingError(error) && retryCount < maxRetries) {
        console.warn(`⚠️ [PROJECT-STORAGE] Connection closing on project ${project.id} (attempt ${retryCount}/${maxRetries}), retrying...`)
        await new Promise(resolve => setTimeout(resolve, 300 * retryCount))
        db = (window as unknown as WindowWithDb).pomoFlowDb || db
        continue
      }

      if (pouchError.status === 409) {
        console.log(`🔄 Conflict saving project ${project.id}, refetching and retrying...`)
        const freshDoc = await db.get(docId)
        const doc = {
          _id: docId,
          _rev: freshDoc._rev,
          type: 'project',
          data: {
            ...project,
            createdAt: project.createdAt instanceof Date ? project.createdAt.toISOString() : project.createdAt
          }
        }
        return await db.put(doc)
      }
      throw error
    }
  }
  throw new Error(`Failed to save project ${project.id} after ${maxRetries} attempts`)
}

/**
 * Save multiple projects as individual documents
 */
export const saveProjects = async (
  db: PouchDB.Database,
  projects: Project[],
  maxRetries: number = 3
): Promise<(PouchDB.Core.Response | PouchDB.Core.Error)[]> => {
  let retryCount = 0

  while (retryCount < maxRetries) {
    try {
      const validDb = await getDbWithRetry(db)

      // Get all existing project documents for revisions (metadata only is faster)
      const existingDocs = await validDb.allDocs({
        include_docs: false,
        startkey: PROJECT_DOC_PREFIX,
        endkey: `${PROJECT_DOC_PREFIX}\ufff0`
      })

      const revMap = new Map<string, string>()
      existingDocs.rows.forEach(row => {
        if (row.value?.rev) {
          revMap.set(row.id, row.value.rev)
        }
      })

      // Prepare documents for bulk insert
      const docs = projects.map(project => {
        const docId = getProjectDocId(project.id)
        return {
          _id: docId,
          _rev: revMap.get(docId),
          type: 'project',
          data: {
            ...project,
            createdAt: project.createdAt instanceof Date ? project.createdAt.toISOString() : project.createdAt
          }
        }
      })

      const results = await validDb.bulkDocs(docs)

      results.forEach((result, index) => {
        const errorResult = result as PouchDB.Core.Error
        if (errorResult.error) {
          console.error(`❌ Failed to save project ${projects[index].id}:`, errorResult.message)
        }
      })

      return results
    } catch (error) {
      retryCount++

      if (isConnectionClosingError(error) && retryCount < maxRetries) {
        console.warn(`⚠️ [PROJECT-STORAGE] Connection closing on bulk save (attempt ${retryCount}/${maxRetries}), retrying...`)
        await new Promise(resolve => setTimeout(resolve, 300 * retryCount))
        db = (window as unknown as WindowWithDb).pomoFlowDb || db
        continue
      }

      throw error
    }
  }
  throw new Error(`Failed to save ${projects.length} projects after ${maxRetries} attempts`)
}

/**
 * Delete a project document
 */
export const deleteProject = async (
  db: PouchDB.Database,
  projectId: string,
  maxRetries: number = 3
): Promise<PouchDB.Core.Response | null> => {
  const docId = getProjectDocId(projectId)
  let retryCount = 0

  while (retryCount < maxRetries) {
    try {
      const validDb = await getDbWithRetry(db)
      const doc = await validDb.get(docId)
      return await validDb.remove(doc)
    } catch (error) {
      const pouchError = error as { status?: number }
      if (pouchError.status === 404) {
        console.log(`Project ${projectId} not found, already deleted`)
        return null
      }

      retryCount++

      if (isConnectionClosingError(error) && retryCount < maxRetries) {
        console.warn(`⚠️ [PROJECT-STORAGE] Connection closing on delete ${projectId} (attempt ${retryCount}/${maxRetries}), retrying...`)
        await new Promise(resolve => setTimeout(resolve, 300 * retryCount))
        db = (window as unknown as WindowWithDb).pomoFlowDb || db
        continue
      }

      throw error
    }
  }
  throw new Error(`Failed to delete project ${projectId} after ${maxRetries} attempts`)
}

/**
 * Load all projects from individual documents
 */
export const loadAllProjects = async (
  db: PouchDB.Database,
  maxRetries: number = 3
): Promise<Project[]> => {
  let retryCount = 0

  while (retryCount < maxRetries) {
    try {
      const validDb = await getDbWithRetry(db)
      const result = await validDb.allDocs({
        include_docs: true,
        startkey: PROJECT_DOC_PREFIX,
        endkey: `${PROJECT_DOC_PREFIX}\ufff0`
      })

      const projects: Project[] = []

      for (const row of result.rows) {
        if (row.doc) {
          const doc = row.doc as unknown as Record<string, unknown>
          let projectData: Record<string, unknown> | null = null

          // Handle nested format: { data: { id, name, ... } }
          if ('data' in doc && doc.data && typeof doc.data === 'object') {
            projectData = doc.data as Record<string, unknown>
          }
          // Handle flat format: { id, name, ... } (legacy/direct format)
          else if ('id' in doc && 'name' in doc) {
            const { _id, _rev, _attachments, _conflicts, ...rest } = doc
            projectData = rest as Record<string, unknown>
          }

          if (projectData && projectData.id) {
            projects.push({
              ...projectData,
              createdAt: new Date(projectData.createdAt as string || Date.now())
            } as Project)
          }
        }
      }

      if (projects.length > 0) {
        console.log(`📂 Loaded ${projects.length} projects from individual documents`)
      }
      return projects
    } catch (error) {
      retryCount++

      if (isConnectionClosingError(error) && retryCount < maxRetries) {
        console.warn(`⚠️ [PROJECT-STORAGE] Connection closing on loadAllProjects (attempt ${retryCount}/${maxRetries}), retrying...`)
        await new Promise(resolve => setTimeout(resolve, 300 * retryCount))
        db = (window as unknown as WindowWithDb).pomoFlowDb || db
        continue
      }

      throw error
    }
  }
  throw new Error(`Failed to load projects after ${maxRetries} attempts`)
}

/**
 * Load a single project by ID
 */
export const loadProject = async (
  db: PouchDB.Database,
  projectId: string,
  maxRetries: number = 3
): Promise<Project | null> => {
  const docId = getProjectDocId(projectId)
  let retryCount = 0

  while (retryCount < maxRetries) {
    try {
      const validDb = await getDbWithRetry(db)
      const doc = await validDb.get(docId) as ProjectDocument
      if (doc.data) {
        const projectData = doc.data as Record<string, unknown>
        return {
          ...projectData,
          createdAt: new Date(projectData.createdAt as string)
        } as Project
      }
      return null
    } catch (error) {
      const pouchError = error as { status?: number }
      if (pouchError.status === 404) {
        return null
      }

      retryCount++

      if (isConnectionClosingError(error) && retryCount < maxRetries) {
        console.warn(`⚠️ [PROJECT-STORAGE] Connection closing on loadProject ${projectId} (attempt ${retryCount}/${maxRetries}), retrying...`)
        await new Promise(resolve => setTimeout(resolve, 300 * retryCount))
        db = (window as unknown as WindowWithDb).pomoFlowDb || db
        continue
      }

      throw error
    }
  }
  throw new Error(`Failed to load project ${projectId} after ${maxRetries} attempts`)
}

/**
 * Migrate from legacy projects:data format to individual documents
 */
export const migrateFromLegacyFormat = async (
  db: PouchDB.Database
): Promise<{ migrated: number; deleted: boolean }> => {
  let migrated = 0
  let deleted = false

  try {
    const legacyDoc = await db.get('projects:data') as LegacyProjectsDocument

    if (legacyDoc && legacyDoc.data && Array.isArray(legacyDoc.data)) {
      const projects: Project[] = legacyDoc.data
      console.log(`🔄 Migrating ${projects.length} projects from legacy format...`)

      await saveProjects(db, projects)
      migrated = projects.length

      try {
        await db.remove(legacyDoc)
        deleted = true
        console.log('✅ Legacy projects:data document deleted')
      } catch (deleteError) {
        console.warn('⚠️ Failed to delete legacy projects document:', deleteError)
      }

      console.log(`✅ Project migration complete: ${migrated} projects migrated`)
    }
  } catch (error) {
    const pouchError = error as { status?: number }
    if (pouchError.status === 404) {
      console.log('ℹ️ No legacy projects:data document found, no migration needed')
    } else {
      console.error('❌ Project migration error:', error)
      throw error
    }
  }

  return { migrated, deleted }
}

/**
 * Sync deleted projects - remove documents that no longer exist in the project list
 */
export const syncDeletedProjects = async (
  db: PouchDB.Database,
  currentProjectIds: Set<string>
): Promise<number> => {
  const result = await db.allDocs({
    include_docs: true,
    startkey: PROJECT_DOC_PREFIX,
    endkey: `${PROJECT_DOC_PREFIX}\ufff0`
  })

  let deletedCount = 0
  const docsToDelete: DeletedDocument[] = []

  for (const row of result.rows) {
    const projectId = extractProjectId(row.id)
    if (projectId && !currentProjectIds.has(projectId) && row.doc) {
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
    console.log(`🗑️ Deleted ${deletedCount} orphaned project documents`)
  }

  return deletedCount
}
