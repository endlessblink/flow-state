/**
 * Three-Way Merge Algorithm for Conflict Resolution
 * Advanced merging based on Git's three-way merge approach
 */

import type { ConflictDiff, ConflictResolution } from './conflictResolution'

export interface ThreeWayMergeResult {
  mergedTask: any
  conflicts: ConflictDiff[]
  resolution: ConflictResolution
  success: boolean
  metadata: {
    autoResolved: number
    manualResolutionRequired: number
    mergeComplexity: 'simple' | 'moderate' | 'complex'
  }
}

export interface MergeStrategy {
  preferLocal: string[]
  preferRemote: string[]
  autoMerge: string[]
  requireManual: string[]
  timestampField: string
}

/**
 * Advanced Three-Way Merge Engine
 */
export class ThreeWayMergeEngine {
  private strategy: MergeStrategy
  private conflictResolver: any

  constructor(conflictResolver?: any, strategy?: MergeStrategy) {
    this.conflictResolver = conflictResolver
    this.strategy = strategy || this.getDefaultStrategy()
  }

  /**
   * Perform three-way merge
   */
  merge(localTask: any, remoteTask: any, baseTask: any): ThreeWayMergeResult {
    const conflicts: ConflictDiff[] = []
    const mergedTask: any = { ...baseTask }

    // Start with base task and apply changes
    Object.keys(baseTask).forEach(key => {
      mergedTask[key] = baseTask[key]
    })

    // Apply local changes
    this.applyChanges(localTask, baseTask, mergedTask, 'local', conflicts)

    // Apply remote changes
    this.applyChanges(remoteTask, baseTask, mergedTask, 'remote', conflicts)

    // Process unresolved conflicts
    const finalConflicts = this.processUnresolvedConflicts(conflicts)
    const autoResolved = conflicts.length - finalConflicts.length

    // Generate merged task with resolved conflicts
    const finalMergedTask = this.applyConflictResolutions(mergedTask, finalConflicts)

    return {
      mergedTask: finalMergedTask,
      conflicts: finalConflicts,
      resolution: this.generateResolution(conflicts, finalConflicts),
      success: true,
      metadata: {
        autoResolved,
        manualResolutionRequired: finalConflicts.length,
        mergeComplexity: this.calculateMergeComplexity(finalConflicts)
      }
    }
  }

  /**
   * Apply changes from one version to merged result
   */
  private applyChanges(
    sourceTask: any,
    baseTask: any,
    mergedTask: any,
    source: 'local' | 'remote',
    conflicts: ConflictDiff[]
  ): void {
    // Simple object diff and apply
    const changes = this.getChanges(sourceTask, baseTask)

    changes.forEach(change => {
      if (change.type === 'add') {
        // Field was added in source
        if (mergedTask[change.field] === undefined) {
          mergedTask[change.field] = change.value
        } else {
          // Field exists in merged (conflict)
          if (!mergedTask[change.field] || typeof mergedTask[change.field] !== 'object') {
            // Simple conflict
            conflicts.push({
              field: change.field,
              localValue: source === 'local' ? change.value : mergedTask[change.field],
              remoteValue: source === 'remote' ? change.value : mergedTask[change.field],
              baseValue: baseTask[change.field],
              conflictType: 'value',
              severity: 'medium',
              autoResolvable: this.canAutoResolveField(change.field),
              suggestedResolution: this.suggestValueResolution(change.field, change.value)
            })
          }
        }
      } else if (change.type === 'modify') {
        // Field was modified in source
        if (this.valuesEqual(mergedTask[change.field], change.oldValue)) {
          // No conflict, apply the change
          mergedTask[change.field] = change.newValue
        } else {
          // Conflict with previous change
          conflicts.push({
            field: change.field,
            localValue: source === 'local' ? change.newValue : mergedTask[change.field],
            remoteValue: source === 'remote' ? change.newValue : mergedTask[change.field],
            baseValue: change.oldValue,
            conflictType: 'value',
            severity: 'medium',
            autoResolvable: this.canAutoResolveField(change.field),
            suggestedResolution: this.suggestValueResolution(change.field, change.newValue)
          })
        }
      } else if (change.type === 'delete') {
        // Field was deleted in source
        if (mergedTask[change.field] !== undefined) {
          if (this.shouldDelete(mergedTask[change.field], change.field, baseTask[change.field])) {
          delete mergedTask[change.field]
          } else {
            // Conflict - other version kept the field
            conflicts.push({
              field: change.field,
              localValue: source === 'local' ? undefined : mergedTask[change.field],
              remoteValue: source === 'remote' ? undefined : mergedTask[change.field],
              baseValue: change.oldValue,
              conflictType: 'deletion',
              severity: 'low',
              autoResolvable: true
            })
          }
        }
      }
    })
  }

  /**
   * Get changes between two tasks
   */
  private getChanges(sourceTask: any, baseTask: any): Array<{
    type: 'add' | 'modify' | 'delete'
    field: string
    value?: any
    oldValue?: any
    newValue?: any
  }> {
    const changes = []
    const allKeys = new Set([...Object.keys(sourceTask || {}), ...Object.keys(baseTask || {})])

    for (const key of allKeys) {
      const sourceValue = sourceTask?.[key]
      const baseValue = baseTask?.[key]

      if (sourceValue === undefined && baseValue !== undefined) {
        // Field was deleted
        changes.push({
          type: 'delete',
          field: key,
          oldValue: baseValue
        })
      } else if (sourceValue !== undefined && baseValue === undefined) {
        // Field was added
        changes.push({
          type: 'add',
          field: key,
          value: sourceValue
        })
      } else if (sourceValue !== undefined && baseValue !== undefined) {
        // Field was modified
        if (!this.valuesEqual(sourceValue, baseValue)) {
          changes.push({
            type: 'modify',
            field: key,
            oldValue: baseValue,
            newValue: sourceValue
          })
        }
      }
    }

    return changes as Array<{ type: 'add' | 'modify' | 'delete'; field: string; value?: any; oldValue?: any; newValue?: any }>
  }

  /**
   * Process unresolved conflicts with resolution strategies
   */
  private processUnresolvedConflicts(conflicts: ConflictDiff[]): ConflictDiff[] {
    return conflicts.filter(conflict => {
      // Skip auto-resolvable conflicts
      if (conflict.autoResolvable) {
        return true
      }

      // Apply field-specific strategies
      if (this.strategy.preferLocal.includes(conflict.field)) {
        conflict.suggestedResolution = conflict.localValue
        return true
      }

      if (this.strategy.preferRemote.includes(conflict.field)) {
        conflict.suggestedResolution = conflict.remoteValue
        return true
      }

      // For auto-merge fields, try to merge values
      if (this.strategy.autoMerge.includes(conflict.field)) {
        const merged = this.attemptMerge(conflict.localValue, conflict.remoteValue)
        if (merged !== undefined) {
          conflict.suggestedResolution = merged
          return true
        }
      }

      // Manual resolution required
      return false
    })
  }

  /**
   * Apply resolved conflicts to merged task
   */
  private applyConflictResolutions(mergedTask: any, conflicts: ConflictDiff[]): any {
    conflicts.forEach(conflict => {
      if (conflict.suggestedResolution !== undefined) {
        mergedTask[conflict.field] = conflict.suggestedResolution
      }
    })
    return mergedTask
  }

  /**
   * Generate conflict resolution summary
   */
  private generateResolution(
    originalConflicts: ConflictDiff[],
    resolvedConflicts: ConflictDiff[]
  ): ConflictResolution {
    return {
      strategy: 'merge' as any,
      timestamp: Date.now(),
      conflicts: originalConflicts,
      resolvedConflicts,
      autoResolved: originalConflicts.length - resolvedConflicts.length,
      userInterventionRequired: resolvedConflicts.length > 0
    } as unknown as ConflictResolution
  }

  /**
   * Calculate merge complexity
   */
  private calculateMergeComplexity(conflicts: ConflictDiff[]): 'simple' | 'moderate' | 'complex' {
    const highSeverityCount = conflicts.filter(c => c.severity === 'high').length
    const mediumSeverityCount = conflicts.filter(c => c.severity === 'medium').length

    if (highSeverityCount > 0) return 'complex'
    if (mediumSeverityCount > 2) return 'moderate'
    return 'simple'
  }

  /**
   * Check if field can be auto-resolved
   */
  private canAutoResolveField(field: string): boolean {
    return this.strategy.preferLocal.includes(field) ||
           this.strategy.preferRemote.includes(field) ||
           this.strategy.autoMerge.includes(field)
  }

  /**
   * Suggest value resolution
   */
  private suggestValueResolution(field: string, value: any): any {
    // Use conflict resolver if available
    if (this.conflictResolver) {
      // Delegate to conflict resolution engine
      return value // Placeholder - would call actual resolver
    }

    // Default suggestions
    if (field === 'title' && typeof value === 'string') {
      return value.trim().substring(0, 200)
    }

    if (field === 'description' && typeof value === 'string') {
      return value.substring(0, 2000)
    }

    return value
  }

  /**
   * Attempt to merge two values
   */
  private attemptMerge(localValue: any, remoteValue: any): any {
    // String merging
    if (typeof localValue === 'string' && typeof remoteValue === 'string') {
      const localClean = localValue.trim()
      const remoteClean = remoteValue.trim()

      if (localClean === remoteClean) {
        return localClean
      }

      // Combine different strings
      const combined = localClean + ' ' + remoteClean
      return combined.length > 500 ? localClean : combined
    }

    // Array merging
    if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
      const unique = [...new Set([...localValue, ...remoteValue])]
      return unique
    }

    // Object merging (shallow)
    if (typeof localValue === 'object' && typeof remoteValue === 'object') {
      return { ...localValue, ...remoteValue }
    }

    // Number merging (average)
    if (typeof localValue === 'number' && typeof remoteValue === 'number') {
      return (localValue + remoteValue) / 2
    }

    return undefined // Cannot merge
  }

  /**
   * Check if value should be deleted
   */
  private shouldDelete(currentValue: any, field: string, _baseValue: any): boolean {
    // Don't delete essential fields
    const essentialFields = ['id', 'createdAt']
    if (essentialFields.includes(field)) {
      return false
    }

    // Delete if value is empty or matches base
    if (this.isEmpty(currentValue)) {
      return true
    }

    return false
  }

  /**
   * Check if value is empty
   */
  private isEmpty(value: any): boolean {
    if (value === null || value === undefined) return true
    if (typeof value === 'string') return value.trim() === ''
    if (Array.isArray(value)) return value.length === 0
    if (typeof value === 'object') return Object.keys(value).length === 0
    return false
  }

  /**
   * Check if two values are equal
   */
  private valuesEqual(a: any, b: any): boolean {
    if (a === b) return true
    if (a == null || b == null) return false
    if (typeof a !== typeof b) return false

    if (typeof a === 'object') {
      return JSON.stringify(a) === JSON.stringify(b)
    }

    return a === b
  }

  /**
   * Get default merge strategy
   */
  private getDefaultStrategy(): MergeStrategy {
    return {
      preferLocal: ['id', 'createdAt', 'updatedAt'],
      preferRemote: ['completedAt', 'completed'],
      autoMerge: ['tags', 'metadata'],
      requireManual: ['title'],
      timestampField: 'updatedAt'
    }
  }

  /**
   * Update merge strategy
   */
  updateStrategy(strategy: Partial<MergeStrategy>): void {
    this.strategy = { ...this.strategy, ...strategy }
  }

  /**
   * Get current merge strategy
   */
  getStrategy(): MergeStrategy {
    return { ...this.strategy }
  }
}

export default ThreeWayMergeEngine