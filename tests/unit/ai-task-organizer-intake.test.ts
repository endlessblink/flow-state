import { describe, expect, it } from 'vitest'
import type { RoutedIntent } from '@/services/ai/pipeline/intentRouter'
import {
  extractPastedTaskDrafts,
  isTaskOrganizerRequest,
  scopeTaskOrganizerIntent,
} from '@/services/ai/pipeline/taskOrganizer'

describe('AI task organizer intake', () => {
  it('extracts, normalizes, and deduplicates pasted task lines', () => {
    const drafts = extractPastedTaskDrafts(`Organize these tasks:
- Call Maya about the renewal
- website
-   Call   Maya about the renewal
- Draft launch checklist`)

    expect(drafts).toEqual([
      expect.objectContaining({ title: 'Call Maya about the renewal', draft: true, needsClarification: false }),
      expect.objectContaining({ title: 'website', draft: true, needsClarification: true }),
      expect.objectContaining({ title: 'Draft launch checklist', draft: true, needsClarification: false }),
    ])
    expect(new Set(drafts.map(draft => draft.id)).size).toBe(3)
  })

  it('recognizes organizer requests without requiring lane wording', () => {
    expect(isTaskOrganizerRequest('Organize these selected tasks')).toBe(true)
    expect(isTaskOrganizerRequest('Clean up and group my inbox tasks')).toBe(true)
    expect(isTaskOrganizerRequest('ארגן את המשימות המסומנות')).toBe(true)
    expect(isTaskOrganizerRequest('show my tasks')).toBe(false)
  })

  it('recognizes raw pasted task lists without an organizer instruction', () => {
    const english = '- Call Maya\n- Draft launch brief'
    const hebrew = '• להתקשר למאיה\n• להכין מסמך השקה'

    expect(isTaskOrganizerRequest(english)).toBe(true)
    expect(extractPastedTaskDrafts(english)).toHaveLength(2)
    expect(isTaskOrganizerRequest(hebrew)).toBe(true)
    expect(extractPastedTaskDrafts(hebrew)).toHaveLength(2)
  })

  it('adds selected IDs only to organizer task reads', () => {
    const organizer: RoutedIntent = {
      type: 'task_query',
      tools: [{ tool: 'list_tasks', parameters: { status: 'todo', limit: 30 } }],
      language: 'en',
      formatDirective: 'Organize tasks',
      responseMode: 'smart_lanes',
    }
    const unrelated: RoutedIntent = { ...organizer, responseMode: 'week_plan' }

    expect(scopeTaskOrganizerIntent(organizer, ['task-a', 'task-b']).tools[0].parameters).toEqual({
      status: 'todo',
      limit: 30,
      taskIds: ['task-a', 'task-b'],
    })
    expect(scopeTaskOrganizerIntent(unrelated, ['task-a']).tools[0].parameters).toEqual({
      status: 'todo',
      limit: 30,
    })
  })
})
