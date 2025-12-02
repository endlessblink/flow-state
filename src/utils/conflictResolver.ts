/**
 * Conflict Resolution System for Cross-Browser Synchronization
 *
 * Phase 1: Implements intelligent conflict resolution with:
 * - Last-write-wins strategy with timestamp comparison
 * - Operation logging for audit trails
 * - Field-level conflict detection and resolution
 * - User-configurable resolution strategies
 * - Integration with circuit breaker health monitoring
 */

export interface ConflictRecord {
  id: string
  timestamp: number
  context: string
  localDoc: any
  remoteDoc: any
  resolution: 'local' | 'remote' | 'merged'
  resolvedAt: number
  resolutionStrategy: string
  fieldsInConflict: string[]
}

export interface ConflictResolutionStrategy {
  name: string
  description: string
  resolve: (local: any, remote: any, context: string) => Promise<{
    resolved: any
    strategy: string
    fieldsInConflict: string[]
  }>
}

export interface ConflictResolverConfig {
  defaultStrategy: 'last-write-wins' | 'local-priority' | 'remote-priority' | 'field-level'
  enableAuditLog: boolean
  maxAuditLogSize: number
  autoResolveThreshold: number // Auto-resolve if conflict confidence > threshold
}

export class ConflictResolver {
  private config: ConflictResolverConfig
  private auditLog: ConflictRecord[] = []
  private strategies: Map<string, ConflictResolutionStrategy> = new Map()

  constructor(config: Partial<ConflictResolverConfig> = {}) {
    this.config = {
      defaultStrategy: 'last-write-wins',
      enableAuditLog: true,
      maxAuditLogSize: 1000,
      autoResolveThreshold: 0.8,
      ...config
    }

    this.initializeStrategies()
  }

  /**
   * Initialize built-in conflict resolution strategies
   */
  private initializeStrategies(): void {
    // Last Write Wins Strategy
    this.strategies.set('last-write-wins', {
      name: 'Last Write Wins',
      description: 'Uses the document with the most recent timestamp',
      resolve: async (local: any, remote: any, context: string) => {
        const localTime = this.extractTimestamp(local)
        const remoteTime = this.extractTimestamp(remote)

        const winner = localTime >= remoteTime ? local : remote
        const winnerName = localTime >= remoteTime ? 'local' : 'remote'

        const fieldsInConflict = this.findConflictingFields(local, remote)

        return {
          resolved: { ...winner },
          strategy: `last-write-wins (${winnerName} won)`,
          fieldsInConflict
        }
      }
    })

    // Local Priority Strategy
    this.strategies.set('local-priority', {
      name: 'Local Priority',
      description: 'Always prefers the local document',
      resolve: async (local: any, remote: any, context: string) => {
        const fieldsInConflict = this.findConflictingFields(local, remote)

        return {
          resolved: { ...local },
          strategy: 'local-priority',
          fieldsInConflict
        }
      }
    })

    // Remote Priority Strategy
    this.strategies.set('remote-priority', {
      name: 'Remote Priority',
      description: 'Always prefers the remote document',
      resolve: async (local: any, remote: any, context: string) => {
        const fieldsInConflict = this.findConflictingFields(local, remote)

        return {
          resolved: { ...remote },
          strategy: 'remote-priority',
          fieldsInConflict
        }
      }
    })

    // Field-Level Strategy
    this.strategies.set('field-level', {
      name: 'Field Level Merge',
      description: 'Merges fields individually, preferring most recent values',
      resolve: async (local: any, remote: any, context: string) => {
        const fieldsInConflict = this.findConflictingFields(local, remote)
        const merged: any = { ...local }

        for (const field of fieldsInConflict) {
          const localFieldTime = this.extractFieldTimestamp(local, field)
          const remoteFieldTime = this.extractFieldTimestamp(remote, field)

          if (remoteFieldTime > localFieldTime) {
            merged[field] = remote[field]
          }
        }

        return {
          resolved: merged,
          strategy: 'field-level-merge',
          fieldsInConflict
        }
      }
    })

    console.log(`🔧 [CONFLICT RESOLVER] Initialized with ${this.strategies.size} strategies`)
  }

  /**
   * Resolve a conflict between local and remote documents
   */
  async resolveConflict(
    local: any,
    remote: any,
    context: string,
    strategy?: string
  ): Promise<{
    resolved: any
    record: ConflictRecord
    confidence: number
  }> {
    const conflictId = this.generateConflictId(context)
    const startTime = Date.now()

    console.log(`⚔️ [CONFLICT RESOLVER] Resolving conflict: ${context} (ID: ${conflictId})`)

    try {
      // Use specified strategy or default
      const strategyName = strategy || this.config.defaultStrategy
      const resolutionStrategy = this.strategies.get(strategyName)

      if (!resolutionStrategy) {
        throw new Error(`Unknown conflict resolution strategy: ${strategyName}`)
      }

      // Execute resolution strategy
      const result = await resolutionStrategy.resolve(local, remote, context)

      // Calculate confidence in the resolution
      const confidence = this.calculateResolutionConfidence(local, remote, result)

      // Create conflict record
      const record: ConflictRecord = {
        id: conflictId,
        timestamp: startTime,
        context,
        localDoc: this.deepClone(local),
        remoteDoc: this.deepClone(remote),
        resolution: strategyName.includes('local') ? 'local' :
                   strategyName.includes('remote') ? 'remote' : 'merged',
        resolvedAt: Date.now(),
        resolutionStrategy: result.strategy,
        fieldsInConflict: result.fieldsInConflict
      }

      // Log to audit trail
      if (this.config.enableAuditLog) {
        this.addToAuditLog(record)
      }

      console.log(`✅ [CONFLICT RESOLVER] Conflict resolved: ${context} -> ${result.strategy} (${confidence.toFixed(2)} confidence)`)

      return {
        resolved: result.resolved,
        record,
        confidence
      }

    } catch (error) {
      console.error(`❌ [CONFLICT RESOLVER] Failed to resolve conflict: ${context}`, error)

      // Fallback to last-write-wins
      const fallbackTime = this.extractTimestamp(local)
      const remoteTime = this.extractTimestamp(remote)
      const fallback = fallbackTime >= remoteTime ? local : remote
      const fallbackName = fallbackTime >= remoteTime ? 'local' : 'remote'

      const record: ConflictRecord = {
        id: conflictId,
        timestamp: startTime,
        context,
        localDoc: this.deepClone(local),
        remoteDoc: this.deepClone(remote),
        resolution: fallbackName as 'local' | 'remote',
        resolvedAt: Date.now(),
        resolutionStrategy: `fallback-last-write-wins (${fallbackName} won)`,
        fieldsInConflict: this.findConflictingFields(local, remote)
      }

      return {
        resolved: fallback,
        record,
        confidence: 0.5 // Low confidence for fallback
      }
    }
  }

  /**
   * Detect if there's a conflict between two documents
   */
  detectConflict(local: any, remote: any): {
    hasConflict: boolean
    conflictType: 'none' | 'version' | 'field' | 'delete'
    conflictingFields: string[]
    confidence: number
  } {
    if (!local && !remote) {
      return { hasConflict: false, conflictType: 'none', conflictingFields: [], confidence: 1.0 }
    }

    if (!local && remote) {
      return { hasConflict: true, conflictType: 'delete', conflictingFields: [], confidence: 0.9 }
    }

    if (local && !remote) {
      return { hasConflict: true, conflictType: 'delete', conflictingFields: [], confidence: 0.9 }
    }

    // Check version conflicts
    const localVersion = this.extractVersion(local)
    const remoteVersion = this.extractVersion(remote)

    if (localVersion !== remoteVersion) {
      const conflictingFields = this.findConflictingFields(local, remote)
      return {
        hasConflict: true,
        conflictType: 'version',
        conflictingFields,
        confidence: Math.min(0.8, conflictingFields.length / 10)
      }
    }

    // Check field conflicts
    const conflictingFields = this.findConflictingFields(local, remote)
    if (conflictingFields.length > 0) {
      return {
        hasConflict: true,
        conflictType: 'field',
        conflictingFields,
        confidence: Math.min(0.7, conflictingFields.length / 15)
      }
    }

    return { hasConflict: false, conflictType: 'none', conflictingFields: [], confidence: 1.0 }
  }

  /**
   * Find fields that differ between two documents
   */
  private findConflictingFields(local: any, remote: any): string[] {
    const conflicts: string[] = []

    if (!local || !remote) return conflicts

    const localKeys = new Set(Object.keys(local))
    const remoteKeys = new Set(Object.keys(remote))

    // Check for different values in common fields
    for (const key of localKeys) {
      if (remoteKeys.has(key)) {
        const localValue = this.normalizeValue(local[key])
        const remoteValue = this.normalizeValue(remote[key])

        if (!this.deepEqual(localValue, remoteValue)) {
          conflicts.push(key)
        }
      }
    }

    // Check for fields that exist in one but not the other
    for (const key of localKeys) {
      if (!remoteKeys.has(key) && local[key] !== undefined) {
        conflicts.push(key)
      }
    }

    for (const key of remoteKeys) {
      if (!localKeys.has(key) && remote[key] !== undefined) {
        conflicts.push(key)
      }
    }

    return conflicts
  }

  /**
   * Extract timestamp from a document
   */
  private extractTimestamp(doc: any): number {
    if (!doc) return 0

    // Try various timestamp fields
    const timestampFields = ['updatedAt', 'modifiedAt', 'lastModified', 'timestamp', '_rev']

    for (const field of timestampFields) {
      if (doc[field]) {
        if (typeof doc[field] === 'string') {
          return new Date(doc[field]).getTime()
        }
        if (typeof doc[field] === 'number') {
          return doc[field]
        }
      }
    }

    // Extract from PouchDB revision
    if (doc._rev) {
      const revMatch = doc._rev.match(/^\d+/)
      if (revMatch) {
        return parseInt(revMatch[0]) * 1000 // Convert revision to approximate timestamp
      }
    }

    return 0
  }

  /**
   * Extract timestamp from a specific field
   */
  private extractFieldTimestamp(doc: any, field: string): number {
    if (!doc || !doc[field]) return 0

    // Check for field-specific timestamp
    const timestampField = `${field}UpdatedAt`
    if (doc[timestampField]) {
      return new Date(doc[timestampField]).getTime()
    }

    // Fall back to document timestamp
    return this.extractTimestamp(doc)
  }

  /**
   * Extract version from a document
   */
  private extractVersion(doc: any): number {
    if (!doc) return 0

    if (doc._rev) {
      const revMatch = doc._rev.match(/^\d+/)
      if (revMatch) {
        return parseInt(revMatch[0])
      }
    }

    if (doc.version) {
      return typeof doc.version === 'number' ? doc.version : parseInt(doc.version) || 0
    }

    return 0
  }

  /**
   * Calculate confidence in a resolution
   */
  private calculateResolutionConfidence(
    local: any,
    remote: any,
    result: { resolved: any; strategy: string; fieldsInConflict: string[] }
  ): number {
    let confidence = 0.5 // Base confidence

    // Strategy-specific confidence adjustments
    if (result.strategy.includes('last-write-wins')) {
      confidence += 0.3
    } else if (result.strategy.includes('field-level')) {
      confidence += 0.2
    }

    // Fewer conflicting fields = higher confidence
    const fieldCount = result.fieldsInConflict.length
    if (fieldCount <= 2) {
      confidence += 0.2
    } else if (fieldCount <= 5) {
      confidence += 0.1
    }

    // Timestamp difference confidence
    const localTime = this.extractTimestamp(local)
    const remoteTime = this.extractTimestamp(remote)
    const timeDiff = Math.abs(localTime - remoteTime)

    if (timeDiff > 60000) { // More than 1 minute difference
      confidence += 0.1
    }

    return Math.min(1.0, confidence)
  }

  /**
   * Normalize a value for comparison
   */
  private normalizeValue(value: any): any {
    if (value === null || value === undefined) return undefined
    if (typeof value === 'string') return value.trim()
    if (typeof value === 'object' && value instanceof Date) {
      return value.toISOString()
    }
    return value
  }

  /**
   * Deep equality check
   */
  private deepEqual(a: any, b: any): boolean {
    return JSON.stringify(this.normalizeValue(a)) === JSON.stringify(this.normalizeValue(b))
  }

  /**
   * Deep clone an object
   */
  private deepClone(obj: any): any {
    return JSON.parse(JSON.stringify(obj))
  }

  /**
   * Generate conflict ID
   */
  private generateConflictId(context: string): string {
    return `conflict-${context}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Add conflict record to audit log
   */
  private addToAuditLog(record: ConflictRecord): void {
    this.auditLog.unshift(record)

    // Keep log size under limit
    if (this.auditLog.length > this.config.maxAuditLogSize) {
      this.auditLog = this.auditLog.slice(0, this.config.maxAuditLogSize)
    }

    // Emit event for monitoring
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('conflict-resolved', {
        detail: { record }
      }))
    }
  }

  /**
   * Get conflict resolution statistics
   */
  getStatistics(): {
    totalConflicts: number
    resolutionBreakdown: Record<string, number>
    averageConfidence: number
    recentConflicts: ConflictRecord[]
    topConflictingContexts: Array<{ context: string; count: number }>
  } {
    const resolutionBreakdown: Record<string, number> = {}
    let totalConfidence = 0
    const contextCounts: Record<string, number> = {}

    for (const record of this.auditLog) {
      resolutionBreakdown[record.resolutionStrategy] = (resolutionBreakdown[record.resolutionStrategy] || 0) + 1
      contextCounts[record.context] = (contextCounts[record.context] || 0) + 1
    }

    const recentConflicts = this.auditLog.slice(0, 10)
    const topConflictingContexts = Object.entries(contextCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([context, count]) => ({ context, count }))

    return {
      totalConflicts: this.auditLog.length,
      resolutionBreakdown,
      averageConfidence: this.auditLog.length > 0 ? totalConfidence / this.auditLog.length : 0,
      recentConflicts,
      topConflictingContexts
    }
  }

  /**
   * Get full audit log
   */
  getAuditLog(limit?: number): ConflictRecord[] {
    if (limit) {
      return this.auditLog.slice(0, limit)
    }
    return [...this.auditLog]
  }

  /**
   * Clear audit log
   */
  clearAuditLog(): void {
    this.auditLog = []
    console.log(`🗑️ [CONFLICT RESOLVER] Audit log cleared`)
  }

  /**
   * Check if resolver is ready for cross-browser sync
   */
  isReadyForCrossBrowserSync(): boolean {
    const stats = this.getStatistics()

    // Ready if we have reasonable resolution success rate
    const recentResolutions = this.auditLog.slice(0, 20)
    if (recentResolutions.length === 0) return true // No conflicts yet

    const avgConfidence = recentResolutions.reduce((sum, record) => {
      // Calculate approximate confidence from resolution strategy
      let confidence = 0.5
      if (record.resolutionStrategy.includes('last-write-wins')) confidence += 0.3
      if (record.resolutionStrategy.includes('field-level')) confidence += 0.2

      return sum + confidence
    }, 0) / recentResolutions.length

    return avgConfidence >= 0.6
  }
}

/**
 * Global conflict resolver instance
 */
export const globalConflictResolver = new ConflictResolver({
  defaultStrategy: 'last-write-wins',
  enableAuditLog: true,
  maxAuditLogSize: 1000,
  autoResolveThreshold: 0.8
})

/**
 * Utility function to resolve conflicts using global resolver
 */
export const resolveConflict = async (
  local: any,
  remote: any,
  context: string,
  strategy?: string
) => {
  return globalConflictResolver.resolveConflict(local, remote, context, strategy)
}

export default ConflictResolver