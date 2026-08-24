/**
 * TASK-1814 — Task Assist AI surface (useAITaskAssist).
 *
 * This is a separate AI entry point from the chat (the per-task popover:
 * break down, suggest subtasks, smart-suggest). It goes through the SAME shared
 * router → bridge. These tests mock the router's streamed output to verify the
 * composable parses real and malformed brain responses correctly (parsing is what
 * gates whether the popover shows useful results vs an error).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Task } from '@/types/tasks'

// The brain's streamed reply for the next call (set per test).
let mockReply = ''
let capturedSystemPrompt = ''
vi.mock('@/services/ai/routerFactory', () => ({
  getSharedRouter: vi.fn(() => Promise.resolve({
    // streamAI() collects chunk.content — yield the whole reply as one chunk.
    chatStream: async function* (messages: Array<{ role: string; content: string }>) {
      capturedSystemPrompt = messages.find(message => message.role === 'system')?.content || ''
      yield { content: mockReply, done: true }
    },
    getLastUsedProvider: () => 'bridge',
  })),
  resetSharedRouter: vi.fn(),
}))

import { useAITaskAssist } from '@/composables/useAITaskAssist'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't-1',
    title: 'Launch the new marketing site',
    description: 'High-level goal',
    status: 'planned',
    priority: 'high',
    projectId: 'p-1',
    dueDate: null,
    estimatedDuration: null,
    ...overrides,
  } as Task
}

describe('Task Assist AI surface (useAITaskAssist)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockReply = ''
    capturedSystemPrompt = ''
  })

  it('breakDownTask parses { tasks: [...] } into a breakdown', async () => {
    mockReply = '{"tasks":[{"title":"Design mockups","priority":"high"},{"title":"Write copy"}]}'
    const a = useAITaskAssist()
    await a.breakDownTask(makeTask())
    expect(a.error.value).toBeNull()
    expect(a.result.value?.type).toBe('breakdown')
    expect(a.result.value?.breakdown?.map(b => b.title)).toEqual(['Design mockups', 'Write copy'])
  })

  it('breakDownTask tolerates a fenced ```json code block', async () => {
    mockReply = '```json\n{"tasks":[{"title":"Step one"}]}\n```'
    const a = useAITaskAssist()
    await a.breakDownTask(makeTask())
    expect(a.result.value?.breakdown?.[0].title).toBe('Step one')
  })

  it('suggestSubtasks parses { subtasks: [...] }', async () => {
    mockReply = '{"subtasks":["Research","Draft","Review"]}'
    const a = useAITaskAssist()
    await a.suggestSubtasks(makeTask())
    expect(a.result.value?.type).toBe('subtasks')
    expect(a.result.value?.subtasks).toEqual(['Research', 'Draft', 'Review'])
  })

  it('suggestSubtasks accepts a raw array fallback', async () => {
    mockReply = '["a","b"]'
    const a = useAITaskAssist()
    await a.suggestSubtasks(makeTask())
    expect(a.result.value?.subtasks).toEqual(['a', 'b'])
  })

  it('smartSuggest parses valid suggestions and filters unchanged values', async () => {
    mockReply = '{"suggestions":[{"field":"priority","value":"low","confidence":0.9,"reason":"small"},{"field":"estimatedDuration","value":30,"confidence":0.8,"reason":"quick"}]}'
    const a = useAITaskAssist()
    await a.smartSuggest(makeTask({ priority: 'high', estimatedDuration: null }))
    const fields = a.result.value?.smartSuggest?.suggestions.map(s => s.field) ?? []
    // priority high→low is a change (kept); duration none→30 is a change (kept)
    expect(fields).toContain('priority')
    expect(fields).toContain('estimatedDuration')
  })

  it('smartSuggest includes learned scheduling context in the model prompt', async () => {
    mockReply = '{"suggestions":[]}'
    const a = useAITaskAssist()
    await a.smartSuggest(makeTask({ priority: null }))
    expect(capturedSystemPrompt).toContain('USER CONTEXT')
  })

  it('smartSuggest asks for consequence context instead of promoting a task from a date alone', async () => {
    mockReply = JSON.stringify({
      contextQuestion: 'What happens if this slips, and who is expecting it?',
      suggestions: [
        { field: 'priority', value: 'high', confidence: 0.95, reason: 'It has a deadline' },
        { field: 'dueDate', value: '2026-09-01', confidence: 0.9, reason: 'The date sounds important' },
        { field: 'estimatedDuration', value: 60, confidence: 0.7, reason: 'This needs focused work' }
      ]
    })

    const a = useAITaskAssist()
    await a.smartSuggest(makeTask({
      title: 'Prepare promotion case',
      description: 'Discuss growth at work',
      priority: null,
      dueDate: null,
      estimatedDuration: null
    }))

    const suggestions = a.result.value?.smartSuggest?.suggestions ?? []
    expect(a.result.value?.smartSuggest?.contextQuestion).toContain('What happens if this slips')
    expect(suggestions.map(s => s.field)).not.toContain('priority')
    expect(suggestions.map(s => s.field)).not.toContain('dueDate')
    expect(suggestions.map(s => s.field)).toContain('estimatedDuration')
  })

  it('malformed JSON surfaces a clean error (not a crash) for breakDownTask', async () => {
    mockReply = 'Sure! Here is a breakdown: first do X, then Y.' // prose, no JSON
    const a = useAITaskAssist()
    await a.breakDownTask(makeTask())
    expect(a.result.value).toBeNull()
    expect(a.error.value).toBeTruthy()
  })

  it('smartSuggest falls back to deterministic suggestions on unparseable output', async () => {
    mockReply = 'totally not json'
    const a = useAITaskAssist()
    await a.smartSuggest(makeTask({ priority: undefined, dueDate: null, estimatedDuration: null }))
    // The composable has a deterministic fallback — it should still produce something
    // or a clean empty result, never throw.
    expect(a.error.value).toBeNull()
    expect(a.result.value?.type).toBe('smartSuggest')
  })
})
