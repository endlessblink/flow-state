/**
 * TASK-1814: text tool-call parsing for subscription bridge brains.
 *
 * The claude/codex CLIs can't do native function-calling, so they emit tool calls
 * as text (`tool_name({...})`). These assertions use the EXACT strings the brains
 * produced in live verification, so a regression in parseTextToolCalls (which gates
 * whether action queries execute) fails this suite.
 */
import { describe, it, expect } from 'vitest'
import { parseTextToolCalls, buildTextToolsBehaviorPrompt } from '@/services/ai/tools'

describe('bridge brain text tool-call parsing (TASK-1814)', () => {
  it('parses Claude mark_task_done with a Hebrew title fragment', () => {
    const out = 'mark_task_done({"task":"לבדוק עם רויטל בקשר ליום הולדת שלה"})'
    const calls = parseTextToolCalls(out)
    expect(calls).toHaveLength(1)
    expect(calls[0].tool).toBe('mark_task_done')
    expect(calls[0].parameters).toEqual({ task: 'לבדוק עם רויטל בקשר ליום הולדת שלה' })
  })

  it('parses an empty-paren call: get_overdue_tasks()', () => {
    const calls = parseTextToolCalls('get_overdue_tasks()')
    expect(calls).toHaveLength(1)
    expect(calls[0].tool).toBe('get_overdue_tasks')
    expect(calls[0].parameters).toEqual({})
  })

  it('parses Codex create_task with title + dueDate', () => {
    const calls = parseTextToolCalls('create_task({"title":"call the dentist","dueDate":"2026-06-06"})')
    expect(calls[0].tool).toBe('create_task')
    expect(calls[0].parameters).toEqual({ title: 'call the dentist', dueDate: '2026-06-06' })
  })

  it('parses search_tasks with a query', () => {
    const calls = parseTextToolCalls('search_tasks({"query":"Reuital"})')
    expect(calls[0].tool).toBe('search_tasks')
    expect(calls[0].parameters).toEqual({ query: 'Reuital' })
  })

  it('extracts a tool call even with a leading sentence (model preamble)', () => {
    const calls = parseTextToolCalls('Sure. get_overdue_tasks({})')
    expect(calls.some(c => c.tool === 'get_overdue_tasks')).toBe(true)
  })

  it('returns nothing for plain prose with no tool call', () => {
    expect(parseTextToolCalls('Here are your most important tasks — they look urgent.')).toHaveLength(0)
  })

  it('still parses the JSON {"tool":...} fallback form', () => {
    const calls = parseTextToolCalls('{"tool":"list_tasks","parameters":{}}')
    expect(calls.some(c => c.tool === 'list_tasks')).toBe(true)
  })

  // ── Robustness / edge cases ──────────────────────────────────────────────

  it('does not throw on malformed JSON args, yields empty params', () => {
    const calls = parseTextToolCalls('mark_task_done({task: Reuital, broken)')
    // regex captures up to first ) → "{task: Reuital, broken" → JSON.parse fails → {}
    expect(calls).toHaveLength(1)
    expect(calls[0].tool).toBe('mark_task_done')
    expect(calls[0].parameters).toEqual({})
  })

  it('extracts a tool call embedded in a full sentence of prose', () => {
    const calls = parseTextToolCalls('Of course — let me pull those up. get_overdue_tasks({}) so you can see them.')
    expect(calls.some(c => c.tool === 'get_overdue_tasks')).toBe(true)
  })

  it('extracts multiple distinct tool calls', () => {
    const calls = parseTextToolCalls('search_tasks({"query":"bug"})\ncreate_task({"title":"Fix it"})')
    const names = calls.map(c => c.tool)
    expect(names).toContain('search_tasks')
    expect(names).toContain('create_task')
  })

  it('ignores function-like text that is not a known tool', () => {
    const calls = parseTextToolCalls('someRandomFunction({"x":1}) and console.log("hi")')
    expect(calls).toHaveLength(0)
  })

  it('handles an empty / whitespace string', () => {
    expect(parseTextToolCalls('')).toHaveLength(0)
    expect(parseTextToolCalls('   \n  ')).toHaveLength(0)
  })

  it('the bridge tool prompt keeps the wired-in framing that stops "no access" refusals', () => {
    const prompt = buildTextToolsBehaviorPrompt()
    // The exact framing that made claude -p emit calls instead of claiming no access
    expect(prompt).toMatch(/executed/i)
    expect(prompt).toMatch(/never claim you lack access/i)
    expect(prompt).toMatch(/mark_task_done/)
    expect(prompt).toMatch(/tool_name\(\{/)
  })
})
