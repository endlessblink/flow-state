/**
 * Document Filtering Utilities for CouchDB Sync
 * Prevents syncing of local documents and system metadata
 */

export interface SyncableDocument {
  _id: string
  _rev?: string
  type?: string
  [key: string]: unknown
}

/**
 * Determines if a document should be synced to remote CouchDB
 * @param doc - The document to check
 * @returns boolean indicating if document should be synced
 */
export const isSyncableDocument = (doc: unknown): boolean => {
  // Basic validation
  if (!doc || typeof doc !== 'object') {
    // console.log(`🚫 Skipping invalid document:`, doc)
    return false
  }

  // Type guard to ensure doc has _id property
  const docRecord = doc as Record<string, unknown>

  // Must have an _id field
  if (!docRecord._id || typeof docRecord._id !== 'string') {
    // console.log(`🚫 Skipping document without _id:`, doc)
    return false
  }

  // NEVER sync local documents (these are PouchDB internal documents)
  if (docRecord._id.startsWith('_local/')) {
    // console.log(`🚫 Skipping local document: ${docRecord._id}`)
    return false
  }

  // NEVER sync design documents
  if (docRecord._id.startsWith('_design/')) {
    // console.log(`🚫 Skipping design document: ${docRecord._id}`)
    return false
  }

  // Only sync user data documents with specific patterns
  const syncablePatterns = [
    // TASK-034: Individual task documents (task-abc123) - Phase 4
    /^task-/,
    // Tasks with standard prefix (legacy: tasks:data)
    /^tasks:/,
    // Projects with standard prefix
    /^projects:/,
    // Canvas data
    /^canvas:/,
    // Timer sessions
    /^timer:/,
    // Settings documents
    /^settings:/,
    // Documents with explicit type field
  ]

  const hasExplicitType = docRecord.type && typeof docRecord.type === 'string'
  const explicitSyncableTypes = ['task', 'project', 'canvas', 'timer_session', 'settings', 'user_preferences']

  // Check if document has syncable ID pattern (docRecord._id is verified as string above)
  const hasSyncablePattern = syncablePatterns.some(pattern => pattern.test(docRecord._id as string))

  // Check if document has explicit syncable type
  const hasSyncableType = hasExplicitType && explicitSyncableTypes.includes(docRecord.type as string)

  // Allow document if it has either pattern or explicit type
  const isSyncable = hasSyncablePattern || hasSyncableType

  if (!isSyncable) {
    // console.log(`🚫 Skipping non-syncable document: ${docRecord._id} (type: ${docRecord.type})`)
    return false
  }

  // Additional validation for syncable documents
  if (hasExplicitType && !hasSyncablePattern) {
    // console.debug(`✅ Syncing document by type: ${docRecord._id} (type: ${docRecord.type})`)
  } else {
    // console.debug(`✅ Syncing document by pattern: ${docRecord._id}`)
  }

  return true
}

/**
 * Filters an array of documents to only include syncable ones
 * @param docs - Array of documents to filter
 * @returns Array of syncable documents
 */
export const filterSyncableDocuments = (docs: unknown[]): unknown[] => {
  if (!Array.isArray(docs)) {
    console.warn('filterSyncableDocuments: docs is not an array', docs)
    return []
  }

  const syncable = docs.filter(isSyncableDocument)
  const filtered = docs.length - syncable.length

  if (filtered > 0) {
    // console.debug(`📊 Filtered ${filtered} non-syncable documents, kept ${syncable.length} syncable documents`)
  }

  return syncable
}

/**
 * Creates a PouchDB filter function for replication
 * @param doc - PouchDB document
 * @param req - PouchDB request object
 * @returns boolean indicating if document should be replicated
 */
export const pouchDBFilterFunction = (doc: unknown, _req: unknown): boolean => {
  return isSyncableDocument(doc)
}

/**
 * Validates document structure before sync
 * @param doc - Document to validate
 * @returns Object with validation result and error message
 */
export const validateDocumentForSync = (doc: unknown): { valid: boolean; error?: string } => {
  if (!doc) {
    return { valid: false, error: 'Document is null or undefined' }
  }

  if (typeof doc !== 'object') {
    return { valid: false, error: 'Document is not an object' }
  }

  const docRecord = doc as Record<string, unknown>

  if (!docRecord._id) {
    return { valid: false, error: 'Document missing _id field' }
  }

  if (typeof docRecord._id !== 'string') {
    return { valid: false, error: 'Document _id is not a string' }
  }

  if (docRecord._id.startsWith('_local/')) {
    return { valid: false, error: 'Cannot sync local documents' }
  }

  if (docRecord._id.startsWith('_design/')) {
    return { valid: false, error: 'Cannot sync design documents' }
  }

  return { valid: true }
}

/**
 * Extracts document type for logging and debugging
 * @param doc - Document to analyze
 * @returns String describing document type
 */
export const getDocumentTypeDescription = (doc: unknown): string => {
  if (!doc || typeof doc !== 'object') return 'unknown'

  const docRecord = doc as Record<string, unknown>

  if (!docRecord._id || typeof docRecord._id !== 'string') return 'unknown'

  if (docRecord._id.startsWith('_local/')) return 'local'
  if (docRecord._id.startsWith('_design/')) return 'design'
  if (docRecord._id.startsWith('task-')) return 'task-individual' // TASK-034: Individual task docs
  if (docRecord._id.startsWith('tasks:')) return 'task-legacy'    // Legacy tasks:data
  if (docRecord._id.startsWith('projects:')) return 'project'
  if (docRecord._id.startsWith('canvas:')) return 'canvas'
  if (docRecord._id.startsWith('timer:')) return 'timer'
  if (docRecord._id.startsWith('settings:')) return 'settings'
  if (docRecord.type) return `type:${docRecord.type}`

  return 'other'
}

/**
 * Enhanced logging for sync operations
 * @param operation - Type of sync operation
 * @param docs - Documents being processed
 * @param details - Additional details about the operation
 */
export const logSyncOperation = (operation: string, docs: unknown[], details?: unknown) => {
  const docCount = docs?.length || 0
  const types = docs?.map(getDocumentTypeDescription).reduce((acc: Record<string, number>, type: string) => {
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log(`🔄 ${operation}: ${docCount} documents`, {
    documentTypes: types,
    details
  })
}