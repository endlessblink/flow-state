/**
 * Deterministic AI Chat Pipeline — Unit Tests
 *
 * Covers:
 * - intentRouter   (routeIntent, routeIntentByKeywords, parseClassification)
 * - responseTemplates (getTemplate, hasTemplate, TEMPLATES)
 * - reasoningDirective (buildReasoningDirective)
 * - entityMemory   (EntityMemory class)
 * - Integration tests (router × templates × entity memory)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { routeIntent, routeIntentByKeywords, parseClassification } from '@/services/ai/pipeline/intentRouter'
import {
  getTemplate,
  hasTemplate,
  TEMPLATES,
  type TemplateKey,
} from '@/services/ai/pipeline/responseTemplates'
import { buildReasoningDirective } from '@/services/ai/pipeline/reasoningDirective'
import { EntityMemory } from '@/services/ai/pipeline/entityMemory'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const mockTasks = [
  { id: 'task-1', title: 'Fix login bug' },
  { id: 'task-2', title: 'Video project' },
  { id: 'task-3', title: 'Weekly report' },
]

// ---------------------------------------------------------------------------
// 1. intentRouter — routeIntentByKeywords
// ---------------------------------------------------------------------------

describe('intentRouter — routeIntentByKeywords()', () => {
  let entityMemory: EntityMemory

  beforeEach(() => {
    entityMemory = new EntityMemory()
  })

  // ── Task queries ──────────────────────────────────────────────────────────

  it.each([
    ['show tasks', 'list_tasks'],
    ['my tasks', 'list_tasks'],
    ['המשימות שלי', 'list_tasks'],
    ['הצג', 'list_tasks'],
  ])('routes "%s" to task_query with %s tool', (input, expectedTool) => {
    const result = routeIntentByKeywords(input, mockTasks, entityMemory)
    expect(result.type).toBe('task_query')
    expect(result.tools.some(t => t.tool === expectedTool)).toBe(true)
  })

  // ── Overdue queries ───────────────────────────────────────────────────────

  it.each([
    ['triage overdue tasks'],
    ['באיחור'],
  ])('routes "%s" to task_query with get_overdue_tasks tool', (input) => {
    const result = routeIntentByKeywords(input, mockTasks, entityMemory)
    expect(result.type).toBe('task_query')
    expect(result.tools.some(t => t.tool === 'get_overdue_tasks')).toBe(true)
    expect(result.responseMode).toBe('overdue_triage')
  })

  it.each([
    ['show overdue'],
    ['list overdue tasks'],
  ])('routes mechanical overdue list request "%s" without triage mode', (input) => {
    const result = routeIntentByKeywords(input, mockTasks, entityMemory)
    expect(result.type).toBe('task_query')
    expect(result.tools.some(t => t.tool === 'get_overdue_tasks')).toBe(true)
    expect(result.responseMode).toBeUndefined()
  })

  it.each([
    ['help me prioritize'],
    ['prioritize my tasks'],
    ['מה הכי חשוב'],
  ])('routes "%s" to prioritization mode over the active task list, not a generic overdue dump', (input) => {
    const result = routeIntentByKeywords(input, mockTasks, entityMemory)
    expect(result.type).toBe('task_query')
    expect(result.tools.some(t => t.tool === 'list_tasks')).toBe(true)
    expect(result.tools.some(t => t.tool === 'get_overdue_tasks')).toBe(false)
    expect(result.responseMode).toBe('prioritization')
  })

  // ── Suggestion queries ────────────────────────────────────────────────────

  it.each([
    ['what should I do'],
    ['מה לעשות'],
  ])('routes "%s" to task_query with suggest_next_task', (input) => {
    const result = routeIntentByKeywords(input, mockTasks, entityMemory)
    expect(result.type).toBe('task_query')
    expect(result.tools.some(t => t.tool === 'suggest_next_task')).toBe(true)
    expect(result.responseMode).toBe('next_task')
  })

  // ── Timer actions ─────────────────────────────────────────────────────────

  it.each([
    ['start timer', 'start_timer'],
    ['התחל טיימר', 'start_timer'],
    ['stop timer', 'stop_timer'],
    ['עצור טיימר', 'stop_timer'],
  ])('routes "%s" to timer with %s and skipLLM=true', (input, expectedTool) => {
    const result = routeIntentByKeywords(input, mockTasks, entityMemory)
    expect(result.type).toBe('timer')
    expect(result.tools.some(t => t.tool === expectedTool)).toBe(true)
    expect(result.skipLLM).toBe(true)
  })

  it('routes generic "timer" to timer with get_timer_status and skipLLM not true', () => {
    const result = routeIntentByKeywords('timer', mockTasks, entityMemory)
    expect(result.type).toBe('timer')
    expect(result.tools.some(t => t.tool === 'get_timer_status')).toBe(true)
    expect(result.skipLLM).toBeFalsy()
  })

  it('routes "start timer" and uses last entity from memory as taskId', () => {
    entityMemory.trackFromToolResult([{ id: 'task-2', title: 'Video project' }])
    const result = routeIntentByKeywords('start timer', mockTasks, entityMemory)
    expect(result.tools.some(t => t.tool === 'start_timer')).toBe(true)
    const timerTool = result.tools.find(t => t.tool === 'start_timer')
    expect(timerTool?.parameters?.taskId).toBe('task-2')
  })

  it('routes "start timer" with no entity memory → taskId defaults to "general"', () => {
    const result = routeIntentByKeywords('start timer', mockTasks, entityMemory)
    const timerTool = result.tools.find(t => t.tool === 'start_timer')
    expect(timerTool?.parameters?.taskId).toBe('general')
  })

  // ── Create actions ────────────────────────────────────────────────────────

  it.each([
    ['create task Buy milk', 'Buy milk'],
    ['add task Review PR', 'Review PR'],
  ])('routes "%s" to task_action with create_task and correct title', (input, expectedTitle) => {
    const result = routeIntentByKeywords(input, mockTasks, entityMemory)
    expect(result.type).toBe('task_action')
    expect(result.tools.some(t => t.tool === 'create_task')).toBe(true)
    const createTool = result.tools.find(t => t.tool === 'create_task')
    expect(createTool?.parameters?.title).toBe(expectedTitle)
  })

  it('routes Hebrew "צור משימה לקנות חלב" to task_action with create_task and extracts title', () => {
    const result = routeIntentByKeywords('צור משימה לקנות חלב', mockTasks, entityMemory)
    expect(result.type).toBe('task_action')
    expect(result.tools.some(t => t.tool === 'create_task')).toBe(true)
    const createTool = result.tools.find(t => t.tool === 'create_task')
    expect(createTool?.parameters?.title).toBeTruthy()
  })

  it('routes "create task" with no title to task_action without skipLLM', () => {
    const result = routeIntentByKeywords('create task', mockTasks, entityMemory)
    expect(result.type).toBe('task_action')
    expect(result.tools.some(t => t.tool === 'create_task')).toBe(true)
    expect(result.skipLLM).toBeFalsy()
  })

  it('routes broad task breakdown requests through read-first clarification instead of creating subtasks', () => {
    const result = routeIntentByKeywords('break down my tasks into next steps', mockTasks, entityMemory)

    expect(result.type).toBe('task_query')
    expect(result.responseMode).toBe('task_breakdown')
    expect(result.tools).toEqual([
      { tool: 'list_tasks', parameters: { status: 'todo', sortBy: 'priority', limit: 25 } },
    ])
    expect(result.tools.some(t => t.tool === 'create_subtasks')).toBe(false)
  })

  // ── Done / complete actions ───────────────────────────────────────────────

  it('routes "mark done video project" to task_action with mark_task_done via keyword match', () => {
    const result = routeIntentByKeywords('mark done video project', mockTasks, entityMemory)
    expect(result.type).toBe('task_action')
    expect(result.tools.some(t => t.tool === 'mark_task_done')).toBe(true)
  })

  it('routes Hebrew "סיים video project" to task_action with mark_task_done', () => {
    const result = routeIntentByKeywords('סיים video project', mockTasks, entityMemory)
    expect(result.type).toBe('task_action')
    expect(result.tools.some(t => t.tool === 'mark_task_done')).toBe(true)
  })

  it.each([
    ['mark video as done', 'freeform'],
    ['done', 'freeform'],
  ])('routes "%s" to freeform (not an exact match)', (input, expectedType) => {
    const result = routeIntentByKeywords(input, mockTasks, entityMemory)
    expect(result.type).toBe(expectedType)
    expect(result.skipLLM).toBeFalsy()
  })

  // ── Stats ─────────────────────────────────────────────────────────────────

  it.each([
    ['how am I doing', 'stats', 'get_productivity_stats'],
    ['סטטיסטיקות', 'stats', 'get_productivity_stats'],
  ])('routes "%s" to %s with %s', (input, expectedType, expectedTool) => {
    const result = routeIntentByKeywords(input, mockTasks, entityMemory)
    expect(result.type).toBe(expectedType)
    expect(result.tools.some(t => t.tool === expectedTool)).toBe(true)
  })

  // ── TASK-1821: forward planning vs retrospective summary ───────────────────
  // The bug: planning phrasings ("תכנן את השבוע") were misrouted to the
  // retrospective get_weekly_summary because the bare 'השבוע' keyword matched.
  // Predicate/tense must decide intent, not the time word.
  describe('plan ↔ summary disambiguation', () => {
    it.each([
      'plan my week',
      'plan the week',
      'plan the rest of my week',
      'help me plan the remaining week',
      'help me plan until the end of the week',
      'organize the rest of my week',
      'תכנן את השבוע',
      'תעזור לי לתכנן את השבוע',
      'תעזור לי לתכנן את שארית השבוע',
      'תעזור לי לתכנן עד סוף השבוע',
      'סדר לי את המשך השבוע',
      'plan לי את השבוע',
      'what should I do this week',
      'מה לעשות השבוע',
      'plan my day',
    ])('routes planning "%s" to forward planning (list_tasks), NOT get_weekly_summary', (input) => {
      const result = routeIntentByKeywords(input, mockTasks, entityMemory)
      expect(result.tools.some(t => t.tool === 'get_weekly_summary')).toBe(false)
      // forward planning → list_tasks (week_plan/day_plan), or at worst freeform — never the summary
      if (result.type !== 'freeform') {
        expect(result.tools.some(t => t.tool === 'list_tasks')).toBe(true)
        expect(['week_plan', 'day_plan']).toContain(result.responseMode)
      }
    })

    it.each([
      'plan the rest of my week',
      'organize the rest of my week',
      'תעזור לי לתכנן את שארית השבוע',
      'סדר לי את המשך השבוע',
    ])('async router preserves flexible weekly planning route before generic task listing: "%s"', async (input) => {
      const result = await routeIntent(input, mockTasks, entityMemory)
      expect(result.type).toBe('task_query')
      expect(result.tools).toEqual([{ tool: 'list_tasks', parameters: { status: 'todo', sortBy: 'dueDate', limit: 40 } }])
      expect(result.responseMode).toBe('week_plan')
    })

    it.each([
      'weekly summary',
      'summarize my week',
      'סיכום שבועי',
      'מה עשיתי השבוע',
      'what did I do this week',
    ])('routes retrospective "%s" to get_weekly_summary (weekly_review)', (input) => {
      const result = routeIntentByKeywords(input, mockTasks, entityMemory)
      expect(result.tools.some(t => t.tool === 'get_weekly_summary')).toBe(true)
      expect(result.responseMode).toBe('weekly_review')
    })

    it('bare "this week" no longer defaults to the retrospective summary', () => {
      const result = routeIntentByKeywords('this week', mockTasks, entityMemory)
      expect(result.tools.some(t => t.tool === 'get_weekly_summary')).toBe(false)
    })
  })

  it('routes "today" alone to freeform (single-word too broad)', () => {
    const result = routeIntentByKeywords('today', mockTasks, entityMemory)
    expect(result.type).toBe('freeform')
  })

  // ── Greetings ─────────────────────────────────────────────────────────────

  it.each([
    ['hi'],
    ['hello there'],
    ['hi can you show my tasks'],
  ])('routes "%s" to greeting with skipLLM=true', (input) => {
    const result = routeIntentByKeywords(input, mockTasks, entityMemory)
    expect(result.type).toBe('greeting')
    expect(result.skipLLM).toBe(true)
    expect(result.tools).toHaveLength(0)
  })

  it('routes Hebrew "שלום" — detected language is Hebrew, type is freeform', () => {
    // "שלום" alone has no matching keywords and greeting regex fails due to \b on non-ASCII
    const result = routeIntentByKeywords('שלום', mockTasks, entityMemory)
    expect(result.language).toBe('he')
    expect(result.type).toBe('freeform')
  })

  // ── Freeform fallback ─────────────────────────────────────────────────────

  it.each([
    ['how do I organize my day?'],
    ['tell me a joke'],
    [''],
  ])('routes "%s" to freeform', (input) => {
    const result = routeIntentByKeywords(input, mockTasks, entityMemory)
    expect(result.type).toBe('freeform')
  })

  // ── Language detection ────────────────────────────────────────────────────

  it('detects Hebrew input language for "מה המשימות שלי?"', () => {
    const result = routeIntentByKeywords('מה המשימות שלי?', mockTasks, entityMemory)
    expect(result.language).toBe('he')
  })

  it('detects English input language for "show my tasks"', () => {
    const result = routeIntentByKeywords('show my tasks', mockTasks, entityMemory)
    expect(result.language).toBe('en')
  })

  // ── formatDirective invariant ─────────────────────────────────────────────

  it('every RoutedIntent has a non-empty formatDirective', () => {
    const messages = [
      'show tasks',
      'start timer',
      'create task Test',
      'mark done',
      'plan my week',
      'how am I doing',
      'hi',
      'tell me a joke',
    ]
    for (const msg of messages) {
      const result = routeIntentByKeywords(msg, mockTasks, entityMemory)
      expect(result.formatDirective).toBeTruthy()
      expect(result.formatDirective.length).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// 1b. parseClassification (LLM response parser)
// ---------------------------------------------------------------------------

describe('parseClassification()', () => {
  it('parses valid JSON response', () => {
    const result = parseClassification('{"tool":"list_tasks","params":{},"confidence":"high"}')
    expect(result.tool).toBe('list_tasks')
    expect(result.confidence).toBe('high')
    expect(result.params).toEqual({})
  })

  it('parses JSON with params', () => {
    const result = parseClassification('{"tool":"create_task","params":{"title":"buy milk"},"confidence":"high"}')
    expect(result.tool).toBe('create_task')
    expect(result.params).toEqual({ title: 'buy milk' })
  })

  it('strips markdown code fences', () => {
    const result = parseClassification('```json\n{"tool":"stop_timer","params":{},"confidence":"high"}\n```')
    expect(result.tool).toBe('stop_timer')
    expect(result.confidence).toBe('high')
  })

  it('extracts JSON from chatty response', () => {
    const result = parseClassification('Based on the message, I classify this as: {"tool":"get_productivity_stats","params":{},"confidence":"medium"} because...')
    expect(result.tool).toBe('get_productivity_stats')
    expect(result.confidence).toBe('medium')
  })

  it.each([
    ['garbage text', 'this is not json at all'],
    ['empty string', ''],
    ['null input', null as unknown as string],
  ])('returns NONE/low for %s', (_label, input) => {
    const result = parseClassification(input)
    expect(result.tool).toBe('NONE')
    expect(result.confidence).toBe('low')
  })

  it('defaults confidence to "medium" and params to {} when missing', () => {
    const noConf = parseClassification('{"tool":"list_tasks","params":{}}')
    expect(noConf.confidence).toBe('medium')

    const noParams = parseClassification('{"tool":"list_tasks","confidence":"high"}')
    expect(noParams.params).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// 1c. routeIntent (async, LLM-first with keyword fallback)
// ---------------------------------------------------------------------------

describe('routeIntent() — async LLM-first router', () => {
  let entityMemory: EntityMemory

  beforeEach(() => {
    entityMemory = new EntityMemory()
  })

  it('greetings bypass LLM classification entirely', async () => {
    const result = await routeIntent('hi', mockTasks, entityMemory)
    expect(result.type).toBe('greeting')
    expect(result.skipLLM).toBe(true)
    expect(result.tools).toHaveLength(0)
  })

  it('falls back to keyword matching when LLM is unavailable', async () => {
    const result = await routeIntent('show tasks', mockTasks, entityMemory)
    expect(result.type).toBe('task_query')
    expect(result.tools.some(t => t.tool === 'list_tasks')).toBe(true)
  })

  it('returns a valid RoutedIntent (not undefined) for freeform messages', async () => {
    const result = await routeIntent('tell me a joke', mockTasks, entityMemory)
    expect(result).toBeDefined()
    expect(result.type).toBe('freeform')
    expect(result.formatDirective).toBeTruthy()
  })

  it('returns Hebrew language for Hebrew input', async () => {
    const result = await routeIntent('המשימות שלי', mockTasks, entityMemory)
    expect(result.language).toBe('he')
  })

  it('every result has a non-empty formatDirective', async () => {
    const messages = ['show tasks', 'start timer', 'create task Test', 'hi', 'random text']
    for (const msg of messages) {
      const result = await routeIntent(msg, mockTasks, entityMemory)
      expect(result.formatDirective).toBeTruthy()
      expect(result.formatDirective.length).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// 2. responseTemplates
// ---------------------------------------------------------------------------

describe('responseTemplates', () => {
  it('has both en and he variants for every template key', () => {
    for (const [key, template] of Object.entries(TEMPLATES)) {
      expect(typeof template.en).toBe('function', `template "${key}" missing "en" variant`)
      expect(typeof template.he).toBe('function', `template "${key}" missing "he" variant`)
    }
  })

  it('hasTemplate returns true for valid keys and false for invalid', () => {
    const validKeys: TemplateKey[] = ['timer_started', 'task_created', 'greeting', 'no_tasks']
    for (const key of validKeys) {
      expect(hasTemplate(key)).toBe(true)
    }
    expect(hasTemplate('nonexistent_key')).toBe(false)
    expect(hasTemplate('')).toBe(false)
    expect(hasTemplate('TIMER_STARTED')).toBe(false) // case-sensitive
  })

  // ── English templates ──────────────────────────────────────────────────────

  it('timer_started EN formats correctly with task name and duration', () => {
    const result = getTemplate('timer_started', 'en', 'Write report', 25)
    expect(result).toContain('Write report')
    expect(result).toContain('25')
    expect(result.toLowerCase()).toContain('timer')
  })

  it('timer_stopped EN formats correctly with task name and remaining time', () => {
    const result = getTemplate('timer_stopped', 'en', 'Fix bug', '10:00')
    expect(result).toContain('Fix bug')
    expect(result).toContain('10:00')
  })

  it('task_created EN formats correctly with title', () => {
    const result = getTemplate('task_created', 'en', 'Buy groceries')
    expect(result).toContain('Buy groceries')
    expect(result.toLowerCase()).toContain('created')
  })

  it('task_done EN formats correctly with title', () => {
    const result = getTemplate('task_done', 'en', 'Fix login bug')
    expect(result).toContain('Fix login bug')
    expect(result.toLowerCase()).toContain('done')
  })

  it('greeting EN returns a conversational greeting string', () => {
    const result = getTemplate('greeting', 'en')
    expect(result.length).toBeGreaterThan(0)
    expect(result).toMatch(/[Hh]ey|[Hh]i|[Hh]ello|help/i)
  })

  it('no_tasks EN returns an appropriate message', () => {
    const result = getTemplate('no_tasks', 'en')
    expect(result.length).toBeGreaterThan(0)
    expect(result.toLowerCase()).toMatch(/no task|not found/)
  })

  it('task_not_found EN includes the query in the response', () => {
    const result = getTemplate('task_not_found', 'en', 'my special task')
    expect(result).toContain('my special task')
  })

  // ── Hebrew templates ───────────────────────────────────────────────────────

  it('timer_started HE formats correctly with task name and duration', () => {
    const result = getTemplate('timer_started', 'he', 'כתיבת דוח', 25)
    expect(result).toContain('כתיבת דוח')
    expect(result).toContain('25')
    expect(result).toContain('טיימר')
  })

  it('task_created HE formats correctly with title', () => {
    const result = getTemplate('task_created', 'he', 'לקנות חלב')
    expect(result).toContain('לקנות חלב')
    expect(result).toContain('נוצרה')
  })

  it('task_done HE formats correctly with title', () => {
    const result = getTemplate('task_done', 'he', 'תיקון באג')
    expect(result).toContain('תיקון באג')
    expect(result).toContain('הושלמה')
  })

  it('greeting HE returns a Hebrew greeting string', () => {
    const result = getTemplate('greeting', 'he')
    expect(result.length).toBeGreaterThan(0)
    expect(/[\u0590-\u05FF]/.test(result)).toBe(true)
  })

  // ── Edge cases ────────────────────────────────────────────────────────────

  it('handles special characters in task names (quotes, slashes)', () => {
    const result = getTemplate('task_created', 'en', 'Fix "auth" bug & more')
    expect(result).toContain('Fix "auth" bug & more')
  })

  it('handles empty string parameters without throwing', () => {
    expect(() => getTemplate('task_created', 'en', '')).not.toThrow()
    const result = getTemplate('task_created', 'en', '')
    expect(result.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// 3. reasoningDirective — buildReasoningDirective()
// ---------------------------------------------------------------------------

describe('reasoningDirective — buildReasoningDirective()', () => {
  it('includes "X days overdue" fact for overdue task (EN)', () => {
    const tasks = [{ title: 'Late bug fix', daysOverdue: 5 }]
    const result = buildReasoningDirective('list_tasks', tasks, 'en')
    expect(result).toContain('5')
    expect(result.toLowerCase()).toContain('overdue')
  })

  it('includes Hebrew "ימים באיחור" for overdue task (HE)', () => {
    const tasks = [{ title: 'Late bug fix', daysOverdue: 3 }]
    const result = buildReasoningDirective('list_tasks', tasks, 'he')
    expect(result).toContain('3')
    expect(result).toContain('באיחור')
  })

  it('includes priority, subtask progress, pomodoros, project for rich task (EN)', () => {
    const tasks = [{
      title: 'Complex task',
      priority: 'high',
      subtasks: '2/5',
      pomodorosCompleted: 4,
      project: 'Authentication Service',
      daysOverdue: 2,
    }]
    const result = buildReasoningDirective('list_tasks', tasks, 'en')
    expect(result).toContain('Complex task')
    expect(result.toLowerCase()).toContain('high priority')
    expect(result).toContain('2/5')
    expect(result).toContain('40%')
    expect(result).toContain('4')
    expect(result.toLowerCase()).toContain('pomodoro')
    expect(result.toLowerCase()).toContain('project:')
    expect(result).toContain('Authentication Service')
  })

  it('includes "due today" and "due tomorrow" facts (EN)', () => {
    const today = new Date()
    const tomorrow = new Date()
    tomorrow.setDate(today.getDate() + 1)
    const pad = (n: number) => String(n).padStart(2, '0')
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
    const tomorrowStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`

    const todayResult = buildReasoningDirective('list_tasks', [{ title: 'Due today task', dueDate: todayStr }], 'en')
    expect(todayResult.toLowerCase()).toContain('due today')

    const tomorrowResult = buildReasoningDirective('list_tasks', [{ title: 'Due tomorrow task', dueDate: tomorrowStr }], 'en')
    expect(tomorrowResult.toLowerCase()).toContain('due tomorrow')
  })

  it('does NOT include "due today" when task is already flagged as overdue', () => {
    const today = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
    const tasks = [{ title: 'Overdue task', dueDate: todayStr, daysOverdue: 3 }]
    const result = buildReasoningDirective('list_tasks', tasks, 'en')
    expect(result.toLowerCase()).toContain('overdue')
    expect(result.toLowerCase()).not.toContain('due today')
  })

  it('includes "~X min estimated" for tasks with estimatedMinutes (EN)', () => {
    const tasks = [{ title: 'Quick fix', estimatedMinutes: 30 }]
    const result = buildReasoningDirective('list_tasks', tasks, 'en')
    expect(result).toContain('30')
    expect(result.toLowerCase()).toContain('min estimated')
  })

  it.each([
    ['empty array', [] as unknown[]],
    ['null input', null],
  ])('returns noTasks message for %s', (_label, input) => {
    const result = buildReasoningDirective('list_tasks', input as Parameters<typeof buildReasoningDirective>[1], 'en')
    expect(result.length).toBeGreaterThan(0)
    expect(result).not.toContain('MANDATORY REASONING POINTS')
  })

  it('skips tasks with no interesting facts (title only)', () => {
    const tasks = [{ title: 'Boring task' }]
    const result = buildReasoningDirective('list_tasks', tasks, 'en')
    expect(result).not.toContain('Boring task')
  })

  it('caps at 5 tasks and appends overflow count', () => {
    const tasks = Array.from({ length: 8 }, (_, i) => ({
      title: `Task ${i + 1}`,
      daysOverdue: i + 1,
    }))
    const result = buildReasoningDirective('list_tasks', tasks, 'en')
    expect(result).toContain('MANDATORY REASONING POINTS')
    expect(result.toLowerCase()).toMatch(/more/)
  })

  it('handles productivity stats, timer status, and weekly summary objects', () => {
    const stats = { todayCompleted: 3, todayPomodoros: 2 }
    const statsResult = buildReasoningDirective('get_productivity_stats', stats, 'en')
    expect(statsResult).toContain('3')
    expect(statsResult.toLowerCase()).toContain('completed')

    const timerRunning = { isRunning: true, currentTask: 'Fix login bug', remainingSeconds: 600 }
    const timerRunningResult = buildReasoningDirective('get_timer_status', timerRunning, 'en')
    expect(timerRunningResult).toContain('Fix login bug')
    expect(timerRunningResult.toLowerCase()).toContain('timer')

    const timerStopped = { isRunning: false, completedToday: 2 }
    const timerStoppedResult = buildReasoningDirective('get_timer_status', timerStopped, 'en')
    expect(timerStoppedResult.toLowerCase()).toContain('timer')
    expect(timerStoppedResult).toContain('2')

    const weekly = { completedThisWeek: 7, totalFocusMinutes: 90 }
    const weeklyResult = buildReasoningDirective('get_weekly_summary', weekly, 'en')
    expect(weeklyResult).toContain('7')
    expect(weeklyResult.toLowerCase()).toContain('week')
  })

  it('directive contains language instruction matching requested language', () => {
    const tasksEN = [{ title: 'EN task', daysOverdue: 1 }]
    expect(buildReasoningDirective('list_tasks', tasksEN, 'en')).toContain('Write in English')

    const tasksHE = [{ title: 'HE task', daysOverdue: 1 }]
    expect(buildReasoningDirective('list_tasks', tasksHE, 'he')).toContain('כתוב בעברית')
  })
})

// ---------------------------------------------------------------------------
// 4. entityMemory — EntityMemory class
// ---------------------------------------------------------------------------

describe('entityMemory — EntityMemory class', () => {
  let memory: EntityMemory

  beforeEach(() => {
    memory = new EntityMemory()
  })

  it('starts empty — getRecent() returns [] and getLastMentioned() returns null', () => {
    expect(memory.getRecent()).toEqual([])
    expect(memory.getLastMentioned()).toBeNull()
  })

  it('trackFromToolResult() adds entities and sets source to "tool_result"', () => {
    memory.trackFromToolResult([{ id: '1', title: 'Task A' }])
    const last = memory.getLastMentioned()
    expect(last).not.toBeNull()
    expect(last?.title).toBe('Task A')
    expect(last?.id).toBe('1')
    expect(last?.source).toBe('tool_result')
  })

  it('most recently tracked entity is first in getRecent()', () => {
    memory.trackFromToolResult([{ id: '1', title: 'First Task' }])
    memory.trackFromToolResult([{ id: '2', title: 'Second Task' }])
    const recent = memory.getRecent()
    expect(recent[0].title).toBe('Second Task')
  })

  it('deduplicates entities — same ID re-tracks to front without duplicates', () => {
    memory.trackFromToolResult([{ id: '1', title: 'Task A' }])
    memory.trackFromToolResult([{ id: '2', title: 'Task B' }])
    memory.trackFromToolResult([{ id: '1', title: 'Task A' }])
    const recent = memory.getRecent()
    expect(recent[0].title).toBe('Task A')
    const ids = recent.map(e => e.id)
    expect(ids.filter(id => id === '1').length).toBe(1)
  })

  it('getRecent() respects the limit parameter', () => {
    memory.trackFromToolResult([
      { id: '1', title: 'Task 1' },
      { id: '2', title: 'Task 2' },
      { id: '3', title: 'Task 3' },
      { id: '4', title: 'Task 4' },
    ])
    expect(memory.getRecent(2).length).toBeLessThanOrEqual(2)
  })

  it('trackActionTarget() adds entity with "action_target" source', () => {
    memory.trackActionTarget('abc-123', 'Done Task')
    const last = memory.getLastMentioned()
    expect(last?.id).toBe('abc-123')
    expect(last?.title).toBe('Done Task')
    expect(last?.source).toBe('action_target')
  })

  it('formatForPrompt() returns empty string when no entities', () => {
    expect(memory.formatForPrompt()).toBe('')
  })

  it('formatForPrompt() includes RECENTLY MENTIONED TASKS with title, ID, and "(most recent)" label', () => {
    memory.trackFromToolResult([{ id: 'abc-999', title: 'Fix login bug' }])
    const prompt = memory.formatForPrompt()
    expect(prompt).toContain('RECENTLY MENTIONED TASKS')
    expect(prompt).toContain('Fix login bug')
    expect(prompt).toContain('abc-999')
    expect(prompt).toContain('(most recent)')
  })

  it('clear() resets all state', () => {
    memory.trackFromToolResult([{ id: '1', title: 'Task A' }])
    memory.clear()
    expect(memory.getRecent()).toEqual([])
    expect(memory.getLastMentioned()).toBeNull()
    expect(memory.formatForPrompt()).toBe('')
  })
})

// ---------------------------------------------------------------------------
// 5. Integration tests — router × templates × entity memory
// ---------------------------------------------------------------------------

describe('deterministic pipeline — integration', () => {
  let entityMemory: EntityMemory

  beforeEach(() => {
    entityMemory = new EntityMemory()
  })

  it.each([
    ['המשימות שלי', 'task_query', 'list_tasks', 'he'],
    ['show overdue', 'task_query', 'get_overdue_tasks', 'en'],
  ])('"%s" → router classifies %s with %s (language: %s)', (input, expectedType, expectedTool, expectedLang) => {
    const result = routeIntentByKeywords(input, mockTasks, entityMemory)
    expect(result.type).toBe(expectedType)
    expect(result.tools.some(t => t.tool === expectedTool)).toBe(true)
    expect(result.language).toBe(expectedLang)
  })

  it('"start timer" → router classifies timer, skipLLM=true', () => {
    const result = routeIntentByKeywords('start timer', mockTasks, entityMemory)
    expect(result.type).toBe('timer')
    expect(result.skipLLM).toBe(true)
  })

  it('"tell me a joke" → router classifies freeform', () => {
    const result = routeIntentByKeywords('tell me a joke', mockTasks, entityMemory)
    expect(result.type).toBe('freeform')
    expect(result.skipLLM).toBeFalsy()
  })

  it('greeting returns skipLLM=true with no tools', () => {
    const result = routeIntentByKeywords('hello', mockTasks, entityMemory)
    expect(result.type).toBe('greeting')
    expect(result.skipLLM).toBe(true)
    expect(result.tools).toHaveLength(0)
  })

  it('timer_started, task_created, task_done, greeting templates all exist for en + he', () => {
    const skipLLMTemplates: TemplateKey[] = ['timer_started', 'task_created', 'task_done', 'greeting']
    for (const key of skipLLMTemplates) {
      expect(hasTemplate(key)).toBe(true)
      expect(() => getTemplate(key, 'en', 'test', 25)).not.toThrow()
      expect(() => getTemplate(key, 'he', 'test', 25)).not.toThrow()
    }
  })

  it('all IntentTypes produce a non-empty formatDirective', () => {
    const testMessages = [
      'show tasks',
      'create task Test item',
      'start timer',
      'plan my week',
      'how am I doing',
      'hi',
      'random thoughts',
    ]
    for (const message of testMessages) {
      const result = routeIntentByKeywords(message, mockTasks, entityMemory)
      expect(result.formatDirective.length).toBeGreaterThan(0)
    }
  })

  it('start timer uses entity from memory when available, defaults to "general" when not', () => {
    entityMemory.trackFromToolResult([{ id: 'task-99', title: 'Important task' }])
    const resultWithMemory = routeIntentByKeywords('start timer', mockTasks, entityMemory)
    expect(resultWithMemory.tools.find(t => t.tool === 'start_timer')?.parameters?.taskId).toBe('task-99')

    const freshMemory = new EntityMemory()
    const resultNoMemory = routeIntentByKeywords('start timer', mockTasks, freshMemory)
    expect(resultNoMemory.tools.find(t => t.tool === 'start_timer')?.parameters?.taskId).toBe('general')
  })
})
