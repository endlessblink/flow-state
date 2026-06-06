import { describe, expect, it } from 'vitest'
import { EntityMemory } from '@/services/ai/pipeline/entityMemory'
import { routeIntentByKeywords } from '@/services/ai/pipeline/intentRouter'
import { isSmartLaneRequest } from '@/services/ai/pipeline/smartLanes'

describe('AI intent router smart-lanes flow', () => {
  it('detects explicit smart-lane requests in English and Hebrew', () => {
    expect(isSmartLaneRequest('Suggest smart lanes for my work')).toBe(true)
    expect(isSmartLaneRequest('Break this big task into a lane')).toBe(true)
    expect(isSmartLaneRequest('תציע לי מסלולי עבודה')).toBe(true)
    expect(isSmartLaneRequest('break down this task')).toBe(false)
    expect(isSmartLaneRequest('show me my tasks')).toBe(false)
  })

  it('routes smart-lane prompts to a structured task query', () => {
    const routed = routeIntentByKeywords('Suggest smart lanes for my current tasks', [], new EntityMemory())

    expect(routed.type).toBe('task_query')
    expect(routed.responseMode).toBe('smart_lanes')
    expect(routed.tools).toEqual([
      { tool: 'list_tasks', parameters: { status: 'todo', sortBy: 'priority', limit: 30 } },
    ])
  })
})
