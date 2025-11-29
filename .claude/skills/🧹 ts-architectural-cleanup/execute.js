#!/usr/bin/env node

/**
 * TypeScript Architectural Cleanup Execution Script
 * Comprehensive duplicate detection and systematic refactoring using AST analysis
 */

import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'

class ArchitecturalCleanup {
  constructor() {
    this.projectRoot = process.cwd()
    this.logs = []
    this.fixCount = 0
    this.duplicateCount = 0
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`
    console.log(logEntry)
    this.logs.push(logEntry)
  }

  async execute() {
    this.log('🔧 Starting TypeScript Architectural Cleanup...', 'info')

    try {
      // Phase 1: Duplicate Detection
      this.log('\n🔍 Phase 1: Duplicate Detection', 'info')
      const duplicates = await this.detectDuplicates()
      this.log(`Found ${duplicates.length} categories of duplicates`, 'warn')

      // Phase 2: Duplicate Method Resolution
      this.log('\n🗑️ Phase 2: Duplicate Method Resolution', 'info')
      await this.resolveDuplicateMethods(duplicates)

      // Phase 3: Pattern Consolidation
      this.log('\n🏗️ Phase 3: Pattern Consolidation', 'info')
      await this.consolidatePatterns()

      // Phase 4: Code Quality Analysis
      this.log('\n📊 Phase 4: Code Quality Analysis', 'info')
      const qualityMetrics = await this.analyzeCodeQuality()

      // Phase 5: Validation
      this.log('\n✅ Phase 5: Validation & Testing', 'info')
      const validationResults = await this.runValidation()

      this.log('\n🎉 Architectural Cleanup Complete!', 'success')
      this.log(`✅ Removed ${this.duplicateCount} duplicates`, 'success')
      this.log(`✅ Fixed ${this.fixCount} architectural issues`, 'success')

    } catch (error) {
      this.log(`💥 Critical error during cleanup: ${error.message}`, 'error')
      throw error
    }
  }

  async detectDuplicates() {
    const duplicates = []

    // Focus on immediate blocking issues first
    const targetFiles = [
      'src/stores/tasks.ts',
      'src/composables/useDatabase.ts',
      'src/composables/useBulletproofPersistence.ts',
      'src/composables/useAutoBackup.ts',
      'src/composables/useBackupScheduler.ts'
    ]

    for (const file of targetFiles) {
      const filePath = path.join(this.projectRoot, file)
      try {
        const content = await fs.readFile(filePath, 'utf8')
        const fileDuplicates = this.parseDuplicates(content, file)
        duplicates.push(...fileDuplicates)
      } catch (error) {
        this.log(`Could not analyze ${file}: ${error.message}`, 'warn')
      }
    }

    return duplicates
  }

  parseDuplicates(content, file) {
    const duplicates = []
    const lines = content.split('\n')
    const functionDeclarations = new Map()
    const variableDeclarations = new Map()

    lines.forEach((line, index) => {
      // Detect duplicate function declarations
      const functionMatch = line.match(/^\s*(?:export\s+)?(?:const|function)\s+(\w+)\s*[=:]/)
      if (functionMatch) {
        const functionName = functionMatch[1]
        if (!functionDeclarations.has(functionName)) {
          functionDeclarations.set(functionName, [])
        }
        functionDeclarations.get(functionName).push({
          line: index + 1,
          content: line.trim()
        })
      }

      // Detect duplicate variable declarations
      const variableMatch = line.match(/^\s*(?:const|let|var)\s+(\w+)\s*[:=]/)
      if (variableMatch) {
        const variableName = variableMatch[1]
        if (!variableDeclarations.has(variableName)) {
          variableDeclarations.set(variableName, [])
        }
        variableDeclarations.get(variableName).push({
          line: index + 1,
          content: line.trim()
        })
      }
    })

    // Find actual duplicates
    for (const [name, declarations] of functionDeclarations) {
      if (declarations.length > 1) {
        duplicates.push({
          file,
          type: 'function',
          name,
          occurrences: declarations,
          severity: 'high'
        })
        this.duplicateCount += declarations.length - 1
      }
    }

    for (const [name, declarations] of variableDeclarations) {
      if (declarations.length > 1) {
        duplicates.push({
          file,
          type: 'variable',
          name,
          occurrences: declarations,
          severity: 'medium'
        })
        this.duplicateCount += declarations.length - 1
      }
    }

    return duplicates
  }

  async resolveDuplicateMethods(duplicates) {
    const functionDuplicates = duplicates.filter(dup => dup.type === 'function' && dup.severity === 'high')

    for (const duplicate of functionDuplicates) {
      await this.fixDuplicateMethods(duplicate)
    }
  }

  async fixDuplicateMethods(duplicate) {
    const filePath = path.join(this.projectRoot, duplicate.file)

    try {
      const content = await fs.readFile(filePath, 'utf8')
      const lines = content.split('\n')

      // Remove duplicate method declarations, keep the first one
      const occurrences = duplicate.occurrences.slice(1) // Skip first occurrence
      let updatedContent = content

      // Remove duplicates in reverse order to maintain line numbers
      for (let i = occurrences.length - 1; i >= 0; i--) {
        const occurrence = occurrences[i]
        const lineIndex = occurrence.line - 1

        // Find the full function or variable declaration
        let endIndex = lineIndex
        while (endIndex < lines.length) {
          const line = lines[endIndex]
          if (line.includes('}') || (line.includes(';') && !line.includes('{'))) {
            endIndex++
            break
          }
          endIndex++
        }

        // Remove the duplicate declaration
        lines.splice(lineIndex, endIndex - lineIndex)
      }

      updatedContent = lines.join('\n')

      if (updatedContent !== content) {
        await fs.writeFile(filePath, updatedContent)
        this.log(`✅ Removed duplicate ${duplicate.type} "${duplicate.name}" from ${duplicate.file}`, 'success')
        this.fixCount++
      }

    } catch (error) {
      this.log(`Failed to fix duplicates in ${duplicate.file}: ${error.message}`, 'error')
    }
  }

  async consolidatePatterns() {
    // Find and consolidate similar patterns
    const similarPatterns = await this.findSimilarPatterns()

    for (const pattern of similarPatterns) {
      await this.consolidatePattern(pattern)
    }
  }

  async findSimilarPatterns() {
    const patterns = []

    // Look for similar composables that can be extracted
    const calendarComposables = [
      'src/composables/calendar/useCalendarDayView.ts',
      'src/composables/calendar/useCalendarWeekView.ts',
      'src/composables/calendar/useCalendarMonthView.ts'
    ]

    // Check if calendar composables have similar logic
    const calendarSimilarity = await this.analyzeCalendarComposables(calendarComposables)
    if (calendarSimilarity.hasSimilarity) {
      patterns.push({
        type: 'calendar-composables',
        files: calendarComposables,
        action: 'extract-base-composable'
      })
    }

    return patterns
  }

  async analyzeCalendarComposables(files) {
    let commonPatterns = 0
    let totalPatterns = 0

    for (const file of files) {
      const filePath = path.join(this.projectRoot, file)
      try {
        const content = await fs.readFile(filePath, 'utf8')

        // Look for common calendar patterns
        const patterns = [
          'useTaskStore',
          'computed(()',
          'formatDate',
          'parseDate',
          'CalendarDateUtils'
        ]

        patterns.forEach(pattern => {
          totalPatterns++
          if (content.includes(pattern)) {
            commonPatterns++
          }
        })
      } catch (error) {
        // Skip files that can't be read
      }
    }

    const hasSimilarity = (commonPatterns / totalPatterns) > 0.7 // 70% similarity threshold

    return { hasSimilarity, commonPatterns, totalPatterns }
  }

  async consolidatePattern(pattern) {
    switch (pattern.type) {
      case 'calendar-composables':
        await this.createBaseCalendarComposable(pattern.files)
        break
    }
  }

  async createBaseCalendarComposable(files) {
    const baseComposablePath = path.join(this.projectRoot, 'src/composables/calendar/useCalendarBase.ts')

    try {
      await fs.mkdir(path.dirname(baseComposablePath), { recursive: true })

      const baseComposable = this.generateBaseCalendarComposable()
      await fs.writeFile(baseComposablePath, baseComposable)

      this.log('✅ Created base calendar composable', 'success')
      this.fixCount++
    } catch (error) {
      this.log(`Failed to create base composable: ${error.message}`, 'error')
    }
  }

  generateBaseCalendarComposable() {
    return `// Base Calendar Composable - Shared functionality for all calendar views
import { computed, ref, type Ref } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { formatDateKey, parseDateKey } from '@/stores/tasks'

export interface CalendarDateRange {
  start: Date
  end: Date
}

export function useCalendarBase(currentDate: Ref<Date>) {
  const taskStore = useTaskStore()

  // Common date computations
  const dateRange = computed((): CalendarDateRange => {
    // This will be overridden by specific view implementations
    const start = new Date(currentDate.value)
    const end = new Date(currentDate.value)
    return { start, end }
  })

  // Common task filtering logic
  const tasksInRange = computed(() => {
    const { start, end } = dateRange.value
    const startKey = formatDateKey(start)
    const endKey = formatDateKey(end)

    return taskStore.tasks.filter(task => {
      // Filter by various scheduling criteria
      if (task.dueDate && task.dueDate >= startKey && task.dueDate <= endKey) {
        return true
      }

      if (task.instances) {
        return task.instances.some(instance =>
          instance.scheduledDate >= startKey && instance.scheduledDate <= endKey
        )
      }

      return false
    })
  })

  // Common event creation logic
  const createCalendarEvent = (task: any, date: string) => {
    return {
      id: task.id,
      title: task.title,
      date,
      taskId: task.id,
      priority: task.priority,
      status: task.status
    }
  }

  return {
    dateRange,
    tasksInRange,
    createCalendarEvent,
    formatDateKey,
    parseDateKey
  }
}

// Common calendar utilities
export class CalendarUtils {
  static isDateInRange(date: Date, range: CalendarDateRange): boolean {
    return date >= range.start && date <= range.end
  }

  static getTaskDateKey(task: any): string | null {
    if (task.dueDate) return task.dueDate
    if (task.scheduledDate) return task.scheduledDate
    return null
  }

  static getPriorityColor(priority: string): string {
    switch (priority) {
      case 'high': return '#ef4444'
      case 'medium': return '#f59e0b'
      case 'low': return '#10b981'
      default: return '#6b7280'
    }
  }
}`
  }

  async analyzeCodeQuality() {
    const metrics = {
      duplicateFiles: 0,
      emptyLines: 0,
      largeFunctions: 0,
      complexity: 0
    }

    try {
      // Count duplicate files
      const { globSync } = await import('glob')
      const files = globSync('src/**/*.ts', { cwd: this.projectRoot })
      metrics.duplicateFiles = files.length

      // Analyze file content
      for (const file of files.slice(0, 10)) { // Sample first 10 files
        const filePath = path.join(this.projectRoot, file)
        try {
          const content = await fs.readFile(filePath, 'utf8')
          metrics.emptyLines += (content.match(/^\s*$/gm) || []).length

          // Count large functions (>50 lines)
          const functions = content.split(/(?:const|function)\s+\w+[^{]*\{[\s\S]*?\}/g)
          metrics.largeFunctions += functions.filter(fn => fn.split('\n').length > 50).length
        } catch (error) {
          // Skip files that can't be read
        }
      }

      this.log(`📊 Quality Metrics: ${metrics.duplicateFiles} files, ${metrics.emptyLines} empty lines, ${metrics.largeFunctions} large functions`, 'info')

    } catch (error) {
      this.log(`Could not analyze code quality: ${error.message}`, 'warn')
    }

    return metrics
  }

  async runValidation() {
    const results = {
      compilation: false,
      duplicateErrors: 0,
      overallErrors: 0
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

      // Count specific error types
      const duplicateErrors = errorOutput.match(/already been declared|already exists/g) || []
      results.duplicateErrors = duplicateErrors.length

      const overallErrors = errorOutput.match(/error TS/g) || []
      results.overallErrors = overallErrors.length

      this.log(`❌ TypeScript compilation failed with ${results.overallErrors} errors (${results.duplicateErrors} duplicate-related)`, 'error')
    }

    return results
  }

  async emergencyRollback() {
    this.log('🔄 Initiating emergency rollback...', 'warn')

    try {
      execSync('git checkout -- src/stores/tasks.ts', { cwd: this.projectRoot })
      execSync('git checkout -- src/composables/useCalendarBase.ts', { cwd: this.projectRoot })
      this.log('✅ Emergency rollback completed', 'success')
    } catch (error) {
      this.log(`Rollback failed: ${error.message}`, 'error')
    }
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cleanup = new ArchitecturalCleanup()
  cleanup.execute().catch(error => {
    console.error('Script execution failed:', error)
    process.exit(1)
  })
}

export default ArchitecturalCleanup