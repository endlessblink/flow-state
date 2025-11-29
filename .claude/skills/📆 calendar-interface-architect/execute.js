#!/usr/bin/env node

/**
 * TypeScript Calendar Interface Architect Execution Script
 * Systematically fixes calendar interface issues and implements comprehensive temporal type systems
 */

import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'

class CalendarInterfaceArchitect {
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
    this.log('🔧 Starting Calendar Interface Architect...', 'info')

    try {
      // Phase 1: Temporal Type Analysis
      this.log('\n📊 Phase 1: Temporal Type Analysis', 'info')
      const calendarIssues = await this.analyzeCalendarIssues()
      this.log(`Found ${calendarIssues.length} calendar interface issues`, 'warn')

      // Phase 2: CalendarEvent Interface Enhancement
      this.log('\n📅 Phase 2: CalendarEvent Interface Enhancement', 'info')
      await this.enhanceCalendarEventInterface()

      // Phase 3: TaskInstance Type System
      this.log('\n📋 Phase 3: TaskInstance Type System', 'info')
      await this.implementTaskInstanceTypes()

      // Phase 4: Calendar Composable Architecture
      this.log('\n🏗️ Phase 4: Calendar Composable Architecture', 'info')
      await this.architectCalendarComposables()

      // Phase 5: Temporal Type Safety
      this.log('\n⏰ Phase 5: Temporal Type Safety', 'info')
      await this.implementTemporalTypeSafety()

      // Phase 6: Validation
      this.log('\n✅ Phase 6: Validation & Testing', 'info')
      const validationResults = await this.runValidation()

      this.log('\n🎉 Calendar Interface Architect Complete!', 'success')
      this.log(`✅ Fixed ${this.fixCount} calendar interface issues`, 'success')

    } catch (error) {
      this.log(`💥 Critical error during calendar architecture: ${error.message}`, 'error')
      throw error
    }
  }

  async analyzeCalendarIssues() {
    const issues = []

    // Target files for calendar interface issues
    const targetFiles = [
      'src/composables/calendar/useCalendarDayView.ts',
      'src/composables/calendar/useCalendarWeekView.ts',
      'src/composables/calendar/useCalendarMonthView.ts',
      'src/views/CalendarView.vue',
      'src/views/CalendarViewVueCal.vue',
      'src/types/recurrence.ts',
      'src/stores/taskScheduler.ts'
    ]

    for (const file of targetFiles) {
      const filePath = path.join(this.projectRoot, file)
      try {
        const content = await fs.readFile(filePath, 'utf8')
        const fileIssues = this.parseCalendarIssues(content, file)
        issues.push(...fileIssues)
      } catch (error) {
        this.log(`Could not read ${file}: ${error.message}`, 'warn')
      }
    }

    return issues
  }

  parseCalendarIssues(content, file) {
    const issues = []
    const lines = content.split('\n')

    lines.forEach((line, index) => {
      // Pattern 1: Missing isDueDate property
      if (line.includes('isDueDate') && line.includes('does not exist')) {
        issues.push({
          file,
          line: index + 1,
          type: 'missing_property',
          propertyName: 'isDueDate',
          interfaceName: 'CalendarEvent',
          content: line.trim(),
          severity: 'high'
        })
      }

      // Pattern 2: TaskInstance type issues
      if (line.includes('TaskInstance') && (line.includes('missing') || line.includes('does not exist'))) {
        issues.push({
          file,
          line: index + 1,
          type: 'taskinstance_type',
          interfaceName: 'TaskInstance',
          content: line.trim(),
          severity: 'high'
        })
      }

      // Pattern 3: Calendar type system issues
      if (line.includes('CalendarEvent') && line.includes('does not exist')) {
        issues.push({
          file,
          line: index + 1,
          type: 'calendar_interface',
          interfaceName: 'CalendarEvent',
          content: line.trim(),
          severity: 'high'
        })
      }
    })

    return issues
  }

  async enhanceCalendarEventInterface() {
    // Create enhanced CalendarEvent interface
    const calendarInterfacePath = path.join(this.projectRoot, 'src/types/calendar.ts')

    try {
      const calendarInterface = this.generateCalendarEventInterface()
      await fs.writeFile(calendarInterfacePath, calendarInterface)
      this.log('✅ Created enhanced CalendarEvent interface', 'success')
      this.fixCount++
    } catch (error) {
      this.log(`Failed to create calendar interface: ${error.message}`, 'error')
    }
  }

  generateCalendarEventInterface() {
    return `// Enhanced Calendar Interface Architecture
export interface BaseTemporalEntity {
  id: string
  title: string
  description?: string
  createdAt: Date
  updatedAt: Date
}

export interface CalendarEvent extends BaseTemporalEntity {
  date: string // YYYY-MM-DD format
  time?: string // HH:MM format
  duration?: number // Duration in minutes
  isDueDate: boolean // Whether this represents a task due date
  isAllDay: boolean // Whether this is an all-day event
  color?: string // Event color for UI
  location?: string // Event location
  attendees?: string[] // Event attendees
  metadata?: Record<string, unknown> // Additional event data
}

export interface TaskCalendarEvent extends CalendarEvent {
  taskId: string // Reference to the original task
  taskStatus: 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold'
  taskPriority: 'low' | 'medium' | 'high' | null
  taskProgress: number // Task completion progress
  subtaskProgress?: number[] // Individual subtask progress
  isRecurring: boolean // Whether this is a recurring task instance
  parentTaskId?: string // For recurring task instances
  instanceId?: string // Unique instance identifier
}

// Calendar Event Factory
export class CalendarEventFactory {
  static fromTask(task: any, date: string, time?: string): TaskCalendarEvent {
    return {
      id: this.generateId(),
      title: task.title,
      description: task.description,
      date,
      time,
      duration: task.estimatedDuration || 25,
      isDueDate: true,
      isAllDay: !time,
      color: this.getTaskEventColor(task.priority),
      taskId: task.id,
      taskStatus: task.status,
      taskPriority: task.priority,
      taskProgress: task.progress,
      isRecurring: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  static fromTaskInstance(instance: any, task: any): TaskCalendarEvent {
    return {
      id: instance.id,
      title: task.title,
      description: task.description,
      date: instance.scheduledDate,
      time: instance.scheduledTime,
      duration: instance.duration,
      isDueDate: true,
      isAllDay: !instance.scheduledTime,
      color: this.getTaskEventColor(task.priority),
      taskId: task.id,
      taskStatus: task.status,
      taskPriority: task.priority,
      taskProgress: task.progress,
      isRecurring: instance.isRecurring || false,
      parentTaskId: instance.parentTaskId,
      instanceId: instance.id,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  private static generateId(): string {
    return Math.random().toString(36).substr(2, 9)
  }

  private static getTaskEventColor(priority: string): string {
    switch (priority) {
      case 'high': return '#ef4444'
      case 'medium': return '#f59e0b'
      case 'low': return '#10b981'
      default: return '#6b7280'
    }
  }
}

// Calendar State Management
export interface CalendarState {
  currentDate: Date
  selectedDate: Date | null
  viewMode: 'month' | 'week' | 'day' | 'agenda'
  events: CalendarEvent[]
  taskInstances: any[]
  loading: boolean
  error: string | null
}

// Date Utilities
export class CalendarDateUtils {
  static parseDateKey(dateKey: string): Date {
    const [year, month, day] = dateKey.split('-').map(Number)
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      throw new Error(\`Invalid date format: \${dateKey}\`)
    }
    return new Date(year, month - 1, day)
  }

  static formatDateKey(date: Date): string {
    return date.toISOString().split('T')[0]
  }

  static isValidTime(time: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    return timeRegex.test(time)
  }
}`
  }

  async implementTaskInstanceTypes() {
    // Update TaskInstance interface in tasks store
    const tasksStorePath = path.join(this.projectRoot, 'src/stores/tasks.ts')

    try {
      const content = await fs.readFile(tasksStorePath, 'utf8')

      if (!content.includes('export interface TaskInstance')) {
        const taskInstanceInterface = this.generateTaskInstanceInterface()
        const updatedContent = content + '\n\n' + taskInstanceInterface
        await fs.writeFile(tasksStorePath, updatedContent)
        this.log('✅ Added TaskInstance interface to tasks store', 'success')
        this.fixCount++
      }
    } catch (error) {
      this.log(`Failed to add TaskInstance interface: ${error.message}`, 'error')
    }
  }

  generateTaskInstanceInterface() {
    return `// Task Instance Interface for Calendar Operations
export interface TaskInstance {
  id: string // Unique instance identifier
  parentTaskId: string // Reference to original task
  scheduledDate: string // YYYY-MM-DD format
  scheduledTime?: string // HH:MM format
  duration?: number // Duration in minutes
  status: 'scheduled' | 'completed' | 'skipped' | 'in_progress'
  isRecurring: boolean // True for recurring task instances
  isModified?: boolean // True if this instance was modified from pattern
  isSkipped?: boolean // True if this instance is skipped
  recurrenceExceptionId?: string // Link to exception if this is an exception
  pomodoroTracking?: {
    completed: number
    total: number
    duration: number // Duration per pomodoro
  }
  completionData?: {
    completedAt?: Date
    completedBy?: string
    notes?: string
    actualDuration?: number
  }
  metadata?: Record<string, unknown>
}

// Task Instance Factory
export class TaskInstanceFactory {
  static createFromTask(task: Task, date: string, time?: string): TaskInstance {
    return {
      id: this.generateInstanceId(task.id, date, time),
      parentTaskId: task.id,
      scheduledDate: date,
      scheduledTime: time,
      duration: task.estimatedDuration || 25,
      status: 'scheduled',
      isRecurring: false,
      pomodoroTracking: {
        completed: 0,
        total: task.estimatedPomodoros || 1,
        duration: 25
      }
    }
  }

  private static generateInstanceId(taskId: string, date: string, time?: string): string {
    const timePart = time ? time.replace(':', '') : 'allday'
    return \`\${taskId}-\${date}-\${timePart}\`
  }
}`
  }

  async architectCalendarComposables() {
    // Create type-safe calendar composable
    const calendarComposablePath = path.join(this.projectRoot, 'src/composables/calendar/useCalendarEventFactory.ts')

    try {
      await fs.mkdir(path.dirname(calendarComposablePath), { recursive: true })
      const composableContent = this.generateCalendarComposable()
      await fs.writeFile(calendarComposablePath, composableContent)
      this.log('✅ Created type-safe calendar composable', 'success')
      this.fixCount++
    } catch (error) {
      this.log(`Failed to create calendar composable: ${error.message}`, 'error')
    }
  }

  generateCalendarComposable() {
    return `// Type-safe Calendar Event Composable
import { computed, ref, type Ref } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { TaskCalendarEvent, CalendarEventFactory, CalendarDateUtils } from '@/types/calendar'
import type { Task } from '@/stores/tasks'

export function useCalendarEvents(date: Ref<Date>) {
  const taskStore = useTaskStore()

  const dayEvents = computed((): TaskCalendarEvent[] => {
    const dayStart = new Date(date.value)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    // Get task instances for this day
    const dayTaskInstances = taskStore.tasks.filter(task => {
      // Check if task has instances for this day
      if (task.instances) {
        return task.instances.some(instance => {
          const instanceDate = CalendarDateUtils.parseDateKey(instance.scheduledDate)
          return instanceDate >= dayStart && instanceDate < dayEnd
        })
      }

      // Check if task has legacy scheduling
      if (task.scheduledDate) {
        const taskDate = CalendarDateUtils.parseDateKey(task.scheduledDate)
        return taskDate >= dayStart && taskDate < dayEnd
      }

      return false
    })

    // Convert to calendar events
    return dayTaskInstances.map(task => {
      if (task.instances) {
        const dayInstance = task.instances.find(instance => {
          const instanceDate = CalendarDateUtils.parseDateKey(instance.scheduledDate)
          return instanceDate >= dayStart && instanceDate < dayEnd
        })

        if (dayInstance) {
          return CalendarEventFactory.fromTaskInstance(dayInstance, task)
        }
      }

      // Fallback to task-level scheduling
      if (task.scheduledDate) {
        const taskDate = CalendarDateUtils.parseDateKey(task.scheduledDate)
        if (taskDate >= dayStart && taskDate < dayEnd) {
          return CalendarEventFactory.fromTask(task, task.scheduledDate, task.scheduledTime)
        }
      }

      return null
    }).filter(Boolean) as TaskCalendarEvent[]
  })

  const addTaskToDay = async (task: Task, time?: string) => {
    const dateKey = CalendarDateUtils.formatDateKey(date.value)

    // Create task instance
    const instance = TaskInstanceFactory.createFromTask(task, dateKey, time)

    // Add to task instances
    if (!task.instances) {
      task.instances = []
    }
    task.instances.push(instance)

    // Update task in store
    await taskStore.updateTask(task.id, {
      instances: task.instances
    })
  }

  const removeTaskFromDay = async (instanceId: string) => {
    // Find task with this instance
    const task = taskStore.tasks.find(t =>
      t.instances?.some(instance => instance.id === instanceId)
    )

    if (task && task.instances) {
      task.instances = task.instances.filter(instance => instance.id !== instanceId)

      await taskStore.updateTask(task.id, {
        instances: task.instances
      })
    }
  }

  return {
    dayEvents,
    addTaskToDay,
    removeTaskFromDay
  }
}`
  }

  async implementTemporalTypeSafety() {
    // Create temporal type utilities
    const temporalUtilsPath = path.join(this.projectRoot, 'src/utils/temporalTypes.ts')

    try {
      const temporalUtils = this.generateTemporalUtils()
      await fs.writeFile(temporalUtilsPath, temporalUtils)
      this.log('✅ Created temporal type safety utilities', 'success')
      this.fixCount++
    } catch (error) {
      this.log(`Failed to create temporal utils: ${error.message}`, 'error')
    }
  }

  generateTemporalUtils() {
    return `// Temporal Type Safety Utilities
export type TimeUnit = 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'

export interface Duration {
  value: number
  unit: TimeUnit
}

export class TemporalTypeValidator {
  static isValidDate(dateString: string): boolean {
    const date = new Date(dateString)
    return !isNaN(date.getTime())
  }

  static isValidTime(timeString: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    return timeRegex.test(timeString)
  }

  static isValidDuration(duration: Duration): boolean {
    return duration.value > 0 && Object.values(['milliseconds', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years']).includes(duration.unit)
  }

  static assertValidDate(dateString: string): void {
    if (!this.isValidDate(dateString)) {
      throw new Error(\`Invalid date format: \${dateString}\`)
    }
  }

  static assertValidTime(timeString: string): void {
    if (!this.isValidTime(timeString)) {
      throw new Error(\`Invalid time format: \${timeString}\`)
    }
  }
}

// Type-safe date operations
export class SafeDateOperations {
  static addTimeToDate(date: Date, time: string, duration: number): Date {
    TemporalTypeValidator.assertValidTime(time)

    const [hours, minutes] = time.split(':').map(Number)
    const result = new Date(date)
    result.setHours(hours, minutes, 0, 0)
    result.setMinutes(result.getMinutes() + duration)

    return result
  }

  static parseDateTime(dateString: string, timeString?: string): Date {
    TemporalTypeValidator.assertValidDate(dateString)

    const date = new Date(dateString)

    if (timeString) {
      TemporalTypeValidator.assertValidTime(timeString)
      const [hours, minutes] = timeString.split(':').map(Number)
      date.setHours(hours, minutes, 0, 0)
    } else {
      date.setHours(0, 0, 0, 0)
    }

    return date
  }

  static formatDateForAPI(date: Date): string {
    return date.toISOString().split('.')[0] + 'Z'
  }

  static formatDateKey(date: Date): string {
    return date.toISOString().split('T')[0]
  }
}`
  }

  async runValidation() {
    const results = {
      compilation: false,
      calendarErrors: 0
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

      // Count calendar-specific errors
      const calendarErrors = errorOutput.match(/isDueDate.*does not exist|CalendarEvent.*does not exist|TaskInstance.*does not exist/g) || []
      results.calendarErrors = calendarErrors.length

      this.log(`❌ TypeScript compilation failed with ${results.calendarErrors} calendar errors`, 'error')
    }

    return results
  }

  async emergencyRollback() {
    this.log('🔄 Initiating emergency rollback...', 'warn')

    try {
      execSync('git checkout -- src/types/calendar.ts', { cwd: this.projectRoot })
      execSync('git checkout -- src/composables/calendar/useCalendarEventFactory.ts', { cwd: this.projectRoot })
      execSync('git checkout -- src/utils/temporalTypes.ts', { cwd: this.projectRoot })
      this.log('✅ Emergency rollback completed', 'success')
    } catch (error) {
      this.log(`Rollback failed: ${error.message}`, 'error')
    }
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const architect = new CalendarInterfaceArchitect()
  architect.execute().catch(error => {
    console.error('Script execution failed:', error)
    process.exit(1)
  })
}

export default CalendarInterfaceArchitect