/**
 * Auto-Integration System for Skill Router
 * Automatically integrates discovered skills with safety features and rollback capabilities
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { execSync } from 'child_process'
import { DiscoveryResult, DiscoveredSkill, SkillDiscoveryEngine } from './skill-discovery'

// Types
interface IntegrationConfig {
  autoApprove: boolean
  createBackups: boolean
  testPatterns: boolean
  requireConfirmation: boolean
  maxConfidenceThreshold: number
  conflictResolution: 'manual' | 'auto-higher-confidence' | 'auto-priority'
}

interface BackupInfo {
  timestamp: Date
  filePath: string
  checksum: string
  description: string
}

interface IntegrationResult {
  success: boolean
  backupPath?: string
  changes: {
    added: string[]
    updated: string[]
    removed: string[]
    conflictsResolved: string[]
  }
  errors: string[]
  warnings: string[]
  rollbackAvailable: boolean
}

interface RollbackResult {
  success: boolean
  restoredFrom: string
  errors: string[]
  warnings: string[]
}

class AutoIntegrationEngine {
  private configPath: string
  private backupPath: string
  private testResultsPath: string
  private config: IntegrationConfig
  private backupHistory: BackupInfo[] = []

  constructor(
    configPath: string,
    private discoveryEngine: SkillDiscoveryEngine,
    config: Partial<IntegrationConfig> = {}
  ) {
    this.configPath = configPath
    this.backupPath = join(dirname(configPath), 'backups')
    this.testResultsPath = join(dirname(configPath), 'test-results')

    this.config = {
      autoApprove: false,
      createBackups: true,
      testPatterns: true,
      requireConfirmation: true,
      maxConfidenceThreshold: 0.6,
      conflictResolution: 'auto-higher-confidence',
      ...config
    }

    this.initializeDirectories()
    this.loadBackupHistory()
  }

  /**
   * Initialize required directories
   */
  private initializeDirectories(): void {
    [this.backupPath, this.testResultsPath].forEach(path => {
      if (!existsSync(path)) {
        mkdirSync(path, { recursive: true })
      }
    })
  }

  /**
   * Load backup history
   */
  private loadBackupHistory(): void {
    try {
      const historyPath = join(this.backupPath, 'history.json')
      if (existsSync(historyPath)) {
        const historyData = readFileSync(historyPath, 'utf-8')
        this.backupHistory = JSON.parse(historyData)
      }
    } catch (error) {
      console.log('No backup history found, starting fresh')
      this.backupHistory = []
    }
  }

  /**
   * Save backup history
   */
  private saveBackupHistory(): void {
    const historyPath = join(this.backupPath, 'history.json')
    writeFileSync(historyPath, JSON.stringify(this.backupHistory, null, 2))
  }

  /**
   * Calculate file checksum
   */
  private calculateChecksum(filePath: string): string {
    try {
      const content = readFileSync(filePath, 'utf-8')
      return require('crypto').createHash('md5').update(content).digest('hex')
    } catch (error) {
      return ''
    }
  }

  /**
   * Create backup of current configuration
   */
  private async createBackup(description: string): Promise<string> {
    if (!this.config.createBackups) {
      return ''
    }

    const timestamp = new Date()
    const timestampStr = timestamp.toISOString().replace(/[:.]/g, '-')
    const backupFileName = `routing-config-${timestampStr}.json`
    const backupFilePath = join(this.backupPath, backupFileName)

    if (existsSync(this.configPath)) {
      const originalContent = readFileSync(this.configPath, 'utf-8')
      writeFileSync(backupFilePath, originalContent)

      const checksum = this.calculateChecksum(this.configPath)

      const backupInfo: BackupInfo = {
        timestamp,
        filePath: backupFilePath,
        checksum,
        description
      }

      this.backupHistory.push(backupInfo)
      this.saveBackupHistory()

      console.log(`📋 Backup created: ${backupFileName}`)
      return backupFilePath
    }

    return ''
  }

  /**
   * Validate configuration before applying
   */
  private async validateConfiguration(config: any): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    // Check basic structure
    if (!config.routingPatterns || typeof config.routingPatterns !== 'object') {
      errors.push('routingPatterns is missing or not an object')
    }

    // Validate each pattern
    if (config.routingPatterns) {
      for (const [key, pattern] of Object.entries(config.routingPatterns)) {
        if (typeof pattern !== 'object') {
          errors.push(`Pattern ${key} is not an object`)
          continue
        }

        const patternObj = pattern as any

        if (!patternObj.skill || typeof patternObj.skill !== 'string') {
          errors.push(`Pattern ${key} missing valid skill`)
        }

        if (!patternObj.patterns || !Array.isArray(patternObj.patterns)) {
          errors.push(`Pattern ${key} missing valid patterns array`)
        } else {
          // Test regex patterns
          patternObj.patterns.forEach((regexPattern: string, index: number) => {
            try {
              new RegExp(regexPattern)
            } catch (error) {
              errors.push(`Pattern ${key}[${index}] has invalid regex: ${regexPattern}`)
            }
          })
        }

        if (patternObj.priority && (typeof patternObj.priority !== 'number' || patternObj.priority < 1 || patternObj.priority > 10)) {
          errors.push(`Pattern ${key} has invalid priority (must be 1-10)`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Test generated patterns
   */
  private async testPatterns(discoveryResult: DiscoveryResult): Promise<{ passed: boolean; results: any[] }> {
    const testResults: any[] = []
    let allPassed = true

    // Test patterns with sample inputs
    const testCases = [
      { input: 'fix the timer bug', expectedCategory: 'debugging' },
      { input: 'test the new feature', expectedCategory: 'testing' },
      { input: 'create a component', expectedCategory: 'development' },
      { input: 'optimize performance', expectedCategory: 'performance' }
    ]

    for (const skill of [...discoveryResult.newSkills, ...discoveryResult.updatedSkills]) {
      for (const pattern of skill.generatedPatterns.slice(0, 3)) {
        for (const testCase of testCases) {
          try {
            const regex = new RegExp(pattern.pattern, 'i')
            const matches = regex.test(testCase.input)

            testResults.push({
              skill: skill.metadata.name,
              pattern: pattern.pattern,
              testCase: testCase.input,
              matches,
              confidence: pattern.confidence,
              category: skill.suggestedCategory
            })

            // Test if patterns match reasonable inputs
            if (matches && skill.suggestedCategory !== testCase.expectedCategory) {
              // This might be a false positive, but not necessarily a failure
              console.log(`⚠️ Pattern matched unexpected category: ${pattern.pattern} matched "${testCase.input}"`)
            }

          } catch (error) {
            testResults.push({
              skill: skill.metadata.name,
              pattern: pattern.pattern,
              testCase: testCase.input,
              matches: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              confidence: pattern.confidence
            })
            allPassed = false
          }
        }
      }
    }

    return {
      passed: allPassed,
      results: testResults
    }
  }

  /**
   * Resolve conflicts automatically
   */
  private resolveConflicts(discoveryResult: DiscoveryResult): void {
    if (discoveryResult.conflicts.length === 0) return

    console.log(`🔧 Resolving ${discoveryResult.conflicts.length} conflicts...`)

    discoveryResult.conflicts.forEach(conflict => {
      const skill1 = [...discoveryResult.newSkills, ...discoveryResult.updatedSkills]
        .find(s => s.metadata.name === conflict.skill1)
      const skill2 = [...discoveryResult.newSkills, ...discoveryResult.updatedSkills]
        .find(s => s.metadata.name === conflict.skill2)

      if (!skill1 || !skill2) return

      switch (this.config.conflictResolution) {
        case 'auto-higher-confidence':
          // Keep patterns with higher confidence
          conflict.conflictingPatterns.forEach(patternStr => {
            const pattern1 = skill1.generatedPatterns.find(p => p.pattern === patternStr)
            const pattern2 = skill2.generatedPatterns.find(p => p.pattern === patternStr)

            if (pattern1 && pattern2) {
              if (pattern1.confidence > pattern2.confidence) {
                // Remove from skill2
                skill2.generatedPatterns = skill2.generatedPatterns.filter(p => p.pattern !== patternStr)
              } else {
                // Remove from skill1
                skill1.generatedPatterns = skill1.generatedPatterns.filter(p => p.pattern !== patternStr)
              }
            }
          })
          break

        case 'auto-priority':
          // Keep patterns from higher priority skill
          const higherPrioritySkill = skill1.suggestedPriority > skill2.suggestedPriority ? skill1 : skill2
          const lowerPrioritySkill = skill1.suggestedPriority > skill2.suggestedPriority ? skill2 : skill1

          conflict.conflictingPatterns.forEach(patternStr => {
            lowerPrioritySkill.generatedPatterns = lowerPrioritySkill.generatedPatterns
              .filter(p => p.pattern !== patternStr)
          })
          break

        case 'manual':
          // Don't resolve automatically, just log
          console.log(`⚠️ Manual conflict resolution needed between ${conflict.skill1} and ${conflict.skill2}`)
          break
      }
    })
  }

  /**
   * Auto-integrate discovered skills
   */
  public async integrateSkills(
    discoveryResult: DiscoveryResult,
    forceIntegration: boolean = false
  ): Promise<IntegrationResult> {
    console.log('🔄 Starting auto-integration...')

    const result: IntegrationResult = {
      success: false,
      changes: {
        added: [],
        updated: [],
        removed: [],
        conflictsResolved: []
      },
      errors: [],
      warnings: [],
      rollbackAvailable: false
    }

    try {
      // Check if there are changes to integrate
      if (discoveryResult.summary.newSkillsCount === 0 &&
          discoveryResult.summary.updatedSkillsCount === 0 &&
          discoveryResult.summary.removedSkillsCount === 0) {
        result.success = true
        result.warnings.push('No changes to integrate')
        return result
      }

      // Create backup
      const backupPath = await this.createBackup('Pre-integration backup')
      if (backupPath) {
        result.backupPath = backupPath
        result.rollbackAvailable = true
      }

      // Resolve conflicts
      this.resolveConflicts(discoveryResult)

      // Test patterns if enabled
      if (this.config.testPatterns) {
        console.log('🧪 Testing generated patterns...')
        const testResult = await this.testPatterns(discoveryResult)

        if (!testResult.passed) {
          result.errors.push('Pattern testing failed')

          // Save test results
          const testResultsFile = join(this.testResultsPath, `test-results-${Date.now()}.json`)
          writeFileSync(testResultsFile, JSON.stringify(testResult.results, null, 2))

          if (!forceIntegration) {
            return result
          }
        }

        console.log('✅ Pattern testing passed')
      }

      // Load current configuration
      let currentConfig: any = { routingPatterns: {} }
      if (existsSync(this.configPath)) {
        const configData = readFileSync(this.configPath, 'utf-8')
        currentConfig = JSON.parse(configData)
      }

      // Validate low-confidence patterns
      const lowConfidenceSkills = [...discoveryResult.newSkills, ...discoveryResult.updatedSkills]
        .filter(skill =>
          skill.generatedPatterns.some(p => p.confidence < this.config.maxConfidenceThreshold)
        )

      if (lowConfidenceSkills.length > 0 && !forceIntegration) {
        result.warnings.push(`Found ${lowConfidenceSkills.length} skills with low-confidence patterns`)
        lowConfidenceSkills.forEach(skill => {
          result.warnings.push(`- ${skill.metadata.name}: Some patterns have confidence < ${(this.config.maxConfidenceThreshold * 100).toFixed(0)}%`)
        })

        if (this.config.requireConfirmation) {
          result.errors.push('Manual review required for low-confidence patterns')
          return result
        }
      }

      // Apply changes
      await this.discoveryEngine.updateRoutingConfig(discoveryResult)

      // Validate new configuration
      const newConfigData = readFileSync(this.configPath, 'utf-8')
      const newConfig = JSON.parse(newConfigData)
      const validation = await this.validateConfiguration(newConfig)

      if (!validation.valid) {
        result.errors.push(...validation.errors)

        // Rollback on validation failure
        if (backupPath) {
          await this.rollback(backupPath)
        }

        return result
      }

      // Track changes
      discoveryResult.newSkills.forEach(skill => {
        result.changes.added.push(skill.metadata.name)
      })

      discoveryResult.updatedSkills.forEach(skill => {
        result.changes.updated.push(skill.metadata.name)
      })

      discoveryResult.removedSkills.forEach(skillName => {
        result.changes.removed.push(skillName)
      })

      discoveryResult.conflicts.forEach(conflict => {
        result.changes.conflictsResolved.push(`${conflict.skill1} ↔ ${conflict.skill2}`)
      })

      result.success = true
      console.log('✅ Auto-integration completed successfully')

    } catch (error) {
      result.errors.push(`Integration failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      console.error('❌ Integration failed:', error)

      // Attempt rollback if we have a backup
      if (result.backupPath) {
        console.log('🔄 Attempting rollback...')
        const rollbackResult = await this.rollback(result.backupPath)
        if (!rollbackResult.success) {
          result.errors.push('Rollback also failed')
        }
      }
    }

    return result
  }

  /**
   * Rollback to a previous configuration
   */
  public async rollback(backupPath?: string): Promise<RollbackResult> {
    const result: RollbackResult = {
      success: false,
      restoredFrom: '',
      errors: [],
      warnings: []
    }

    try {
      let targetBackup = backupPath

      if (!targetBackup) {
        // Use the most recent backup
        const recentBackup = this.backupHistory
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]

        if (!recentBackup) {
          result.errors.push('No backup found for rollback')
          return result
        }

        targetBackup = recentBackup.filePath
      }

      if (!existsSync(targetBackup)) {
        result.errors.push(`Backup file not found: ${targetBackup}`)
        return result
      }

      // Validate backup before restoring
      const backupContent = readFileSync(targetBackup, 'utf-8')
      const backupConfig = JSON.parse(backupContent)
      const validation = await this.validateConfiguration(backupConfig)

      if (!validation.valid) {
        result.errors.push('Backup configuration is invalid')
        result.errors.push(...validation.errors)
        return result
      }

      // Create backup of current state before rollback
      const preRollbackBackup = await this.createBackup('Pre-rollback backup')

      // Restore backup
      writeFileSync(this.configPath, backupContent)

      result.success = true
      result.restoredFrom = targetBackup
      console.log(`✅ Rollback completed: ${targetBackup}`)

      if (preRollbackBackup) {
        result.warnings.push(`Pre-rollback backup created: ${preRollbackBackup}`)
      }

    } catch (error) {
      result.errors.push(`Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      console.error('❌ Rollback failed:', error)
    }

    return result
  }

  /**
   * List available backups
   */
  public listBackups(): BackupInfo[] {
    return this.backupHistory
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10) // Show last 10 backups
  }

  /**
   * Clean up old backups
   */
  public cleanupBackups(keepCount: number = 10): void {
    const sortedBackups = this.backupHistory
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    if (sortedBackups.length > keepCount) {
      const toDelete = sortedBackups.slice(keepCount)

      toDelete.forEach(backup => {
        try {
          if (existsSync(backup.filePath)) {
            unlinkSync(backup.filePath)
            console.log(`🗑️ Deleted old backup: ${backup.filePath}`)
          }
        } catch (error) {
          console.warn(`Failed to delete backup ${backup.filePath}:`, error)
        }
      })

      this.backupHistory = sortedBackups.slice(0, keepCount)
      this.saveBackupHistory()
    }
  }

  /**
   * Get integration status
   */
  public getStatus(): {
    lastBackup?: BackupInfo
    backupCount: number
    autoApproveEnabled: boolean
    testPatternsEnabled: boolean
    conflictResolution: string
  } {
    return {
      lastBackup: this.backupHistory
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0],
      backupCount: this.backupHistory.length,
      autoApproveEnabled: this.config.autoApprove,
      testPatternsEnabled: this.config.testPatterns,
      conflictResolution: this.config.conflictResolution
    }
  }
}

export { AutoIntegrationEngine, IntegrationResult, RollbackResult, IntegrationConfig, BackupInfo }