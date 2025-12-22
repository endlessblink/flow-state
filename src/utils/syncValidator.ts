/**
 * Sync Validation System
 * Verifies data integrity after sync operations and ensures consistency
 */

import type { ConflictInfo } from '@/types/conflicts';
import { ConflictType } from '@/types/conflicts'
import { isSyncableDocument } from '@/composables/documentFilters'

export interface ValidationResult {
  isValid: boolean
  documentId: string
  issues: ValidationIssue[]
  checksum?: string
  timestamp: Date
  documentType?: string
  severity: 'error' | 'warning' | 'info'
}

export interface ValidationIssue {
  type: ValidationIssueType
  field?: string
  expected?: unknown
  actual?: unknown
  severity: 'error' | 'warning' | 'info'
  message: string
  suggestions?: string[]
}

export enum ValidationIssueType {
  MISSING_FIELD = 'missing_field',
  INVALID_TYPE = 'invalid_type',
  CHECKSUM_MISMATCH = 'checksum_mismatch',
  CORRUPTED_DATA = 'corrupted_data',
  INVALID_STRUCTURE = 'invalid_structure',
  VERSION_MISMATCH = 'version_mismatch',
  TIMESTAMP_ISSUE = 'timestamp_issue',
  ID_FORMAT_INVALID = 'id_format_invalid',
  ENCRYPTION_ERROR = 'encryption_error',
  DECRYPTION_ERROR = 'decryption_error'
}

export interface SyncValidationResult {
  totalValidated: number
  validDocuments: number
  issues: ValidationIssue[]
  conflicts: ConflictInfo[]
  timestamp: Date
  duration: number
  stats: ValidationStats
  checksums: Map<string, string>
}

export interface ValidationStats {
  byType: Record<string, { total: number; valid: number; issues: number }>
  bySeverity: Record<'error' | 'warning' | 'info', number>
  byIssueType: Record<ValidationIssueType, number>
  averageIssuesPerDocument: number
  mostCommonIssue: ValidationIssueType | null
}

export interface ValidationOptions {
  strictMode?: boolean      // Enable stricter validation rules
  includeChecksums?: boolean // Validate checksums
  validateTimestamps?: boolean  // Validate timestamp formats
  validateIds?: boolean      // Validate ID formats
  maxIssuesPerDocument?: number  // Limit issues per document for performance
}

export class SyncValidator {
  private options: ValidationOptions
  private validationHistory: Array<SyncValidationResult> = []

  constructor(options: ValidationOptions = {}) {
    this.options = {
      strictMode: false,
      includeChecksums: true,
      validateTimestamps: true,
      validateIds: true,
      maxIssuesPerDocument: 50,
      ...options
    }

    console.log('🔍 SyncValidator initialized:', this.options)
  }

  /**
   * Validate all syncable documents in a database
   */
  async validateDatabase(db: PouchDB.Database): Promise<SyncValidationResult & { valid?: boolean; critical?: boolean; errors?: string[] }> {
    console.log(`🔍 Validating entire database: ${db.name}`)
    const errors: string[] = []
    const startTime = Date.now()
    let critical = false
    try {
      const allDocs = await db.allDocs({ include_docs: true })
      const syncableDocs = allDocs.rows
        .filter(row => isSyncableDocument(row.doc))
        .map(row => (row.doc as unknown) as Record<string, unknown>)

      for (const doc of syncableDocs) {
        const result = await this.validateDocument(doc as unknown as Record<string, unknown>)
        if (!result.isValid) {
          const docErrors = result.issues
            .filter(i => i.severity === 'error')
            .map(i => `${(doc as any)._id}: ${i.message}`)

          errors.push(...docErrors)

          if (result.issues.some(i => i.type === ValidationIssueType.CORRUPTED_DATA)) {
            critical = true
          }
        }
      }

      const duration = Date.now() - startTime
      return {
        totalValidated: syncableDocs.length,
        validDocuments: syncableDocs.length - (new Set(errors.map(e => e.split(':')[0])).size),
        issues: [] as ValidationIssue[], // Simplified for database level
        conflicts: [] as ConflictInfo[],
        timestamp: new Date(),
        duration,
        stats: {} as ValidationStats,
        checksums: new Map()
      } as unknown as SyncValidationResult
    } catch (error) {
      console.error('❌ Failed to validate database:', error)
      return {
        totalValidated: 0,
        validDocuments: 0,
        issues: [] as ValidationIssue[],
        conflicts: [] as ConflictInfo[],
        timestamp: new Date(),
        duration: 0,
        stats: {} as ValidationStats,
        checksums: new Map(),
        errors: [(error as Error).message]
      } as unknown as SyncValidationResult
    }
  }

  /**
   * Validate a single document
   */
  async validateDocument(document: Record<string, unknown>): Promise<ValidationResult> {
    const startTime = Date.now()
    const issues: ValidationIssue[] = []

    // Basic structure validation
    if (!document || typeof document !== 'object') {
      issues.push({
        type: ValidationIssueType.CORRUPTED_DATA,
        severity: 'error',
        message: 'Document is not a valid object or is null'
      })
      return this.createValidationResult((document?._id as string) || 'unknown', issues, Date.now() - startTime)
    }

    // Skip validation for non-syncable documents
    if (!isSyncableDocument(document)) {
      return this.createValidationResult(document._id as string, issues, Date.now() - startTime)
    }

    // Required field validation
    this.validateRequiredFields(document, issues)

    // Type-specific validation
    const docType = this.getDocumentType(document)
    await this.validateDocumentType(document, docType, issues)

    // Timestamp validation
    if (this.options.validateTimestamps) {
      this.validateTimestamps(document, issues)
    }

    // ID format validation
    if (this.options.validateIds) {
      this.validateIds(document, issues)
    }

    // Data integrity validation
    if (this.options.includeChecksums) {
      this.validateChecksums(document, issues)
    }

    // Structure validation
    this.validateStructure(document, issues)

    // Business logic validation
    await this.validateBusinessRules(document, docType, issues)

    // Limit issues for performance
    if (issues.length > (this.options.maxIssuesPerDocument || 100)) {
      issues.splice(this.options.maxIssuesPerDocument || 100)
      issues.push({
        type: ValidationIssueType.CORRUPTED_DATA,
        severity: 'warning',
        message: `Too many validation issues (${this.options.maxIssuesPerDocument}+ limit reached)`
      })
    }

    const duration = Date.now() - startTime
    const result = this.createValidationResult(document._id as string, issues, duration, docType)

    if (!result.isValid) {
      console.error(`❌ Validation failed for ${result.documentId}:`, issues)
    }

    return result
  }

  /**
   * Validate sync integrity between local and remote documents
   */
  async validateSync(localDocs: Record<string, unknown>[], remoteDocs: Record<string, unknown>[]): Promise<SyncValidationResult> {
    console.log(`🔍 Validating sync integrity (${localDocs.length} local, ${remoteDocs.length} remote)`)
    const startTime = Date.now()

    const results: ValidationResult[] = []
    const conflicts: ConflictInfo[] = []
    const checksums = new Map<string, string>()

    // Validate all local documents
    for (const doc of localDocs) {
      const result = await this.validateDocument(doc)
      results.push(result)

      if (this.options.includeChecksums && result.checksum) {
        checksums.set(doc._id as string, result.checksum)
      }
    }

    // Validate all remote documents
    for (const doc of remoteDocs) {
      const result = await this.validateDocument(doc)
      results.push(result)

      if (this.options.includeChecksums && result.checksum) {
        checksums.set(doc._id as string, result.checksum)
      }
    }

    // Check for synchronization consistency
    const consistencyConflicts = this.checkConsistency(localDocs, remoteDocs, checksums)
    conflicts.push(...consistencyConflicts)

    // Calculate statistics
    const stats = this.calculateValidationStats(results)

    const duration = Date.now() - startTime
    const validationResult: SyncValidationResult = {
      totalValidated: results.length,
      validDocuments: results.filter(r => r.isValid).length,
      issues: results.flatMap(r => r.issues),
      conflicts,
      timestamp: new Date(),
      duration,
      stats,
      checksums
    }

    // Store in history
    this.validationHistory.push(validationResult)
    if (this.validationHistory.length > 100) {
      this.validationHistory = this.validationHistory.slice(-100)
    }

    const totalErrors = validationResult.issues.filter(i => i.severity === 'error').length
    console.log(`✅ Sync validation complete: ${validationResult.validDocuments}/${validationResult.totalValidated} valid, ${totalErrors} errors (${duration}ms)`)

    return validationResult
  }

  /**
   * Validate required fields for all documents
   */
  private validateRequiredFields(document: Record<string, unknown>, issues: ValidationIssue[]): void {
    const requiredFields = ['_id']

    for (const field of requiredFields) {
      if (!document[field]) {
        issues.push({
          type: ValidationIssueType.MISSING_FIELD,
          field,
          severity: 'error',
          message: `Document missing required field: ${field}`,
          suggestions: ['Ensure document has proper structure', 'Check for data corruption']
        })
      }
    }

    // Document type validation
    if (!document.updatedAt && !document.timestamp) {
      issues.push({
        type: ValidationIssueType.MISSING_FIELD,
        field: 'updatedAt/timestamp',
        severity: 'warning',
        message: 'Document missing timestamp information',
        suggestions: ['Add updatedAt or timestamp field', 'Use current time if missing']
      })
    }
  }

  /**
   * Get document type for type-specific validation
   */
  private getDocumentType(document: Record<string, unknown>): string {
    const id = typeof document._id === 'string' ? document._id : ''

    if (id.startsWith('tasks:')) return 'task'
    if (id.startsWith('projects:')) return 'project'
    if (id.startsWith('canvas:')) return 'canvas'
    if (id.startsWith('timer:')) return 'timer'
    if (id.startsWith('settings:')) return 'settings'

    return 'unknown'
  }

  /**
   * Validate document type-specific rules
   */
  private async validateDocumentType(document: Record<string, unknown>, type: string, issues: ValidationIssue[]): Promise<void> {
    switch (type) {
      case 'task':
        this.validateTaskDocument(document, issues)
        break
      case 'project':
        this.validateProjectDocument(document, issues)
        break
      case 'canvas':
        this.validateCanvasDocument(document, issues)
        break
      case 'timer':
        this.validateTimerDocument(document, issues)
        break
      case 'settings':
        this.validateSettingsDocument(document, issues)
        break
    }
  }

  /**
   * Validate task document structure
   */
  private validateTaskDocument(document: Record<string, unknown>, issues: ValidationIssue[]): void {
    const data = (document.data || document) as Record<string, unknown>

    // Required task fields
    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      issues.push({
        type: ValidationIssueType.MISSING_FIELD,
        field: 'title',
        severity: 'error',
        message: 'Task missing valid title field',
        suggestions: ['Add a descriptive title', 'Ensure title is a non-empty string']
      })
    }

    // Status validation
    if (data.status) {
      const validStatuses = ['planned', 'in_progress', 'done', 'backlog', 'on_hold']
      if (!validStatuses.includes(data.status as string)) {
        issues.push({
          type: ValidationIssueType.INVALID_TYPE,
          field: 'status',
          actual: data.status,
          expected: validStatuses,
          severity: 'warning',
          message: 'Task has invalid status value',
          suggestions: ['Use one of: ' + validStatuses.join(', ')]
        })
      }
    }

    // Priority validation
    if (data.priority && data.priority !== null) {
      const validPriorities = ['low', 'medium', 'high']
      if (!validPriorities.includes(data.priority as string)) {
        issues.push({
          type: ValidationIssueType.INVALID_TYPE,
          field: 'priority',
          actual: data.priority,
          expected: validPriorities,
          severity: 'warning',
          message: 'Task has invalid priority value',
          suggestions: ['Use one of: ' + validPriorities.join(', ') + ' or null']
        })
      }
    }

    // Progress validation
    if (data.progress !== undefined) {
      const progress = Number(data.progress)
      if (isNaN(progress) || progress < 0 || progress > 100) {
        issues.push({
          type: ValidationIssueType.INVALID_TYPE,
          field: 'progress',
          actual: data.progress,
          expected: '0-100',
          severity: 'warning',
          message: 'Task progress must be between 0 and 100',
          suggestions: ['Use a number between 0 and 100']
        })
      }
    }
  }

  /**
   * Validate project document structure
   */
  private validateProjectDocument(document: Record<string, unknown>, issues: ValidationIssue[]): void {
    const data = (document.data || document) as Record<string, unknown>

    // Required project fields
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      issues.push({
        type: ValidationIssueType.MISSING_FIELD,
        field: 'name',
        severity: 'error',
        message: 'Project missing valid name field',
        suggestions: ['Add a descriptive project name', 'Ensure name is a non-empty string']
      })
    }

    // Color validation
    if (data.color && typeof data.color !== 'string') {
      issues.push({
        type: ValidationIssueType.INVALID_TYPE,
        field: 'color',
        severity: 'warning',
        message: 'Project color should be a string',
        suggestions: ['Use hex color format (#RRGGBB)']
      })
    }
  }

  /**
   * Validate canvas document structure
   */
  private validateCanvasDocument(document: Record<string, unknown>, issues: ValidationIssue[]): void {
    const data = (document.data || document) as Record<string, unknown>

    // Canvas-specific validations
    if (data.nodes && !Array.isArray(data.nodes)) {
      issues.push({
        type: ValidationIssueType.INVALID_TYPE,
        field: 'nodes',
        severity: 'error',
        message: 'Canvas nodes must be an array',
        suggestions: ['Ensure nodes is properly formatted as an array']
      })
    }

    if (data.edges && !Array.isArray(data.edges)) {
      issues.push({
        type: ValidationIssueType.INVALID_TYPE,
        field: 'edges',
        severity: 'error',
        message: 'Canvas edges must be an array',
        suggestions: ['Ensure edges is properly formatted as an array']
      })
    }
  }

  /**
   * Validate timer document structure
   */
  private validateTimerDocument(document: Record<string, unknown>, issues: ValidationIssue[]): void {
    const data = (document.data || document) as Record<string, unknown>

    // Timer-specific validations
    if (data.duration !== undefined) {
      const duration = Number(data.duration)
      if (isNaN(duration) || duration <= 0) {
        issues.push({
          type: ValidationIssueType.INVALID_TYPE,
          field: 'duration',
          severity: 'error',
          message: 'Timer duration must be a positive number',
          suggestions: ['Use a positive duration value in minutes']
        })
      }
    }
  }

  /**
   * Validate settings document structure
   */
  private validateSettingsDocument(document: Record<string, unknown>, _issues: ValidationIssue[]): void {
    // Settings documents can have flexible structure, but basic validation applies
    console.log(`🔍 Validating settings document: ${document._id}`)
  }

  /**
   * Validate timestamp fields
   */
  private validateTimestamps(document: Record<string, unknown>, issues: ValidationIssue[]): void {
    const timestampFields = ['updatedAt', 'createdAt', 'timestamp']

    for (const field of timestampFields) {
      if (document[field]) {
        const timestamp = new Date(document[field] as string | number | Date)
        if (isNaN(timestamp.getTime())) {
          issues.push({
            type: ValidationIssueType.TIMESTAMP_ISSUE,
            field,
            actual: document[field],
            severity: 'warning',
            message: `Invalid timestamp format for ${field}`,
            suggestions: ['Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)']
          })
        } else if (timestamp.getTime() > Date.now() + 60000) { // 1 minute tolerance
          issues.push({
            type: ValidationIssueType.TIMESTAMP_ISSUE,
            field,
            actual: document[field],
            severity: 'warning',
            message: `Timestamp ${field} is in the future`,
            suggestions: ['Check clock synchronization', 'Verify timestamp generation']
          })
        }
      }
    }
  }

  /**
   * Validate ID formats
   */
  private validateIds(document: Record<string, unknown>, issues: ValidationIssue[]): void {
    if (document._id && typeof document._id === 'string') {
      // Check for valid ID patterns
      if (document._id.length === 0) {
        issues.push({
          type: ValidationIssueType.ID_FORMAT_INVALID,
          field: '_id',
          severity: 'error',
          message: 'Document ID cannot be empty'
        })
      } else if (document._id.includes(' ') || document._id.includes('\n')) {
        issues.push({
          type: ValidationIssueType.ID_FORMAT_INVALID,
          field: '_id',
          severity: 'warning',
          message: 'Document ID should not contain spaces',
          suggestions: ['Use underscores or hyphens instead of spaces']
        })
      }
    }
  }

  /**
   * Validate checksums for data integrity
   */
  private validateChecksums(document: Record<string, unknown>, issues: ValidationIssue[]): void {
    if (document.checksum) {
      const calculatedChecksum = this.calculateChecksum((document.data || document) as Record<string, unknown>)

      if (document.checksum !== calculatedChecksum) {
        issues.push({
          type: ValidationIssueType.CHECKSUM_MISMATCH,
          expected: document.checksum,
          actual: calculatedChecksum,
          severity: 'error',
          message: 'Document checksum mismatch - data may be corrupted',
          suggestions: ['Data may have been corrupted during transmission', 'Consider re-syncing from source']
        })
      }
    }
  }

  /**
   * Validate document structure
   */
  private validateStructure(document: Record<string, unknown>, issues: ValidationIssue[]): void {
    // Check for circular references
    try {
      JSON.stringify(document)
    } catch {
      issues.push({
        type: ValidationIssueType.CORRUPTED_DATA,
        severity: 'error',
        message: 'Document contains circular references or invalid structure',
        suggestions: ['Remove circular references', 'Check for invalid data types']
      })
    }

    // Check for unusually large documents
    const size = JSON.stringify(document).length
    if (size > 1024 * 1024) { // 1MB
      issues.push({
        type: ValidationIssueType.CORRUPTED_DATA,
        severity: 'warning',
        message: `Document is unusually large (${Math.round(size / 1024)}KB)`,
        suggestions: ['Consider splitting large documents', 'Remove unnecessary data']
      })
    }
  }

  /**
   * Validate business rules
   */
  private async validateBusinessRules(document: Record<string, unknown>, type: string, issues: ValidationIssue[]): Promise<void> {
    // Type-specific business rule validation
    switch (type) {
      case 'task':
        this.validateTaskBusinessRules(document, issues)
        break
      case 'project':
        this.validateProjectBusinessRules(document, issues)
        break
    }
  }

  /**
   * Validate task business rules
   */
  private validateTaskBusinessRules(document: Record<string, unknown>, issues: ValidationIssue[]): void {
    const data = (document.data || document) as Record<string, unknown>

    // Business rules for tasks
    if (data.status === 'done' && data.progress !== undefined && data.progress !== 100) {
      issues.push({
        type: ValidationIssueType.INVALID_STRUCTURE,
        severity: 'warning',
        message: 'Completed task should have 100% progress',
        suggestions: ['Set progress to 100 for completed tasks', 'Or remove progress field']
      })
    }

    if (data.dueDate) {
      const dueDate = new Date(data.dueDate as string | number | Date)
      if (isNaN(dueDate.getTime())) {
        issues.push({
          type: ValidationIssueType.INVALID_TYPE,
          field: 'dueDate',
          severity: 'warning',
          message: 'Invalid due date format',
          suggestions: ['Use ISO 8601 date format']
        })
      }
    }
  }

  /**
   * Validate project business rules
   */
  private validateProjectBusinessRules(document: Record<string, unknown>, issues: ValidationIssue[]): void {
    const data = (document.data || document) as Record<string, unknown>

    // Business rules for projects
    if (data.parentId && data.parentId === document._id) {
      issues.push({
        type: ValidationIssueType.INVALID_STRUCTURE,
        severity: 'error',
        message: 'Project cannot be its own parent',
        suggestions: ['Remove parentId or set to different project']
      })
    }
  }

  /**
   * Check consistency between local and remote documents
   */
  private checkConsistency(localDocs: Record<string, unknown>[], remoteDocs: Record<string, unknown>[], checksums: Map<string, string>): ConflictInfo[] {
    const conflicts: ConflictInfo[] = []
    const localMap = new Map(localDocs.map(doc => [doc._id, doc]))
    const remoteMap = new Map(remoteDocs.map(doc => [doc._id, doc]))

    // Check for documents that exist in both but have different data
    for (const [id, localDoc] of localMap) {
      const remoteDoc = remoteMap.get(id)
      if (remoteDoc) {
        const localChecksum = checksums.get(id + '_local')
        const remoteChecksum = checksums.get(id + '_remote')

        if (localChecksum && remoteChecksum && localChecksum !== remoteChecksum) {
          conflicts.push({
            documentId: id as string,
            localVersion: {
              _id: localDoc._id as string,
              _rev: (localDoc._rev as string) || 'unknown',
              data: (localDoc.data || localDoc) as Record<string, unknown>,
              updatedAt: (localDoc.updatedAt as string) || new Date().toISOString(),
              deviceId: 'local',
              version: (localDoc.version as number) || 1
            },
            remoteVersion: {
              _id: remoteDoc._id as string,
              _rev: (remoteDoc._rev as string) || 'unknown',
              data: (remoteDoc.data || remoteDoc) as Record<string, unknown>,
              updatedAt: (remoteDoc.updatedAt as string) || new Date().toISOString(),
              deviceId: 'remote',
              version: (remoteDoc.version as number) || 1
            },
            conflictType: ConflictType.CHECKSUM_MISMATCH,
            timestamp: new Date(),
            severity: 'medium',
            autoResolvable: true
          })
        }
      }
    }

    return conflicts
  }

  /**
   * Calculate validation statistics
   */
  private calculateValidationStats(results: ValidationResult[]): ValidationStats {
    const stats: ValidationStats = {
      byType: {},
      bySeverity: { error: 0, warning: 0, info: 0 },
      byIssueType: {} as Record<ValidationIssueType, number>,
      averageIssuesPerDocument: 0,
      mostCommonIssue: null
    }

    for (const result of results) {
      // By type
      const type = result.documentType || 'unknown'
      if (!stats.byType[type]) {
        stats.byType[type] = { total: 0, valid: 0, issues: 0 }
      }
      stats.byType[type].total++
      if (result.isValid) {
        stats.byType[type].valid++
      }
      stats.byType[type].issues += result.issues.length

      // By severity
      for (const issue of result.issues) {
        stats.bySeverity[issue.severity]++

        // By issue type
        if (!stats.byIssueType[issue.type]) {
          stats.byIssueType[issue.type] = 0
        }
        stats.byIssueType[issue.type]++
      }
    }

    // Calculate averages
    const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0)
    stats.averageIssuesPerDocument = results.length > 0 ? totalIssues / results.length : 0

    // Find most common issue
    let maxCount = 0
    for (const [issueType, count] of Object.entries(stats.byIssueType)) {
      if (count > maxCount) {
        maxCount = count
        stats.mostCommonIssue = issueType as ValidationIssueType
      }
    }

    return stats
  }

  /**
   * Create validation result object
   */
  private createValidationResult(
    documentId: string,
    issues: ValidationIssue[],
    duration: number,
    documentType?: string
  ): ValidationResult {
    const hasErrors = issues.some(i => i.severity === 'error')
    const severity = hasErrors ? 'error' :
      issues.some(i => i.severity === 'warning') ? 'warning' : 'info'

    return {
      isValid: !hasErrors,
      documentId,
      issues,
      timestamp: new Date(),
      documentType,
      severity
    }
  }

  /**
   * Calculate checksum for document data
   */
  private calculateChecksum(data: Record<string, unknown>): string {
    try {
      const sortedData = JSON.stringify(data, Object.keys(data || {}).sort())
      return btoa(sortedData).slice(0, 16)
    } catch (error) {
      console.warn('⚠️ Error calculating checksum:', error)
      return Date.now().toString(36)
    }
  }

  /**
   * Get validation history
   */
  getValidationHistory(limit: number = 10): SyncValidationResult[] {
    return this.validationHistory.slice(-limit)
  }

  /**
   * Get current validation options
   */
  getOptions(): ValidationOptions {
    return { ...this.options }
  }

  /**
   * Update validation options
   */
  updateOptions(newOptions: Partial<ValidationOptions>): void {
    this.options = { ...this.options, ...newOptions }
    console.log('⚙️ Validation options updated:', this.options)
  }

  /**
   * Clear validation history
   */
  clearHistory(): void {
    this.validationHistory = []
    console.log('🧹 Validation history cleared')
  }
}