#!/usr/bin/env node

/**
 * TypeScript Foundation Restoration Execution Script
 * Automatically fixes TypeScript foundation issues in Pomo-Flow
 */

import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'

class TypeScriptFoundationRestorer {
  constructor() {
    this.projectRoot = process.cwd()
    this.logs = []
    this.errorCount = 0
    this.fixCount = 0
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`
    console.log(logEntry)
    this.logs.push(logEntry)
  }

  async execute() {
    this.log('🔧 Starting TypeScript Foundation Restoration...', 'info')

    try {
      // Phase 1: Error Analysis
      this.log('\n📊 Phase 1: Error Analysis', 'info')
      const errorReport = await this.analyzeTypeScriptErrors()

      // Phase 2: Interface Restoration
      this.log('\n🏗️ Phase 2: Interface Restoration', 'info')
      await this.restoreTaskInterface()

      // Phase 3: Store Method Restoration
      this.log('\n🏪 Phase 3: Store Method Restoration', 'info')
      await this.implementStoreMethods()

      // Phase 4: Import Resolution
      this.log('\n📦 Phase 4: Import Resolution', 'info')
      await this.fixImportIssues()

      // Phase 5: Validation
      this.log('\n✅ Phase 5: Validation & Testing', 'info')
      const validationResults = await this.runValidation()

      this.log('\n🎉 TypeScript Foundation Restoration Complete!', 'success')
      this.log(`✅ Fixed ${this.fixCount} issues`, 'success')

    } catch (error) {
      this.log(`💥 Critical error during restoration: ${error.message}`, 'error')
      throw error
    }
  }

  async analyzeTypeScriptErrors() {
    try {
      const output = execSync('npx tsc --noEmit --skipLibCheck', { encoding: 'utf8', cwd: this.projectRoot })
      this.log('✅ No TypeScript errors found', 'success')
      return { totalErrors: 0, errors: [] }
    } catch (error) {
      const errorOutput = error.stdout || error.stderr || ''
      const errors = errorOutput.split('\n').filter(line => line.includes('error TS'))
      this.errorCount = errors.length
      this.log(`Found ${errors.length} TypeScript errors`, 'warn')

      // Categorize errors
      const categorized = this.categorizeErrors(errors)
      this.log(`- Missing properties: ${categorized.missingProperties.length}`, 'info')
      this.log(`- Missing methods: ${categorized.missingMethods.length}`, 'info')
      this.log(`- Type issues: ${categorized.typeIssues.length}`, 'info')

      return { totalErrors: errors.length, errors, categorized }
    }
  }

  categorizeErrors(errors) {
    const categorized = {
      missingProperties: [],
      missingMethods: [],
      typeIssues: [],
      importIssues: [],
      returnTypes: []
    }

    errors.forEach(error => {
      if (error.includes("Property") && error.includes("does not exist")) {
        categorized.missingProperties.push(error)
      } else if (error.includes("Property") && error.includes("does not exist on type")) {
        categorized.missingMethods.push(error)
      } else if (error.includes("Cannot find name") || error.includes("refer to a value")) {
        categorized.typeIssues.push(error)
      } else if (error.includes("Cannot find module") || error.includes("has no exported member")) {
        categorized.importIssues.push(error)
      } else if (error.includes("not assignable to parameter") || error.includes("not assignable to type")) {
        categorized.returnTypes.push(error)
      }
    })

    return categorized
  }

  async restoreTaskInterface() {
    const tasksPath = path.join(this.projectRoot, 'src/stores/tasks.ts')

    try {
      const content = await fs.readFile(tasksPath, 'utf8')

      // Check if Task interface needs updates
      if (content.includes('export interface Task')) {
        const updatedContent = this.addMissingTaskProperties(content)
        if (updatedContent !== content) {
          await fs.writeFile(tasksPath, updatedContent)
          this.log('✅ Updated Task interface with missing properties', 'success')
          this.fixCount++
        }
      }

      // Check if TaskInstance interface exists
      if (!content.includes('export interface TaskInstance')) {
        const taskInstanceInterface = this.generateTaskInstanceInterface()
        const updatedContent = content + '\n\n' + taskInstanceInterface
        await fs.writeFile(tasksPath, updatedContent)
        this.log('✅ Added TaskInstance interface', 'success')
        this.fixCount++
      }

    } catch (error) {
      this.log(`Failed to update Task interface: ${error.message}`, 'error')
      throw error
    }
  }

  addMissingTaskProperties(content) {
    let updatedContent = content

    // Find the Task interface and add missing properties
    const taskInterfaceMatch = content.match(/export interface Task \{[\s\S]*?\n\}/)
    if (taskInterfaceMatch) {
      let taskInterface = taskInterfaceMatch[0]

      // Add missing properties if not present
      if (!taskInterface.includes('scheduledDate?:')) {
        taskInterface = taskInterface.replace(
          '  updatedAt: Date',
          `  updatedAt: Date

  // Legacy scheduling fields (for backward compatibility)
  scheduledDate?: string        // YYYY-MM-DD format for legacy support
  scheduledTime?: string        // HH:MM format for legacy time support

  // Task classification
  isUncategorized?: boolean     // true if task has no project assigned

  // Planning fields
  estimatedPomodoros?: number   // Estimated pomodoro sessions

  // Calendar instances (NEW)
  instances?: TaskInstance[]    // Calendar scheduling instances`
        )
        this.fixCount++
      }

      updatedContent = content.replace(taskInterfaceMatch[0], taskInterface)
    }

    return updatedContent
  }

  generateTaskInstanceInterface() {
    return `export interface TaskInstance {
  id: string                    // Unique instance identifier
  parentTaskId: string          // Reference to original task
  scheduledDate: string         // YYYY-MM-DD format
  scheduledTime?: string        // HH:MM format
  duration?: number             // Duration in minutes
  status: 'scheduled' | 'completed' | 'skipped'
  isRecurring?: boolean         // True for recurring task instances
  pomodoroTracking?: {
    completed: number
    total: number
  }
}`
  }

  async implementStoreMethods() {
    const tasksPath = path.join(this.projectRoot, 'src/stores/tasks.ts')

    try {
      const content = await fs.readFile(tasksPath, 'utf8')

      // Find the store definition and add missing methods
      const updatedContent = this.addMissingStoreMethods(content)

      if (updatedContent !== content) {
        await fs.writeFile(tasksPath, updatedContent)
        this.log('✅ Added missing store methods', 'success')
        this.fixCount++
      }

    } catch (error) {
      this.log(`Failed to update store methods: ${error.message}`, 'error')
      throw error
    }
  }

  addMissingStoreMethods(content) {
    let updatedContent = content

    // Find the store definition
    const storeMatch = content.match(/export const useTaskStore = defineStore\('tasks', \(\) => \{[\s\S]*?return \{[\s\S]*?\}\)/)
    if (storeMatch) {
      let storeDef = storeMatch[0]

      // Add missing methods before the return statement
      const returnMatch = storeDef.match(/return \{/)
      if (returnMatch) {
        const methodsToAdd = `
  // Missing store methods
  const getTask = (taskId: string): Task | undefined => {
    return tasks.value.find(task => task.id === taskId)
  }

  const getUncategorizedTaskCount = computed(() => {
    return tasks.value.filter(task =>
      task.projectId === 'uncategorized' ||
      task.isUncategorized ||
      !task.projectId
    ).length
  })

  const getTaskById = (taskId: string): Task | undefined => {
    const task = getTask(taskId)
    if (!task) {
      console.warn(\`Task with ID \${taskId} not found\`)
      return undefined
    }
    return task
  }

`

        storeDef = storeDef.replace(returnMatch[0], methodsToAdd + returnMatch[0])

        // Add methods to return object
        const returnObjMatch = storeDef.match(/return \{([\s\S]*?)\}/)
        if (returnObjMatch) {
          let returnObj = returnObjMatch[1]
          if (!returnObj.includes('getTask,')) {
            returnObj = `    tasks,\n    projects,\n    getTask,\n    getUncategorizedTaskCount,\n    getTaskById,` +
                      returnObj.replace(/(\s*tasks,)/, '').replace(/(\s*projects,)/, '')
          }
          storeDef = storeDef.replace(returnObjMatch[0], `return {${returnObj}}`)
          this.fixCount++
        }
      }

      updatedContent = content.replace(storeMatch[0], storeDef)
    }

    return updatedContent
  }

  async fixImportIssues() {
    // Fix RecurrencePattern import issues
    const files = await this.findFilesWithImportIssues()

    for (const file of files) {
      const content = await fs.readFile(file, 'utf8')
      const updatedContent = content.replace(
        /import\s*\{\s*([^}]*RecurrencePattern[^}]*)\}\s*from\s*['"]@\/types\/recurrence['"]/g,
        'import type { $1 } from \'@/types/recurrence\''
      )

      if (updatedContent !== content) {
        await fs.writeFile(file, updatedContent)
        this.log(`✅ Fixed import issue in ${path.relative(this.projectRoot, file)}`, 'success')
        this.fixCount++
      }
    }

    // Create centralized type exports
    await this.createCentralTypeExports()
  }

  async findFilesWithImportIssues() {
    try {
      const output = execSync('find src -name "*.ts" -o -name "*.vue" | xargs grep -l "import.*RecurrencePattern"',
                             { encoding: 'utf8', cwd: this.projectRoot })
      return output.split('\n').filter(file => file.trim())
    } catch (error) {
      return []
    }
  }

  async createCentralTypeExports() {
    const typesIndexPath = path.join(this.projectRoot, 'src/types/index.ts')

    try {
      const content = `// Centralized type exports for Pomo-Flow
export type { Task, Project, Subtask } from '@/stores/tasks'
export type { TaskInstance } from '@/stores/tasks'
export type {
  RecurrencePattern,
  TaskRecurrence,
  RecurringTaskInstance,
  NotificationPreferences
} from './recurrence'
`

      fs.writeFileSync(typesIndexPath, content)
      this.log('✅ Created centralized type exports', 'success')
      this.fixCount++

    } catch (error) {
      this.log(`Failed to create type exports: ${error.message}`, 'error')
    }
  }

  async runValidation() {
    const results = {
      compilation: false,
      serverStart: false,
      build: false
    }

    try {
      // Test compilation
      execSync('npx tsc --noEmit --skipLibCheck', { cwd: this.projectRoot })
      results.compilation = true
      this.log('✅ TypeScript compilation successful', 'success')
    } catch (error) {
      this.log('❌ TypeScript compilation failed', 'error')
    }

    try {
      // Test development server startup (with timeout)
      execSync('timeout 15s npm run dev', { cwd: this.projectRoot })
      results.serverStart = true
      this.log('✅ Development server starts successfully', 'success')
    } catch (error) {
      this.log('❌ Development server failed to start', 'error')
    }

    try {
      // Test build
      execSync('npm run build', { cwd: this.projectRoot })
      results.build = true
      this.log('✅ Build successful', 'success')
    } catch (error) {
      this.log('❌ Build failed', 'error')
    }

    return results
  }

  async emergencyRollback() {
    this.log('🔄 Initiating emergency rollback...', 'warn')

    try {
      execSync('git checkout -- src/stores/tasks.ts', { cwd: this.projectRoot })
      execSync('git checkout -- src/types/', { cwd: this.projectRoot })
      this.log('✅ Emergency rollback completed', 'success')
    } catch (error) {
      this.log(`Rollback failed: ${error.message}`, 'error')
    }
  }
}

// Execute if run directly
const restorer = new TypeScriptFoundationRestorer()
restorer.execute().catch(error => {
  console.error('Script execution failed:', error)
  process.exit(1)
})

export default TypeScriptFoundationRestorer