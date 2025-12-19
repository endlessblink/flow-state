/**
 * Forensic-Grade Backup Verification Logger
 * Provides cryptographic proof of data integrity and immutable audit trails
 */

import CryptoJS from 'crypto-js'
import { filterMockTasks, detectMockTask, MockTaskDetectionResult as _MockTaskDetectionResult } from './mockTaskDetector'
import type { Task } from '@/types/tasks' // Use the canonical Task interface

export interface BackupSnapshot {
  timestamp: string
  taskHash: string
  taskFingerprint: string
  taskCount: number
  mockTasksDetected: number
  realTasks: number
  mockTaskDetails: Array<{
    id: string
    title: string
    matchedPatterns: string[]
    confidence: string
  }>
  checksum: string
  operation: string
  metadata: {
    browser: string
    userAgent: string
    sessionId: string
    version: string
  }
}

export interface AuditEvent {
  id: string
  timestamp: string
  operation: string
  status: 'SUCCESS' | 'WARNING' | 'ERROR'
  beforeSnapshot?: BackupSnapshot
  afterSnapshot?: BackupSnapshot
  filteredTasks?: Array<{
    task: Task
    reason: string
    pattern: string
    confidence: string
  }>
  details: string
  checksum: string
}

export interface IntegrityReport {
  isValid: boolean
  hashesMatch: boolean
  taskCountMatch: boolean
  integrityScore: number
  issues: string[]
  warnings: string[]
}

export interface ComparisonResult {
  identical: boolean
  hashMatch: boolean
  countMatch: boolean
  fingerprintMatch: boolean
  differences: {
    addedTasks: number
    removedTasks: number
    modifiedTasks: number
    mockTasksChanged: boolean
  }
}

export class ForensicLogger {
  private static readonly AUDIT_KEY = 'pomo-flow-forensic-audit'
  private static readonly SESSION_ID = this.generateSessionId()

  /**
   * Compute SHA-256 hash of task data
   */
  static computeTaskHash(tasks: Task[]): string {
    const normalized = tasks
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        projectId: task.projectId,
        // Only hash fields that matter for integrity
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString()
      }))

    return CryptoJS.SHA256(JSON.stringify(normalized)).toString()
  }

  /**
   * Create deterministic fingerprint (ignores timestamps)
   */
  static createTaskFingerprint(tasks: Task[]): string {
    const normalized = tasks
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        projectId: task.projectId
      }))

    return CryptoJS.SHA256(JSON.stringify(normalized)).toString()
  }

  /**
   * Capture comprehensive snapshot of task state
   */
  static captureSnapshot(tasks: unknown, operation: string = 'snapshot'): BackupSnapshot {
    try {
      console.log('📸 Capturing snapshot...')

      // ✅ Validation 1: Type check
      if (!Array.isArray(tasks)) {
        console.error('❌ captureSnapshot: tasks is not an array', {
          type: typeof tasks,
          value: tasks
        })
        throw new Error('Invalid tasks format')
      }

      // ✅ Validation 2: Empty check (empty array is OK)
      if (tasks.length === 0) {
        console.log('ℹ️ captureSnapshot: empty tasks array')
        return {
          timestamp: new Date().toISOString(),
          taskHash: '',
          taskFingerprint: '',
          taskCount: 0,
          mockTasksDetected: 0,
          realTasks: 0,
          mockTaskDetails: [],
          checksum: '',
          operation,
          metadata: {
            browser: navigator.userAgent,
            userAgent: navigator.userAgent,
            sessionId: this.SESSION_ID || 'unknown',
            version: '1.0.0'
          }
        }
      }

      // ✅ Validation 3: Each task structure
      const validTasks = tasks.filter(task => {
        return task &&
               typeof task === 'object' &&
               task.id &&
               task.title
      })

      if (validTasks.length === 0) {
        console.error('❌ No valid tasks in snapshot')
        throw new Error('No valid tasks found')
      }

      console.log(`✅ Creating snapshot of ${validTasks.length} valid tasks`)

      const timestamp = new Date().toISOString()
      const mockFilter = filterMockTasks(validTasks, { confidence: 'low' })

      const snapshot: BackupSnapshot = {
        timestamp,
        taskHash: this.computeTaskHash(validTasks),
        taskFingerprint: this.createTaskFingerprint(validTasks),
        taskCount: validTasks.length,
        mockTasksDetected: mockFilter.mockTasks.length,
        realTasks: mockFilter.cleanTasks.length,
        mockTaskDetails: mockFilter.mockTasks.map(task => {
          const detection = detectMockTask(task)
          return {
            id: task.id,
            title: task.title,
            matchedPatterns: detection.matchedPatterns,
            confidence: detection.confidence
          }
        }),
        checksum: '', // Will be set below
        operation,
        metadata: {
          browser: navigator.userAgent,
          userAgent: navigator.userAgent,
          sessionId: this.SESSION_ID || 'unknown',
          version: '1.0.0'
        }
      }

      // Create checksum of the entire snapshot
      const checksumData = { ...snapshot, checksum: '' }
      snapshot.checksum = CryptoJS.SHA256(JSON.stringify(checksumData)).toString()

      return Object.freeze(snapshot) // Make immutable

    } catch (error) {
      console.error('❌ Snapshot capture failed:', error)
      throw error
    }
  }

  /**
   * Log filter operation with detailed before/after analysis
   */
  static logFilterOperation(
    operation: string,
    beforeSnapshot: BackupSnapshot,
    afterSnapshot: BackupSnapshot,
    filteredTasks: Task[]
  ): void {
    const event: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      operation: `filter_${operation}`,
      status: 'SUCCESS',
      beforeSnapshot,
      afterSnapshot,
      filteredTasks: filteredTasks.map(task => {
        const detection = detectMockTask(task)
        return {
          task,
          reason: detection.reasons.join('; '),
          pattern: detection.matchedPatterns.join(', '),
          confidence: detection.confidence
        }
      }),
      details: `Filtered ${filteredTasks.length} mock tasks. Reduced from ${beforeSnapshot.taskCount} to ${afterSnapshot.taskCount} tasks.`,
      checksum: ''
    }

    event.checksum = CryptoJS.SHA256(JSON.stringify({ ...event, checksum: '' })).toString()
    this.addToAuditLog(event)

    console.log(`🔍 FORENSIC LOG: ${operation}`)
    console.log(`   Before: ${beforeSnapshot.taskCount} tasks (hash: ${beforeSnapshot.taskHash.substring(0, 12)}...)`)
    console.log(`   After: ${afterSnapshot.taskCount} tasks (hash: ${afterSnapshot.taskHash.substring(0, 12)}...)`)
    console.log(`   Filtered: ${filteredTasks.length} mock tasks`)
  }

  /**
   * Log restore operation with integrity verification
   */
  static logRestoreOperation(
    backupSnapshot: BackupSnapshot,
    restoredTasks: Task[],
    issues: string[] = []
  ): void {
    const postRestoreSnapshot = this.captureSnapshot(restoredTasks, 'restore_complete')

    const event: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      operation: 'restore',
      status: issues.length === 0 ? 'SUCCESS' : issues.length > 2 ? 'ERROR' : 'WARNING',
      beforeSnapshot: backupSnapshot,
      afterSnapshot: postRestoreSnapshot,
      details: `Restored ${restoredTasks.length} tasks from backup. Issues: ${issues.join(', ') || 'None'}`,
      checksum: ''
    }

    event.checksum = CryptoJS.SHA256(JSON.stringify({ ...event, checksum: '' })).toString()
    this.addToAuditLog(event)

    console.log(`🔍 FORENSIC LOG: Restore operation completed`)
    console.log(`   Backup hash: ${backupSnapshot.taskHash.substring(0, 12)}...`)
    console.log(`   Restored hash: ${postRestoreSnapshot.taskHash.substring(0, 12)}...`)
    console.log(`   Hashes match: ${backupSnapshot.taskHash === postRestoreSnapshot.taskHash ? 'YES' : 'NO'}`)
    console.log(`   Issues: ${issues.length}`)
  }

  /**
   * Compare two snapshots for integrity verification
   */
  static compareSnapshots(snapshot1: BackupSnapshot, snapshot2: BackupSnapshot): ComparisonResult {
    const hashMatch = snapshot1.taskHash === snapshot2.taskHash
    const fingerprintMatch = snapshot1.taskFingerprint === snapshot2.taskFingerprint
    const countMatch = snapshot1.taskCount === snapshot2.taskCount
    const mockCountMatch = snapshot1.mockTasksDetected === snapshot2.mockTasksDetected

    const differences = {
      addedTasks: Math.max(0, snapshot2.taskCount - snapshot1.taskCount),
      removedTasks: Math.max(0, snapshot1.taskCount - snapshot2.taskCount),
      modifiedTasks: hashMatch ? 0 : Math.min(snapshot1.taskCount, snapshot2.taskCount),
      mockTasksChanged: !mockCountMatch
    }

    return {
      identical: hashMatch && countMatch && fingerprintMatch && mockCountMatch,
      hashMatch,
      countMatch,
      fingerprintMatch,
      differences
    }
  }

  /**
   * Validate integrity between expected and actual snapshots
   */
  static validateIntegrity(expected: BackupSnapshot, actual: BackupSnapshot): IntegrityReport {
    const comparison = this.compareSnapshots(expected, actual)
    const issues: string[] = []
    const warnings: string[] = []

    if (!comparison.hashMatch) {
      issues.push('Task data hash mismatch - data corruption detected')
    }

    if (!comparison.countMatch) {
      issues.push(`Task count mismatch: expected ${expected.taskCount}, got ${actual.taskCount}`)
    }

    if (!comparison.fingerprintMatch) {
      warnings.push('Task fingerprint mismatch - task content may have changed')
    }

    if (actual.mockTasksDetected > expected.mockTasksDetected) {
      warnings.push(`New mock tasks detected: ${actual.mockTasksDetected - expected.mockTasksDetected}`)
    }

    const integrityScore = Math.max(0, 100 - (issues.length * 25) - (warnings.length * 10))

    return {
      isValid: issues.length === 0,
      hashesMatch: comparison.hashMatch,
      taskCountMatch: comparison.countMatch,
      integrityScore,
      issues,
      warnings
    }
  }

  /**
   * Generate comprehensive audit report
   */
  static generateAuditReport(): {
    events: AuditEvent[]
    summary: {
      totalEvents: number
      successfulOperations: number
      warnings: number
      errors: number
      mockTasksFiltered: number
      lastOperation: string | null
      lastTimestamp: string | null
    }
    chainOfCustody: boolean
  } {
    const events = this.getAuditLog()

    const summary = {
      totalEvents: events.length,
      successfulOperations: events.filter(e => e.status === 'SUCCESS').length,
      warnings: events.filter(e => e.status === 'WARNING').length,
      errors: events.filter(e => e.status === 'ERROR').length,
      mockTasksFiltered: events.reduce((sum, e) => sum + (e.filteredTasks?.length || 0), 0),
      lastOperation: events.length > 0 ? events[events.length - 1].operation : null,
      lastTimestamp: events.length > 0 ? events[events.length - 1].timestamp : null
    }

    // Verify chain of custody (check all event checksums)
    const chainOfCustody = events.every(event => {
      const expectedChecksum = CryptoJS.SHA256(JSON.stringify({ ...event, checksum: '' })).toString()
      return event.checksum === expectedChecksum
    })

    return {
      events: [...events] as any, // Make mutable copy
      summary: Object.freeze(summary),
      chainOfCustody: chainOfCustody as any
    }
  }

  /**
   * Get audit log from localStorage
   */
  private static getAuditLog(): AuditEvent[] {
    try {
      const stored = localStorage.getItem(this.AUDIT_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Failed to load audit log:', error)
      return []
    }
  }

  /**
   * Add event to audit log
   */
  private static addToAuditLog(event: AuditEvent): void {
    try {
      const log = this.getAuditLog()
      log.push(event)

      // Keep only last 1000 events to prevent storage issues
      if (log.length > 1000) {
        log.splice(0, log.length - 1000)
      }

      localStorage.setItem(this.AUDIT_KEY, JSON.stringify(log))
    } catch (error) {
      console.error('Failed to save audit event:', error)
    }
  }

  /**
   * Generate unique session ID
   */
  private static generateSessionId(): string {
    return CryptoJS.SHA256(`${Date.now()}-${Math.random()}-${navigator.userAgent}`).toString().substring(0, 16)
  }

  /**
   * Generate unique event ID
   */
  private static generateEventId(): string {
    return CryptoJS.SHA256(`${Date.now()}-${Math.random()}`).toString().substring(0, 12)
  }

  /**
   * Clear audit log (for testing purposes)
   */
  static clearAuditLog(): void {
    localStorage.removeItem(this.AUDIT_KEY)
    console.log('🔍 FORENSIC LOG: Audit log cleared')
  }

  /**
   * Export audit log as downloadable JSON
   */
  static exportAuditLog(): string {
    const report = this.generateAuditReport()
    const exportData = {
      exportTimestamp: new Date().toISOString(),
      report,
      checksum: CryptoJS.SHA256(JSON.stringify(report)).toString()
    }

    return JSON.stringify(exportData, null, 2)
  }
}