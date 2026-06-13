import { describe, expect, it } from 'vitest'
import { scrubToolActivityMessage } from '@/composables/useAIChat'
import type { ToolCall, ToolResult } from '@/services/ai/tools'

function call(tool: string): ToolCall {
  return { tool, parameters: {} }
}

function result(message: string): ToolResult {
  return { success: true, message }
}

describe('AI chat activity message display', () => {
  it('scrubs weekly-plan English task-count read activity', () => {
    expect(scrubToolActivityMessage(call('list_tasks'), result('Found 40 tasks'), 'week_plan', 'read'))
      .toBe('Loaded weekly planning candidates')
    expect(scrubToolActivityMessage(call('search_tasks'), result('Found 3 tasks matching "week"'), 'week_plan', 'read'))
      .toBe('Loaded weekly planning candidates')
    expect(scrubToolActivityMessage(call('get_overdue_tasks'), result('Found 4 overdue tasks'), 'week_plan', 'read'))
      .toBe('Loaded weekly planning candidates')
  })

  it('scrubs weekly-plan Hebrew task-count read activity', () => {
    expect(scrubToolActivityMessage(call('list_tasks'), result('נמצאו 40 משימות'), 'week_plan', 'read'))
      .toBe('נטענו מועמדים לתכנון השבוע')
    expect(scrubToolActivityMessage(call('search_tasks'), result('נמצאו 3 משימות התואמות ל-"שבוע"'), 'week_plan', 'read'))
      .toBe('נטענו מועמדים לתכנון השבוע')
    expect(scrubToolActivityMessage(call('get_overdue_tasks'), result('נמצאו 4 משימות באיחור'), 'week_plan', 'read'))
      .toBe('נטענו מועמדים לתכנון השבוע')
  })

  it('keeps task-count messages outside weekly-plan read activity', () => {
    expect(scrubToolActivityMessage(call('list_tasks'), result('Found 40 tasks'), 'day_plan', 'read'))
      .toBe('Found 40 tasks')
    expect(scrubToolActivityMessage(call('mark_task_done'), result('Found 40 tasks'), 'week_plan', 'write'))
      .toBe('Found 40 tasks')
  })
})
