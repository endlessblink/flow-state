import { describe, expect, it } from 'vitest'
import {
  broadTaskClarificationMemoryKey,
  buildBroadTaskClarification,
  hasRecentClarificationDecision,
  shouldAskBroadTaskClarification,
} from '@/services/ai/pipeline/broadClarification'
import type { AIClarificationEvent } from '@/types/aiMemory'
import type { RoutedIntent } from '@/services/ai/pipeline/intentRouter'

function routed(responseMode?: RoutedIntent['responseMode']): RoutedIntent {
  return {
    intent: 'analyze',
    confidence: 0.9,
    language: 'en',
    responseMode,
    directToolCalls: [],
    analysis: [],
    needsAI: true,
  }
}

function taskResult(count: number) {
  return [{
    success: true,
    message: 'tasks',
    data: Array.from({ length: count }, (_, index) => ({
      id: `task-${index + 1}`,
      title: `Task ${index + 1}`,
      status: 'todo',
    })),
  }]
}

function event(eventType: AIClarificationEvent['eventType'], daysAgo: number): AIClarificationEvent {
  return {
    id: `${eventType}-${daysAgo}`,
    entityKey: 'workflow:task_answer:day_plan',
    entityType: 'workflow',
    eventType,
    questionId: 'response_quality_day_plan',
    question: 'What should guide this answer?',
    createdAt: new Date(Date.UTC(2026, 5, 8) - (daysAgo * 24 * 60 * 60 * 1000)).toISOString(),
  }
}

describe('broad task clarification policy', () => {
  const now = Date.UTC(2026, 5, 8)

  it('routes broad non-weekly task answers through clarification while leaving weekly planning separate', () => {
    expect(shouldAskBroadTaskClarification('what should I do next?', routed('general'), true)).toBe(true)
    expect(shouldAskBroadTaskClarification('open this task', routed('general'), true)).toBe(false)
    expect(shouldAskBroadTaskClarification('plan my day', routed('day_plan'), true)).toBe(true)
    expect(shouldAskBroadTaskClarification('show smart lanes', routed('smart_lanes'), true)).toBe(true)
    expect(shouldAskBroadTaskClarification('plan my week', routed('week_plan'), true)).toBe(false)
    expect(shouldAskBroadTaskClarification('what should I do next?', routed('general'), false)).toBe(false)
  })

  it('builds one concise response-direction card for cold-start broad recommendations', () => {
    const card = buildBroadTaskClarification(routed('day_plan'), taskResult(5), 'en', [])

    expect(card?.kind).toBe('response_quality')
    expect(card?.pathType).toBe('clarify_first')
    expect(card?.question.options).toHaveLength(5)
    expect(card?.question.allowFreeText).toBe(true)
    expect(card?.candidateTaskIds).toHaveLength(5)
    expect(card?.coverage?.decision).toBe('ask')
    expect(card?.debug?.candidateCount).toBe(5)
  })

  it('suppresses repeat questions after recent answers or recent proceed-with-uncertainty decisions', () => {
    expect(hasRecentClarificationDecision([event('answered', 6)], now)).toBe(true)
    expect(hasRecentClarificationDecision([event('generated_with_uncertainty', 6)], now)).toBe(true)
    expect(buildBroadTaskClarification(routed('day_plan'), taskResult(5), 'en', [event('answered', 6)])).toBeNull()
    expect(buildBroadTaskClarification(routed('day_plan'), taskResult(5), 'en', [event('generated_with_uncertainty', 6)])).toBeNull()
  })

  it('uses a shorter cooldown for unanswered asked-only cards and asks again after stale decisions', () => {
    expect(hasRecentClarificationDecision([event('asked', 0.5)], now)).toBe(true)
    expect(hasRecentClarificationDecision([event('asked', 2)], now)).toBe(false)
    expect(hasRecentClarificationDecision([event('answered', 8)], now)).toBe(false)

    const card = buildBroadTaskClarification(routed('day_plan'), taskResult(5), 'he', [event('answered', 8)])
    expect(card?.locale).toBe('he')
    expect(card?.direction).toBe('rtl')
    expect(card?.question.options[0]?.label).toBe('השפעה אמיתית')
  })

  it('uses stable workflow memory keys for synthetic broad-answer buckets', () => {
    expect(broadTaskClarificationMemoryKey(routed('day_plan'))).toBe('workflow:task_answer:day_plan')
    expect(broadTaskClarificationMemoryKey(routed())).toBe('workflow:task_answer:general')
  })
})
