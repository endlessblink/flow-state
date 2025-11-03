/**
 * Task Invariant Validation
 *
 * Development-mode assertions for task count consistency validation.
 * Prevents regressions in the unified filtering system by catching
 * counting mismatches early with detailed debugging information.
 */

import { computed, watch } from 'vue'
import type { Task } from '@/stores/tasks'
import { useUnifiedTaskFilter, FILTER_PRESETS, type FilterConfig } from './useUnifiedTaskFilter'

export interface InvariantViolation {
  type: 'count_mismatch' | 'subset_violation' | 'dependency_inconsistency'
  severity: 'error' | 'warning' | 'info'
  message: string
  expected: any
  actual: any
  context: {
    filterType: string
    timestamp: Date
    rawCounts: Record<string, number>
    filterDetails?: any
  }
}

export interface ValidationReport {
  isValid: boolean
  violations: InvariantViolation[]
  timestamp: Date
  totalTasks: number
}

/**
 * Development-mode invariant validation for task counting consistency
 */
export const useTaskInvariantValidation = (
  tasks: Parameters<typeof useUnifiedTaskFilter>[0],
  options: {
    enabled?: boolean
    strictMode?: boolean
    logViolations?: boolean
    throwOnErrors?: boolean
  } = {}
) => {
  const {
    enabled = process.env.NODE_ENV === 'development',
    strictMode = false,
    logViolations = true,
    throwOnErrors = false
  } = options

  const violations = ref<InvariantViolation[]>([])

  /**
   * Invariant 1: Total task count consistency
   * The total number of tasks should be consistent across all base filters
   */
  const validateTotalCountConsistency = (baseTasks: Task[]): InvariantViolation[] => {
    const results: InvariantViolation[] = []

    const allTasksFilter = { ...FILTER_PRESETS.BOARD }
    const allTasksResult = useUnifiedTaskFilter(baseTasks, allTasksFilter)
    const totalTasks = allTasksResult.value.tasks.length

    // Test different base configurations
    const testConfigs: Array<{ name: string; config: FilterConfig }> = [
      { name: 'All Tasks', config: FILTER_PRESETS.BOARD },
      { name: 'Inbox Only', config: FILTER_PRESETS.INBOX },
      { name: 'Canvas Only', config: FILTER_PRESETS.CANVAS }
    ]

    const rawCounts: Record<string, number> = {}

    testConfigs.forEach(({ name, config }) => {
      const result = useUnifiedTaskFilter(baseTasks, config)
      rawCounts[name] = result.value.tasks.length

      // Invariant: All tasks should be >= any subset
      if (name !== 'All Tasks' && result.value.tasks.length > totalTasks) {
        results.push({
          type: 'count_mismatch',
          severity: 'error',
          message: `Subset filter "${name}" returned more tasks than "All Tasks"`,
          expected: `<= ${totalTasks}`,
          actual: result.value.tasks.length,
          context: {
            filterType: name,
            timestamp: new Date(),
            rawCounts,
            filterDetails: result.value.debug
          }
        })
      }
    })

    return results
  }

  /**
   * Invariant 2: Smart view logical consistency
   * Today tasks should be a subset of total tasks
   */
  const validateSmartViewLogic = (baseTasks: Task[]): InvariantViolation[] => {
    const results: InvariantViolation[] = []

    const allTasksConfig = { ...FILTER_PRESETS.BOARD }
    const todayConfig = { ...FILTER_PRESETS.TODAY }

    const allResult = useUnifiedTaskFilter(baseTasks, allTasksConfig)
    const todayResult = useUnifiedTaskFilter(baseTasks, todayConfig)

    const allCount = allResult.value.tasks.length
    const todayCount = todayResult.value.tasks.length

    // Today should never exceed total tasks
    if (todayCount > allCount) {
      results.push({
        type: 'count_mismatch',
        severity: 'error',
        message: 'Today filter returned more tasks than total tasks',
        expected: `<= ${allCount}`,
        actual: todayCount,
        context: {
          filterType: 'smart_view_logic',
          timestamp: new Date(),
          rawCounts: {
            'All Tasks': allCount,
            'Today': todayCount
          },
          filterDetails: {
            all: allResult.value.debug,
            today: todayResult.value.debug
          }
        }
      })
    }

    return results
  }

  /**
   * Invariant 3: Filter composition consistency
   * Applying filters sequentially should equal applying them in a different order
   */
  const validateFilterComposition = (baseTasks: Task[]): InvariantViolation[] => {
    const results: InvariantViolation[] = []

    // Test: Today + Hide Done should equal (Today tasks) filtered by Hide Done
    const todayFilter = { ...FILTER_PRESETS.TODAY }
    const todayHideDoneFilter = { ...FILTER_PRESETS.TODAY, hideDone: true }

    const todayResult = useUnifiedTaskFilter(baseTasks, todayFilter)
    const todayHideDoneResult = useUnifiedTaskFilter(baseTasks, todayHideDoneFilter)

    // Manually filter today tasks by hide done
    const manuallyFiltered = todayResult.value.tasks.filter(task => task.status !== 'done')
    const manualCount = manuallyFiltered.length
    const composedCount = todayHideDoneResult.value.tasks.length

    if (Math.abs(manualCount - composedCount) > 0) {
      results.push({
        type: 'subset_violation',
        severity: strictMode ? 'error' : 'warning',
        message: 'Filter composition inconsistency detected',
        expected: manualCount,
        actual: composedCount,
        context: {
          filterType: 'filter_composition',
          timestamp: new Date(),
          rawCounts: {
            'Today (raw)': todayResult.value.tasks.length,
            'Today (hide done - composed)': composedCount,
            'Today (hide done - manual)': manualCount
          }
        }
      })
    }

    return results
  }

  /**
   * Invariant 4: Project filter consistency
   * Tasks filtered by project should be consistent across all views
   */
  const validateProjectFilterConsistency = (baseTasks: Task[]): InvariantViolation[] => {
    const results: InvariantViolation[] = []

    // Get unique project IDs from tasks
    const projectIds = [...new Set(baseTasks.map(task => task.projectId).filter(Boolean))]

    projectIds.forEach(projectId => {
      const projectConfig = { ...FILTER_PRESETS.BOARD, projectId }
      const projectResult = useUnifiedTaskFilter(baseTasks, projectConfig)
      const projectCount = projectResult.value.tasks.length

      // Verify project tasks are actually from that project
      const actualProjectTasks = baseTasks.filter(task => task.projectId === projectId)
      const actualCount = actualProjectTasks.length

      if (projectCount !== actualCount) {
        results.push({
          type: 'dependency_inconsistency',
          severity: 'warning',
          message: `Project filter inconsistency for project ${projectId}`,
          expected: actualCount,
          actual: projectCount,
          context: {
            filterType: 'project_filter',
            timestamp: new Date(),
            rawCounts: {
              [`Project ${projectId} (filtered)`]: projectCount,
              [`Project ${projectId} (direct)`]: actualCount
            }
          }
        })
      }
    })

    return results
  }

  /**
   * Run all invariants and return validation report
   */
  const validateInvariants = (baseTasks: Task[]): ValidationReport => {
    if (!enabled) {
      return {
        isValid: true,
        violations: [],
        timestamp: new Date(),
        totalTasks: baseTasks.length
      }
    }

    const allViolations: InvariantViolation[] = []

    // Run all invariant checks
    allViolations.push(...validateTotalCountConsistency(baseTasks))
    allViolations.push(...validateSmartViewLogic(baseTasks))
    allViolations.push(...validateFilterComposition(baseTasks))
    allViolations.push(...validateProjectFilterConsistency(baseTasks))

    // Update violations state
    violations.value = allViolations

    const report: ValidationReport = {
      isValid: allViolations.length === 0,
      violations: allViolations,
      timestamp: new Date(),
      totalTasks: baseTasks.length
    }

    // Log violations if enabled
    if (logViolations && allViolations.length > 0) {
      console.group('🚨 [INVARIANT VIOLATIONS] Task filtering consistency issues detected:')

      allViolations.forEach((violation, index) => {
        console.error(`${index + 1}. ${violation.type.toUpperCase()}: ${violation.message}`)
        console.error(`   Severity: ${violation.severity}`)
        console.error(`   Expected: ${violation.expected}`)
        console.error(`   Actual: ${violation.actual}`)
        console.error(`   Context:`, violation.context)
        console.error('---')
      })

      console.groupEnd()
    }

    // Throw errors in strict mode
    if (throwOnErrors && strictMode) {
      const errors = allViolations.filter(v => v.severity === 'error')
      if (errors.length > 0) {
        throw new Error(`Task invariant validation failed: ${errors.length} errors detected`)
      }
    }

    return report
  }

  // Computed property that runs validation
  const validationReport = computed(() => {
    const baseTasks = Array.isArray(tasks) ? tasks : tasks.value
    return validateInvariants(baseTasks)
  })

  // Watch for changes and log automatically in development
  if (enabled && logViolations) {
    watch(
      () => validationReport.value.isValid,
      (isValid) => {
        if (!isValid) {
          console.warn('⚠️ [INVARIANT] Task count consistency issues detected - see console for details')
        }
      },
      { immediate: true }
    )
  }

  return {
    validationReport,
    violations,
    validateInvariants,
    isValid: computed(() => validationReport.value.isValid),
    hasErrors: computed(() => validationReport.value.violations.some(v => v.severity === 'error')),
    hasWarnings: computed(() => validationReport.value.violations.some(v => v.severity === 'warning'))
  }
}

/**
 * Quick validation helper for debugging
 */
export const validateTaskCounts = (
  tasks: Task[],
  context: string = 'unknown'
): boolean => {
  const validation = useTaskInvariantValidation(tasks, {
    enabled: true,
    logViolations: true
  })

  const report = validation.validationReport.value

  if (!report.isValid) {
    console.error(`❌ [VALIDATION FAILED] Context: ${context}`)
    return false
  }

  console.log(`✅ [VALIDATION PASSED] Context: ${context} (${report.totalTasks} tasks)`)
  return true
}

/**
 * Development-only global assertion helper
 */
export const assertTaskConsistency = (tasks: Task[], message?: string): void => {
  if (process.env.NODE_ENV === 'development') {
    const isValid = validateTaskCounts(tasks, message || 'assertion')
    if (!isValid) {
      throw new Error(`Task consistency assertion failed: ${message}`)
    }
  }
}