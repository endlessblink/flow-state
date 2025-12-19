/**
 * Conflict Detection System
 * Automatically detects parallel edits and data conflicts between local and remote documents
 */

import type PouchDB from 'pouchdb-browser'
import type { ConflictInfo, DocumentVersion, ConflictDetectionOptions } from '@/types/conflicts';
import { ConflictType } from '@/types/conflicts'
import { isSyncableDocument } from '@/composables/documentFilters'

export class ConflictDetector {
  private localDB: PouchDB.Database | null = null
  private remoteDB: PouchDB.Database | null = null
  private deviceId: string
  private conflictThreshold: number

  constructor(options: ConflictDetectionOptions = {}) {
    this.deviceId = options.deviceId || this.generateDeviceId()
    this.conflictThreshold = options.conflictThreshold || 1000 // 1 second default
  }

  /**
   * Initialize the detector with database instances
   */
  async initialize(localDB: PouchDB.Database, remoteDB: PouchDB.Database | null): Promise<void> {
    this.localDB = localDB
    this.remoteDB = remoteDB

    console.log(`🔍 ConflictDetector initialized with deviceId: ${this.deviceId}`)
  }

  /**
   * Detect conflicts for all syncable documents
   */
  async detectAllConflicts(): Promise<ConflictInfo[]> {
    if (!this.localDB) {
      throw new Error('ConflictDetector not initialized')
    }

    console.log('🔍 Starting comprehensive conflict detection...')

    try {
      // Get all local documents
      const allDocs = await this.localDB.allDocs({ include_docs: true })
      const syncableDocs = allDocs.rows
        .filter(row => isSyncableDocument(row.doc))
        .map(row => row.doc)

      console.log(`📊 Analyzing ${syncableDocs.length} syncable documents for conflicts`)

      const conflicts: ConflictInfo[] = []

      for (const doc of syncableDocs) {
        try {
          const conflict = await this.detectDocumentConflict(doc)
          if (conflict) {
            conflicts.push(conflict)
          }
        } catch (detectError) {
          console.warn(`⚠️ Error detecting conflict for ${doc?._id}:`, detectError)
        }
      }

      console.log(`✅ Conflict detection complete: ${conflicts.length} conflicts found`)
      return conflicts

    } catch (error) {
      console.error('❌ Error during conflict detection:', error)
      throw error
    }
  }

  /**
   * Detect conflicts for specific document IDs
   */
  async detectConflicts(documentIds: string[]): Promise<ConflictInfo[]> {
    if (!this.localDB) {
      throw new Error('ConflictDetector not initialized')
    }

    console.log(`🔍 Detecting conflicts for ${documentIds.length} specific documents`)

    const conflicts: ConflictInfo[] = []

    for (const docId of documentIds) {
      try {
        const localDoc = await this.getLocalVersion(docId)
        const remoteDoc = this.remoteDB ? await this.getRemoteVersion(docId) : null

        if (localDoc && remoteDoc && this.hasConflict(localDoc, remoteDoc)) {
          const conflict = this.analyzeConflict(localDoc, remoteDoc)
          conflicts.push(conflict)
        }
      } catch (error) {
        console.warn(`⚠️ Error detecting conflict for ${docId}:`, error)
      }
    }

    return conflicts
  }

  /**
   * Detect conflict for a single document
   */
  async detectDocumentConflict(localDoc: unknown): Promise<ConflictInfo | null> {
    if (!this.localDB) {
      throw new Error('ConflictDetector not initialized')
    }

    if (!isSyncableDocument(localDoc)) {
      return null
    }

    // After type guard, cast to DocumentVersion for type safety
    const doc = localDoc as DocumentVersion

    try {
      const remoteDoc = this.remoteDB ? await this.getRemoteVersion(doc._id) : null

      if (remoteDoc && this.hasConflict(doc, remoteDoc)) {
        return this.analyzeConflict(doc, remoteDoc)
      }

      return null
    } catch (error) {
      console.warn(`⚠️ Error detecting conflict for ${doc._id}:`, error)
      return null
    }
  }

  /**
   * Get local version of a document
   */
  private async getLocalVersion(docId: string): Promise<DocumentVersion | null> {
    if (!this.localDB) return null

    try {
      const doc = await this.localDB.get(docId)
      return this.normalizeDocumentVersion(doc, 'local')
    } catch (versionError) {
      if ((versionError as { name?: string }).name === 'not_found') {
        return null
      }
      throw versionError
    }
  }

  /**
   * Get remote version of a document
   */
  private async getRemoteVersion(docId: string): Promise<DocumentVersion | null> {
    if (!this.remoteDB) return null

    try {
      const doc = await this.remoteDB.get(docId)
      return this.normalizeDocumentVersion(doc, 'remote')
    } catch (versionError) {
      if ((versionError as any).name === 'not_found') {
        return null
      }
      throw versionError
    }
  }

  /**
   * Normalize document to DocumentVersion format
   */
  private normalizeDocumentVersion(doc: any, source: 'local' | 'remote'): DocumentVersion {
    const data = this.extractData(doc)

    return {
      _id: doc._id,
      _rev: doc._rev,
      data,
      updatedAt: doc.updatedAt || doc.timestamp || new Date().toISOString(),
      deviceId: doc.deviceId || (source === 'local' ? this.deviceId : 'unknown'),
      version: doc.version || 1,
      checksum: this.calculateChecksum(data),
      _deleted: doc._deleted || false
    }
  }

  /**
   * Extract data payload from document
   */
  private extractData(doc: any): any {
    // Handle different document structures
    if (doc.data) {
      return doc.data
    }

    // Create data object excluding PouchDB metadata
    const { _id, _rev, _deleted, _attachments, _conflicts, _revisions, ...data } = doc
    return data
  }

  /**
   * Check if two documents have a conflict
   */
  private hasConflict(localDoc: DocumentVersion, remoteDoc: DocumentVersion): boolean {
    // Same revision = no conflict
    if (localDoc._rev === remoteDoc._rev) {
      return false
    }

    // Both deleted = no conflict
    if (localDoc._deleted && remoteDoc._deleted) {
      return false
    }

    // Check for temporal conflict (both modified around same time)
    const localTime = new Date(localDoc.updatedAt).getTime()
    const remoteTime = new Date(remoteDoc.updatedAt).getTime()
    const timeDiff = Math.abs(localTime - remoteTime)

    if (timeDiff < this.conflictThreshold && !localDoc._deleted && !remoteDoc._deleted) {
      return true
    }

    // Check for data conflict (different content)
    if (localDoc.checksum !== remoteDoc.checksum) {
      return true
    }

    // Different versions = potential conflict
    return localDoc.version !== remoteDoc.version
  }

  /**
   * Analyze and classify a conflict
   */
  private analyzeConflict(localDoc: DocumentVersion, remoteDoc: DocumentVersion): ConflictInfo {
    const conflictType = this.determineConflictType(localDoc, remoteDoc)
    const severity = this.assessSeverity(localDoc, remoteDoc, conflictType)
    const autoResolvable = this.canAutoResolve(localDoc, remoteDoc, conflictType)

    console.log(`⚔️ Conflict detected: ${localDoc._id} - ${conflictType} (${severity})`)

    return {
      documentId: localDoc._id,
      localVersion: localDoc,
      remoteVersion: remoteDoc,
      conflictType,
      timestamp: new Date(),
      severity,
      autoResolvable
    }
  }

  /**
   * Determine the type of conflict
   */
  private determineConflictType(local: DocumentVersion, remote: DocumentVersion): ConflictType {
    // Both deleted
    if (local._deleted && remote._deleted) {
      return ConflictType.EDIT_DELETE
    }

    // One deleted, one modified
    if (local._deleted || remote._deleted) {
      return ConflictType.EDIT_DELETE
    }

    // Checksum mismatch
    if (local.checksum !== remote.checksum) {
      return ConflictType.CHECKSUM_MISMATCH
    }

    // Version mismatch
    if (local.version !== remote.version) {
      return ConflictType.VERSION_MISMATCH
    }

    // Default to edit-edit conflict
    return ConflictType.EDIT_EDIT
  }

  /**
   * Assess conflict severity
   */
  private assessSeverity(
    local: DocumentVersion,
    remote: DocumentVersion,
    conflictType: ConflictType
  ): 'low' | 'medium' | 'high' {
    // High severity for critical field conflicts
    if (this.hasCriticalFieldConflict(local.data, remote.data)) {
      return 'high'
    }

    // Medium severity for status changes
    if (this.hasStatusConflict(local.data, remote.data)) {
      return 'medium'
    }

    // Medium severity for delete conflicts
    if (conflictType === ConflictType.EDIT_DELETE) {
      return 'medium'
    }

    // Low severity for minor field changes
    return 'low'
  }

  /**
   * Check if conflict involves critical fields
   */
  private hasCriticalFieldConflict(localData: any, remoteData: any): boolean {
    const criticalFields = ['title', 'name', 'id']

    return criticalFields.some(field => {
      const localValue = localData?.[field]
      const remoteValue = remoteData?.[field]
      return localValue && remoteValue && localValue !== remoteValue
    })
  }

  /**
   * Check if conflict involves status changes
   */
  private hasStatusConflict(localData: any, remoteData: any): boolean {
    const localStatus = localData?.status
    const remoteStatus = remoteData?.status

    return localStatus && remoteStatus && localStatus !== remoteStatus
  }

  /**
   * Determine if conflict can be automatically resolved
   */
  private canAutoResolve(
    local: DocumentVersion,
    remote: DocumentVersion,
    conflictType: ConflictType
  ): boolean {
    // Can't auto-resolve high severity conflicts
    const severity = this.assessSeverity(local, remote, conflictType)
    if (severity === 'high') {
      return false
    }

    // Can auto-resolve delete conflicts
    if (conflictType === ConflictType.EDIT_DELETE) {
      return true
    }

    // Can auto-resolve low severity conflicts
    if (severity === 'low') {
      return true
    }

    // Check for mergeable conflicts
    return this.areChangesMergeable(local.data, remote.data)
  }

  /**
   * Check if changes can be merged
   */
  private areChangesMergeable(localData: any, remoteData: any): boolean {
    // If data structures are compatible
    if (this.hasCompatibleStructure(localData, remoteData)) {
      return true
    }

    // If only non-overlapping fields changed
    if (this.hasNonOverlappingChanges(localData, remoteData)) {
      return true
    }

    return false
  }

  /**
   * Check if data structures are compatible
   */
  private hasCompatibleStructure(localData: any, remoteData: any): boolean {
    const localKeys = Object.keys(localData || {}).sort()
    const remoteKeys = Object.keys(remoteData || {}).sort()

    return JSON.stringify(localKeys) === JSON.stringify(remoteKeys)
  }

  /**
   * Check if changes are in non-overlapping fields
   */
  private hasNonOverlappingChanges(localData: any, remoteData: any): boolean {
    const localKeys = new Set(Object.keys(localData || {}))
    const remoteKeys = new Set(Object.keys(remoteData || {}))

    // Find keys that exist in both but have different values
    const overlappingKeys = [...localKeys].filter(key =>
      remoteKeys.has(key) && localData[key] !== remoteData[key]
    )

    // If no overlapping conflicts, can merge
    return overlappingKeys.length === 0
  }

  /**
   * Calculate checksum for data integrity
   */
  private calculateChecksum(data: any): string {
    try {
      const sortedData = JSON.stringify(data, Object.keys(data || {}).sort())
      return btoa(sortedData).slice(0, 16)
    } catch (error) {
      console.warn('⚠️ Error calculating checksum:', error)
      return Date.now().toString(36)
    }
  }

  /**
   * Generate unique device identifier
   */
  private generateDeviceId(): string {
    // Try to get consistent device identifier
    const stored = localStorage.getItem('pomoflow-device-id')
    if (stored) {
      return stored
    }

    // Generate new ID
    const newId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('pomoflow-device-id', newId)
    return newId
  }

  /**
   * Get current device ID
   */
  getDeviceId(): string {
    return this.deviceId
  }

  /**
   * Set device ID (for testing or manual override)
   */
  setDeviceId(deviceId: string): void {
    this.deviceId = deviceId
    localStorage.setItem('pomoflow-device-id', deviceId)
  }

  /**
   * Get conflict detection statistics
   */
  getStats() {
    return {
      deviceId: this.deviceId,
      conflictThreshold: this.conflictThreshold,
      hasLocalDB: !!this.localDB,
      hasRemoteDB: !!this.remoteDB
    }
  }
}