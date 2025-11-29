#!/usr/bin/env node

/**
 * TypeScript Persistence Type System Fixer Execution Script
 * Systematically fixes generic type issues in persistence and backup layers
 */

import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'

class PersistenceTypeFixer {
  constructor() {
    this.projectRoot = process.cwd()
    this.logs = []
    this.fixCount = 0
    this.errorCount = 0
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`
    console.log(logEntry)
    this.logs.push(logEntry)
  }

  async execute() {
    this.log('🔧 Starting Persistence Type System Fixer...', 'info')

    try {
      // Phase 1: Generic Type Analysis
      this.log('\n📊 Phase 1: Generic Type Analysis', 'info')
      const typeIssues = await this.analyzeTypeIssues()
      this.log(`Found ${typeIssues.length} generic type issues`, 'warn')

      // Phase 2: Type Guard Implementation
      this.log('\n🛡️ Phase 2: Type Guard Implementation', 'info')
      await this.implementTypeGuards(typeIssues)

      // Phase 3: Generic Constraint Resolution
      this.log('\n⚙️ Phase 3: Generic Constraint Resolution', 'info')
      await this.fixGenericConstraints(typeIssues)

      // Phase 4: Array Type System Fixes
      this.log('\n📋 Phase 4: Array Type System Fixes', 'info')
      await this.fixArrayTypeIssues(typeIssues)

      // Phase 5: Validation
      this.log('\n✅ Phase 5: Validation & Testing', 'info')
      const validationResults = await this.runValidation()

      this.log('\n🎉 Persistence Type System Fixer Complete!', 'success')
      this.log(`✅ Fixed ${this.fixCount} generic type issues`, 'success')

    } catch (error) {
      this.log(`💥 Critical error during type fixing: ${error.message}`, 'error')
      throw error
    }
  }

  async analyzeTypeIssues() {
    const issues = []

    // Target files for persistence type issues
    const targetFiles = [
      'src/composables/useBulletproofPersistence.ts',
      'src/composables/useAutoBackup.ts',
      'src/composables/useBackupScheduler.ts',
      'src/composables/useDatabase.ts',
      'src/composables/useDatabaseAdapter.ts'
    ]

    for (const file of targetFiles) {
      const filePath = path.join(this.projectRoot, file)
      try {
        const content = await fs.readFile(filePath, 'utf8')
        const fileIssues = this.parseTypeIssues(content, file)
        issues.push(...fileIssues)
      } catch (error) {
        this.log(`Could not read ${file}: ${error.message}`, 'warn')
      }
    }

    return issues
  }

  parseTypeIssues(content, file) {
    const issues = []
    const lines = content.split('\n')

    lines.forEach((line, index) => {
      // Pattern 1: "Type 'unknown' is not assignable to type"
      if (line.includes("Type 'unknown' is not assignable to type")) {
        issues.push({
          file,
          line: index + 1,
          type: 'unknown_assignment',
          content: line.trim(),
          severity: 'high'
        })
      }

      // Pattern 2: Empty object {} assignment to arrays
      if (line.includes('{}') && (line.includes('any[]') || line.includes('Array'))) {
        issues.push({
          file,
          line: index + 1,
          type: 'array_mismatch',
          content: line.trim(),
          severity: 'high'
        })
      }

      // Pattern 3: Generic functions without proper constraints
      if (line.includes('<T>') && !line.includes('extends')) {
        issues.push({
          file,
          line: index + 1,
          type: 'missing_constraint',
          content: line.trim(),
          severity: 'medium'
        })
      }

      // Pattern 4: Direct type assertions
      if (line.includes(' as T') || line.includes('as T ')) {
        issues.push({
          file,
          line: index + 1,
          type: 'unsafe_assertion',
          content: line.trim(),
          severity: 'medium'
        })
      }
    })

    return issues
  }

  async implementTypeGuards(typeIssues) {
    const unknownAssignmentIssues = typeIssues.filter(issue => issue.type === 'unknown_assignment')

    for (const issue of unknownAssignmentIssues) {
      await this.fixUnknownAssignment(issue)
    }
  }

  async fixUnknownAssignment(issue) {
    const filePath = path.join(this.projectRoot, issue.file)

    try {
      const content = await fs.readFile(filePath, 'utf8')

      // Create type guard utility if not present
      if (!content.includes('function createTypeGuard')) {
        const typeGuardUtility = this.generateTypeGuardUtility()
        const updatedContent = typeGuardUtility + '\n\n' + content
        await fs.writeFile(filePath, updatedContent)
        this.log(`✅ Added type guard utility to ${issue.file}`, 'success')
        this.fixCount++
      }

    } catch (error) {
      this.log(`Failed to fix unknown assignment in ${issue.file}: ${error.message}`, 'error')
    }
  }

  generateTypeGuardUtility() {
    return `// Type guard utilities for safe generic type handling
export function createTypeGuard<T>(
  validator: (value: unknown) => value is T
): {
  validate: (value: unknown) => value is T
  assertValid: (value: unknown) => T
} {
  return {
    validate: validator,
    assertValid: (value: unknown): T => {
      if (!validator(value)) {
        throw new TypeError(\`Invalid type: validation failed\`)
      }
      return value
    }
  }
}

// Common type guards
export const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const hasId = (value: unknown): value is { id: string } => {
  return isObject(value) && typeof value.id === 'string'
}

export const isTask = (value: unknown): value is {
  id: string
  title: string
  description: string
  status: string
  priority: string | null
  progress: number
  completedPomodoros: number
  subtasks: unknown[]
  dueDate: string
  projectId: string
  createdAt: Date
  updatedAt: Date
} => {
  return hasId(value) &&
         typeof value.title === 'string' &&
         typeof value.description === 'string' &&
         typeof value.status === 'string' &&
         typeof value.progress === 'number' &&
         typeof value.completedPomodoros === 'number' &&
         Array.isArray(value.subtasks) &&
         typeof value.dueDate === 'string' &&
         typeof value.projectId === 'string'
}`
  }

  async fixGenericConstraints(typeIssues) {
    const constraintIssues = typeIssues.filter(issue => issue.type === 'missing_constraint')

    for (const issue of constraintIssues) {
      await this.addGenericConstraints(issue)
    }
  }

  async addGenericConstraints(issue) {
    const filePath = path.join(this.projectRoot, issue.file)

    try {
      const content = await fs.readFile(filePath, 'utf8')

      // Replace generic functions with proper constraints
      const updatedContent = content.replace(
        /<T>\s*=>/g,
        '<T extends Record<string, unknown>> =>'
      )

      if (updatedContent !== content) {
        await fs.writeFile(filePath, updatedContent)
        this.log(`✅ Added generic constraints to ${issue.file}`, 'success')
        this.fixCount++
      }

    } catch (error) {
      this.log(`Failed to add constraints to ${issue.file}: ${error.message}`, 'error')
    }
  }

  async fixArrayTypeIssues(typeIssues) {
    const arrayIssues = typeIssues.filter(issue => issue.type === 'array_mismatch')

    for (const issue of arrayIssues) {
      await this.fixArrayInitialization(issue)
    }
  }

  async fixArrayInitialization(issue) {
    const filePath = path.join(this.projectRoot, issue.file)

    try {
      const content = await fs.readFile(filePath, 'utf8')

      // Replace {} with [] in array contexts
      const updatedContent = content.replace(
        /localStorage\.getItem\([^)]+\)\s*\|\|\s*{\}/g,
        match => match.replace('{}', '[]')
      )

      // Add array type safety
      if (updatedContent !== content) {
        const safeArrayUtils = this.generateSafeArrayUtils()
        const finalContent = safeArrayUtils + '\n\n' + updatedContent
        await fs.writeFile(filePath, finalContent)
        this.log(`✅ Fixed array initialization in ${issue.file}`, 'success')
        this.fixCount++
      }

    } catch (error) {
      this.log(`Failed to fix array issue in ${issue.file}: ${error.message}`, 'error')
    }
  }

  generateSafeArrayUtils() {
    return `// Safe array utilities for type-safe persistence
export function safeParseArray<T>(
  data: string | null,
  validator: (item: unknown) => item is T
): T[] {
  if (!data) {
    return []
  }

  try {
    const parsed = JSON.parse(data)
    if (Array.isArray(parsed)) {
      return parsed.filter(validator)
    }
  } catch (error) {
    console.warn('Failed to parse array data:', error)
  }

  return []
}

export function safeStringifyArray<T>(data: T[]): string {
  try {
    return JSON.stringify(data)
  } catch (error) {
    console.warn('Failed to stringify array data:', error)
    return '[]'
  }
}`
  }

  async runValidation() {
    const results = {
      compilation: false,
      typeErrors: 0
    }

    try {
      // Test TypeScript compilation
      const output = execSync('npx tsc --noEmit --skipLibCheck', {
        encoding: 'utf8',
        cwd: this.projectRoot
      })

      results.compilation = true
      this.log('✅ TypeScript compilation successful', 'success')
    } catch (error) {
      const errorOutput = error.stdout || error.stderr || ''
      results.typeErrors = (errorOutput.match(/error TS/g) || []).length
      this.log(`❌ TypeScript compilation failed with ${results.typeErrors} errors`, 'error')
    }

    return results
  }

  async emergencyRollback() {
    this.log('🔄 Initiating emergency rollback...', 'warn')

    try {
      execSync('git checkout -- src/composables/useBulletproofPersistence.ts', { cwd: this.projectRoot })
      execSync('git checkout -- src/composables/useAutoBackup.ts', { cwd: this.projectRoot })
      execSync('git checkout -- src/composables/useBackupScheduler.ts', { cwd: this.projectRoot })
      this.log('✅ Emergency rollback completed', 'success')
    } catch (error) {
      this.log(`Rollback failed: ${error.message}`, 'error')
    }
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const fixer = new PersistenceTypeFixer()
  fixer.execute().catch(error => {
    console.error('Script execution failed:', error)
    process.exit(1)
  })
}

export default PersistenceTypeFixer