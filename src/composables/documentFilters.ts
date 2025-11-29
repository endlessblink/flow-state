/**
 * Document Filtering Utilities for CouchDB Sync
 * Prevents syncing of local documents and system metadata
 */

export interface SyncableDocument {
  _id: string
  _rev?: string
  type?: string
  [key: string]: any
}

/**
 * Determines if a document should be synced to remote CouchDB
 * @param doc - The document to check
 * @returns boolean indicating if document should be synced
 */
export const isSyncableDocument = (doc: any): boolean => {
  // Basic validation
  if (!doc || typeof doc !== 'object') {
    console.log(`🚫 Skipping invalid document:`, doc)
    return false
  }

  // Must have an _id field
  if (!doc._id || typeof doc._id !== 'string') {
    console.log(`🚫 Skipping document without _id:`, doc)
    return false
  }

  // NEVER sync local documents (these are PouchDB internal documents)
  if (doc._id.startsWith('_local/')) {
    console.log(`🚫 Skipping local document: ${doc._id}`)
    return false
  }

  // NEVER sync design documents
  if (doc._id.startsWith('_design/')) {
    console.log(`🚫 Skipping design document: ${doc._id}`)
    return false
  }

  // Only sync user data documents with specific patterns
  const syncablePatterns = [
    // Tasks with standard prefix
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

  const hasExplicitType = doc.type && typeof doc.type === 'string'
  const explicitSyncableTypes = ['task', 'project', 'canvas', 'timer_session', 'settings', 'user_preferences']

  // Check if document has syncable ID pattern
  const hasSyncablePattern = syncablePatterns.some(pattern => pattern.test(doc._id))

  // Check if document has explicit syncable type
  const hasSyncableType = hasExplicitType && explicitSyncableTypes.includes(doc.type)

  // Allow document if it has either pattern or explicit type
  const isSyncable = hasSyncablePattern || hasSyncableType

  if (!isSyncable) {
    console.log(`🚫 Skipping non-syncable document: ${doc._id} (type: ${doc.type})`)
    return false
  }

  // Additional validation for syncable documents
  if (hasExplicitType && !hasSyncablePattern) {
    console.log(`✅ Syncing document by type: ${doc._id} (type: ${doc.type})`)
  } else {
    console.log(`✅ Syncing document by pattern: ${doc._id}`)
  }

  return true
}

/**
 * Filters an array of documents to only include syncable ones
 * @param docs - Array of documents to filter
 * @returns Array of syncable documents
 */
export const filterSyncableDocuments = (docs: any[]): any[] => {
  if (!Array.isArray(docs)) {
    console.warn('filterSyncableDocuments: docs is not an array', docs)
    return []
  }

  const syncable = docs.filter(isSyncableDocument)
  const filtered = docs.length - syncable.length

  if (filtered > 0) {
    console.log(`📊 Filtered ${filtered} non-syncable documents, kept ${syncable.length} syncable documents`)
  }

  return syncable
}

/**
 * Creates a PouchDB filter function for replication
 * @param doc - PouchDB document
 * @param req - PouchDB request object
 * @returns boolean indicating if document should be replicated
 */
export const pouchDBFilterFunction = (doc: any, req: any): boolean => {
  return isSyncableDocument(doc)
}

/**
 * Validates document structure before sync
 * @param doc - Document to validate
 * @returns Object with validation result and error message
 */
export const validateDocumentForSync = (doc: any): { valid: boolean; error?: string } => {
  if (!doc) {
    return { valid: false, error: 'Document is null or undefined' }
  }

  if (typeof doc !== 'object') {
    return { valid: false, error: 'Document is not an object' }
  }

  if (!doc._id) {
    return { valid: false, error: 'Document missing _id field' }
  }

  if (typeof doc._id !== 'string') {
    return { valid: false, error: 'Document _id is not a string' }
  }

  if (doc._id.startsWith('_local/')) {
    return { valid: false, error: 'Cannot sync local documents' }
  }

  if (doc._id.startsWith('_design/')) {
    return { valid: false, error: 'Cannot sync design documents' }
  }

  return { valid: true }
}

/**
 * Extracts document type for logging and debugging
 * @param doc - Document to analyze
 * @returns String describing document type
 */
export const getDocumentTypeDescription = (doc: any): string => {
  if (!doc || !doc._id) return 'unknown'

  if (doc._id.startsWith('_local/')) return 'local'
  if (doc._id.startsWith('_design/')) return 'design'
  if (doc._id.startsWith('tasks:')) return 'task'
  if (doc._id.startsWith('projects:')) return 'project'
  if (doc._id.startsWith('canvas:')) return 'canvas'
  if (doc._id.startsWith('timer:')) return 'timer'
  if (doc._id.startsWith('settings:')) return 'settings'
  if (doc.type) return `type:${doc.type}`

  return 'other'
}

/**
 * Enhanced logging for sync operations
 * @param operation - Type of sync operation
 * @param docs - Documents being processed
 * @param details - Additional details about the operation
 */
export const logSyncOperation = (operation: string, docs: any[], details?: any) => {
  const docCount = docs?.length || 0
  const types = docs?.map(getDocumentTypeDescription).reduce((acc: Record<string, number>, type: string) => {
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {})

  console.log(`🔄 ${operation}: ${docCount} documents`, {
    documentTypes: types,
    details
  })
}