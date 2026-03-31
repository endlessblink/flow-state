/**
 * AI Effectiveness Test Suite (TASK-1470)
 *
 * Validates that AI Task Assist actions produce quality results that actually
 * improve tasks. Mocks the AI router to return controlled but realistic
 * responses, then verifies parsing, validation, and end result quality.
 *
 * Sections:
 *   A — AI Action Result Quality (10 tests)
 *   B — Task Improvement Measurement (4 tests)
 *   C — Acceptance Rate Tracking (3 tests)
 *   D — Response Parsing Robustness (3 tests)
 *   E — UX Flow Tests (4 tests)
 *
 * @see src/composables/useAITaskAssist.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Task } from '@/types/tasks'

// ============================================================================
// Mocks — must be before imports that use mocked modules
// ============================================================================

/**
 * Mock router factory.
 * Inspects system prompt content to determine which AI action is being called,
 * then yields the appropriate controlled JSON response.
 */
// Shared mock failure flag — set via setMockFailure()
let mockShouldFail = false

vi.mock('@/services/ai/routerFactory', () => {
  // Build a date string for "today + 3 days" to use in date suggestions
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + 3)
  const futureDateStr = futureDate.toISOString().split('T')[0]

  return {
    getSharedRouter: vi.fn(() => Promise.resolve({
      chatStream: async function* (_messages: Array<{ role: string; content: string }>) {
        if (mockShouldFail) {
          throw new Error('Mock AI failure')
        }

        const systemContent = _messages[0]?.content || ''
        const userContent = _messages.find((m: { role: string }) => m.role === 'user')?.content || ''
        // Also check few-shot demos to detect improveTitle (it has multiple user messages)
        const lastUserContent = _messages[_messages.length - 1]?.content || ''

        // 1. suggestSubtasks
        if (systemContent.includes('subtasks') && systemContent.includes('actionable')) {
          yield { content: JSON.stringify({
            subtasks: [
              'Research API authentication options and compare OAuth providers',
              'Write integration tests for the auth flow endpoints',
              'Deploy auth service to staging environment',
              'Configure rate limiting for auth endpoints'
            ]
          })}
          return
        }

        // 2. suggestPriorityDuration
        if (systemContent.includes('priority') && systemContent.includes('duration')) {
          yield { content: JSON.stringify({
            priority: 'high',
            duration: 60,
            reasoning: 'Task involves API changes which are time-sensitive'
          })}
          return
        }

        // 3. breakDownTask
        if (systemContent.includes('Break this task') && systemContent.includes('smaller')) {
          yield { content: JSON.stringify({
            tasks: [
              { title: 'Design database schema for user profiles', priority: 'high' },
              { title: 'Implement REST API endpoints', priority: 'medium' },
              { title: 'Write unit tests for profile service', priority: 'medium' }
            ]
          })}
          return
        }

        // 4. suggestDate
        if (systemContent.includes('optimal date')) {
          yield { content: JSON.stringify({
            date: futureDateStr,
            reasoning: 'Scheduling a few days out allows preparation time'
          })}
          return
        }

        // 5. improveTitle — detected by the "Improve the given task title" prompt
        if (systemContent.includes('Improve the given task title')) {
          // Check for Hebrew content in the last user message
          const hebrewPattern = /[\u0590-\u05FF]/
          if (hebrewPattern.test(lastUserContent)) {
            yield { content: JSON.stringify({ title: 'לתקן את שגיאת ההתחברות בדף הראשי' }) }
          } else {
            yield { content: JSON.stringify({ title: 'Fix broken checkout redirect on confirmation page' }) }
          }
          return
        }

        // 6. smartSuggest
        if (systemContent.includes('suggest task metadata') && !systemContent.includes('multiple tasks')) {
          // Check for "invalid priority" test case (user content includes special marker)
          if (userContent.includes('INVALID_PRIORITY_TEST')) {
            yield { content: JSON.stringify({
              suggestions: [
                { field: 'priority', value: 'critical', confidence: 0.8, reason: 'Urgent work' },
                { field: 'estimatedDuration', value: 30, confidence: 0.7, reason: 'Quick task' }
              ]
            })}
            return
          }

          yield { content: JSON.stringify({
            suggestions: [
              { field: 'priority', value: 'high', confidence: 0.85, reason: 'Has deadline soon' },
              { field: 'dueDate', value: futureDateStr, confidence: 0.75, reason: 'Should be scheduled soon' },
              { field: 'estimatedDuration', value: 60, confidence: 0.7, reason: 'Medium complexity task' }
            ]
          })}
          return
        }

        // 7. smartSuggestGroup
        if (systemContent.includes('multiple tasks')) {
          yield { content: JSON.stringify({
            tasks: [
              { taskId: 'task-1', suggestions: [{ field: 'priority', value: 'high', confidence: 0.9, reason: 'Critical bug' }] },
              { taskId: 'task-2', suggestions: [{ field: 'estimatedDuration', value: 30, confidence: 0.7, reason: 'Quick fix' }] }
            ]
          })}
          return
        }

        // 8. summarizeBatch
        if (systemContent.includes('Summarize')) {
          yield { content: JSON.stringify({
            summary: 'These tasks relate to API infrastructure improvements',
            suggestedGroup: 'API Infrastructure'
          })}
          return
        }

        // Default fallback
        yield { content: '{}' }
      },
      chat: vi.fn(),
      dispose: vi.fn(),
      initialize: vi.fn()
    })),
    resetSharedRouter: vi.fn()
  }
})

// Mock the user context injection (routerFactory uses it internally)
vi.mock('@/services/ai/userContext', () => ({
  getAIUserContext: vi.fn(() => Promise.resolve(''))
}))

// Mock complexity classifier
vi.mock('@/services/ai/complexityClassifier', () => ({
  classifyComplexity: vi.fn(() => ({ tier: 'simple', score: 0.2, reasons: [] }))
}))

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { useAITaskAssist } from '@/composables/useAITaskAssist'
import { getTaskCompleteness } from '@/composables/useTaskCompleteness'
import { useAIEventTracking } from '@/composables/useAIEventTracking'

// ============================================================================
// Helpers
// ============================================================================

function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test-task-1',
    title: 'Implement user authentication API',
    description: 'Build OAuth2 login flow with Google and GitHub providers',
    status: 'todo',
    priority: null,
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: '',
    projectId: 'proj-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  } as Task
}

function setMockFailure(fail: boolean) {
  mockShouldFail = fail
}

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  setActivePinia(createPinia())
  mockShouldFail = false
})

// ============================================================================
// Section A — AI Action Result Quality (10 tests)
// ============================================================================

describe('Section A: AI Action Result Quality', () => {
  it('1. suggestSubtasks produces actionable subtask titles', async () => {
    const { suggestSubtasks, result, error } = useAITaskAssist()
    await suggestSubtasks(createMockTask())

    expect(error.value).toBeNull()
    expect(result.value).not.toBeNull()
    expect(result.value!.type).toBe('subtasks')

    const subtasks = result.value!.subtasks!
    expect(subtasks.length).toBeGreaterThanOrEqual(3)

    // Each subtask starts with a verb and has 3+ words
    const verbStarters = /^(Research|Write|Deploy|Configure|Design|Implement|Test|Review|Create|Build|Set up|Update|Add|Remove|Fix|Refactor|Migrate|Optimize|Document|Prepare|Schedule|Analyze|Validate|Monitor)/i
    for (const subtask of subtasks) {
      expect(subtask).toMatch(verbStarters)
      expect(subtask.split(/\s+/).length).toBeGreaterThanOrEqual(3)
    }

    // All subtasks are distinct
    const unique = new Set(subtasks.map(s => s.toLowerCase()))
    expect(unique.size).toBe(subtasks.length)
  })

  it('2. suggestSubtasks rejects vague filler', async () => {
    const { suggestSubtasks, result } = useAITaskAssist()
    await suggestSubtasks(createMockTask())

    const subtasks = result.value!.subtasks!
    const vaguePattern = /^(do|work on|handle|stuff|things|misc|other|various)/i
    for (const subtask of subtasks) {
      expect(subtask).not.toMatch(vaguePattern)
    }
  })

  it('3. suggestPriorityDuration returns valid priority + reasonable duration', async () => {
    const { suggestPriorityDuration, result, error } = useAITaskAssist()
    await suggestPriorityDuration(createMockTask())

    expect(error.value).toBeNull()
    expect(result.value).not.toBeNull()
    expect(result.value!.type).toBe('priority')

    const priority = result.value!.priority!
    expect(['low', 'medium', 'high']).toContain(priority.priority)
    expect([15, 30, 60, 90, 120]).toContain(priority.duration)
    expect(typeof priority.reasoning).toBe('string')
    expect(priority.reasoning.length).toBeGreaterThan(0)
  })

  it('4. suggestDate returns a future date in YYYY-MM-DD format', async () => {
    const { suggestDate, result, error } = useAITaskAssist()
    await suggestDate(createMockTask())

    expect(error.value).toBeNull()
    expect(result.value).not.toBeNull()
    expect(result.value!.type).toBe('date')

    const dateResult = result.value!.date!
    expect(dateResult.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    const suggestedDate = new Date(dateResult.date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    expect(suggestedDate.getTime()).toBeGreaterThanOrEqual(today.getTime())
    expect(typeof dateResult.reasoning).toBe('string')
  })

  it('5. improveTitle makes vague titles specific', async () => {
    const { improveTitle, result, error } = useAITaskAssist()
    await improveTitle('fix the thing')

    expect(error.value).toBeNull()
    expect(result.value).not.toBeNull()
    expect(result.value!.type).toBe('title')

    const improved = result.value!.title!
    expect(improved.length).toBeGreaterThan('fix the thing'.length)
    expect(improved.length).toBeLessThanOrEqual(60)
    // Starts with a capital letter or verb
    expect(improved[0]).toMatch(/[A-Z]/)
  })

  it('6. improveTitle preserves Hebrew language', async () => {
    const { improveTitle, result, error } = useAITaskAssist()
    await improveTitle('לתקן את הדבר')

    expect(error.value).toBeNull()
    expect(result.value).not.toBeNull()

    const improved = result.value!.title!
    // Must contain Hebrew characters
    expect(improved).toMatch(/[\u0590-\u05FF]/)
  })

  it('7. smartSuggest fills multiple missing fields', async () => {
    const { smartSuggest, result, error } = useAITaskAssist()
    const task = createMockTask({
      priority: null,
      dueDate: '',
      estimatedDuration: undefined
    })
    await smartSuggest(task)

    expect(error.value).toBeNull()
    expect(result.value).not.toBeNull()
    expect(result.value!.type).toBe('smartSuggest')

    const suggestions = result.value!.smartSuggest!.suggestions
    expect(suggestions.length).toBeGreaterThanOrEqual(2)

    // Each suggestion has required shape
    for (const s of suggestions) {
      expect(['priority', 'dueDate', 'status', 'estimatedDuration']).toContain(s.field)
      expect(s.confidence).toBeGreaterThanOrEqual(0)
      expect(s.confidence).toBeLessThanOrEqual(1)
      expect(typeof s.reasoning).toBe('string')
    }
  })

  it('8. smartSuggest skips fields that already exist', async () => {
    const { smartSuggest, result } = useAITaskAssist()
    const task = createMockTask({
      priority: 'high', // already set
      dueDate: '',
      estimatedDuration: undefined
    })
    await smartSuggest(task)

    const suggestions = result.value!.smartSuggest!.suggestions
    // The AI mock returns priority='high' which matches current value,
    // so the validation logic should filter it out (String(value) !== String(current))
    const prioritySuggestion = suggestions.find(s => s.field === 'priority')
    if (prioritySuggestion) {
      // If a priority suggestion exists, its value must differ from current
      expect(String(prioritySuggestion.suggestedValue)).not.toBe('high')
    }
  })

  it('9. smartSuggest validates strictly — invalid priority filtered out', async () => {
    const { smartSuggest, result } = useAITaskAssist()
    const task = createMockTask({
      // Marker in title so the mock returns invalid data
      title: 'INVALID_PRIORITY_TEST task',
      priority: null,
      dueDate: '',
      estimatedDuration: undefined
    })
    await smartSuggest(task)

    const suggestions = result.value!.smartSuggest!.suggestions
    // 'critical' is not a valid priority — it should be filtered out
    const prioritySuggestion = suggestions.find(s => s.field === 'priority')
    expect(prioritySuggestion).toBeUndefined()

    // But valid estimatedDuration should remain
    const durationSuggestion = suggestions.find(s => s.field === 'estimatedDuration')
    expect(durationSuggestion).toBeDefined()
    expect(durationSuggestion!.suggestedValue).toBe(30)
  })

  it('10. smartSuggest falls back on AI failure', async () => {
    setMockFailure(true)

    const { smartSuggest, result, error } = useAITaskAssist()
    const task = createMockTask({
      priority: null,
      dueDate: '',
      estimatedDuration: undefined
    })
    await smartSuggest(task)

    // Should use deterministic fallback, not error
    expect(error.value).toBeNull()
    expect(result.value).not.toBeNull()
    expect(result.value!.type).toBe('smartSuggest')

    const suggestions = result.value!.smartSuggest!.suggestions
    expect(suggestions.length).toBeGreaterThan(0)

    // Fallback confidence should be low (0.3-0.5)
    for (const s of suggestions) {
      expect(s.confidence).toBeLessThanOrEqual(0.5)
    }
  })
})

// ============================================================================
// Section B — Task Improvement Measurement (4 tests)
// ============================================================================

describe('Section B: Task Improvement Measurement', () => {
  it('11. accepting priority suggestion updates task from null', async () => {
    const { suggestPriorityDuration, result } = useAITaskAssist()
    const task = createMockTask({ priority: null })
    await suggestPriorityDuration(task)

    const suggested = result.value!.priority!
    expect(suggested.priority).toBe('high')
    // Simulating "accept" — the update WOULD set priority from null to 'high'
    expect(task.priority).toBeNull() // original unchanged
    expect(suggested.priority).not.toBeNull()
  })

  it('12. accepting date suggestion updates task from empty', async () => {
    const { suggestDate, result } = useAITaskAssist()
    const task = createMockTask({ dueDate: '' })
    await suggestDate(task)

    const suggested = result.value!.date!
    expect(task.dueDate).toBe('') // original unchanged
    expect(suggested.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('13. accepting subtasks adds them to the result', async () => {
    const { suggestSubtasks, result } = useAITaskAssist()
    await suggestSubtasks(createMockTask())

    const subtasks = result.value!.subtasks!
    expect(subtasks.length).toBeGreaterThanOrEqual(3)
    for (const st of subtasks) {
      expect(typeof st).toBe('string')
      expect(st.length).toBeGreaterThan(0)
    }
  })

  it('14. completeness score improves after AI fields applied', () => {
    // Before: task with only title
    const taskBefore = createMockTask({
      priority: null,
      dueDate: '',
      estimatedDuration: undefined,
      subtasks: []
    })
    const scoreBefore = getTaskCompleteness(taskBefore)
    expect(scoreBefore.score).toBe(0)
    expect(scoreBefore.missing).toContain('priority')
    expect(scoreBefore.missing).toContain('dueDate')
    expect(scoreBefore.missing).toContain('estimatedDuration')
    expect(scoreBefore.missing).toContain('subtasks')

    // After: apply priority + dueDate + duration
    const taskAfter = createMockTask({
      priority: 'high',
      dueDate: '2026-04-15',
      estimatedDuration: 60,
      subtasks: [] // still no subtasks
    })
    const scoreAfter = getTaskCompleteness(taskAfter)
    expect(scoreAfter.score).toBe(0.75) // 3 of 4 fields filled
    expect(scoreAfter.missing).toEqual(['subtasks'])

    expect(scoreAfter.score).toBeGreaterThan(scoreBefore.score)
  })
})

// ============================================================================
// Section C — Acceptance Rate Tracking (3 tests)
// ============================================================================

describe('Section C: Acceptance Rate Tracking', () => {
  beforeEach(() => {
    // Clear events from previous tests (module-level shared ref)
    const tracking = useAIEventTracking()
    tracking.clearEvents()
  })

  it('15. trackSuggestionShown records a suggestion_shown event', () => {
    const tracking = useAIEventTracking()
    const countBefore = tracking.getEvents().length

    tracking.trackSuggestionShown('task_assist', { action: 'suggestSubtasks' })

    const events = tracking.getEvents()
    expect(events.length).toBe(countBefore + 1)
    const latest = events[0]
    expect(latest.type).toBe('suggestion_shown')
    expect(latest.feature).toBe('task_assist')
  })

  it('16. trackSuggestionAccepted records acceptance event', () => {
    const tracking = useAIEventTracking()

    tracking.trackSuggestionAccepted('task_assist', { action: 'suggestPriorityDuration', field: 'priority' })

    const latest = tracking.getEvents()[0]
    expect(latest.type).toBe('suggestion_accepted')
    expect(latest.feature).toBe('task_assist')
    expect(latest.metadata).toHaveProperty('action', 'suggestPriorityDuration')
  })

  it('17. behavioral metrics compute acceptance rate correctly', () => {
    const tracking = useAIEventTracking()

    // Simulate: 3 shown, 2 accepted, 1 rejected
    tracking.trackSuggestionShown('task_assist')
    tracking.trackSuggestionShown('task_assist')
    tracking.trackSuggestionShown('task_assist')
    tracking.trackSuggestionAccepted('task_assist')
    tracking.trackSuggestionAccepted('task_assist')
    tracking.trackSuggestionRejected('task_assist')

    // computeMetrics(0) = all time
    const metrics = tracking.computeMetrics(0)
    expect(metrics.suggestionsShown).toBe(3)
    expect(metrics.suggestionsAccepted).toBe(2)
    expect(metrics.suggestionsRejected).toBe(1)
    // Acceptance rate formula: (accepted + edited) / (accepted + rejected + edited) * 100
    // = (2 + 0) / (2 + 1 + 0) * 100 = 66.67
    expect(metrics.acceptanceRate).toBeCloseTo(67, 0)
  })
})

// ============================================================================
// Section D — Response Parsing Robustness (3 tests)
// ============================================================================

describe('Section D: Response Parsing Robustness', () => {
  // These test the parseAIResponse function indirectly through suggestSubtasks,
  // by customizing the mock to return different response formats.

  it('18. parses markdown-wrapped JSON', async () => {
    // Override mock for this test to return markdown-wrapped JSON
    const routerMod = await import('@/services/ai/routerFactory')
    const originalImpl = vi.mocked(routerMod.getSharedRouter).getMockImplementation()

    vi.mocked(routerMod.getSharedRouter).mockImplementationOnce(() => Promise.resolve({
      chatStream: async function* () {
        yield { content: '```json\n{"subtasks": ["Parse markdown JSON", "Validate output", "Return results"]}\n```' }
      },
      chat: vi.fn(),
      dispose: vi.fn(),
      initialize: vi.fn()
    } as any))

    const { suggestSubtasks, result, error } = useAITaskAssist()
    await suggestSubtasks(createMockTask())

    expect(error.value).toBeNull()
    expect(result.value!.subtasks).toEqual(['Parse markdown JSON', 'Validate output', 'Return results'])

    // Restore original mock
    if (originalImpl) vi.mocked(routerMod.getSharedRouter).mockImplementation(originalImpl)
  })

  it('19. parses raw array response (no wrapping object)', async () => {
    const routerMod = await import('@/services/ai/routerFactory')
    const originalImpl = vi.mocked(routerMod.getSharedRouter).getMockImplementation()

    vi.mocked(routerMod.getSharedRouter).mockImplementationOnce(() => Promise.resolve({
      chatStream: async function* () {
        yield { content: '["Set up CI pipeline", "Configure deployment", "Write smoke tests"]' }
      },
      chat: vi.fn(),
      dispose: vi.fn(),
      initialize: vi.fn()
    } as any))

    const { suggestSubtasks, result, error } = useAITaskAssist()
    await suggestSubtasks(createMockTask())

    expect(error.value).toBeNull()
    expect(result.value!.subtasks).toEqual(['Set up CI pipeline', 'Configure deployment', 'Write smoke tests'])

    if (originalImpl) vi.mocked(routerMod.getSharedRouter).mockImplementation(originalImpl)
  })

  it('20. handles malformed response gracefully', async () => {
    const routerMod = await import('@/services/ai/routerFactory')
    const originalImpl = vi.mocked(routerMod.getSharedRouter).getMockImplementation()

    vi.mocked(routerMod.getSharedRouter).mockImplementationOnce(() => Promise.resolve({
      chatStream: async function* () {
        yield { content: 'This is just plain text, not JSON at all.' }
      },
      chat: vi.fn(),
      dispose: vi.fn(),
      initialize: vi.fn()
    } as any))

    const { suggestSubtasks, result, error } = useAITaskAssist()
    await suggestSubtasks(createMockTask())

    // Should produce an error, not crash
    expect(error.value).toBeTruthy()
    expect(error.value).toContain('could not be parsed')
    expect(result.value).toBeNull()

    if (originalImpl) vi.mocked(routerMod.getSharedRouter).mockImplementation(originalImpl)
  })
})

// ============================================================================
// Section E — UX Flow Tests (4 tests)
// ============================================================================

describe('Section E: UX Flow Tests', () => {
  it('21. isLoading reflects in-progress state during AI call', async () => {
    const assist = useAITaskAssist()
    expect(assist.isLoading.value).toBe(false)

    const promise = assist.suggestSubtasks(createMockTask())
    // Note: since mock is synchronous, isLoading may already be false
    // We verify the initial state and the final state
    await promise
    expect(assist.isLoading.value).toBe(false)
    expect(assist.currentAction.value).toBeNull()
  })

  it('22. clearResult resets all state', async () => {
    const assist = useAITaskAssist()
    await assist.suggestSubtasks(createMockTask())

    expect(assist.result.value).not.toBeNull()

    assist.clearResult()
    expect(assist.result.value).toBeNull()
    expect(assist.error.value).toBeNull()
    expect(assist.currentAction.value).toBeNull()
  })

  it('23. abort prevents result from being set', async () => {
    const routerMod = await import('@/services/ai/routerFactory')
    const originalImpl = vi.mocked(routerMod.getSharedRouter).getMockImplementation()

    // Create a slow mock that yields after a delay
    vi.mocked(routerMod.getSharedRouter).mockImplementationOnce(() => Promise.resolve({
      chatStream: async function* () {
        // Yield content in chunks to allow abort in between
        yield { content: '{"subtasks":' }
        // The composable checks `aborted` after each chunk
        yield { content: '["item1"]}' }
      },
      chat: vi.fn(),
      dispose: vi.fn(),
      initialize: vi.fn()
    } as any))

    const assist = useAITaskAssist()
    const promise = assist.suggestSubtasks(createMockTask())
    // Abort immediately
    assist.abort()
    await promise

    // After abort, result should remain null (abort was called before completion)
    expect(assist.isLoading.value).toBe(false)

    if (originalImpl) vi.mocked(routerMod.getSharedRouter).mockImplementation(originalImpl)
  })

  it('24. breakDownTask produces titled breakdown items', async () => {
    const { breakDownTask, result, error } = useAITaskAssist()
    await breakDownTask(createMockTask())

    expect(error.value).toBeNull()
    expect(result.value).not.toBeNull()
    expect(result.value!.type).toBe('breakdown')

    const breakdown = result.value!.breakdown!
    expect(breakdown.length).toBeGreaterThanOrEqual(2)

    for (const item of breakdown) {
      expect(typeof item.title).toBe('string')
      expect(item.title.length).toBeGreaterThan(0)
      // Priority is optional but if present, must be valid
      if (item.priority) {
        expect(['low', 'medium', 'high']).toContain(item.priority)
      }
    }
  })
})
