/**
 * Conflict Resolution System
 * Resolves detected conflicts using multiple strategies: Last Write Wins, Smart Merge, etc.
 * Consolidated with advanced rules from ConflictResolutionEngine.
 */

import type { ConflictInfo, ResolutionResult, DocumentVersion } from '@/types/conflicts';
import { ConflictType, ResolutionType } from '@/types/conflicts'

export interface UserResolutionRule {
  name: string
  field: string
  condition: 'always' | 'when-newer' | 'when-empty' | 'when-contains' | 'when-longer'
  value?: unknown
  action: 'prefer-local' | 'prefer-remote' | 'merge' | 'prefer-truthy' | 'prefer-either-true' | 'prefer-longer' | 'prefer-true' | 'prefer-false' | 'prefer-newer' | 'prefer-earlier' | 'prefer-higher' | 'union' | 'merge-deep' | 'ask' | 'prefer-non-empty'
  priority: number
}

export class ConflictResolver {
  private deviceId: string
  private resolutionHistory: ResolutionResult[] = []
  private userRules: Map<string, UserResolutionRule[]> = new Map()

  constructor(deviceId: string) {
    this.deviceId = deviceId
    this.initializeDefaultRules()
  }

  /**
   * Initialize default field-level resolution rules
   */
  private initializeDefaultRules(): void {
    // Ported from ConflictResolutionEngine
    this.userRules.set('title', [
      {
        name: 'Prefer non-empty titles',
        field: 'title',
        condition: 'when-empty',
        action: 'prefer-local',
        priority: 1
      },
      {
        name: 'Prefer longer titles',
        field: 'title',
        condition: 'always',
        action: 'prefer-longer',
        priority: 2
      }
    ])

    this.userRules.set('description', [
      {
        name: 'Merge descriptions',
        field: 'description',
        condition: 'always',
        action: 'merge',
        priority: 1
      }
    ])

    this.userRules.set('completed', [
      {
        name: 'Prefer completed status',
        field: 'completed',
        condition: 'always',
        action: 'prefer-either-true',
        priority: 1
      }
    ])
  }

  /**
   * Resolve a conflict using the most appropriate strategy
   */
  async resolveConflict(conflict: ConflictInfo, customStrategy?: ResolutionType): Promise<ResolutionResult> {
    console.log(`🔧 Resolving conflict: ${conflict.documentId} (${conflict.conflictType})`)

    const strategy = customStrategy || this.selectStrategy(conflict)
    let result: ResolutionResult

    try {
      switch (strategy) {
        case ResolutionType.LAST_WRITE_WINS:
          result = await this.resolveLastWriteWins(conflict)
          break
        case ResolutionType.PRESERVE_NON_DELETED:
          result = await this.resolvePreserveNonDeleted(conflict)
          break
        case ResolutionType.SMART_MERGE:
          result = await this.resolveSmartMerge(conflict)
          break
        case ResolutionType.LOCAL_WINS:
          result = await this.resolveLocalWins(conflict)
          break
        case ResolutionType.REMOTE_WINS:
          result = await this.resolveRemoteWins(conflict)
          break
        case ResolutionType.MANUAL:
          result = await this.createManualResolution(conflict)
          break
        default:
          throw new Error(`Unknown resolution strategy: ${strategy}`)
      }

      // Add resolution metadata
      result.metadata = {
        ...result.metadata,
        resolutionReason: `Auto-resolved using ${strategy} strategy`
      }

      // Store in history
      this.resolutionHistory.push(result)

      console.log(`✅ Conflict resolved: ${conflict.documentId} -> ${strategy} (${result.winner})`)
      return result

    } catch (error) {
      console.error(`❌ Failed to resolve conflict for ${conflict.documentId}:`, error)
      throw error
    }
  }

  /**
   * Select the best resolution strategy for a conflict
   */
  private selectStrategy(conflict: ConflictInfo): ResolutionType {
    // If conflict is marked as auto-resolvable, use appropriate strategy
    if (conflict.autoResolvable) {
      switch (conflict.conflictType) {
        case ConflictType.EDIT_DELETE:
          return ResolutionType.PRESERVE_NON_DELETED
        case ConflictType.MERGE_CANDIDATES:
          return ResolutionType.SMART_MERGE
        case ConflictType.VERSION_MISMATCH:
          return ResolutionType.LAST_WRITE_WINS
        default:
          return ResolutionType.LAST_WRITE_WINS
      }
    }

    // High severity conflicts require manual intervention
    if (conflict.severity === 'high') {
      return ResolutionType.MANUAL
    }

    // Medium severity conflicts use last write wins
    if (conflict.severity === 'medium') {
      return ResolutionType.LAST_WRITE_WINS
    }

    // Low severity conflicts can be smart merged
    return ResolutionType.SMART_MERGE
  }

  /**
   * Last Write Wins resolution strategy
   */
  private async resolveLastWriteWins(conflict: ConflictInfo): Promise<ResolutionResult> {
    // CRITICAL NULL SAFETY CHECKS - Prevent TypeError
    if (!conflict.localVersion) {
      console.warn(`⚠️ Conflict missing localVersion for ${conflict.documentId}, using remote version`)
      return await this.resolveRemoteWins(conflict)
    }

    if (!conflict.remoteVersion) {
      console.warn(`⚠️ Conflict missing remoteVersion for ${conflict.documentId}, using local version`)
      return await this.resolveLocalWins(conflict)
    }

    if (!conflict.localVersion.updatedAt) {
      console.warn(`⚠️ Conflict localVersion missing updatedAt for ${conflict.documentId}, using remote version`)
      return await this.resolveRemoteWins(conflict)
    }

    if (!conflict.remoteVersion.updatedAt) {
      console.warn(`⚠️ Conflict remoteVersion missing updatedAt for ${conflict.documentId}, using local version`)
      return await this.resolveLocalWins(conflict)
    }

    const localTime = new Date(conflict.localVersion.updatedAt).getTime()
    const remoteTime = new Date(conflict.remoteVersion.updatedAt).getTime()

    const winner = localTime > remoteTime ? conflict.localVersion : conflict.remoteVersion
    const winnerDevice: string = winner === conflict.localVersion ? 'local' : 'remote'

    console.log(`🏆 Last Write Wins: ${conflict.documentId} -> ${winnerDevice} (${winner.updatedAt})`)

    // Safe access to winner.data with null fallback
    const winnerData = (winner.data || {}) as Record<string, unknown>
    const preservedLocalFields = winnerDevice === 'local' ? Object.keys(winnerData) : []
    const preservedRemoteFields = winnerDevice === 'remote' ? Object.keys(winnerData) : []

    return {
      documentId: conflict.documentId,
      resolutionType: ResolutionType.LAST_WRITE_WINS,
      resolvedDocument: this.prepareResolvedDocument(winner, conflict),
      winner: winner.deviceId,
      timestamp: new Date(),
      conflictData: conflict,
      metadata: {
        timeDifference: Math.abs(localTime - remoteTime),
        mergedFields: [],
        preservedLocalFields,
        preservedRemoteFields
      }
    }
  }

  /**
   * Deletion-Wins resolution strategy (BUG-037 FIX)
   *
   * Changed from "preserve non-deleted" to "deletion wins" to prevent
   * deleted tasks from being resurrected by CouchDB sync.
   *
   * When a user deletes a task, that deletion should propagate everywhere.
   * The deletion intent takes priority over older non-deleted versions.
   */
  private async resolvePreserveNonDeleted(conflict: ConflictInfo): Promise<ResolutionResult> {
    // CRITICAL NULL SAFETY CHECKS - Prevent TypeError
    if (!conflict.localVersion) {
      console.warn(`⚠️ Conflict missing localVersion for ${conflict.documentId}, using remote version`)
      return await this.resolveRemoteWins(conflict)
    }

    if (!conflict.remoteVersion) {
      console.warn(`⚠️ Conflict missing remoteVersion for ${conflict.documentId}, using local version`)
      return await this.resolveLocalWins(conflict)
    }

    const localDeleted = conflict.localVersion._deleted || (conflict.localVersion.data as any)?._soft_deleted || false
    const remoteDeleted = conflict.remoteVersion._deleted || (conflict.remoteVersion.data as any)?._soft_deleted || false

    const localData = (conflict.localVersion.data || {}) as Record<string, unknown>
    const remoteData = (conflict.remoteVersion.data || {}) as Record<string, unknown>

    let winner: DocumentVersion
    let winnerDevice: string

    // BUG-037 FIX: Deletion ALWAYS wins to prevent task resurrection
    // Phase 14 Update: Support Soft Deletes
    if (localDeleted && !remoteDeleted) {
      // LOCAL DELETION WINS
      winner = { ...conflict.localVersion, data: { ...localData, _soft_deleted: true, deletedAt: new Date().toISOString() } }
      winnerDevice = 'local_deletion'
      console.log(`🗑️ BUG-037/Phase 14: Local deletion wins for ${conflict.documentId} - task marked deleted`)
    } else if (!localDeleted && remoteDeleted) {
      // REMOTE DELETION WINS
      winner = { ...conflict.remoteVersion, data: { ...remoteData, _soft_deleted: true, deletedAt: new Date().toISOString() } }
      winnerDevice = 'remote_deletion'
      console.log(`🗑️ BUG-037/Phase 14: Remote deletion wins for ${conflict.documentId} - propagating deletion`)
    } else if (!localDeleted && !remoteDeleted) {
      // Neither deleted, use last write wins
      return this.resolveLastWriteWins(conflict)
    } else {
      // Both deleted - keep deleted
      winner = { ...conflict.localVersion, data: { ...localData, _soft_deleted: true, deletedAt: new Date().toISOString() } }
      winnerDevice = 'both_deleted'
    }

    console.log(`🗑️ Edit-Delete Resolution: ${conflict.documentId} -> ${winnerDevice}`)

    // Safe access to winner.data with fallback to empty object
    const winnerData = (winner.data || {}) as Record<string, unknown>

    return {
      documentId: conflict.documentId,
      resolutionType: ResolutionType.PRESERVE_NON_DELETED,
      resolvedDocument: this.prepareResolvedDocument(winner, conflict),
      winner: winner.deviceId,
      timestamp: new Date(),
      conflictData: conflict,
      metadata: {
        winnerDevice,
        localDeleted,
        remoteDeleted,
        mergedFields: [] as string[],
        preservedLocalFields: winnerDevice === 'local' ? Object.keys(winnerData) : [],
        preservedRemoteFields: winnerDevice === 'remote' ? Object.keys(winnerData) : []
      }
    }
  }

  /**
   * Smart Merge resolution strategy
   */
  private async resolveSmartMerge(conflict: ConflictInfo): Promise<ResolutionResult> {
    console.log(`🤝 Smart Merge: ${conflict.documentId}`)

    // CRITICAL NULL SAFETY CHECKS - Prevent TypeError
    if (!conflict.localVersion) {
      console.warn(`⚠️ Conflict missing localVersion for ${conflict.documentId}, using remote version`)
      return await this.resolveRemoteWins(conflict)
    }

    if (!conflict.remoteVersion) {
      console.warn(`⚠️ Conflict missing remoteVersion for ${conflict.documentId}, using local version`)
      return await this.resolveLocalWins(conflict)
    }

    // Safe access to data with fallback to empty objects
    const localData = (conflict.localVersion.data || {}) as Record<string, unknown>
    const remoteData = (conflict.remoteVersion.data || {}) as Record<string, unknown>

    const merged = this.smartMergeData(localData, remoteData)
    const mergedFields = this.getMergedFields(localData, remoteData)

    // Create merged document with combined metadata
    const mergedVersion: DocumentVersion = {
      _id: conflict.documentId,
      _rev: conflict.localVersion._rev, // Keep local revision
      data: merged,
      updatedAt: new Date().toISOString(),
      deviceId: 'merged',
      version: Math.max(conflict.localVersion.version, conflict.remoteVersion.version) + 1,
      checksum: this.calculateChecksum(merged)
    }

    return {
      documentId: conflict.documentId,
      resolutionType: ResolutionType.SMART_MERGE,
      resolvedDocument: this.prepareResolvedDocument(mergedVersion, conflict),
      winner: 'merged',
      timestamp: new Date(),
      conflictData: conflict,
      metadata: {
        mergedFields,
        preservedLocalFields: this.getPreservedFields((conflict.localVersion.data || {}) as Record<string, unknown>, merged),
        preservedRemoteFields: this.getPreservedFields((conflict.remoteVersion.data || {}) as Record<string, unknown>, merged),
      }
    }
  }

  /**
   * Local Wins resolution strategy
   */
  private async resolveLocalWins(conflict: ConflictInfo): Promise<ResolutionResult> {
    console.log(`🏠 Local Wins: ${conflict.documentId}`)

    // CRITICAL NULL SAFETY CHECKS - Prevent TypeError
    if (!conflict.localVersion) {
      console.error(`❌ resolveLocalWins called with null localVersion for ${conflict.documentId}`)
      throw new Error('Local version cannot be null')
    }

    // Safe access to data with fallback to empty object
    const localData = (conflict.localVersion.data || {}) as Record<string, unknown>

    return {
      documentId: conflict.documentId,
      resolutionType: ResolutionType.LOCAL_WINS,
      resolvedDocument: this.prepareResolvedDocument(conflict.localVersion, conflict),
      winner: conflict.localVersion.deviceId || 'local',
      timestamp: new Date(),
      conflictData: conflict,
      metadata: {
        winnerDevice: 'local',
        mergedFields: [] as string[],
        preservedLocalFields: Object.keys(localData),
        preservedRemoteFields: [] as string[]
      }
    }
  }

  /**
   * Remote Wins resolution strategy
   */
  private async resolveRemoteWins(conflict: ConflictInfo): Promise<ResolutionResult> {
    console.log(`🌐 Remote Wins: ${conflict.documentId}`)

    // CRITICAL NULL SAFETY CHECKS - Prevent TypeError
    if (!conflict.remoteVersion) {
      console.error(`❌ resolveRemoteWins called with null remoteVersion for ${conflict.documentId}`)
      throw new Error('Remote version cannot be null')
    }

    // Safe access to data with fallback to empty object
    const remoteData = (conflict.remoteVersion.data || {}) as Record<string, unknown>

    return {
      documentId: conflict.documentId,
      resolutionType: ResolutionType.REMOTE_WINS,
      resolvedDocument: this.prepareResolvedDocument(conflict.remoteVersion, conflict),
      winner: conflict.remoteVersion.deviceId || 'remote',
      timestamp: new Date(),
      conflictData: conflict,
      metadata: {
        winnerDevice: 'remote',
        mergedFields: [] as string[],
        preservedLocalFields: [] as string[],
        preservedRemoteFields: Object.keys(remoteData)
      }
    }
  }

  /**
   * Create Manual resolution placeholder
   */
  private async createManualResolution(conflict: ConflictInfo): Promise<ResolutionResult> {
    console.log(`👤 Manual Resolution Required: ${conflict.documentId}`)

    // For now, default to last write wins but mark as requiring manual review
    const lastWriteResult = await this.resolveLastWriteWins(conflict)

    return {
      ...lastWriteResult,
      resolutionType: ResolutionType.MANUAL,
      metadata: {
        ...lastWriteResult.metadata
      }
    }
  }

  /**
   * Smart merge data from two versions
   */
  private smartMergeData(localData: Record<string, unknown>, remoteData: Record<string, unknown>): Record<string, unknown> {
    const merged = { ...localData }

    // Merge fields from remote that don't conflict
    for (const [key, remoteValue] of Object.entries(remoteData)) {
      const localValue = merged[key]

      if (localValue === undefined) {
        // Field only exists in remote
        merged[key] = remoteValue
        console.log(`🔄 Added remote field ${key}: ${remoteValue}`)
      } else if (localValue !== remoteValue) {
        // Field exists in both with different values
        if (this.canMergeField(key, localValue, remoteValue)) {
          merged[key] = this.mergeFieldValues(key, localValue, remoteValue)
          console.log(`🤝 Merged field ${key}: ${localValue} + ${remoteValue} -> ${merged[key]}`)
        } else {
          // Keep local value for conflicting non-mergeable fields
          console.log(`⚠️ Conflict in field ${key}, keeping local value: ${localValue}`)
        }
      }
    }

    return merged
  }

  /**
   * Check if a specific field can be merged
   */
  private canMergeField(key: string, localValue: unknown, remoteValue: unknown): boolean {
    // Never merge critical identifier fields unless they have specific rules
    const criticalFields = ['id', '_id']
    if (criticalFields.includes(key)) {
      return false
    }

    // Allow fields with rules
    if (this.userRules.has(key)) {
      return true
    }

    // Merge arrays by concatenation
    if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
      return true
    }

    // Merge objects by combining properties
    if (typeof localValue === 'object' && typeof remoteValue === 'object' &&
      localValue !== null && remoteValue !== null && !Array.isArray(localValue) && !Array.isArray(remoteValue)) {
      return true
    }

    // Don't merge conflicting primitive values
    return false
  }

  /**
   * Merge values for a specific field
   */
  private mergeFieldValues(key: string, localValue: unknown, remoteValue: unknown): unknown {
    // Check for advanced rules
    const rules = this.userRules.get(key)
    if (rules && rules.length > 0) {
      // Sort by priority and find first applicable rule
      const sortedRules = [...rules].sort((a, b) => a.priority - b.priority)
      for (const rule of sortedRules) {
        if (this.shouldApplyRule(rule, localValue, remoteValue)) {
          console.log(`📜 Applying rule: ${rule.name} for field ${key}`)
          return this.applyRule(rule, localValue, remoteValue)
        }
      }
    }

    // Merge arrays (concatenate and dedupe)
    if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
      const merged = [...localValue, ...remoteValue]
      return Array.from(new Set(merged)) // Remove duplicates
    }

    // Merge objects (combine properties, remote takes precedence)
    if (typeof localValue === 'object' && typeof remoteValue === 'object' &&
      localValue !== null && remoteValue !== null && !Array.isArray(localValue) && !Array.isArray(remoteValue)) {
      return { ...localValue, ...remoteValue }
    }

    // Default: return local value
    return localValue
  }

  /**
   * Check if rule should be applied
   */
  private shouldApplyRule(rule: UserResolutionRule, localValue: unknown, remoteValue: unknown): boolean {
    switch (rule.condition) {
      case 'always':
        return true
      case 'when-empty':
        return !localValue || !remoteValue
      case 'when-contains':
        if (rule.value && typeof localValue === 'string') {
          return localValue.includes(String(rule.value))
        }
        return false
      default:
        return false
    }
  }

  /**
   * Apply resolution rule
   */
  private applyRule(rule: UserResolutionRule, localValue: unknown, remoteValue: unknown): unknown {
    switch (rule.action) {
      case 'prefer-local':
        return localValue
      case 'prefer-remote':
        return remoteValue
      case 'prefer-truthy':
        return localValue || remoteValue
      case 'prefer-either-true':
        return localValue === true || remoteValue === true
      case 'prefer-longer':
        if (typeof localValue === 'string' && typeof remoteValue === 'string') {
          return localValue.length >= remoteValue.length ? localValue : remoteValue
        }
        return localValue
      case 'merge':
        if (typeof localValue === 'string' && typeof remoteValue === 'string') {
          return `${localValue}\n\n---\n\n${remoteValue}`
        }
        return localValue
      default:
        return localValue
    }
  }

  /**
   * Get list of fields that were merged
   */
  private getMergedFields(localData: Record<string, unknown>, remoteData: Record<string, unknown>): string[] {
    const merged: string[] = []

    for (const [key, remoteValue] of Object.entries(remoteData)) {
      const localValue = localData[key]

      if (localValue !== undefined && localValue !== remoteValue && this.canMergeField(key, localValue, remoteValue)) {
        merged.push(key)
      }
    }

    return merged
  }

  /**
   * Get fields preserved from a version in the final merged result
   */
  private getPreservedFields(sourceData: Record<string, unknown>, mergedData: Record<string, unknown>): string[] {
    return Object.keys(sourceData).filter(key => mergedData[key] === sourceData[key])
  }

  /**
   * Assess merge complexity for metadata
   */
  private assessMergeComplexity(conflict: ConflictInfo): 'simple' | 'moderate' | 'complex' {
    // CRITICAL NULL SAFETY CHECKS - Prevent TypeError
    if (!conflict.localVersion || !conflict.localVersion.data) {
      console.warn(`⚠️ Conflict missing localVersion.data for ${conflict.documentId}, assuming simple complexity`)
      return 'simple'
    }

    if (!conflict.remoteVersion || !conflict.remoteVersion.data) {
      console.warn(`⚠️ Conflict missing remoteVersion.data for ${conflict.documentId}, assuming simple complexity`)
      return 'simple'
    }

    const localFieldCount = Object.keys(conflict.localVersion.data as Record<string, unknown>).length
    const remoteFieldCount = Object.keys(conflict.remoteVersion.data as Record<string, unknown>).length

    if (localFieldCount + remoteFieldCount < 10) {
      return 'simple'
    } else if (localFieldCount + remoteFieldCount < 25) {
      return 'moderate'
    } else {
      return 'complex'
    }
  }

  /**
   * Prepare resolved document with conflict metadata
   */
  private prepareResolvedDocument(version: DocumentVersion, conflict: ConflictInfo): Record<string, unknown> {
    // CRITICAL NULL SAFETY CHECKS - Prevent TypeError
    if (!version) {
      console.error(`❌ prepareResolvedDocument called with null version for conflict ${conflict.documentId}`)
      throw new Error('Document version cannot be null')
    }

    if (!conflict) {
      console.error(`❌ prepareResolvedDocument called with null conflict`)
      throw new Error('Conflict cannot be null')
    }

    // Safe access to version.data with fallback to empty object
    const versionData = (version.data || {}) as Record<string, unknown>

    const doc = {
      ...versionData,
      _id: version._id || conflict.documentId,
      _rev: version._rev,
      updatedAt: version.updatedAt || new Date().toISOString(),
      version: version.version || 1,
      deviceId: version.deviceId || 'unknown'
    } as Record<string, unknown>

    // Add conflict resolution metadata
    if (version.deviceId !== 'merged') {
      doc.conflictResolvedAt = new Date().toISOString()
      doc.conflictResolutionType = conflict.conflictType || 'unknown'
      doc.conflictSeverity = conflict.severity || 'unknown'
    }

    return doc
  }

  /**
   * Calculate checksum for data
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
   * Get resolution history
   */
  getResolutionHistory(): ResolutionResult[] {
    return [...this.resolutionHistory]
  }

  /**
   * Get resolution statistics
   */
  getResolutionStats() {
    const stats = {
      total: this.resolutionHistory.length,
      byType: {} as Record<ResolutionType, number>,
      byConflictType: {} as Record<ConflictType, number>,
      averageResolutionTime: 0,
      successRate: 1.0
    }

    if (this.resolutionHistory.length === 0) {
      return stats
    }

    // Count by resolution type
    for (const resolution of this.resolutionHistory) {
      stats.byType[resolution.resolutionType] = (stats.byType[resolution.resolutionType] || 0) + 1
      stats.byConflictType[resolution.conflictData.conflictType] =
        (stats.byConflictType[resolution.conflictData.conflictType] || 0) + 1
    }

    // Calculate average resolution time (placeholder - would need timing data)
    stats.averageResolutionTime = 150 // ms placeholder

    return stats
  }

  /**
   * Clear resolution history
   */
  clearHistory(): void {
    this.resolutionHistory = []
    console.log('🧹 Conflict resolution history cleared')
  }

  /**
   * Get device ID
   */
  getDeviceId(): string {
    return this.deviceId
  }
}