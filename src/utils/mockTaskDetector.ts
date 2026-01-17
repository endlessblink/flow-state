/**
 * Mock Task Detection Utility
 * Identifies and filters out mock/test tasks from real user data
 */

export interface MockTaskPattern {
  name: string
  pattern: RegExp
  description: string
  confidence: 'high' | 'medium' | 'low'
}

export interface MockTaskDetectionResult {
  isMock: boolean
  confidence: 'high' | 'medium' | 'low'
  matchedPatterns: string[]
  reasons: string[]
}

/**
 * Mock task patterns based on historical contamination data
 */
export const MOCK_TASK_PATTERNS: MockTaskPattern[] = [
  {
    name: 'Test Task Pattern',
    pattern: /^Test Task$/,
    confidence: 'high',
    description: 'Exact match for "Test Task"'
  },
  {
    name: 'Numbered Test Tasks',
    pattern: /^Test Task \d+$/,
    confidence: 'high',
    description: 'Test Task with numbers (Test Task 2, Test Task 3, etc.)'
  },
  {
    name: 'Priority Test Tasks',
    pattern: /^(Medium|Low|No priority|Completed high priority) task - test completion circle$/,
    confidence: 'high',
    description: 'Priority test completion circle tasks'
  },
  {
    name: 'TASK-TEST Pattern',
    pattern: /^TASK-TEST-\d{3,4}$/,
    confidence: 'high',
    description: 'Auto-generated test task IDs (TASK-TEST-002, etc.)'
  },
  {
    name: 'Performance Testing Tasks',
    pattern: /^Task \d+ - Performance Testing$/,
    confidence: 'high',
    description: 'Performance testing task pattern'
  },
  {
    name: 'Generic New Tasks',
    pattern: /^New Task$/,
    confidence: 'medium',
    description: 'Generic placeholder task name'
  },
  {
    name: 'Sample Task Pattern',
    pattern: /sample|example|demo|test/i,
    confidence: 'low',
    description: 'Contains sample/test keywords (case-insensitive)'
  },
  {
    name: 'Auto-generated ID Pattern',
    pattern: /^\d{11,}$/, // Very long numeric IDs
    confidence: 'low',
    description: 'Auto-generated numeric IDs (11+ digits)'
  },
  {
    name: 'Legacy Test Pattern',
    pattern: /^Task \d{4,}$/, // Task followed by 4+ digits
    confidence: 'low',
    description: 'Legacy numbered task pattern'
  }
]

/**
 * Detect if a task is likely a mock/test task
 */
export function detectMockTask(task: {
  id?: string
  title?: string
  description?: string
}): MockTaskDetectionResult {
  const matchedPatterns: string[] = []
  const reasons: string[] = []
  let highestConfidence: 'high' | 'medium' | 'low' = 'low'

  // Check title patterns
  if (task.title) {
    for (const mockPattern of MOCK_TASK_PATTERNS) {
      if (mockPattern.pattern.test(task.title)) {
        matchedPatterns.push(mockPattern.name)
        reasons.push(`Title matches ${mockPattern.name}: ${mockPattern.description}`)

        // Update confidence level
        if (mockPattern.confidence === 'high') {
          highestConfidence = 'high'
        } else if (mockPattern.confidence === 'medium' && highestConfidence === 'low') {
          highestConfidence = 'medium'
        }
      }
    }
  }

  // Check description for test indicators
  if (task.description) {
    const testKeywords = ['test', 'demo', 'sample', 'example', 'mock']
    const hasTestKeywords = testKeywords.some(keyword =>
      task.description?.toLowerCase().includes(keyword) || false
    )

    if (hasTestKeywords && matchedPatterns.length === 0) {
      matchedPatterns.push('Description Test Keywords')
      reasons.push('Description contains test/demo keywords')
      highestConfidence = 'low'
    }
  }

  // Check ID patterns
  if (task.id) {
    const taskIdPattern = MOCK_TASK_PATTERNS.find(p => p.name === 'TASK-TEST Pattern')
    if (taskIdPattern && taskIdPattern.pattern.test(task.id)) {
      matchedPatterns.push(taskIdPattern.name)
      reasons.push(`ID matches test pattern: ${taskIdPattern.description}`)
      highestConfidence = 'high'
    }

    const autoIdPattern = MOCK_TASK_PATTERNS.find(p => p.name === 'Auto-generated ID Pattern')
    if (autoIdPattern && autoIdPattern.pattern.test(task.id)) {
      matchedPatterns.push(autoIdPattern.name)
      reasons.push(`ID appears to be auto-generated: ${autoIdPattern.description}`)
      if (highestConfidence === 'low') highestConfidence = 'medium'
    }
  }

  return {
    isMock: matchedPatterns.length > 0,
    confidence: highestConfidence,
    matchedPatterns,
    reasons
  }
}

/**
 * Filter mock tasks from an array of tasks
 */
export function filterMockTasks<T extends Record<string, unknown>>(
  tasks: unknown,
  options: {
    confidence?: 'high' | 'medium' | 'low'
    logResults?: boolean
  } = {}
): { cleanTasks: T[]; mockTasks: T[]; results: MockTaskDetectionResult[] } {
  const { confidence = 'medium', logResults = false } = options

  console.log('🔍 Filtering mock tasks...')

  // ✅ Validation 1: Type check
  if (!Array.isArray(tasks)) {
    console.warn('⚠️ filterMockTasks received non-array:', typeof tasks)
    return {
      cleanTasks: [],
      mockTasks: [],
      results: []
    }
  }

  // ✅ Validation 2: Empty check
  if (tasks.length === 0) {
    console.log('ℹ️ filterMockTasks: no tasks to filter')
    return {
      cleanTasks: [],
      mockTasks: [],
      results: []
    }
  }

  try {
    // NOW it's safe to iterate
    const _mockPatterns = [/mock/i, /test/i, /fake/i, /sample/i, /placeholder/i]

    const mockTasks: T[] = []
    const cleanTasks: T[] = []
    const results: MockTaskDetectionResult[] = []

    const confidenceLevels = { high: 3, medium: 2, low: 1 }
    const minConfidence = confidenceLevels[confidence]

    for (const task of tasks) {
      if (!task || typeof task !== 'object') {
        continue
      }

      const detection = detectMockTask(task)
      results.push(detection)

      const taskConfidence = confidenceLevels[detection.confidence]

      if (detection.isMock && taskConfidence >= minConfidence) {
        mockTasks.push(task)
        if (logResults) {
          console.warn(`🚫 Mock task filtered: "${task.title}" (${detection.confidence} confidence)`)
          detection.reasons.forEach(reason => console.warn(`   - ${reason}`))
        }
      } else {
        cleanTasks.push(task)
      }
    }

    console.log(`✅ Filtered ${mockTasks.length} mock tasks from ${tasks.length}`)

    return {
      cleanTasks,
      mockTasks,
      results
    }

  } catch (error) {
    console.error('❌ Mock task filtering failed:', error)
    return {
      cleanTasks: tasks as T[],
      mockTasks: [],
      results: (tasks as T[]).map(_t => ({
        isMock: false,
        confidence: 'low' as const,
        matchedPatterns: [],
        reasons: []
      }))
    }
  }
}

/**
 * Get summary statistics for mock task detection
 */
export function getMockTaskSummary(results: MockTaskDetectionResult[]): {
  total: number
  mock: number
  clean: number
  highConfidence: number
  mediumConfidence: number
  lowConfidence: number
  mostCommonPatterns: Array<{ pattern: string; count: number }>
} {
  const total = results.length
  const mock = results.filter(r => r.isMock).length
  const clean = total - mock

  const highConfidence = results.filter(r => r.confidence === 'high').length
  const mediumConfidence = results.filter(r => r.confidence === 'medium').length
  const lowConfidence = results.filter(r => r.confidence === 'low').length

  // Count most common patterns
  const patternCounts = new Map<string, number>()
  results.forEach(result => {
    result.matchedPatterns.forEach(pattern => {
      patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1)
    })
  })

  const mostCommonPatterns = Array.from(patternCounts.entries())
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    total,
    mock,
    clean,
    highConfidence,
    mediumConfidence,
    lowConfidence,
    mostCommonPatterns
  }
}

/**
 * Clean localStorage of any contaminated backup data
 */
export function cleanBackupStorage(): {
  cleanedKeys: string[]
  errors: string[]
} {
  const cleanedKeys: string[] = []
  const errors: string[] = []

  const backupKeys = [
    'flow-state-user-backup',
    'flow-state-imported-tasks',
    'flow-state-simple-backups',
    'flow-state-simple-latest-backup'
  ]

  backupKeys.forEach(key => {
    try {
      const data = localStorage.getItem(key)
      if (data) {
        // Try to parse and detect mock tasks
        const parsed = JSON.parse(data)

        let containsMockData = false
        if (Array.isArray(parsed)) {
          const detection = filterMockTasks(parsed, { confidence: 'low' })
          containsMockData = detection.mockTasks.length > 0
        } else if (parsed.tasks && Array.isArray(parsed.tasks)) {
          const detection = filterMockTasks(parsed.tasks, { confidence: 'low' })
          containsMockData = detection.mockTasks.length > 0
        } else if (parsed.data && Array.isArray(parsed.data)) {
          const detection = filterMockTasks(parsed.data, { confidence: 'low' })
          containsMockData = detection.mockTasks.length > 0
        }

        if (containsMockData) {
          localStorage.removeItem(key)
          cleanedKeys.push(key)
          console.log(`🧹 Cleaned contaminated storage: ${key}`)
        }
      }
    } catch (error) {
      errors.push(`Failed to clean ${key}: ${error}`)
    }
  })

  return { cleanedKeys, errors }
}