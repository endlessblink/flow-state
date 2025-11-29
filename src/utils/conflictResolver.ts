/**
 * Conflict Resolution System
 * Resolves detected conflicts using multiple strategies: Last Write Wins, Smart Merge, etc.
 */

import { ConflictInfo, ConflictType, ResolutionResult, ResolutionType, DocumentVersion } from '@/types/conflicts'

export class ConflictResolver {
  private deviceId: string
  private resolutionHistory: ResolutionResult[] = []

  constructor(deviceId: string) {
    this.deviceId = deviceId
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
      } as any

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
    const winnerData = winner.data || {}
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
      } as any
    }
  }

  /**
   * Preserve Non-Deleted resolution strategy
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

    const localDeleted = conflict.localVersion._deleted || false
    const remoteDeleted = conflict.remoteVersion._deleted || false

    let winner: DocumentVersion
    let winnerDevice: string

    if (localDeleted && !remoteDeleted) {
      winner = conflict.remoteVersion
      winnerDevice = 'remote'
    } else if (!localDeleted && remoteDeleted) {
      winner = conflict.localVersion
      winnerDevice = 'local'
    } else if (!localDeleted && !remoteDeleted) {
      // Neither deleted, use last write wins
      return this.resolveLastWriteWins(conflict)
    } else {
      // Both deleted - keep deleted
      winner = { ...conflict.localVersion, data: {}, _deleted: true }
      winnerDevice = 'both_deleted'
    }

    console.log(`🗑️ Edit-Delete Resolution: ${conflict.documentId} -> ${winnerDevice}`)

    // Safe access to winner.data with fallback to empty object
    const winnerData = winner.data || {}

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
        mergedFields: [],
        preservedLocalFields: winnerDevice === 'local' ? Object.keys(winnerData) : [],
        preservedRemoteFields: winnerDevice === 'remote' ? Object.keys(winnerData) : []
      } as any
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
    const localData = conflict.localVersion.data || {}
    const remoteData = conflict.remoteVersion.data || {}

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
        preservedLocalFields: this.getPreservedFields(conflict.localVersion.data, merged),
        preservedRemoteFields: this.getPreservedFields(conflict.remoteVersion.data, merged),
        // mergeComplexity: this.assessMergeComplexity(conflict)
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
    const localData = conflict.localVersion.data || {}

    return {
      documentId: conflict.documentId,
      resolutionType: ResolutionType.LOCAL_WINS,
      resolvedDocument: this.prepareResolvedDocument(conflict.localVersion, conflict),
      winner: conflict.localVersion.deviceId || 'local',
      timestamp: new Date(),
      conflictData: conflict,
      metadata: {
        winnerDevice: 'local' as any,
        mergedFields: [],
        preservedLocalFields: Object.keys(localData),
        preservedRemoteFields: []
      } as any
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
    const remoteData = conflict.remoteVersion.data || {}

    return {
      documentId: conflict.documentId,
      resolutionType: ResolutionType.REMOTE_WINS,
      resolvedDocument: this.prepareResolvedDocument(conflict.remoteVersion, conflict),
      winner: conflict.remoteVersion.deviceId || 'remote',
      timestamp: new Date(),
      conflictData: conflict,
      metadata: {
        winnerDevice: 'remote' as any,
        mergedFields: [],
        preservedLocalFields: [],
        preservedRemoteFields: Object.keys(remoteData)
      } as any
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
        ...lastWriteResult.metadata,
        // requiresManualReview: true,
        // autoResolvedWithFallback: true
      } as any
    }
  }

  /**
   * Smart merge data from two versions
   */
  private smartMergeData(localData: any, remoteData: any): any {
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
  private canMergeField(key: string, localValue: any, remoteValue: any): boolean {
    // Never merge critical identifier fields
    const criticalFields = ['id', 'title', 'name', '_id']
    if (criticalFields.includes(key)) {
      return false
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
  private mergeFieldValues(key: string, localValue: any, remoteValue: any): any {
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

    // Default: return remote value
    return remoteValue
  }

  /**
   * Get list of fields that were merged
   */
  private getMergedFields(localData: any, remoteData: any): string[] {
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
  private getPreservedFields(sourceData: any, mergedData: any): string[] {
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

    const localFieldCount = Object.keys(conflict.localVersion.data).length
    const remoteFieldCount = Object.keys(conflict.remoteVersion.data).length

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
  private prepareResolvedDocument(version: DocumentVersion, conflict: ConflictInfo): any {
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
    const versionData = version.data || {}

    const doc = {
      ...versionData,
      _id: version._id || conflict.documentId,
      _rev: version._rev,
      updatedAt: version.updatedAt || new Date().toISOString(),
      version: version.version || 1,
      deviceId: version.deviceId || 'unknown'
    }

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