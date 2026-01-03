/**
 * Individual Section Storage Utility
 *
 * Stores each canvas section/group as a separate PouchDB document to prevent conflicts
 * during cross-browser synchronization.
 *
 * Document ID format: section-{sectionId}
 *
 * TASK-048: This fixes the sync conflict issue where a single canvas:data document
 * caused data loss when two browsers edited different sections.
 */

import type { CanvasGroup, CanvasSection } from '@/stores/canvas'

// PouchDB document interfaces
interface SectionDocument extends PouchDB.Core.IdMeta, PouchDB.Core.GetMeta {
  type: 'section'
  data: Record<string, unknown>
}

interface LegacyCanvasDocument extends PouchDB.Core.IdMeta, PouchDB.Core.GetMeta {
  groups?: CanvasGroup[]
  sections?: CanvasSection[] // Legacy alias
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

// Document prefix for individual section storage
export const SECTION_DOC_PREFIX = 'section-'

/**
 * Get the PouchDB document ID for a section
 */
export const getSectionDocId = (sectionId: string): string => {
  return `${SECTION_DOC_PREFIX}${sectionId}`
}

/**
 * Check if a document ID is a section document
 */
export const isSectionDocId = (docId: string): boolean => {
  return docId.startsWith(SECTION_DOC_PREFIX) && !docId.includes(':')
}

/**
 * Extract section ID from document ID
 */
export const extractSectionId = (docId: string): string | null => {
  if (!isSectionDocId(docId)) return null
  return docId.substring(SECTION_DOC_PREFIX.length)
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
      console.warn('⚠️ [SECTION-STORAGE] Connection closing, getting fresh database instance...')
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
 * Save a single section as an individual document
 */
export const saveSection = async (
  db: PouchDB.Database,
  section: CanvasGroup,
  maxRetries: number = 3
): Promise<PouchDB.Core.Response> => {
  const docId = getSectionDocId(section.id)
  let retryCount = 0

  while (retryCount < maxRetries) {
    try {
      const validDb = await getDbWithRetry(db)
      const existingDoc = await validDb.get(docId).catch(() => null)

      const doc = {
        _id: docId,
        _rev: existingDoc?._rev,
        type: 'section',
        // Standardized root-level timestamp for validator and PouchDB efficiency
        updatedAt: section.updatedAt || new Date().toISOString(),
        data: {
          ...section
        }
      }

      return await validDb.put(doc)
    } catch (error) {
      retryCount++
      const pouchError = error as { status?: number; message?: string }

      if (isConnectionClosingError(error) && retryCount < maxRetries) {
        console.warn(`⚠️ [SECTION-STORAGE] Connection closing on section ${section.id} (attempt ${retryCount}/${maxRetries}), retrying...`)
        await new Promise(resolve => setTimeout(resolve, 300 * retryCount))
        db = (window as unknown as WindowWithDb).pomoFlowDb || db
        continue
      }

      if (pouchError.status === 409) {
        // console.log(`🔄 Conflict saving section ${section.id}, refetching and retrying...`)
        const freshDoc = await db.get(docId)
        const doc = {
          _id: docId,
          _rev: freshDoc._rev,
          type: 'section',
          // Standardized root-level timestamp for validator and PouchDB efficiency
          updatedAt: section.updatedAt || new Date().toISOString(),
          data: {
            ...section
          }
        }
        return await db.put(doc)
      }
      throw error
    }
  }
  throw new Error(`Failed to save section ${section.id} after ${maxRetries} attempts`)
}

/**
 * Save multiple sections as individual documents
 */
export const saveSections = async (
  db: PouchDB.Database,
  sections: CanvasGroup[],
  maxRetries: number = 3
): Promise<(PouchDB.Core.Response | PouchDB.Core.Error)[]> => {
  let retryCount = 0
  let sectionsToSave = [...sections]
  let finalResults: (PouchDB.Core.Response | PouchDB.Core.Error)[] = []

  while (retryCount < maxRetries) {
    try {
      const validDb = await getDbWithRetry(db)

      // Get latest revisions for accuracy
      const existingDocs = await validDb.allDocs({
        include_docs: false,
        keys: sectionsToSave.map(s => getSectionDocId(s.id))
      })

      const revMap = new Map<string, string>()
      existingDocs.rows.forEach(row => {
        if ('value' in row && row.value?.rev) {
          revMap.set(row.id, row.value.rev)
        }
      })

      // Prepare documents for bulk insert
      const docs = sectionsToSave.map(section => {
        const docId = getSectionDocId(section.id)
        return {
          _id: docId,
          _rev: revMap.get(docId),
          type: 'section',
          // Standardized root-level timestamp for validator and PouchDB efficiency
          updatedAt: section.updatedAt || new Date().toISOString(),
          data: {
            ...section
          }
        }
      })

      const results = await validDb.bulkDocs(docs)

      // Separate successful results from conflicts for potential retry
      const conflicts: CanvasGroup[] = []
      const currentRoundResults: (PouchDB.Core.Response | PouchDB.Core.Error)[] = []

      results.forEach((result, index) => {
        const res = result as PouchDB.Core.Response & PouchDB.Core.Error
        if (res.error) {
          if (res.status === 409 || res.name === 'conflict') {
            conflicts.push(sectionsToSave[index])
          } else {
            console.error(`❌ [SECTION-STORAGE] Failed to save section ${sectionsToSave[index].id}:`, res.message)
          }
        }
        currentRoundResults.push(result)
      })

      // Merge results (replace previous errors with new results if retried)
      if (conflicts.length > 0 && retryCount < maxRetries - 1) {
        retryCount++
        sectionsToSave = conflicts
        // console.warn(`⚠️ [SECTION-STORAGE] Retrying ${conflicts.length} conflicted documents (attempt ${retryCount}/${maxRetries})...`)
        // Small delay to allow DB/Sync to settle
        await new Promise(resolve => setTimeout(resolve, 100 * retryCount))
        continue
      }

      return results
    } catch (error) {
      retryCount++

      if (isConnectionClosingError(error) && retryCount < maxRetries) {
        console.warn(`⚠️ [SECTION-STORAGE] Connection closing on bulk save (attempt ${retryCount}/${maxRetries}), retrying...`)
        await new Promise(resolve => setTimeout(resolve, 300 * retryCount))
        db = (window as unknown as WindowWithDb).pomoFlowDb || db
        continue
      }

      throw error
    }
  }
  throw new Error(`Failed to save ${sections.length} sections after ${maxRetries} attempts`)
}

/**
 * Delete a section document
 */
export const deleteSection = async (
  db: PouchDB.Database,
  sectionId: string,
  maxRetries: number = 3
): Promise<PouchDB.Core.Response | null> => {
  const docId = getSectionDocId(sectionId)
  let retryCount = 0

  while (retryCount < maxRetries) {
    try {
      const validDb = await getDbWithRetry(db)
      const doc = await validDb.get(docId)
      return await validDb.remove(doc)
    } catch (error) {
      const pouchError = error as { status?: number }
      if (pouchError.status === 404) {
        console.log(`Section ${sectionId} not found, already deleted`)
        return null
      }

      retryCount++

      if (isConnectionClosingError(error) && retryCount < maxRetries) {
        console.warn(`⚠️ [SECTION-STORAGE] Connection closing on delete ${sectionId} (attempt ${retryCount}/${maxRetries}), retrying...`)
        await new Promise(resolve => setTimeout(resolve, 300 * retryCount))
        db = (window as unknown as WindowWithDb).pomoFlowDb || db
        continue
      }

      throw error
    }
  }
  throw new Error(`Failed to delete section ${sectionId} after ${maxRetries} attempts`)
}

/**
 * Load all sections from individual documents
 */
export const loadAllSections = async (
  db: PouchDB.Database,
  maxRetries: number = 3
): Promise<CanvasGroup[]> => {
  let retryCount = 0

  while (retryCount < maxRetries) {
    try {
      const validDb = await getDbWithRetry(db)
      const result = await validDb.allDocs({
        include_docs: true,
        startkey: SECTION_DOC_PREFIX,
        endkey: `${SECTION_DOC_PREFIX}\ufff0`
      })

      const sections: CanvasGroup[] = []

      for (const row of result.rows) {
        if (row.doc) {
          const doc = row.doc as unknown as Record<string, unknown>
          let sectionData: Record<string, unknown> | null = null

          // Handle nested format: { data: { id, name, ... } }
          if ('data' in doc && doc.data && typeof doc.data === 'object') {
            sectionData = doc.data as Record<string, unknown>
          }
          // Handle flat format: { id, name, ... } (legacy/direct format)
          else if ('id' in doc && 'name' in doc) {
            const { _id, _rev, _attachments, _conflicts, ...rest } = doc
            sectionData = rest as Record<string, unknown>
          }

          if (sectionData && sectionData.id) {
            sections.push(sectionData as unknown as CanvasGroup)
          }
        }
      }

      if (sections.length > 0) {
        // console.log(`📐 Loaded ${sections.length} sections from individual documents`)
      }
      return sections
    } catch (error) {
      retryCount++

      if (isConnectionClosingError(error) && retryCount < maxRetries) {
        console.warn(`⚠️ [SECTION-STORAGE] Connection closing on loadAllSections (attempt ${retryCount}/${maxRetries}), retrying...`)
        await new Promise(resolve => setTimeout(resolve, 300 * retryCount))
        db = (window as unknown as WindowWithDb).pomoFlowDb || db
        continue
      }

      throw error
    }
  }
  throw new Error(`Failed to load sections after ${maxRetries} attempts`)
}

/**
 * Load a single section by ID
 */
export const loadSection = async (
  db: PouchDB.Database,
  sectionId: string,
  maxRetries: number = 3
): Promise<CanvasGroup | null> => {
  const docId = getSectionDocId(sectionId)
  let retryCount = 0

  while (retryCount < maxRetries) {
    try {
      const validDb = await getDbWithRetry(db)
      const doc = await validDb.get(docId) as SectionDocument
      if (doc.data) {
        return doc.data as unknown as CanvasGroup
      }
      return null
    } catch (error) {
      const pouchError = error as { status?: number }
      if (pouchError.status === 404) {
        return null
      }

      retryCount++

      if (isConnectionClosingError(error) && retryCount < maxRetries) {
        console.warn(`⚠️ [SECTION-STORAGE] Connection closing on loadSection ${sectionId} (attempt ${retryCount}/${maxRetries}), retrying...`)
        await new Promise(resolve => setTimeout(resolve, 300 * retryCount))
        db = (window as unknown as WindowWithDb).pomoFlowDb || db
        continue
      }

      throw error
    }
  }
  throw new Error(`Failed to load section ${sectionId} after ${maxRetries} attempts`)
}

/**
 * Migrate from legacy canvas:data format to individual documents
 */
export const migrateFromLegacyFormat = async (
  db: PouchDB.Database
): Promise<{ migrated: number; deleted: boolean }> => {
  let migrated = 0
  let deleted = false

  try {
    const legacyDoc = await db.get('canvas:data') as LegacyCanvasDocument

    // Check for groups (preferred) or sections (legacy alias)
    const sectionsToMigrate = legacyDoc.groups || legacyDoc.sections

    if (legacyDoc && sectionsToMigrate && Array.isArray(sectionsToMigrate)) {
      console.log(`🔄 Migrating ${sectionsToMigrate.length} sections from legacy format...`)

      await saveSections(db, sectionsToMigrate)
      migrated = sectionsToMigrate.length

      try {
        await db.remove(legacyDoc)
        deleted = true
        console.log('✅ Legacy canvas:data document deleted')
      } catch (deleteError) {
        console.warn('⚠️ Failed to delete legacy canvas document:', deleteError)
      }

      console.log(`✅ Section migration complete: ${migrated} sections migrated`)
    }
  } catch (error) {
    const pouchError = error as { status?: number }
    if (pouchError.status === 404) {
      console.log('ℹ️ No legacy canvas:data document found, no migration needed')
    } else {
      console.error('❌ Section migration error:', error)
      throw error
    }
  }

  return { migrated, deleted }
}

/**
 * Sync deleted sections - remove documents that no longer exist in the section list
 */
export const syncDeletedSections = async (
  db: PouchDB.Database,
  currentSectionIds: Set<string>
): Promise<number> => {
  const result = await db.allDocs({
    include_docs: true,
    startkey: SECTION_DOC_PREFIX,
    endkey: `${SECTION_DOC_PREFIX}\ufff0`
  })

  let deletedCount = 0
  const docsToDelete: DeletedDocument[] = []

  for (const row of result.rows) {
    const sectionId = extractSectionId(row.id)
    if (sectionId && !currentSectionIds.has(sectionId) && row.doc) {
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
    console.log(`🗑️ Deleted ${deletedCount} orphaned section documents`)
  }

  return deletedCount
}
