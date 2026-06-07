/**
 * AI Pipeline Unit Tests
 *
 * Comprehensive tests for all AI pipeline modules:
 * - languageDetector
 * - responseValidator
 * - fluffDetector
 * - toolHints
 * - preDigestedReasoning
 * - entityResolver
 * - contextOptimizer
 *
 * NOTE: entityMemory tests live in deterministic-pipeline.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest'

// ============================================================================
// 1. Language Detector
// ============================================================================

import {
  detectLanguage,
  detectLanguageMismatch,
  containsHebrew,
  getTextDirection,
} from '@/services/ai/pipeline/languageDetector'

describe('languageDetector', () => {
  describe('detectLanguage()', () => {
    it('returns "en" for English text', () => {
      expect(detectLanguage('Hello, how are you?')).toBe('en')
    })

    it('returns "he" for Hebrew text', () => {
      expect(detectLanguage('שלום, מה שלומך?')).toBe('he')
    })

    it('returns a string for mixed-language text', () => {
      const result = detectLanguage('Hello שלום mixed')
      expect(['en', 'he', 'unknown']).toContain(result)
    })

    it.each([
      ['empty string', ''],
      ['whitespace-only', '   '],
      ['numbers-only', '12345 6789'],
    ])('returns "unknown" for %s', (_label, input) => {
      expect(detectLanguage(input)).toBe('unknown')
    })

    it('returns "en" for a longer English paragraph', () => {
      expect(detectLanguage('This is a longer sentence to make sure language detection works reliably.')).toBe('en')
    })

    it('returns "he" for a longer Hebrew sentence', () => {
      expect(detectLanguage('זוהי משפט ארוך יותר כדי לוודא שזיהוי השפה עובד בצורה אמינה')).toBe('he')
    })
  })

  describe('detectLanguageMismatch()', () => {
    it('returns true when input is English and output is Hebrew', () => {
      expect(detectLanguageMismatch('Hello how are you', 'שלום מה שלומך אני בסדר')).toBe(true)
    })

    it('returns false when both are English', () => {
      expect(detectLanguageMismatch('Hello', 'Hi there')).toBe(false)
    })

    it('returns false when both are Hebrew', () => {
      expect(detectLanguageMismatch('שלום', 'שלום וברכה')).toBe(false)
    })

    it('returns false when either language is unknown', () => {
      expect(detectLanguageMismatch('123', 'Hi there')).toBe(false)
      expect(detectLanguageMismatch('Hello', '456')).toBe(false)
    })

    it('returns false for empty input', () => {
      expect(detectLanguageMismatch('', 'Hello')).toBe(false)
    })
  })

  describe('containsHebrew()', () => {
    it('returns true for text with Hebrew characters', () => {
      expect(containsHebrew('שלום')).toBe(true)
    })

    it('returns false for text without Hebrew characters', () => {
      expect(containsHebrew('Hello world')).toBe(false)
    })

    it('returns false for empty string', () => {
      expect(containsHebrew('')).toBe(false)
    })

    it('returns true for mixed Hebrew+English text', () => {
      expect(containsHebrew('Hello שלום')).toBe(true)
    })
  })

  describe('getTextDirection()', () => {
    it.each([
      ['he', 'rtl'],
      ['en', 'ltr'],
      ['unknown', 'ltr'],
    ])('returns "%s" direction for lang "%s"', (lang, expected) => {
      expect(getTextDirection(lang)).toBe(expected)
    })
  })
})

// ============================================================================
// 2. Response Validator
// ============================================================================

import { cleanResponse } from '@/services/ai/pipeline/responseValidator'

describe('responseValidator — cleanResponse()', () => {
  it('returns empty string for empty input', () => {
    expect(cleanResponse('')).toBe('')
  })

  it('returns empty string for falsy input', () => {
    expect(cleanResponse(null as unknown as string)).toBe('')
    expect(cleanResponse(undefined as unknown as string)).toBe('')
  })

  it('passes through normal text unchanged (no artifacts)', () => {
    const normal = 'You have 3 tasks due today. The most urgent is the login bug fix.'
    expect(cleanResponse(normal)).toBe(normal)
  })

  it('strips ```json tool call code blocks', () => {
    const input = 'Here is what I found:\n```json\n{ "tool": "list_tasks", "parameters": {} }\n```\nYour tasks are listed above.'
    const result = cleanResponse(input)
    expect(result).not.toContain('```json')
    expect(result).not.toContain('"tool"')
    expect(result).not.toContain('"parameters"')
  })

  it('strips bare JSON tool calls (no code fences)', () => {
    const input = 'Let me check. { "tool": "get_overdue_tasks", "parameters": {} } Here are your overdue tasks.'
    const result = cleanResponse(input)
    expect(result).not.toContain('"tool"')
    expect(result).not.toContain('"parameters"')
  })

  it('strips "I\'ll use the X tool" preamble lines', () => {
    const input = "I'll use the list_tasks tool to check your tasks.\nYou have 5 tasks."
    const result = cleanResponse(input)
    expect(result).not.toContain("I'll use")
    expect(result).not.toContain('list_tasks tool')
    expect(result).toContain('You have 5 tasks.')
  })

  it.each([
    'list_tasks',
    'get_overdue_tasks',
    'search_tasks',
    'get_daily_summary',
  ])('strips standalone tool name reference "%s" from response', (toolName) => {
    const input = `Using ${toolName} to find your data.`
    const result = cleanResponse(input)
    expect(result).not.toContain(toolName)
  })

  it('strips UUIDs from response text', () => {
    const input = 'Check task 550e8400-e29b-41d4-a716-446655440000 which is overdue.'
    const result = cleanResponse(input)
    expect(result).not.toContain('550e8400-e29b-41d4-a716-446655440000')
    expect(result).toContain('Check task')
    expect(result).toContain('which is overdue.')
  })

  it('strips HTML tags', () => {
    const input = 'Your tasks: <b>Fix login bug</b> and <em>write docs</em>.'
    const result = cleanResponse(input)
    expect(result).not.toContain('<b>')
    expect(result).not.toContain('</b>')
    expect(result).not.toContain('<em>')
    expect(result).toContain('Fix login bug')
    expect(result).toContain('write docs')
  })

  it('collapses triple+ newlines to double newlines', () => {
    const input = 'First paragraph.\n\n\n\nSecond paragraph.\n\n\n\n\nThird paragraph.'
    const result = cleanResponse(input)
    expect(result).not.toContain('\n\n\n')
    expect(result).toContain('First paragraph.')
    expect(result).toContain('Second paragraph.')
    expect(result).toContain('Third paragraph.')
  })

  it('strips technical field name dumps', () => {
    const input = 'taskId: abc123 and projectId: xyz789 are technical fields.'
    const result = cleanResponse(input)
    expect(result).not.toContain('taskId')
    expect(result).not.toContain('projectId')
  })

  it('strips confidence percentage patterns', () => {
    const input = "I'm 85% confident this is correct. Confidence: 92% of the data matches."
    const result = cleanResponse(input)
    expect(result).not.toMatch(/\d+%\s*(confident|confidence)/i)
    expect(result).not.toMatch(/confidence\s*:\s*\d+%/i)
  })

  it('does not corrupt normal text content', () => {
    const normal = 'You completed 3 tasks today. Great progress! Your highest priority task is "Fix login bug".'
    const result = cleanResponse(normal)
    expect(result).toContain('You completed 3 tasks today')
    expect(result).toContain('Fix login bug')
  })
})

// ============================================================================
// 3. Fluff Detector
// ============================================================================

import { detectFluff, extractTaskTitlesFromResults } from '@/services/ai/pipeline/fluffDetector'

describe('fluffDetector', () => {
  describe('detectFluff()', () => {
    it('returns high score (>0.5) for specific, data-rich response referencing real tasks', () => {
      const response = 'Your task "Fix login bug" is 3 days overdue with 2/5 subtasks done. It has high priority and needs immediate attention.'
      const result = detectFluff(response, ['Fix login bug'], true)
      expect(result.score).toBeGreaterThan(0.5)
      expect(result.shouldRetry).toBe(false)
    })

    it('returns low score (<0.5) and shouldRetry=true for generic advisory response after tool calls', () => {
      const response = "It's essential to prioritize your tasks and focus on what matters most. You should consider starting with urgent items."
      const result = detectFluff(response, ['Fix login bug'], true)
      expect(result.score).toBeLessThan(0.5)
      expect(result.shouldRetry).toBe(true)
      expect(result.flags.some(f => f.includes('generic phrases'))).toBe(true)
    })

    it('flags "suspiciously short" for a very short response after tool calls', () => {
      const result = detectFluff('short', [], true)
      expect(result.flags.some(f => f.includes('suspiciously short'))).toBe(true)
    })

    it('shouldRetry is false when hadToolCalls is false (even for low-scoring generic response)', () => {
      const response = "It's important to prioritize your tasks and manage your time well."
      const result = detectFluff(response, [], false)
      expect(result.shouldRetry).toBe(false)
    })

    it('penalizes response that references no task titles from results', () => {
      const response = 'You should focus on your most important work and set clear goals for the day.'
      const result = detectFluff(response, ['Fix login bug', 'Write docs'], true)
      expect(result.flags.some(f => f.includes('references no specific tasks'))).toBe(true)
    })

    it('does NOT penalize when taskTitles list is empty (nothing to reference)', () => {
      const response = 'You should focus on your most important work today.'
      const result = detectFluff(response, [], true)
      expect(result.flags.some(f => f.includes('references no specific tasks'))).toBe(false)
    })

    it('rewards response with specific data points (days, counts, percentages)', () => {
      const response = 'You have 3 tasks overdue, including one that is 5 days late. You completed 40% of your weekly goal.'
      const result1 = detectFluff(response, [], true)

      const vague = 'You have some tasks to work on today.'
      const result2 = detectFluff(vague, [], true)

      expect(result1.score).toBeGreaterThan(result2.score)
    })

    it('returns score between 0 and 1 always', () => {
      const worst = detectFluff("It's essential to prioritize and focus on what matters most. Start with the most important tasks and stay organized. Manage your time well.", ['Task A', 'Task B', 'Task C'], true)
      const best = detectFluff('Your task "Fix login bug" is 3 days overdue (high priority). Complete 2/5 subtasks remaining.', ['Fix login bug'], true)
      expect(worst.score).toBeGreaterThanOrEqual(0)
      expect(worst.score).toBeLessThanOrEqual(1)
      expect(best.score).toBeGreaterThanOrEqual(0)
      expect(best.score).toBeLessThanOrEqual(1)
    })

    it('handles Hebrew generic phrases', () => {
      const response = 'חשוב לתעדף את המשימות שלך ולהתמקד בדברים החשובים'
      const result = detectFluff(response, [], true)
      expect(result.flags.some(f => f.includes('generic phrases'))).toBe(true)
    })
  })

  describe('extractTaskTitlesFromResults()', () => {
    it('extracts titles from array results', () => {
      const toolResults = [
        { data: [{ title: 'Task A', id: '1' }, { title: 'Task B', id: '2' }] },
      ]
      expect(extractTaskTitlesFromResults(toolResults)).toEqual(['Task A', 'Task B'])
    })

    it.each([
      ['null data', [{ data: null }]],
      ['empty toolResults', []],
      ['empty data array', [{ data: [] }]],
    ])('returns empty array for %s', (_label, toolResults) => {
      expect(extractTaskTitlesFromResults(toolResults as Parameters<typeof extractTaskTitlesFromResults>[0])).toEqual([])
    })

    it('handles multiple result entries, concatenating titles', () => {
      const toolResults = [
        { data: [{ title: 'Task A', id: '1' }] },
        { data: [{ title: 'Task B', id: '2' }, { title: 'Task C', id: '3' }] },
      ]
      const result = extractTaskTitlesFromResults(toolResults)
      expect(result).toContain('Task A')
      expect(result).toContain('Task B')
      expect(result).toContain('Task C')
    })

    it('skips items without a title field', () => {
      const toolResults = [
        { data: [{ id: '1', status: 'done' }, { title: 'Task B', id: '2' }] },
      ]
      expect(extractTaskTitlesFromResults(toolResults)).toEqual(['Task B'])
    })
  })
})

// ============================================================================
// 4. Tool Hints
// ============================================================================

import { getToolHints, formatToolHints } from '@/services/ai/pipeline/toolHints'
import type { ToolHint } from '@/services/ai/pipeline/toolHints'

describe('toolHints', () => {
  describe('getToolHints()', () => {
    it('returns hint with tool "get_overdue_tasks" for "show me overdue tasks"', () => {
      const hints = getToolHints('show me overdue tasks')
      expect(hints.some(h => h.tool === 'get_overdue_tasks')).toBe(true)
    })

    it('returns hint with tool "start_timer" for "start timer" (NOT get_timer_status)', () => {
      const hints = getToolHints('start timer')
      expect(hints.some(h => h.tool === 'start_timer')).toBe(true)
      const startTimerIdx = hints.findIndex(h => h.tool === 'start_timer')
      const timerStatusIdx = hints.findIndex(h => h.tool === 'get_timer_status')
      if (timerStatusIdx !== -1) {
        expect(startTimerIdx).toBeLessThan(timerStatusIdx)
      }
    })

    it.each([
      ['generic greeting', 'hello'],
      ['empty string', ''],
      ['whitespace-only', '   '],
    ])('returns empty array for %s', (_label, input) => {
      expect(getToolHints(input)).toEqual([])
    })

    it('matches Hebrew keywords for task listing', () => {
      const hints = getToolHints('מה המשימות שלי')
      expect(hints.length).toBeGreaterThan(0)
    })

    it('matches Hebrew keyword for overdue tasks', () => {
      const hints = getToolHints('יש לי משימות באיחור?')
      expect(hints.some(h => h.tool === 'get_overdue_tasks')).toBe(true)
    })

    it.each([
      'help me prioritize',
      "I'm overwhelmed",
      'מה המשימות הכי דחופות',
      'מה חשוב עכשיו',
    ])('routes common prioritization phrasing "%s" to overdue-task data', (input) => {
      const hints = getToolHints(input)
      expect(hints[0]?.tool).toBe('get_overdue_tasks')
    })

    it('deduplicates tool names (same tool not returned twice)', () => {
      const hints = getToolHints('show me my tasks and all tasks in the list')
      const tools = hints.map(h => h.tool)
      const uniqueTools = new Set(tools)
      expect(tools.length).toBe(uniqueTools.size)
    })

    it.each([
      ['stop timer', 'stop_timer'],
      ['give me a weekly summary', 'get_weekly_summary'],
      ['show me my statistics', 'get_productivity_stats'],
      ['create task: buy groceries', 'create_task'],
    ])('matches "%s" to %s', (input, expectedTool) => {
      const hints = getToolHints(input)
      expect(hints.some(h => h.tool === expectedTool)).toBe(true)
    })

    it('is case-insensitive', () => {
      const lower = getToolHints('show me overdue tasks')
      const upper = getToolHints('SHOW ME OVERDUE TASKS')
      expect(lower.map(h => h.tool)).toEqual(upper.map(h => h.tool))
    })
  })

  describe('formatToolHints()', () => {
    it('returns empty string for empty hints array', () => {
      expect(formatToolHints([])).toBe('')
    })

    it('includes "TOOL HINTS" header for non-empty hints', () => {
      const hints: ToolHint[] = [{ tool: 'test_tool', reason: 'test reason' }]
      expect(formatToolHints(hints)).toContain('TOOL HINTS')
    })

    it('includes the tool name in backticks and the reason text', () => {
      const hints: ToolHint[] = [{ tool: 'list_tasks', reason: 'User wants tasks' }]
      const result = formatToolHints(hints)
      expect(result).toContain('`list_tasks`')
      expect(result).toContain('User wants tasks')
    })

    it('caps output at 3 hints even when more are provided', () => {
      const hints: ToolHint[] = [
        { tool: 'tool_1', reason: 'reason 1' },
        { tool: 'tool_2', reason: 'reason 2' },
        { tool: 'tool_3', reason: 'reason 3' },
        { tool: 'tool_4', reason: 'reason 4' },
        { tool: 'tool_5', reason: 'reason 5' },
      ]
      const result = formatToolHints(hints)
      expect(result).toContain('tool_1')
      expect(result).toContain('tool_2')
      expect(result).toContain('tool_3')
      expect(result).not.toContain('tool_4')
      expect(result).not.toContain('tool_5')
    })
  })
})

// ============================================================================
// 5. Pre-Digested Reasoning
// ============================================================================

import { digestToolResults } from '@/services/ai/pipeline/preDigestedReasoning'

describe('preDigestedReasoning — digestToolResults()', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty array', []],
  ])('returns the original message when data is %s', (_label, data) => {
    expect(digestToolResults('list_tasks', data as Parameters<typeof digestToolResults>[1], 'Found 0 tasks')).toBe('Found 0 tasks')
  })

  it('includes PRE-ANALYZED FACTS for task list with overdue task', () => {
    const data = [{ title: 'Fix bug', status: 'in_progress', daysOverdue: 3, priority: 'high' }]
    const result = digestToolResults('list_tasks', data, 'Found 1 task')
    expect(result).toContain('PRE-ANALYZED FACTS')
    expect(result).toContain('OVERDUE')
    expect(result).toContain('Fix bug')
    expect(result).toContain('3')
    expect(result).toContain('RECOMMENDATION')
  })

  it('digests productivity stats with completedToday and pomodorosToday', () => {
    const data = { completedToday: 5, pomodorosToday: 4 }
    const result = digestToolResults('get_productivity_stats', data, 'Stats')
    expect(result).toContain('Completed today: 5')
    expect(result).toContain('Pomodoros today: 4')
  })

  it('TASK-1820: digests weekly summary from the completed-task ARRAY (grounded count + titles)', () => {
    // get_weekly_summary now returns the real completed-this-week tasks, so the
    // digest is grounded in actual count + titles (no fabricated names/numbers).
    const data = [
      { id: 'c1', title: 'Ship release notes', priority: 'high', status: 'done' },
      { id: 'c2', title: 'Review PR #82', priority: 'medium', status: 'done' },
    ]
    const result = digestToolResults('get_weekly_summary', data, 'Weekly summary: 2 tasks completed, 1h 30m focus')
    expect(result).toContain('Completed this week: 2')
    expect(result).toContain('Ship release notes')
    expect(result).toContain('Review PR #82')
    expect(result).toContain('1h 30m') // carried in the message
  })

  it('digests timer status when running', () => {
    const data = { isActive: true, currentTaskName: 'Fix login bug', remainingSeconds: 600 }
    const result = digestToolResults('get_timer_status', data, 'Timer status')
    expect(result).toContain('RUNNING')
    expect(result).toContain('Fix login bug')
  })

  it('digests timer status when not running', () => {
    const data = { isActive: false, sessionsCompleted: 2 }
    const result = digestToolResults('get_timer_status', data, 'Timer status')
    expect(result).toContain('NOT RUNNING')
  })

  it('falls back with "Data:" prefix for unknown tool shapes', () => {
    const result = digestToolResults('unknown_tool', { foo: 'bar' }, 'message')
    expect(result).toContain('Data:')
    expect(result).toContain('message')
  })

  it('handles multiple tasks and sorts overdue by days', () => {
    const data = [
      { title: 'Minor task', status: 'planned', daysOverdue: 1, priority: 'low' },
      { title: 'Critical task', status: 'in_progress', daysOverdue: 10, priority: 'high' },
    ]
    const result = digestToolResults('list_tasks', data, 'Found tasks')
    const recIndex = result.indexOf('RECOMMENDATION')
    const criticalIndex = result.indexOf('Critical task', recIndex)
    expect(recIndex).toBeGreaterThan(-1)
    expect(criticalIndex).toBeGreaterThan(recIndex)
  })
})

// ============================================================================
// 6. Entity Resolver
// ============================================================================

import { resolveTask, resolveTaskOrThrow } from '@/services/ai/entityResolver'
import type { TaskLike } from '@/services/ai/entityResolver'

describe('entityResolver', () => {
  const tasks: TaskLike[] = [
    { id: '550e8400-e29b-41d4-a716-446655440000', title: 'My Task' },
    { id: 'different-id-xxx-yyyy-zzzz-aaaa-bbbbbbbbbbbb', title: 'Other Task' },
    { id: '11111111-2222-3333-4444-555555555555', title: 'Edit marketing video for Q1' },
    { id: '66666666-7777-8888-9999-000000000000', title: 'Fix login bug in auth flow' },
  ]

  describe('resolveTask()', () => {
    it('returns exact confidence when UUID matches exactly', () => {
      const result = resolveTask('550e8400-e29b-41d4-a716-446655440000', tasks)
      expect(result).not.toBeNull()
      expect(result?.confidence).toBe('exact')
      expect(result?.task.title).toBe('My Task')
    })

    it('returns null when UUID is provided but does not match any task', () => {
      const result = resolveTask('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', tasks)
      expect(result).toBeNull()
    })

    it.each([
      ['TASK-XXX format', 'TASK-123'],
      ['task- lowercase format', 'task-456'],
      ['empty string', ''],
      ['empty task list', 'marketing video'],
    ])('returns null for %s', (label, ref) => {
      const taskList = label === 'empty task list' ? [] : tasks
      expect(resolveTask(ref, taskList)).toBeNull()
    })

    it('resolves "marketing video" to the video task by fuzzy title match', () => {
      const result = resolveTask('marketing video', tasks)
      expect(result).not.toBeNull()
      expect(result?.task.id).toBe('11111111-2222-3333-4444-555555555555')
    })

    it('resolves "login bug" to the login task by fuzzy title match', () => {
      const result = resolveTask('login bug', tasks)
      expect(result).not.toBeNull()
      expect(result?.task.title).toContain('Fix login bug')
    })

    it('fuzzy match returns recognized confidence level', () => {
      const result = resolveTask('marketing video', tasks)
      expect(['exact', 'high', 'medium', 'low']).toContain(result?.confidence)
    })
  })

  describe('resolveTaskOrThrow()', () => {
    it('returns task for exact UUID match', () => {
      const result = resolveTaskOrThrow('550e8400-e29b-41d4-a716-446655440000', tasks)
      expect(result.title).toBe('My Task')
    })

    it.each([
      ['no match in empty list', 'nonexistent-query-with-no-match-xyz', [] as TaskLike[]],
      ['TASK-XXX format', 'TASK-999', tasks as TaskLike[]],
    ])('throws for %s', (_label, ref, taskList) => {
      expect(() => resolveTaskOrThrow(ref, taskList)).toThrow()
    })
  })
})

// ============================================================================
// 7. Context Optimizer
// ============================================================================

import { optimizeTaskContext, buildTaskStats } from '@/services/ai/pipeline/contextOptimizer'
import type { OptimizableTask, ProjectLookup } from '@/services/ai/pipeline/contextOptimizer'

describe('contextOptimizer', () => {
  const TODAY = '2026-02-21'
  const YESTERDAY = '2026-02-20'
  const TOMORROW = '2026-02-22'
  const NEXT_WEEK = '2026-02-25'

  function makeTask(overrides: Partial<OptimizableTask> & { id: string; title: string }): OptimizableTask {
    return {
      status: 'todo',
      priority: null,
      dueDate: null,
      projectId: null,
      _soft_deleted: false,
      ...overrides,
    }
  }

  describe('optimizeTaskContext()', () => {
    it.each([
      ['empty tasks array', []],
      ['all-done tasks', [{ id: '1', title: 'Done task', status: 'done' as const }]],
      ['all soft-deleted tasks', [{ id: '1', title: 'Deleted task', _soft_deleted: true as const }]],
    ])('returns empty string for %s', (_label, tasks) => {
      expect(optimizeTaskContext(tasks.map(t => makeTask(t as Parameters<typeof makeTask>[0])), [], { today: TODAY })).toBe('')
    })

    it('returns non-empty string for open tasks', () => {
      const tasks = [makeTask({ id: '1', title: 'Open task' })]
      const result = optimizeTaskContext(tasks, [], { today: TODAY })
      expect(result.length).toBeGreaterThan(0)
    })

    it.each([
      ['overdue', YESTERDAY, 'OVERDUE'],
      ['due today', TODAY, 'DUE TODAY'],
      ['due this week', NEXT_WEEK, 'THIS WEEK'],
    ])('places %s task in correct section', (_label, dueDate, expectedSection) => {
      const tasks = [makeTask({ id: '1', title: `${_label} task`, dueDate })]
      const result = optimizeTaskContext(tasks, [], { today: TODAY })
      expect(result).toContain(expectedSection)
      expect(result).toContain(`${_label} task`)
    })

    it('places todo tasks in TODO section when no due date', () => {
      const tasks = [makeTask({ id: '1', title: 'WIP task', status: 'todo' })]
      const result = optimizeTaskContext(tasks, [], { today: TODAY })
      expect(result).toContain('TODO')
      expect(result).toContain('WIP task')
    })

    it('quotes task titles in output', () => {
      const tasks = [makeTask({ id: '1', title: 'My Hebrew Task' })]
      const result = optimizeTaskContext(tasks, [], { today: TODAY })
      expect(result).toContain('"My Hebrew Task"')
    })

    it('includes project name and header section', () => {
      const tasks = [makeTask({ id: '1', title: 'Proj task', projectId: 'proj-1' })]
      const projects: ProjectLookup[] = [{ id: 'proj-1', name: 'Authentication Service' }]
      const result = optimizeTaskContext(tasks, projects, { today: TODAY })
      expect(result).toContain('Authentication Service')
      expect(result).toContain('YOUR TASK DATA')
    })

    it('does not include done tasks in the output', () => {
      const tasks = [
        makeTask({ id: '1', title: 'Open task' }),
        makeTask({ id: '2', title: 'Done task', status: 'done' }),
      ]
      const result = optimizeTaskContext(tasks, [], { today: TODAY })
      expect(result).toContain('Open task')
      expect(result).not.toContain('Done task')
    })

    it('respects character budget — truncates with omission notice', () => {
      const overdueTask = makeTask({ id: 'od-0', title: 'Overdue task', dueDate: YESTERDAY })
      const otherTasks: OptimizableTask[] = Array.from({ length: 30 }, (_, i) =>
        makeTask({ id: `t-${i}`, title: `Other task with a fairly long title to consume budget number ${i}` })
      )
      const tasks = [overdueTask, ...otherTasks]
      const result = optimizeTaskContext(tasks, [], { today: TODAY, charBudget: 300 })
      expect(result).toContain('omitted due to space')
    })
  })

  describe('buildTaskStats()', () => {
    it('returns "0 active" phrasing for empty task array', () => {
      const result = buildTaskStats([])
      expect(result).toContain('0')
    })

    it('includes total task count, overdue count, and todo count', () => {
      const tasks = [
        makeTask({ id: '1', title: 'Planned', status: 'planned' }),
        makeTask({ id: '2', title: 'In Progress', status: 'in_progress' }),
        makeTask({ id: '3', title: 'Done', status: 'done' }),
        makeTask({ id: '4', title: 'Overdue A', dueDate: YESTERDAY, status: 'planned' }),
        makeTask({ id: '5', title: 'Overdue B', dueDate: YESTERDAY, status: 'in_progress' }),
        makeTask({ id: '6', title: 'WIP 1', status: 'todo' }),
        makeTask({ id: '7', title: 'WIP 2', status: 'todo' }),
      ]
      const result = buildTaskStats(tasks, TODAY)
      expect(result).toContain('7 total')
      expect(result).toContain('2 overdue')
      expect(result).toContain('2 todo')
    })

    it('does not count done tasks as overdue even if past due date', () => {
      const tasks = [
        makeTask({ id: '1', title: 'Done but past due', dueDate: YESTERDAY, status: 'done' }),
      ]
      const result = buildTaskStats(tasks, TODAY)
      expect(result).toContain('0 overdue')
    })

    it('returns string containing "Tasks:"', () => {
      const result = buildTaskStats([], TODAY)
      expect(result).toContain('Tasks:')
    })
  })
})
