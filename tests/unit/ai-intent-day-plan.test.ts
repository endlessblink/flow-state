import { describe, expect, it } from 'vitest'
import { EntityMemory } from '@/services/ai/pipeline/entityMemory'
import { routeIntentByKeywords } from '@/services/ai/pipeline/intentRouter'

describe('AI intent router day-plan flow', () => {
  it('routes overwhelmed prompts to an ordered day-plan task query', () => {
    const routed = routeIntentByKeywords("I'm overwhelmed, reorder my day", [], new EntityMemory())

    expect(routed.type).toBe('task_query')
    expect(routed.responseMode).toBe('day_plan')
    expect(routed.tools).toEqual([
      { tool: 'list_tasks', parameters: { status: 'todo', sortBy: 'priority', limit: 25 } },
    ])
  })
})
