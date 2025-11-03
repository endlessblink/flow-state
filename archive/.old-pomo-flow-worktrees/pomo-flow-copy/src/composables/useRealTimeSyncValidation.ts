/**
 * Real-time Sync Validation Monitoring System
 *
 * Provides cross-view consistency monitoring with immediate mismatch detection
 * and visual validation indicators for task filtering synchronization issues.
 */

import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { Task } from '@/types/task'
import { useUnifiedTaskFilter, FILTER_PRESETS, type FilterConfig } from './useUnifiedTaskFilter'
import { useTaskInvariantValidation, type InvariantViolation, type ValidationReport } from './useTaskInvariantValidation'

export interface SyncSnapshot {
  timestamp: Date
  viewName: string
  filterConfig: FilterConfig
  taskCount: number
  taskIds: string[]
  debugInfo: any
}

export interface SyncMismatch {
  id: string
  timestamp: Date
  severity: 'error' | 'warning' | 'info'
  type: 'count_mismatch' | 'task_missing' | 'logic_violation' | 'filter_inconsistency'
  message: string
  affectedViews: string[]
  expectedValue: any
  actualValue: any
  details: {
    snapshots: SyncSnapshot[]
    invariants: InvariantViolation[]
    resolution?: string
  }
}

export interface ValidationState {
  isMonitoring: boolean
  lastValidation: Date | null
  totalMismatches: number
  errorCount: number
  warningCount: number
  infoCount: number
}

export interface RealTimeValidationConfig {
  enabled?: boolean
  monitoringInterval?: number // milliseconds
  maxHistorySize?: number
  strictMode?: boolean
  enableAutoHealing?: boolean
  visualFeedback?: boolean
  logToConsole?: boolean
  monitoredViews?: Array<{
    name: string
    filterConfig: FilterConfig
    priority: 'high' | 'medium' | 'low'
  }>
}

/**
 * Real-time cross-view consistency monitoring
 */
export const useRealTimeSyncValidation = (
  tasks: Parameters<typeof useUnifiedTaskFilter>[0],
  config: RealTimeValidationConfig = {}
) => {
  const {
    enabled = process.env.NODE_ENV === 'development',
    monitoringInterval = 2000, // 2 seconds
    maxHistorySize = 50,
    strictMode = false,
    enableAutoHealing = false,
    visualFeedback = true,
    logToConsole = true,
    monitoredViews = [
      { name: 'Board', filterConfig: FILTER_PRESETS.BOARD, priority: 'high' },
      { name: 'Today', filterConfig: FILTER_PRESETS.TODAY, priority: 'high' },
      { name: 'Inbox', filterConfig: FILTER_PRESETS.INBOX, priority: 'medium' },
      { name: 'Canvas', filterConfig: FILTER_PRESETS.CANVAS, priority: 'medium' }
    ]
  } = config

  // State management
  const isMonitoring = ref(false)
  const snapshots = ref<SyncSnapshot[]>([])
  const mismatches = ref<SyncMismatch[]>([])
  const validationState = ref<ValidationState>({
    isMonitoring: false,
    lastValidation: null,
    totalMismatches: 0,
    errorCount: 0,
    warningCount: 0,
    infoCount: 0
  })

  // Interval handle for cleanup
  let monitoringIntervalHandle: any = null

  // Invariant validation integration
  const invariantValidation = useTaskInvariantValidation(tasks, {
    enabled,
    strictMode,
    logViolations: logToConsole
  })

  /**
   * Capture snapshot of current view state
   */
  const captureSnapshot = (viewName: string, filterConfig: FilterConfig): SyncSnapshot => {
    // Safety check for tasks parameter
    if (!tasks) {
      console.debug('🔍 [SYNC_VALIDATION] Cannot capture snapshot, tasks is undefined')
      return {
        timestamp: new Date(),
        viewName,
        filterConfig: { ...filterConfig },
        taskCount: 0,
        taskIds: [],
        debugInfo: {
          original: 0,
          afterProject: 0,
          afterSmartView: 0,
          afterStatus: 0,
          afterTime: 0,
          afterHideDone: 0,
          afterLocation: 0,
          final: 0,
          filters: ['UNDEFINED_TASKS']
        }
      }
    }

    const filterResult = useUnifiedTaskFilter(tasks, filterConfig)

    // Safety check for filter result
    if (!filterResult?.value?.tasks) {
      console.debug('🔍 [SYNC_VALIDATION] Filter result is invalid, returning empty snapshot')
      return {
        timestamp: new Date(),
        viewName,
        filterConfig: { ...filterConfig },
        taskCount: 0,
        taskIds: [],
        debugInfo: {
          original: 0,
          afterProject: 0,
          afterSmartView: 0,
          afterStatus: 0,
          afterTime: 0,
          afterHideDone: 0,
          afterLocation: 0,
          final: 0,
          filters: ['INVALID_FILTER_RESULT']
        }
      }
    }

    return {
      timestamp: new Date(),
      viewName,
      filterConfig: { ...filterConfig },
      taskCount: filterResult.value?.tasks?.length || 0,
      taskIds: filterResult.value?.tasks?.map(task => task.id) || [],
      debugInfo: filterResult.value?.debug || {
        original: 0,
        afterProject: 0,
        afterSmartView: 0,
        afterStatus: 0,
        afterTime: 0,
        afterHideDone: 0,
        afterLocation: 0,
        final: 0,
        filters: ['FALLBACK_DEBUG']
      }
    }
  }

  /**
   * Analyze snapshots for consistency issues
   */
  const analyzeConsistency = (): SyncMismatch[] => {
    const issues: SyncMismatch[] = []

    // Safety check for snapshots
    if (!snapshots?.value) {
      console.warn('⚠️ [SYNC_VALIDATION] snapshots.value is undefined, returning empty issues')
      return issues
    }

    const currentSnapshots = snapshots.value.slice(-monitoredViews.length)

    if (currentSnapshots.length < 2) return issues

    // Sort by timestamp to ensure chronological order
    currentSnapshots.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    const boardSnapshot = currentSnapshots.find(s => s.viewName === 'Board')
    const todaySnapshot = currentSnapshots.find(s => s.viewName === 'Today')
    const inboxSnapshot = currentSnapshots.find(s => s.viewName === 'Inbox')
    const canvasSnapshot = currentSnapshots.find(s => s.viewName === 'Canvas')

    // 1. Board vs Today consistency
    if (boardSnapshot && todaySnapshot) {
      if (todaySnapshot.taskCount > boardSnapshot.taskCount) {
        issues.push(createMismatch(
          'count_mismatch',
          'Today tasks exceed total board tasks',
          ['Board', 'Today'],
          `<= ${boardSnapshot.taskCount}`,
          todaySnapshot.taskCount,
          'error',
          [boardSnapshot, todaySnapshot]
        ))
      }
    }

    // 2. Board vs Inbox consistency
    if (boardSnapshot && inboxSnapshot && boardSnapshot.taskCount !== undefined && inboxSnapshot.taskCount !== undefined) {
      if (inboxSnapshot.taskCount > boardSnapshot.taskCount) {
        issues.push(createMismatch(
          'count_mismatch',
          'Inbox tasks exceed total board tasks',
          ['Board', 'Inbox'],
          `<= ${boardSnapshot.taskCount}`,
          inboxSnapshot.taskCount,
          'error',
          [boardSnapshot, inboxSnapshot]
        ))
      }
    }

    // 3. Subset validation: Today tasks should be subset of Board tasks
    if (boardSnapshot && todaySnapshot) {
      const todayTaskIds = new Set(todaySnapshot.taskIds)
      const boardTaskIds = new Set(boardSnapshot.taskIds)
      const invalidTodayTasks = Array.from(todayTaskIds).filter(id => !boardTaskIds.has(id))

      if (invalidTodayTasks.length > 0) {
        issues.push(createMismatch(
          'task_missing',
          `Today view contains tasks not in Board view: ${invalidTodayTasks.length} tasks`,
          ['Board', 'Today'],
          'All today tasks should exist in board',
          `${invalidTodayTasks.length} missing tasks`,
          'error',
          [boardSnapshot, todaySnapshot]
        ))
      }
    }

    // 4. Logical consistency: Hide Done filtering
    const boardHideDoneSnapshot = currentSnapshots.find(s =>
      s.viewName === 'Board' && s.filterConfig.hideDone
    )
    const boardSnapshotNoFilter = currentSnapshots.find(s =>
      s.viewName === 'Board' && !s.filterConfig.hideDone
    )

    if (boardSnapshotNoFilter && boardHideDoneSnapshot) {
      const doneTaskCount = boardSnapshotNoFilter.taskCount - boardHideDoneSnapshot.taskCount
      if (doneTaskCount < 0) {
        issues.push(createMismatch(
          'logic_violation',
          'Hide Done filter resulted in more tasks than total',
          ['Board'],
          'Non-negative count of hidden tasks',
          `${doneTaskCount} (negative)`,
          'warning',
          [boardSnapshotNoFilter, boardHideDoneSnapshot]
        ))
      }
    }

    // 5. Canvas consistency check
    if (canvasSnapshot && boardSnapshot) {
      // Canvas tasks should be subset of board tasks (excluding inbox-only tasks)
      const canvasTaskIds = new Set(canvasSnapshot.taskIds)
      const boardTaskIds = new Set(boardSnapshot.taskIds)
      const orphanCanvasTasks = Array.from(canvasTaskIds).filter(id => !boardTaskIds.has(id))

      if (orphanCanvasTasks.length > 0) {
        issues.push(createMismatch(
          'task_missing',
          `Canvas contains tasks not in Board view: ${orphanCanvasTasks.length} tasks`,
          ['Board', 'Canvas'],
          'All canvas tasks should exist in board',
          `${orphanCanvasTasks.length} orphan tasks`,
          'warning',
          [boardSnapshot, canvasSnapshot]
        ))
      }
    }

    return issues
  }

  /**
   * Create standardized mismatch object
   */
  const createMismatch = (
    type: SyncMismatch['type'],
    message: string,
    affectedViews: string[],
    expectedValue: any,
    actualValue: any,
    severity: SyncMismatch['severity'],
    snapshots: SyncSnapshot[]
  ): SyncMismatch => {
    return {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      severity,
      type,
      message,
      affectedViews,
      expectedValue,
      actualValue,
      details: {
        snapshots,
        invariants: invariantValidation.validationReport.value.violations,
        resolution: getResolutionSuggestion(type, message)
      }
    }
  }

  /**
   * Get resolution suggestions for common issues
   */
  const getResolutionSuggestion = (type: SyncMismatch['type'], message: string): string => {
    const suggestions: Record<string, string> = {
      'count_mismatch': 'Check filter logic and ensure proper subset relationships',
      'task_missing': 'Verify task filtering conditions and data consistency',
      'logic_violation': 'Review filter implementation and logical operators',
      'filter_inconsistency': 'Ensure filter configurations are consistent across views'
    }
    return suggestions[type] || 'Investigate filtering logic and data consistency'
  }

  /**
   * Perform validation cycle
   */
  const performValidation = (): void => {
    if (!enabled || !isMonitoring.value) return

    // Enhanced safety checks for reactive references
    if (!tasks) {
      console.debug('🔍 [SYNC_VALIDATION] Tasks parameter is undefined, skipping validation')
      return
    }

    const baseTasks = Array.isArray(tasks) ? tasks : (tasks?.value !== undefined ? tasks.value : null)

    if (!baseTasks || baseTasks.length === 0) {
      console.debug('🔍 [SYNC_VALIDATION] No tasks available for validation')
      return
    }

    try {
      // Capture snapshots for all monitored views
      const newSnapshots: SyncSnapshot[] = []
      monitoredViews.forEach(view => {
        const snapshot = captureSnapshot(view.name, view.filterConfig)
        newSnapshots.push(snapshot)
      })

      // Add to history (maintain size limit)
      snapshots.value.push(...newSnapshots)
      if (snapshots.value.length > maxHistorySize) {
        snapshots.value = snapshots.value.slice(-maxHistorySize)
      }

      // Analyze for consistency issues
      const newMismatches = analyzeConsistency()

      // Filter out duplicates and add new mismatches
      const existingMismatchIds = new Set(mismatches.value.map(m => m.id))
      const uniqueNewMismatches = newMismatches.filter(m => !existingMismatchIds.has(m.id))

      mismatches.value.push(...uniqueNewMismatches)

      // Update validation state
      validationState.value = {
        isMonitoring: true,
        lastValidation: new Date(),
        totalMismatches: mismatches.value.length,
        errorCount: mismatches.value.filter(m => m.severity === 'error').length,
        warningCount: mismatches.value.filter(m => m.severity === 'warning').length,
        infoCount: mismatches.value.filter(m => m.severity === 'info').length
      }

      // Log new mismatches
      if (logToConsole && uniqueNewMismatches.length > 0) {
        console.group(`🚨 [SYNC_VALIDATION] ${uniqueNewMismatches.length} new consistency issues detected:`)
        uniqueNewMismatches.forEach((mismatch, index) => {
          console.error(`${index + 1}. ${mismatch.type.toUpperCase()}: ${mismatch.message}`)
          console.error(`   Affected Views: ${mismatch.affectedViews.join(', ')}`)
          console.error(`   Expected: ${mismatch.expectedValue}`)
          console.error(`   Actual: ${mismatch.actualValue}`)
          console.error(`   Suggestion: ${mismatch.details.resolution}`)
          console.error('---')
        })
        console.groupEnd()
      }

    } catch (error) {
      console.error('❌ [SYNC_VALIDATION] Error during validation cycle:', error)
    }
  }

  /**
   * Start monitoring
   */
  const startMonitoring = (): void => {
    if (isMonitoring.value || !enabled) return

    isMonitoring.value = true
    validationState.value.isMonitoring = true

    // Perform initial validation
    performValidation()

    // Set up interval monitoring
    monitoringIntervalHandle = setInterval(performValidation, monitoringInterval)

    if (logToConsole) {
      console.log(`✅ [SYNC_VALIDATION] Real-time monitoring started (interval: ${monitoringInterval}ms)`)
    }
  }

  /**
   * Stop monitoring
   */
  const stopMonitoring = (): void => {
    if (!isMonitoring.value) return

    isMonitoring.value = false
    validationState.value.isMonitoring = false

    if (monitoringIntervalHandle) {
      clearInterval(monitoringIntervalHandle)
      monitoringIntervalHandle = null
    }

    if (logToConsole) {
      console.log('⏹️ [SYNC_VALIDATION] Real-time monitoring stopped')
    }
  }

  /**
   * Clear validation history
   */
  const clearHistory = (): void => {
    snapshots.value = []
    mismatches.value = []
    validationState.value = {
      ...validationState.value,
      totalMismatches: 0,
      errorCount: 0,
      warningCount: 0,
      infoCount: 0
    }

    if (logToConsole) {
      console.log('🗑️ [SYNC_VALIDATION] Validation history cleared')
    }
  }

  /**
   * Get latest mismatches by severity
   */
  const getLatestMismatches = (severity?: SyncMismatch['severity'], limit: number = 10): SyncMismatch[] => {
    let filtered = mismatches.value
    if (severity) {
      filtered = filtered.filter(m => m.severity === severity)
    }
    return filtered
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  }

  /**
   * Get validation summary for visual indicators
   */
  const getValidationSummary = computed(() => {
    const hasErrors = validationState.value.errorCount > 0
    const hasWarnings = validationState.value.warningCount > 0
    const hasIssues = validationState.value.totalMismatches > 0

    return {
      status: hasErrors ? 'error' : hasWarnings ? 'warning' : hasIssues ? 'info' : 'success',
      isHealthy: !hasErrors && !hasWarnings,
      message: hasErrors
        ? `${validationState.value.errorCount} error${validationState.value.errorCount > 1 ? 's' : ''} detected`
        : hasWarnings
          ? `${validationState.value.warningCount} warning${validationState.value.warningCount > 1 ? 's' : ''} detected`
          : hasIssues
            ? `${validationState.value.totalMismatches} issue${validationState.value.totalMismatches > 1 ? 's' : ''} detected`
            : 'All views synchronized',
      color: hasErrors ? '#ef4444' : hasWarnings ? '#f59e0b' : hasIssues ? '#3b82f6' : '#10b981',
      icon: hasErrors ? '⚠️' : hasWarnings ? '⚡' : hasIssues ? 'ℹ️' : '✅'
    }
  })

  /**
   * Watch for task changes and trigger validation
   */
  const taskWatcher = watch(
    () => Array.isArray(tasks) ? tasks.length : tasks.value?.length || 0,
    () => {
      if (isMonitoring.value) {
        // Debounce rapid changes
        setTimeout(performValidation, 100)
      }
    },
    { immediate: false }
  )

  // Lifecycle management
  onMounted(() => {
    if (enabled) {
      startMonitoring()
    }
  })

  onUnmounted(() => {
    stopMonitoring()
    taskWatcher()
  })

  return {
    // State
    isMonitoring: computed(() => isMonitoring.value),
    snapshots: computed(() => snapshots.value),
    mismatches: computed(() => mismatches.value),
    validationState: computed(() => validationState.value),
    validationSummary: getValidationSummary,

    // Invariant validation integration
    invariants: invariantValidation.validationReport,
    isValid: computed(() => invariantValidation.isValid.value && validationState.value.errorCount === 0),

    // Actions
    startMonitoring,
    stopMonitoring,
    clearHistory,
    performValidation,
    captureSnapshot,

    // Utilities
    getLatestMismatches,
    getMismatchesByView: (viewName: string) => mismatches.value.filter(m => m.affectedViews.includes(viewName)),
    getMismatchesByType: (type: SyncMismatch['type']) => mismatches.value.filter(m => m.type === type)
  }
}

/**
 * Create a global sync validation instance for app-wide monitoring
 */
export const createGlobalSyncValidation = (
  tasks: Parameters<typeof useUnifiedTaskFilter>[0],
  options?: RealTimeValidationConfig
) => {
  return useRealTimeSyncValidation(tasks, {
    ...options,
    monitoringInterval: 3000, // 3 seconds for global monitoring
    maxHistorySize: 100,
    logToConsole: true,
    visualFeedback: true
  })
}