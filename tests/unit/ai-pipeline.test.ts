/**
 * AI Pipeline Unit Tests
 *
 * Comprehensive tests for all AI pipeline modules:
 * - languageDetector
 * - responseValidator
 * - fluffDetector
 * - toolHints
 * - preDigestedReasoning
 * - entityMemory
 * - entityResolver
 * - contextOptimizer
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

    it('returns "unknown" for empty string', () => {
      expect(detectLanguage('')).toBe('unknown')
    })

    it('returns "unknown" for whitespace-only string', () => {
      expect(detectLanguage('   ')).toBe('unknown')
    })

    it('returns "unknown" for numbers-only string', () => {
      expect(detectLanguage('12345 6789')).toBe('unknown')
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
    it('returns "rtl" for Hebrew', () => {
      expect(getTextDirection('he')).toBe('rtl')
    })

    it('returns "ltr" for English', () => {
      expect(getTextDirection('en')).toBe('ltr')
    })

    it('returns "ltr" for unknown', () => {
      expect(getTextDirection('unknown')).toBe('ltr')
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

  it('strips standalone tool name references from response', () => {
    const toolNames = ['list_tasks', 'get_overdue_tasks', 'search_tasks', 'get_daily_summary']
    for (const toolName of toolNames) {
      const input = `Using ${toolName} to find your data.`
      const result = cleanResponse(input)
      expect(result).not.toContain(toolName)
    }
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
      // Response with specific data should not get the "no specific data" penalty
      const response = 'You have 3 tasks overdue, including one that is 5 days late. You completed 40% of your weekly goal.'
      const result1 = detectFluff(response, [], true)

      // Response without specific data gets penalty
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

    it('returns empty array when data is null', () => {
      const toolResults = [{ data: null }]
      expect(extractTaskTitlesFromResults(toolResults)).toEqual([])
    })

    it('returns empty array for empty toolResults', () => {
      expect(extractTaskTitlesFromResults([])).toEqual([])
    })

    it('returns empty array when data is empty array', () => {
      const toolResults = [{ data: [] }]
      expect(extractTaskTitlesFromResults(toolResults)).toEqual([])
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

    it('returns hint with tool "generate_weekly_plan" for "plan my week"', () => {
      const hints = getToolHints('plan my week')
      expect(hints.some(h => h.tool === 'generate_weekly_plan')).toBe(true)
    })

    it('returns hint with tool "start_timer" for "start timer" (NOT get_timer_status)', () => {
      const hints = getToolHints('start timer')
      expect(hints.some(h => h.tool === 'start_timer')).toBe(true)
      // The start_timer match should appear before get_timer_status due to specificity
      const startTimerIdx = hints.findIndex(h => h.tool === 'start_timer')
      const timerStatusIdx = hints.findIndex(h => h.tool === 'get_timer_status')
      if (timerStatusIdx !== -1) {
        expect(startTimerIdx).toBeLessThan(timerStatusIdx)
      }
    })

    it('returns empty array for generic greeting with no keywords', () => {
      expect(getToolHints('hello')).toEqual([])
    })

    it('returns empty array for empty string', () => {
      expect(getToolHints('')).toEqual([])
    })

    it('returns empty array for whitespace-only string', () => {
      expect(getToolHints('   ')).toEqual([])
    })

    it('matches Hebrew keywords for task listing', () => {
      const hints = getToolHints('מה המשימות שלי')
      expect(hints.length).toBeGreaterThan(0)
    })

    it('matches Hebrew keyword for overdue tasks', () => {
      const hints = getToolHints('יש לי משימות באיחור?')
      expect(hints.some(h => h.tool === 'get_overdue_tasks')).toBe(true)
    })

    it('deduplicates tool names (same tool not returned twice)', () => {
      const hints = getToolHints('show me my tasks and all tasks in the list')
      const tools = hints.map(h => h.tool)
      const uniqueTools = new Set(tools)
      expect(tools.length).toBe(uniqueTools.size)
    })

    it('matches "stop timer" to stop_timer tool', () => {
      const hints = getToolHints('stop timer')
      expect(hints.some(h => h.tool === 'stop_timer')).toBe(true)
    })

    it('matches "weekly summary" to get_weekly_summary', () => {
      const hints = getToolHints('give me a weekly summary')
      expect(hints.some(h => h.tool === 'get_weekly_summary')).toBe(true)
    })

    it('matches "statistics" to get_productivity_stats', () => {
      const hints = getToolHints('show me my statistics')
      expect(hints.some(h => h.tool === 'get_productivity_stats')).toBe(true)
    })

    it('matches "create task" to create_task', () => {
      const hints = getToolHints('create task: buy groceries')
      expect(hints.some(h => h.tool === 'create_task')).toBe(true)
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

    it('includes the tool name in backticks', () => {
      const hints: ToolHint[] = [{ tool: 'list_tasks', reason: 'User wants tasks' }]
      expect(formatToolHints(hints)).toContain('`list_tasks`')
    })

    it('includes the reason text', () => {
      const hints: ToolHint[] = [{ tool: 'list_tasks', reason: 'User wants tasks' }]
      expect(formatToolHints(hints)).toContain('User wants tasks')
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

    it('formats a single hint correctly', () => {
      const hints: ToolHint[] = [{ tool: 'get_overdue_tasks', reason: 'User is asking about overdue tasks' }]
      const result = formatToolHints(hints)
      expect(result).toMatch(/TOOL HINTS/)
      expect(result).toMatch(/`get_overdue_tasks`/)
    })
  })
})

// ============================================================================
// 5. Pre-Digested Reasoning
// ============================================================================

import { digestToolResults } from '@/services/ai/pipeline/preDigestedReasoning'

describe('preDigestedReasoning — digestToolResults()', () => {
  it('returns the original message when data is null/undefined', () => {
    expect(digestToolResults('list_tasks', null, 'Found 0 tasks')).toBe('Found 0 tasks')
    expect(digestToolResults('list_tasks', undefined, 'No data')).toBe('No data')
  })

  it('returns the original message when data is an empty array', () => {
    expect(digestToolResults('list_tasks', [], 'Found 0 tasks')).toBe('Found 0 tasks')
  })

  it('includes PRE-ANALYZED FACTS for task list with overdue task', () => {
    const data = [{ title: 'Fix bug', status: 'in_progress', daysOverdue: 3, priority: 'high' }]
    const result = digestToolResults('list_tasks', data, 'Found 1 task')
    expect(result).toContain('PRE-ANALYZED FACTS')
    expect(result).toContain('OVERDUE')
    expect(result).toContain('Fix bug')
  })

  it('includes task name and days overdue in digested output', () => {
    const data = [{ title: 'Fix bug', status: 'in_progress', daysOverdue: 3, priority: 'high' }]
    const result = digestToolResults('list_tasks', data, 'Found 1 task')
    expect(result).toContain('Fix bug')
    expect(result).toContain('3')
  })

  it('digests productivity stats with todayCompleted', () => {
    const data = { todayCompleted: 5, todayPomodoros: 3 }
    const result = digestToolResults('get_productivity_stats', data, 'Stats')
    expect(result).toContain('Completed today: 5')
  })

  it('digests productivity stats with todayPomodoros', () => {
    const data = { todayCompleted: 2, todayPomodoros: 4 }
    const result = digestToolResults('get_productivity_stats', data, 'Stats')
    expect(result).toContain('Pomodoros today: 4')
  })

  it('digests weekly summary with completedThisWeek', () => {
    const data = { completedThisWeek: 8, totalFocusMinutes: 150 }
    const result = digestToolResults('get_weekly_summary', data, 'Week summary')
    expect(result).toContain('Completed this week: 8')
  })

  it('digests weekly summary with totalFocusMinutes as hours+minutes', () => {
    const data = { completedThisWeek: 3, totalFocusMinutes: 90 }
    const result = digestToolResults('get_weekly_summary', data, 'Week summary')
    expect(result).toContain('1h 30m')
  })

  it('digests timer status when running', () => {
    const data = { isRunning: true, currentTask: 'Fix login bug', remainingSeconds: 600 }
    const result = digestToolResults('get_timer_status', data, 'Timer status')
    expect(result).toContain('RUNNING')
    expect(result).toContain('Fix login bug')
  })

  it('digests timer status when not running', () => {
    const data = { isRunning: false, completedToday: 2 }
    const result = digestToolResults('get_timer_status', data, 'Timer status')
    expect(result).toContain('NOT RUNNING')
  })

  it('falls back with "Data:" prefix for unknown tool shapes', () => {
    const result = digestToolResults('unknown_tool', { foo: 'bar' }, 'message')
    expect(result).toContain('Data:')
    expect(result).toContain('message')
  })

  it('includes RECOMMENDATION section for task lists', () => {
    const data = [{ title: 'Fix bug', status: 'in_progress', daysOverdue: 3, priority: 'high' }]
    const result = digestToolResults('list_tasks', data, 'Found 1 task')
    expect(result).toContain('RECOMMENDATION')
  })

  it('handles multiple tasks and sorts overdue by days', () => {
    const data = [
      { title: 'Minor task', status: 'planned', daysOverdue: 1, priority: 'low' },
      { title: 'Critical task', status: 'in_progress', daysOverdue: 10, priority: 'high' },
    ]
    const result = digestToolResults('list_tasks', data, 'Found tasks')
    // Critical (10 days) should be recommended first
    const recIndex = result.indexOf('RECOMMENDATION')
    const criticalIndex = result.indexOf('Critical task', recIndex)
    expect(recIndex).toBeGreaterThan(-1)
    expect(criticalIndex).toBeGreaterThan(recIndex)
  })
})

// ============================================================================
// 6. Entity Memory
// ============================================================================

import { EntityMemory, extractEntitiesFromToolResult } from '@/services/ai/pipeline/entityMemory'

describe('entityMemory', () => {
  describe('EntityMemory class', () => {
    let memory: EntityMemory

    beforeEach(() => {
      memory = new EntityMemory()
    })

    it('starts with empty entity list', () => {
      expect(memory.getRecent()).toEqual([])
    })

    it('getLastMentioned() returns null when empty', () => {
      expect(memory.getLastMentioned()).toBeNull()
    })

    it('trackFromToolResult() adds entities from array data', () => {
      memory.trackFromToolResult([{ id: '1', title: 'Task A' }])
      const last = memory.getLastMentioned()
      expect(last).not.toBeNull()
      expect(last?.title).toBe('Task A')
      expect(last?.id).toBe('1')
    })

    it('trackFromToolResult() sets source to "tool_result"', () => {
      memory.trackFromToolResult([{ id: '1', title: 'Task A' }])
      expect(memory.getLastMentioned()?.source).toBe('tool_result')
    })

    it('most recently tracked entity is first in getRecent()', () => {
      memory.trackFromToolResult([{ id: '1', title: 'First Task' }])
      // Small delay is not possible in sync code; track second immediately
      memory.trackFromToolResult([{ id: '2', title: 'Second Task' }])
      const recent = memory.getRecent()
      expect(recent[0].title).toBe('Second Task')
    })

    it('deduplicates entities — same ID updates to front', () => {
      memory.trackFromToolResult([{ id: '1', title: 'Task A' }])
      memory.trackFromToolResult([{ id: '2', title: 'Task B' }])
      memory.trackFromToolResult([{ id: '1', title: 'Task A' }]) // re-track
      const recent = memory.getRecent()
      // Task A should be first (most recent), Task B second
      expect(recent[0].title).toBe('Task A')
      // No duplicates
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

    it('formatForPrompt() includes RECENTLY MENTIONED TASKS when entities exist', () => {
      memory.trackFromToolResult([{ id: '1', title: 'Fix login bug' }])
      const prompt = memory.formatForPrompt()
      expect(prompt).toContain('RECENTLY MENTIONED TASKS')
    })

    it('formatForPrompt() includes task title and ID', () => {
      memory.trackFromToolResult([{ id: 'abc-999', title: 'Write unit tests' }])
      const prompt = memory.formatForPrompt()
      expect(prompt).toContain('Write unit tests')
      expect(prompt).toContain('abc-999')
    })

    it('formatForPrompt() labels first entity as (most recent)', () => {
      memory.trackFromToolResult([{ id: '1', title: 'Most Recent Task' }])
      const prompt = memory.formatForPrompt()
      expect(prompt).toContain('(most recent)')
    })

    it('clear() resets everything', () => {
      memory.trackFromToolResult([{ id: '1', title: 'Task A' }])
      memory.clear()
      expect(memory.getRecent()).toEqual([])
      expect(memory.getLastMentioned()).toBeNull()
      expect(memory.formatForPrompt()).toBe('')
    })
  })

  describe('extractEntitiesFromToolResult()', () => {
    it('extracts from array of objects with id+title', () => {
      const data = [{ id: '1', title: 'Task A' }, { id: '2', title: 'Task B' }]
      expect(extractEntitiesFromToolResult(data)).toEqual([
        { id: '1', title: 'Task A' },
        { id: '2', title: 'Task B' },
      ])
    })

    it('extracts from single object with id+title', () => {
      const data = { id: '42', title: 'Single Task' }
      expect(extractEntitiesFromToolResult(data)).toEqual([{ id: '42', title: 'Single Task' }])
    })

    it('returns empty array for null', () => {
      expect(extractEntitiesFromToolResult(null)).toEqual([])
    })

    it('returns empty array for undefined', () => {
      expect(extractEntitiesFromToolResult(undefined)).toEqual([])
    })

    it('skips array items missing id or title', () => {
      const data = [{ id: '1' }, { title: 'Only title' }, { id: '3', title: 'Complete' }]
      const result = extractEntitiesFromToolResult(data)
      expect(result).toEqual([{ id: '3', title: 'Complete' }])
    })
  })
})

// ============================================================================
// 7. Entity Resolver
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

    it('returns null for TASK-XXX format references (guard prevents fuzzy match)', () => {
      expect(resolveTask('TASK-123', tasks)).toBeNull()
      expect(resolveTask('task-456', tasks)).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(resolveTask('', tasks)).toBeNull()
    })

    it('returns null when tasks list is empty', () => {
      expect(resolveTask('marketing video', [])).toBeNull()
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

    it('fuzzy match returns non-null confidence level', () => {
      const result = resolveTask('marketing video', tasks)
      expect(['exact', 'high', 'medium', 'low']).toContain(result?.confidence)
    })
  })

  describe('resolveTaskOrThrow()', () => {
    it('returns task for exact UUID match', () => {
      const result = resolveTaskOrThrow('550e8400-e29b-41d4-a716-446655440000', tasks)
      expect(result.title).toBe('My Task')
    })

    it('throws when no match is found', () => {
      expect(() => resolveTaskOrThrow('nonexistent-query-with-no-match-xyz', [])).toThrow()
    })

    it('throws for TASK-XXX format', () => {
      expect(() => resolveTaskOrThrow('TASK-999', tasks)).toThrow()
    })
  })
})

// ============================================================================
// 8. Context Optimizer
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
      status: 'planned',
      priority: null,
      dueDate: null,
      projectId: null,
      _soft_deleted: false,
      ...overrides,
    }
  }

  describe('optimizeTaskContext()', () => {
    it('returns empty string when tasks array is empty', () => {
      expect(optimizeTaskContext([], [], { today: TODAY })).toBe('')
    })

    it('returns empty string when all tasks are done', () => {
      const tasks = [makeTask({ id: '1', title: 'Done task', status: 'done' })]
      expect(optimizeTaskContext(tasks, [], { today: TODAY })).toBe('')
    })

    it('returns empty string when all tasks are soft-deleted', () => {
      const tasks = [makeTask({ id: '1', title: 'Deleted task', _soft_deleted: true })]
      expect(optimizeTaskContext(tasks, [], { today: TODAY })).toBe('')
    })

    it('returns non-empty string for open tasks', () => {
      const tasks = [makeTask({ id: '1', title: 'Open task' })]
      const result = optimizeTaskContext(tasks, [], { today: TODAY })
      expect(result.length).toBeGreaterThan(0)
    })

    it('places overdue tasks in OVERDUE section', () => {
      const tasks = [makeTask({ id: '1', title: 'Overdue task', dueDate: YESTERDAY })]
      const result = optimizeTaskContext(tasks, [], { today: TODAY })
      expect(result).toContain('OVERDUE')
      expect(result).toContain('Overdue task')
    })

    it('places due-today tasks in DUE TODAY section', () => {
      const tasks = [makeTask({ id: '1', title: 'Today task', dueDate: TODAY })]
      const result = optimizeTaskContext(tasks, [], { today: TODAY })
      expect(result).toContain('DUE TODAY')
      expect(result).toContain('Today task')
    })

    it('places tasks due this week in THIS WEEK section', () => {
      const tasks = [makeTask({ id: '1', title: 'Week task', dueDate: NEXT_WEEK })]
      const result = optimizeTaskContext(tasks, [], { today: TODAY })
      expect(result).toContain('THIS WEEK')
      expect(result).toContain('Week task')
    })

    it('places in-progress tasks in IN PROGRESS section when no due date', () => {
      const tasks = [makeTask({ id: '1', title: 'WIP task', status: 'in_progress' })]
      const result = optimizeTaskContext(tasks, [], { today: TODAY })
      expect(result).toContain('IN PROGRESS')
      expect(result).toContain('WIP task')
    })

    it('quotes task titles in output', () => {
      const tasks = [makeTask({ id: '1', title: 'My Hebrew Task' })]
      const result = optimizeTaskContext(tasks, [], { today: TODAY })
      expect(result).toContain('"My Hebrew Task"')
    })

    it('includes project name when projectId matches a project', () => {
      const tasks = [makeTask({ id: '1', title: 'Proj task', projectId: 'proj-1' })]
      const projects: ProjectLookup[] = [{ id: 'proj-1', name: 'Authentication Service' }]
      const result = optimizeTaskContext(tasks, projects, { today: TODAY })
      expect(result).toContain('Authentication Service')
    })

    it('includes header section about task data', () => {
      const tasks = [makeTask({ id: '1', title: 'Test task' })]
      const result = optimizeTaskContext(tasks, [], { today: TODAY })
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
      // Put one overdue task so OVERDUE section is emitted first, then many "other" tasks
      // that will push the total over the budget on the next addSection call.
      const overdueTask = makeTask({ id: 'od-0', title: 'Overdue task', dueDate: YESTERDAY })
      const otherTasks: OptimizableTask[] = Array.from({ length: 30 }, (_, i) =>
        makeTask({ id: `t-${i}`, title: `Other task with a fairly long title to consume budget number ${i}` })
      )
      const tasks = [overdueTask, ...otherTasks]
      // charBudget is set to just above the OVERDUE section size so OTHER overflows
      const result = optimizeTaskContext(tasks, [], { today: TODAY, charBudget: 300 })
      expect(result).toContain('omitted due to space')
    })
  })

  describe('buildTaskStats()', () => {
    it('returns "0 active" phrasing for empty task array', () => {
      const result = buildTaskStats([])
      expect(result).toContain('0')
    })

    it('includes total task count', () => {
      const tasks = [
        makeTask({ id: '1', title: 'Task 1', status: 'planned' }),
        makeTask({ id: '2', title: 'Task 2', status: 'in_progress' }),
        makeTask({ id: '3', title: 'Task 3', status: 'done' }),
      ]
      const result = buildTaskStats(tasks, TODAY)
      expect(result).toContain('3 total')
    })

    it('counts overdue tasks correctly', () => {
      const tasks = [
        makeTask({ id: '1', title: 'Overdue A', dueDate: YESTERDAY, status: 'planned' }),
        makeTask({ id: '2', title: 'Overdue B', dueDate: YESTERDAY, status: 'in_progress' }),
        makeTask({ id: '3', title: 'Future task', dueDate: TOMORROW, status: 'planned' }),
      ]
      const result = buildTaskStats(tasks, TODAY)
      expect(result).toContain('2 overdue')
    })

    it('does not count done tasks as overdue even if past due date', () => {
      const tasks = [
        makeTask({ id: '1', title: 'Done but past due', dueDate: YESTERDAY, status: 'done' }),
      ]
      const result = buildTaskStats(tasks, TODAY)
      expect(result).toContain('0 overdue')
    })

    it('counts in_progress tasks', () => {
      const tasks = [
        makeTask({ id: '1', title: 'WIP task', status: 'in_progress' }),
        makeTask({ id: '2', title: 'WIP task 2', status: 'in_progress' }),
      ]
      const result = buildTaskStats(tasks, TODAY)
      expect(result).toContain('2 in progress')
    })

    it('returns string containing "Tasks:"', () => {
      const result = buildTaskStats([], TODAY)
      expect(result).toContain('Tasks:')
    })
  })
})
