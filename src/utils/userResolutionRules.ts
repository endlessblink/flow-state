/**
 * User-Defined Resolution Rules System
 * Allows users to create custom conflict resolution strategies
 */

import type { UserResolutionRule } from './conflictResolution'

export interface RuleTemplate {
  id: string
  name: string
  description: string
  category: 'field-specific' | 'condition-based' | 'automation' | 'custom'
  template: Partial<UserResolutionRule>
  fields: string[]
  applicableTypes: string[]
}

export interface UserRuleSet {
  id: string
  name: string
  description: string
  enabled: boolean
  priority: number
  rules: UserResolutionRule[]
  createdAt: number
  updatedAt: number
}

export interface RuleExecutionResult {
  rule: UserResolutionRule
  applied: boolean
  result?: any
  reason: string
  executionTime: number
}

/**
 * Advanced User Resolution Rules Manager
 */
export class UserResolutionRulesManager {
  private ruleSets: Map<string, UserRuleSet> = new Map()
  private globalRules: UserResolutionRule[] = []
  private ruleTemplates: RuleTemplate[] = []
  private executionHistory: RuleExecutionResult[] = []

  constructor() {
    this.initializeDefaultTemplates()
    this.loadUserRules()
  }

  /**
   * Initialize default rule templates
   */
  private initializeDefaultTemplates(): void {
    this.ruleTemplates = [
      // Field-specific templates
      {
        id: 'title-prefer-longer',
        name: 'Prefer Longer Title',
        description: 'Always use the longer title when there\'s a conflict',
        category: 'field-specific',
        template: {
          name: 'Prefer longer titles',
          field: 'title',
          condition: 'always',
          action: 'prefer-longer' as any,
          priority: 1
        },
        fields: ['title'],
        applicableTypes: ['string']
      },
      {
        id: 'description-combine',
        name: 'Combine Descriptions',
        description: 'Merge both descriptions when they differ',
        category: 'field-specific',
        template: {
          name: 'Combine descriptions',
          field: 'description',
          condition: 'always',
          action: 'merge',
          priority: 1
        },
        fields: ['description'],
        applicableTypes: ['string']
      },
      {
        id: 'completed-prefer-true',
        name: 'Prefer Completed Status',
        description: 'Always mark as completed if either version is completed',
        category: 'field-specific',
        template: {
          name: 'Prefer completed status',
          field: 'completed',
          condition: 'always',
          action: 'prefer-true' as any,
          priority: 1
        },
        fields: ['completed'],
        applicableTypes: ['boolean']
      },
      {
        id: 'priority-use-max',
        name: 'Use Higher Priority',
        description: 'Always use the higher priority level',
        category: 'field-specific',
        template: {
          name: 'Use higher priority',
          field: 'priority',
          condition: 'always',
          action: 'prefer-higher' as any,
          priority: 1
        },
        fields: ['priority'],
        applicableTypes: ['string', 'number']
      },
      {
        id: 'duedate-prefer-sooner',
        name: 'Prefer Sooner Due Date',
        description: 'Use the earlier due date to stay on schedule',
        category: 'field-specific',
        template: {
          name: 'Prefer sooner due date',
          field: 'dueDate',
          condition: 'always',
          action: 'prefer-earlier' as any,
          priority: 1
        },
        fields: ['dueDate'],
        applicableTypes: ['string', 'number', 'date']
      },

      // Condition-based templates
      {
        id: 'timestamps-prefer-newer',
        name: 'Prefer Newer Timestamp',
        description: 'Always use the most recent timestamp',
        category: 'condition-based',
        template: {
          name: 'Prefer newer timestamp',
          field: 'updatedAt',
          condition: 'when-newer',
          action: 'prefer-newer' as any,
          priority: 1
        },
        fields: ['updatedAt', 'createdAt', 'modifiedAt'],
        applicableTypes: ['string', 'number', 'date']
      },
      {
        id: 'empty-prefer-non-empty',
        name: 'Prefer Non-Empty Values',
        description: 'Use the non-empty value when one is empty',
        category: 'condition-based',
        template: {
          name: 'Prefer non-empty values',
          field: '',
          condition: 'when-empty',
          action: 'prefer-non-empty' as any,
          priority: 1
        },
        fields: ['*'],
        applicableTypes: ['string', 'array', 'object']
      },
      {
        id: 'shorter-prefer-longer',
        name: 'Prefer Longer Content',
        description: 'Use the longer content (more detailed)',
        category: 'condition-based',
        template: {
          name: 'Prefer longer content',
          field: '',
          condition: 'when-longer' as any,
          action: 'prefer-longer' as any,
          priority: 1
        },
        fields: ['title', 'description', 'notes'],
        applicableTypes: ['string']
      },

      // Automation templates
      {
        id: 'tags-union',
        name: 'Union All Tags',
        description: 'Combine tags from both versions',
        category: 'automation',
        template: {
          name: 'Union all tags',
          field: 'tags',
          condition: 'always',
          action: 'union' as any,
          priority: 1
        },
        fields: ['tags', 'categories', 'labels'],
        applicableTypes: ['array']
      },
      {
        id: 'metadata-merge',
        name: 'Merge Metadata',
        description: 'Merge metadata objects with remote taking precedence',
        category: 'automation',
        template: {
          name: 'Merge metadata',
          field: 'metadata',
          condition: 'always',
          action: 'merge-deep' as any,
          priority: 1
        },
        fields: ['metadata', 'properties', 'settings'],
        applicableTypes: ['object']
      },

      // Custom templates
      {
        id: 'user-prompt',
        name: 'Ask User',
        description: 'Always prompt user to decide',
        category: 'custom',
        template: {
          name: 'Ask user to decide',
          field: '',
          condition: 'always',
          action: 'ask',
          priority: 10
        },
        fields: ['*'],
        applicableTypes: ['*']
      }
    ]
  }

  /**
   * Load user rules from storage
   */
  private async loadUserRules(): Promise<void> {
    try {
      const stored = localStorage.getItem('pomo-flow-resolution-rules')
      if (stored) {
        const data = JSON.parse(stored)
        this.globalRules = data.globalRules || []

        if (data.ruleSets) {
          data.ruleSets.forEach((ruleSet: UserRuleSet) => {
            this.ruleSets.set(ruleSet.id, ruleSet)
          })
        }
      }
    } catch (error) {
      console.warn('Failed to load user resolution rules:', error)
    }
  }

  /**
   * Save user rules to storage
   */
  private async saveUserRules(): Promise<void> {
    try {
      const data = {
        globalRules: this.globalRules,
        ruleSets: Array.from(this.ruleSets.values())
      }
      localStorage.setItem('pomo-flow-resolution-rules', JSON.stringify(data))
    } catch (error) {
      console.warn('Failed to save user resolution rules:', error)
    }
  }

  /**
   * Get all available rule templates
   */
  getRuleTemplates(): RuleTemplate[] {
    return [...this.ruleTemplates]
  }

  /**
   * Get template by ID
   */
  getRuleTemplate(id: string): RuleTemplate | undefined {
    return this.ruleTemplates.find(template => template.id === id)
  }

  /**
   * Get templates applicable to a field
   */
  getTemplatesForField(fieldName: string, fieldType: string): RuleTemplate[] {
    return this.ruleTemplates.filter(template => {
      const fieldMatch = template.fields.includes('*') ||
                        template.fields.includes(fieldName)
      const typeMatch = template.applicableTypes.includes('*') ||
                       template.applicableTypes.includes(fieldType)

      return fieldMatch && typeMatch
    })
  }

  /**
   * Create rule from template
   */
  createRuleFromTemplate(templateId: string, overrides: Partial<UserResolutionRule> = {}): UserResolutionRule | null {
    const template = this.getRuleTemplate(templateId)
    if (!template) return null

    const rule: UserResolutionRule = {
      name: template.template.name || template.name,
      field: template.template.field || overrides.field || '',
      condition: template.template.condition || 'always',
      value: template.template.value,
      action: template.template.action || 'ask',
      priority: template.template.priority || 1,
      ...overrides
    }

    // Ensure required fields
    if (!rule.field && !template.fields.includes('*')) {
      rule.field = template.fields[0] || ''
    }

    return rule
  }

  /**
   * Add custom resolution rule
   */
  addResolutionRule(rule: UserResolutionRule): void {
    this.globalRules.push(rule)
    this.globalRules.sort((a, b) => a.priority - b.priority)
    this.saveUserRules()
  }

  /**
   * Create rule set
   */
  createRuleSet(name: string, description: string = ''): UserRuleSet {
    const ruleSet: UserRuleSet = {
      id: `rule-set-${Date.now()}`,
      name,
      description,
      enabled: true,
      priority: 1,
      rules: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    this.ruleSets.set(ruleSet.id, ruleSet)
    this.saveUserRules()

    return ruleSet
  }

  /**
   * Add rule to rule set
   */
  addRuleToSet(ruleSetId: string, rule: UserResolutionRule): boolean {
    const ruleSet = this.ruleSets.get(ruleSetId)
    if (!ruleSet) return false

    ruleSet.rules.push(rule)
    ruleSet.rules.sort((a, b) => a.priority - b.priority)
    ruleSet.updatedAt = Date.now()

    this.saveUserRules()
    return true
  }

  /**
   * Get applicable rules for a conflict
   */
  getApplicableRules(fieldName: string, localValue: any, remoteValue: any): UserResolutionRule[] {
    const allRules: UserResolutionRule[] = []

    // Add global rules
    allRules.push(...this.globalRules)

    // Add rules from enabled rule sets
    this.ruleSets.forEach(ruleSet => {
      if (ruleSet.enabled) {
        allRules.push(...ruleSet.rules)
      }
    })

    // Filter applicable rules
    return allRules.filter(rule => {
      // Field match
      const fieldMatch = rule.field === '*' ||
                        rule.field === fieldName ||
                        (rule.field.includes('*') && this.matchPattern(rule.field, fieldName))

      if (!fieldMatch) return false

      // Condition match
      return this.evaluateCondition(rule, localValue, remoteValue)
    }).sort((a, b) => a.priority - b.priority)
  }

  /**
   * Apply resolution rules to a conflict
   */
  async applyResolutionRules(
    fieldName: string,
    localValue: any,
    remoteValue: any,
    baseValue?: any
  ): Promise<RuleExecutionResult[]> {
    const applicableRules = this.getApplicableRules(fieldName, localValue, remoteValue)
    const results: RuleExecutionResult[] = []

    for (const rule of applicableRules) {
      const startTime = Date.now()

      try {
        const result = await this.executeRule(rule, localValue, remoteValue, baseValue)
        const executionTime = Date.now() - startTime

        results.push({
          rule,
          applied: result.applied,
          result: result.value,
          reason: result.reason,
          executionTime
        })

        this.executionHistory.push(results[results.length - 1])

        // Stop after first successfully applied rule
        if (result.applied) {
          break
        }
      } catch (error) {
        results.push({
          rule,
          applied: false,
          reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          executionTime: Date.now() - startTime
        })
      }
    }

    // Keep only recent execution history
    if (this.executionHistory.length > 100) {
      this.executionHistory = this.executionHistory.slice(-100)
    }

    return results
  }

  /**
   * Execute a single resolution rule
   */
  private async executeRule(
    rule: UserResolutionRule,
    localValue: any,
    remoteValue: any,
    _baseValue?: any
  ): Promise<{ applied: boolean; value?: any; reason: string }> {
    switch (rule.action as any) {
      case 'prefer-local':
        return {
          applied: true,
          value: localValue,
          reason: `Applied rule: ${rule.name} - prefer local value`
        }

      case 'prefer-remote':
        return {
          applied: true,
          value: remoteValue,
          reason: `Applied rule: ${rule.name} - prefer remote value`
        }

      case 'prefer-non-empty': {
        const nonEmpty = localValue || remoteValue
        return {
          applied: true,
          value: nonEmpty,
          reason: `Applied rule: ${rule.name} - prefer non-empty value`
        }
      }

      case 'prefer-true': {
        const trueValue = localValue === true || remoteValue === true
        return {
          applied: true,
          value: trueValue,
          reason: `Applied rule: ${rule.name} - prefer true value`
        }
      }

      case 'prefer-false': {
        const falseValue = localValue === false || remoteValue === false
        return {
          applied: true,
          value: falseValue,
          reason: `Applied rule: ${rule.name} - prefer false value`
        }
      }

      case 'prefer-longer':
        if (typeof localValue === 'string' && typeof remoteValue === 'string') {
          const longer = localValue.length > remoteValue.length ? localValue : remoteValue
          return {
            applied: true,
            value: longer,
            reason: `Applied rule: ${rule.name} - prefer longer string`
          }
        }
        break

      case 'prefer-newer':
        if (this.isTimestamp(localValue) && this.isTimestamp(remoteValue)) {
          const localTime = this.extractTimestamp(localValue)
          const remoteTime = this.extractTimestamp(remoteValue)
          const newer = localTime > remoteTime ? localValue : remoteValue
          return {
            applied: true,
            value: newer,
            reason: `Applied rule: ${rule.name} - prefer newer timestamp`
          }
        }
        break

      case 'prefer-earlier':
        if (this.isTimestamp(localValue) && this.isTimestamp(remoteValue)) {
          const localTime = this.extractTimestamp(localValue)
          const remoteTime = this.extractTimestamp(remoteValue)
          const earlier = localTime < remoteTime ? localValue : remoteValue
          return {
            applied: true,
            value: earlier,
            reason: `Applied rule: ${rule.name} - prefer earlier timestamp`
          }
        }
        break

      case 'prefer-higher':
        if (typeof localValue === 'number' && typeof remoteValue === 'number') {
          const higher = Math.max(localValue, remoteValue)
          return {
            applied: true,
            value: higher,
            reason: `Applied rule: ${rule.name} - prefer higher number`
          }
        }
        if (typeof localValue === 'string' && typeof remoteValue === 'string') {
          const priorities = ['low', 'medium', 'high']
          const localIndex = priorities.indexOf(localValue.toLowerCase())
          const remoteIndex = priorities.indexOf(remoteValue.toLowerCase())

          if (localIndex !== -1 && remoteIndex !== -1) {
            const higher = localIndex > remoteIndex ? localValue : remoteValue
            return {
              applied: true,
              value: higher,
              reason: `Applied rule: ${rule.name} - prefer higher priority`
            }
          }
        }
        break

      case 'merge':
        if (typeof localValue === 'string' && typeof remoteValue === 'string') {
          const combined = localValue + ' ' + remoteValue
          return {
            applied: true,
            value: combined,
            reason: `Applied rule: ${rule.name} - merge strings`
          }
        }
        break

      case 'union':
        if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
          const union = [...new Set([...localValue, ...remoteValue])]
          return {
            applied: true,
            value: union,
            reason: `Applied rule: ${rule.name} - union arrays`
          }
        }
        break

      case 'merge-deep':
        if (typeof localValue === 'object' && typeof remoteValue === 'object') {
          const merged = { ...localValue, ...remoteValue }
          return {
            applied: true,
            value: merged,
            reason: `Applied rule: ${rule.name} - deep merge objects`
          }
        }
        break

      case 'ask':
        return {
          applied: false,
          reason: `Rule requires user input: ${rule.name}`
        }

      default:
        return {
          applied: false,
          reason: `Unknown action: ${rule.action}`
        }
    }

    return {
      applied: false,
      reason: `Rule ${rule.name} could not be applied to these value types`
    }
  }

  /**
   * Evaluate rule condition
   */
  private evaluateCondition(rule: UserResolutionRule, localValue: any, remoteValue: any): boolean {
    switch (rule.condition as any) {
      case 'always':
        return true

      case 'when-empty':
        return !localValue || !remoteValue

      case 'when-newer':
        if (this.isTimestamp(localValue) && this.isTimestamp(remoteValue)) {
          return this.extractTimestamp(localValue) !== this.extractTimestamp(remoteValue)
        }
        return false

      case 'when-contains':
        if (rule.value && typeof rule.value === 'string') {
          const localStr = String(localValue || '')
          const remoteStr = String(remoteValue || '')
          return localStr.includes(rule.value) || remoteStr.includes(rule.value)
        }
        return false

      case 'when-longer':
        if (typeof localValue === 'string' && typeof remoteValue === 'string') {
          return localValue.length !== remoteValue.length
        }
        return false

      default:
        return false
    }
  }

  /**
   * Check if value is a timestamp
   */
  private isTimestamp(value: any): boolean {
    if (typeof value === 'number') {
      return value > 1000000000 && value < 2000000000 // Reasonable timestamp range
    }
    if (typeof value === 'string') {
      const date = new Date(value)
      return !isNaN(date.getTime())
    }
    if (value && typeof value === 'object' && 'timestamp' in value) {
      return typeof value.timestamp === 'number'
    }
    return false
  }

  /**
   * Extract timestamp from value
   */
  private extractTimestamp(value: any): number {
    if (typeof value === 'number') return value
    if (typeof value === 'string') return new Date(value).getTime()
    if (value && typeof value === 'object' && 'timestamp' in value) {
      return typeof value.timestamp === 'number' ? value.timestamp : 0
    }
    return 0
  }

  /**
   * Match pattern (supports wildcards)
   */
  private matchPattern(pattern: string, fieldName: string): boolean {
    if (pattern === '*') return true
    if (pattern === fieldName) return true

    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'))
      return regex.test(fieldName)
    }

    return false
  }

  /**
   * Get rule sets
   */
  getRuleSets(): UserRuleSet[] {
    return Array.from(this.ruleSets.values())
  }

  /**
   * Get rule set by ID
   */
  getRuleSet(id: string): UserRuleSet | undefined {
    return this.ruleSets.get(id)
  }

  /**
   * Update rule set
   */
  updateRuleSet(ruleSet: UserRuleSet): void {
    this.ruleSets.set(ruleSet.id, ruleSet)
    this.saveUserRules()
  }

  /**
   * Delete rule set
   */
  deleteRuleSet(id: string): boolean {
    const deleted = this.ruleSets.delete(id)
    if (deleted) {
      this.saveUserRules()
    }
    return deleted
  }

  /**
   * Get execution history
   */
  getExecutionHistory(): RuleExecutionResult[] {
    return [...this.executionHistory]
  }

  /**
   * Clear execution history
   */
  clearExecutionHistory(): void {
    this.executionHistory = []
  }

  /**
   * Export rules
   */
  exportRules(): string {
    const exportData = {
      version: '1.0.0',
      exportedAt: Date.now(),
      globalRules: this.globalRules,
      ruleSets: Array.from(this.ruleSets.values())
    }
    return JSON.stringify(exportData, null, 2)
  }

  /**
   * Import rules
   */
  async importRules(jsonData: string): Promise<{ success: boolean; message: string; imported: number }> {
    try {
      const data = JSON.parse(jsonData)

      let imported = 0

      if (data.globalRules && Array.isArray(data.globalRules)) {
        this.globalRules.push(...data.globalRules)
        imported += data.globalRules.length
      }

      if (data.ruleSets && Array.isArray(data.ruleSets)) {
        data.ruleSets.forEach((ruleSet: UserRuleSet) => {
          this.ruleSets.set(ruleSet.id, ruleSet)
          imported++
        })
      }

      // Sort rules by priority
      this.globalRules.sort((a, b) => a.priority - b.priority)
      this.ruleSets.forEach(ruleSet => {
        ruleSet.rules.sort((a, b) => a.priority - b.priority)
      })

      await this.saveUserRules()

      return {
        success: true,
        message: `Successfully imported ${imported} rules`,
        imported
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to import rules: ${error instanceof Error ? error.message : 'Unknown error'}`,
        imported: 0
      }
    }
  }
}

export default UserResolutionRulesManager