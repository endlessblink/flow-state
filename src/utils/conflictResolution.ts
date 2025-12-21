/**
 * Advanced Conflict Resolution System for Pomo-Flow
 * Sophisticated handling of synchronization conflicts across devices
 */

export type ConflictResolution = 'merge' | 'ask' | 'prefer-local' | 'prefer-remote'

export interface ConflictResolutionStrategy {
  strategy: 'last-write-wins' | 'manual' | 'merge' | 'field-level'
  ui: {
    showConflictDialog: boolean
    highlightDifferences: boolean
    suggestResolution: boolean
  }
  automation: {
    similarFieldMerge: boolean
    timestampComparison: boolean
    userPriorityRules: boolean
  }
}

export interface ConflictDiff {
  field: string
  localValue: unknown
  remoteValue: unknown
  baseValue?: unknown
  conflictType: 'value' | 'structure' | 'timestamp' | 'deletion'
  severity: 'low' | 'medium' | 'high'
  suggestedResolution?: unknown
  autoResolvable: boolean
}

export interface TaskConflict {
  taskId: string
  conflicts: ConflictDiff[]
  timestamp: number
  localTask: Record<string, unknown>
  remoteTask: Record<string, unknown>
  baseTask?: Record<string, unknown>
  priority: 'low' | 'medium' | 'high'
  resolution?: ConflictResolution
  status: 'pending' | 'resolving' | 'resolved' | 'failed'
}

export interface UserResolutionRule {
  name: string
  field: string
  condition: 'always' | 'when-newer' | 'when-empty' | 'when-contains' | 'when-longer'
  value?: unknown
  action: 'prefer-local' | 'prefer-remote' | 'merge' | 'ask' | 'prefer-truthy' | 'prefer-either-true' | 'prefer-longer' | 'prefer-true' | 'prefer-false' | 'prefer-higher' | 'prefer-earlier' | 'prefer-newer' | 'prefer-non-empty' | 'union' | 'merge-deep'
  priority: number
}

/**
 * Advanced Conflict Resolution Engine
 */
export class ConflictResolutionEngine {
  private userRules: Map<string, UserResolutionRule[]> = new Map()
  private strategy: ConflictResolutionStrategy

  constructor(strategy: ConflictResolutionStrategy = {
    strategy: 'field-level',
    ui: {
      showConflictDialog: true,
      highlightDifferences: true,
      suggestResolution: true
    },
    automation: {
      similarFieldMerge: true,
      timestampComparison: true,
      userPriorityRules: true
    }
  }) {
    this.strategy = strategy
    this.initializeDefaultRules()
  }

  /**
   * Initialize default user resolution rules
   */
  private initializeDefaultRules(): void {
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
        action: 'prefer-local',
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
        action: 'prefer-local',
        priority: 1
      }
    ])
  }

  /**
   * Detect conflicts between local and remote tasks
   */
  detectConflicts(localTask: Record<string, unknown>, remoteTask: Record<string, unknown>, baseTask?: Record<string, unknown>): TaskConflict {
    const conflicts: ConflictDiff[] = []
    const allFields = this.getAllFields(localTask, remoteTask, baseTask)

    for (const field of allFields) {
      const localValue = this.getFieldValue(localTask, field)
      const remoteValue = this.getFieldValue(remoteTask, field)
      const baseValue = baseTask ? this.getFieldValue(baseTask, field) : undefined

      const conflict = this.analyzeFieldConflict(field, localValue, remoteValue, baseValue)
      if (conflict) {
        conflicts.push(conflict)
      }
    }

    return {
      taskId: (localTask.id as string) || (remoteTask.id as string),
      conflicts,
      timestamp: Date.now(),
      localTask,
      remoteTask,
      baseTask,
      priority: this.calculateConflictPriority(conflicts),
      status: 'pending'
    }
  }

  /**
   * Get all unique fields from tasks
   */
  private getAllFields(localTask: Record<string, unknown>, remoteTask: Record<string, unknown>, baseTask?: Record<string, unknown>): string[] {
    const fields = new Set<string>()

    const addFields = (task: Record<string, unknown>) => {
      if (task && typeof task === 'object') {
        Object.keys(task).forEach(key => fields.add(key))
        // Add subtask fields if present
        const subtasks = task.subtasks
        if (subtasks && Array.isArray(subtasks)) {
          subtasks.forEach((subtask: unknown, index: number) => {
            if (subtask && typeof subtask === 'object') {
              Object.keys(subtask as Record<string, unknown>).forEach(key => fields.add(`subtask.${index}.${key}`))
            }
          })
        }
      }
    }

    addFields(localTask)
    addFields(remoteTask)
    if (baseTask) addFields(baseTask)

    return Array.from(fields)
  }

  /**
   * Get field value from task, supporting nested fields
   */
  private getFieldValue(task: Record<string, unknown>, field: string): unknown {
    if (!task || typeof task !== 'object') return undefined

    const parts = field.split('.')
    let value: unknown = task

    for (const part of parts) {
      if (value && typeof value === 'object' && part in (value as Record<string, unknown>)) {
        value = (value as Record<string, unknown>)[part]
      } else {
        return undefined
      }
    }

    return value
  }

  /**
   * Analyze field for conflict
   */
  private analyzeFieldConflict(
    field: string,
    localValue: unknown,
    remoteValue: unknown,
    baseValue?: unknown
  ): ConflictDiff | null {
    // Handle deletions
    if (localValue === undefined && remoteValue !== undefined) {
      return {
        field,
        localValue,
        remoteValue,
        baseValue,
        conflictType: 'deletion',
        severity: 'medium',
        autoResolvable: this.strategy.strategy === 'last-write-wins'
      }
    }

    if (remoteValue === undefined && localValue !== undefined) {
      return {
        field,
        localValue,
        remoteValue,
        baseValue,
        conflictType: 'deletion',
        severity: 'low',
        autoResolvable: this.strategy.strategy === 'last-write-wins'
      }
    }

    // Both undefined - no conflict
    if (localValue === undefined && remoteValue === undefined) {
      return null
    }

    // Handle different types
    if (typeof localValue !== typeof remoteValue) {
      return {
        field,
        localValue,
        remoteValue,
        baseValue,
        conflictType: 'structure',
        severity: 'high',
        autoResolvable: false
      }
    }

    // Compare values
    if (!this.valuesEqual(localValue, remoteValue)) {
      return {
        field,
        localValue,
        remoteValue,
        baseValue,
        conflictType: this.determineConflictType(localValue, remoteValue, field),
        severity: this.determineConflictSeverity(field, localValue, remoteValue),
        autoResolvable: this.canAutoResolve(field, localValue, remoteValue),
        suggestedResolution: this.suggestResolution(field, localValue, remoteValue, baseValue)
      }
    }

    return null
  }

  /**
   * Determine conflict type based on values and field
   */
  private determineConflictType(localValue: unknown, remoteValue: unknown, field: string): 'value' | 'timestamp' | 'structure' | 'deletion' {
    if (field.includes('time') || field.includes('date') || field.includes('updated')) {
      return 'timestamp'
    }

    if (typeof localValue === 'object' || typeof remoteValue === 'object') {
      return 'structure'
    }

    return 'value'
  }

  /**
   * Determine conflict severity
   */
  private determineConflictSeverity(field: string, _localValue: unknown, _remoteValue: unknown): 'low' | 'medium' | 'high' {
    // High severity for critical fields
    const criticalFields = ['id', 'completed', 'dueDate', 'priority']
    if (criticalFields.includes(field)) {
      return 'high'
    }

    // Medium severity for important fields
    const importantFields = ['title', 'description', 'projectId']
    if (importantFields.includes(field)) {
      return 'medium'
    }

    // Low severity for other fields
    return 'low'
  }

  /**
   * Check if conflict can be auto-resolved
   */
  private canAutoResolve(field: string, localValue: unknown, remoteValue: unknown): boolean {
    // Always auto-resolve with last-write-wins strategy
    if (this.strategy.strategy === 'last-write-wins') {
      return true
    }

    // Auto-resolve simple conflicts
    if (this.strategy.automation.similarFieldMerge) {
      return this.isSimilarValue(localValue, remoteValue)
    }

    // Check user rules
    if (this.strategy.automation.userPriorityRules) {
      const rules = this.userRules.get(field)
      return rules?.some(rule =>
        this.shouldApplyRule(rule, localValue, remoteValue)
      ) || false
    }

    return false
  }

  /**
   * Suggest resolution for conflict
   */
  private suggestResolution(field: string, localValue: unknown, remoteValue: unknown, _baseValue?: unknown): unknown {
    // Use user-defined rules first
    if (this.strategy.automation.userPriorityRules) {
      const rules = this.userRules.get(field)
      for (const rule of rules || []) {
        if (this.shouldApplyRule(rule, localValue, remoteValue)) {
          return this.applyRule(rule, localValue, remoteValue)
        }
      }
    }

    // Use timestamp comparison if available
    if (this.strategy.automation.timestampComparison) {
      const localTime = this.extractTimestamp(localValue)
      const remoteTime = this.extractTimestamp(remoteValue)

      if (localTime && remoteTime) {
        return localTime > remoteTime ? localValue : remoteValue
      }
    }

    // Default to local value
    return localValue
  }

  /**
   * Check if two values are similar enough to merge
   */
  private isSimilarValue(localValue: unknown, remoteValue: unknown): boolean {
    // Same value or same reference
    if (localValue === remoteValue) return true

    // Similar strings (ignoring whitespace)
    if (typeof localValue === 'string' && typeof remoteValue === 'string') {
      return localValue.trim() === remoteValue.trim()
    }

    // Similar numbers within tolerance
    if (typeof localValue === 'number' && typeof remoteValue === 'number') {
      return Math.abs(localValue - remoteValue) < 0.001
    }

    return false
  }

  /**
   * Check if rule should be applied
   */
  private shouldApplyRule(rule: UserResolutionRule, localValue: unknown, remoteValue: unknown): boolean {
    switch (rule.condition) {
      case 'always':
        return true
      case 'when-newer':
        // Would need timestamp comparison logic here
        return true
      case 'when-empty':
        return !localValue || !remoteValue
      case 'when-contains':
        // Would need value checking logic here
        return true
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
        return (localValue || remoteValue)
      case 'prefer-either-true':
        return localValue === true || remoteValue === true
      case 'prefer-longer':
        if (typeof localValue === 'string' && typeof remoteValue === 'string') {
          return localValue.length > remoteValue.length ? localValue : remoteValue
        }
        return localValue
      case 'merge':
        // Simple merge for strings
        if (typeof localValue === 'string' && typeof remoteValue === 'string') {
          const combined = localValue + ' ' + remoteValue
          return combined.length > 500 ? localValue : combined // Prevent overly long merges
        }
        return localValue
      case 'ask':
        return undefined // Let user decide
      default:
        return localValue
    }
  }

  /**
   * Extract timestamp from value
   */
  private extractTimestamp(value: unknown): number | null {
    if (typeof value === 'number') {
      return value
    }
    if (typeof value === 'string') {
      const parsed = new Date(value).getTime()
      return isNaN(parsed) ? null : parsed
    }
    if (value && typeof value === 'object' && 'timestamp' in value) {
      const ts = (value as { timestamp: unknown }).timestamp
      return typeof ts === 'number' ? ts : null
    }
    return null
  }

  /**
   * Check if two values are equal (deep comparison)
   */
  private valuesEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true
    if (a == null || b == null) return false
    if (typeof a !== typeof b) return false

    if (typeof a === 'object') {
      return JSON.stringify(a) === JSON.stringify(b)
    }

    return a === b
  }

  /**
   * Calculate conflict priority
   */
  private calculateConflictPriority(conflicts: ConflictDiff[]): 'low' | 'medium' | 'high' {
    const hasHigh = conflicts.some(c => c.severity === 'high')
    if (hasHigh) return 'high'

    const hasMedium = conflicts.some(c => c.severity === 'medium')
    if (hasMedium) return 'medium'

    return 'low'
  }

  /**
   * Add custom resolution rule
   */
  addResolutionRule(field: string, rule: UserResolutionRule): void {
    if (!this.userRules.has(field)) {
      this.userRules.set(field, [])
    }
    const rules = this.userRules.get(field)
    if (rules) {
      rules.push(rule)
      // Sort by priority
      rules.sort((a, b) => a.priority - b.priority)
    }
  }

  /**
   * Get all resolution rules for a field
   */
  getResolutionRules(field: string): UserResolutionRule[] {
    return this.userRules.get(field) || []
  }

  /**
   * Update strategy
   */
  updateStrategy(strategy: Partial<ConflictResolutionStrategy>): void {
    this.strategy = { ...this.strategy, ...strategy }
  }

  /**
   * Get current strategy
   */
  getStrategy(): ConflictResolutionStrategy {
    return { ...this.strategy }
  }
}

export default ConflictResolutionEngine