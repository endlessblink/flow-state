import { describe, expect, it } from 'vitest'
import {
  broadTaskClarificationMemoryKey,
  buildBroadTaskClarification,
  hasRecentClarificationDecision,
  selectBroadClarificationPrompt,
  shouldAskBroadTaskClarification,
} from '@/services/ai/pipeline/broadClarification'
import type { AIClarificationEvent, AIParameterBelief } from '@/types/aiMemory'
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

function event(eventType: AIClarificationEvent['eventType'], daysAgo: number, questionId = 'response_quality_day_plan'): AIClarificationEvent {
  return {
    id: `${eventType}-${daysAgo}`,
    entityKey: 'workflow:task_answer:day_plan',
    entityType: 'workflow',
    eventType,
    questionId,
    question: 'What should guide this answer?',
    createdAt: new Date(Date.UTC(2026, 5, 8) - (daysAgo * 24 * 60 * 60 * 1000)).toISOString(),
  }
}

function belief(parameterKey = 'rankingFocus', confidence = 0.9, value = 'real impact or consequence'): AIParameterBelief {
  return {
    id: `belief-${parameterKey}`,
    entityKey: 'workflow:task_answer:day_plan',
    entityType: 'workflow',
    parameterKey,
    beliefJson: { value },
    confidence,
    impactWeight: 0.65,
  }
}

describe('broad task clarification policy', () => {
  const now = Date.UTC(2026, 5, 8)

  it('routes broad non-weekly task answers through clarification while leaving weekly planning separate', () => {
    expect(shouldAskBroadTaskClarification('what should I do next?', routed('general'), true)).toBe(true)
    expect(shouldAskBroadTaskClarification('open this task', routed('general'), true)).toBe(false)
    expect(shouldAskBroadTaskClarification('plan my day', routed('day_plan'), true)).toBe(true)
    expect(shouldAskBroadTaskClarification('show smart lanes', routed('smart_lanes'), true)).toBe(true)
    expect(shouldAskBroadTaskClarification('prioritize my tasks', routed('prioritization'), true)).toBe(true)
    expect(shouldAskBroadTaskClarification('what is next?', routed('next_task'), true)).toBe(true)
    expect(shouldAskBroadTaskClarification('show overdue', routed(), true)).toBe(false)
    expect(shouldAskBroadTaskClarification('triage overdue tasks', routed('overdue_triage'), true)).toBe(true)
    expect(shouldAskBroadTaskClarification('plan my week', routed('week_plan'), true)).toBe(false)
    expect(shouldAskBroadTaskClarification('what should I do next?', routed('general'), false)).toBe(false)
  })

  it('builds one concise response-direction card for cold-start broad recommendations', () => {
    const card = buildBroadTaskClarification(routed('day_plan'), taskResult(5), 'en', [])

    expect(card?.kind).toBe('response_quality')
    expect(card?.responseMode).toBe('day_plan')
    expect(card?.pathType).toBe('clarify_first')
    expect(card?.question.options).toHaveLength(5)
    expect(card?.question.allowFreeText).toBe(true)
    expect(card?.question.id).toBe('response_quality_day_plan_general_focus')
    expect(card?.debug?.evpi?.targetedParameters).toEqual(expect.arrayContaining(['preferences', 'impact']))
    expect(card?.debug?.evpi?.selectedScore).toBeGreaterThan(0.28)
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

  it('dedupes the same broad clarification wording across workflow buckets without blocking mode-specific questions', () => {
    const recentGeneralFocus: AIClarificationEvent = {
      ...event('answered', 2, 'response_quality_general_general_focus'),
      entityKey: 'workflow:task_answer:general',
      question: 'What should guide this answer?',
      selectedLabel: 'Real impact',
    }

    expect(buildBroadTaskClarification(routed('day_plan'), taskResult(5), 'en', [recentGeneralFocus])).toBeNull()

    const prioritizationCard = buildBroadTaskClarification(routed('prioritization'), taskResult(5), 'en', [recentGeneralFocus])
    expect(prioritizationCard?.question.id).toBe('response_quality_prioritization_impact')
    expect(prioritizationCard?.question.question).toBe('What should decide the priority order?')
  })

  it('suppresses repeat questions when a saved parameter belief already answers the ladder', () => {
    expect(buildBroadTaskClarification(routed('day_plan'), taskResult(5), 'en', [], [belief()])).toBeNull()
  })

  it('asks a priority-specific question for prioritization requests', () => {
    const card = buildBroadTaskClarification(routed('prioritization'), taskResult(6), 'en', [])

    expect(card?.question.question).toBe('What should decide the priority order?')
    expect(card?.responseMode).toBe('prioritization')
    expect(card?.question.id).toBe('response_quality_prioritization_impact')
    expect(card?.question.options.map(option => option.label)).toEqual([
      'Real consequence',
      'Commitment',
      'Money/health',
      'Project momentum',
      'Not sure',
    ])
    expect(card?.memoryKey).toBe('workflow:task_answer:prioritization')
  })

  it('asks a next-action question for next-task requests', () => {
    const card = buildBroadTaskClarification(routed('next_task'), taskResult(4), 'en', [])

    expect(card?.question.id).toBe('response_quality_next_task_energy')
    expect(card?.responseMode).toBe('next_task')
    expect(card?.question.question).toBe('What would make one task right for now?')
    expect(card?.question.options.map(option => option.label)).toEqual([
      'Energy fit',
      'Most meaningful',
      'Most urgent',
      'Easy start',
      'Not sure',
    ])
  })

  it('uses EVPI to ask about energy when impact is already covered for next-task requests', () => {
    const card = buildBroadTaskClarification(routed('next_task'), taskResult(4), 'en', [], [
      belief('impact', 0.92, 'real consequence is already known'),
      belief('stakeholders', 0.9, 'commitments are already known'),
    ])

    expect(card?.question.id).toBe('response_quality_next_task_energy')
    expect(card?.question.question).toBe('What would make one task right for now?')
    expect(card?.debug?.evpi?.targetedParameters).toEqual(expect.arrayContaining(['energy_fit']))
  })

  it('does not ask a below-threshold clarification when no available prompt targets the missing dimension', () => {
    const selection = selectBroadClarificationPrompt('day_plan', 'en', [], {
      score: 0.49,
      materiality: 'high',
      decision: 'ask',
      missing: ['task_context'],
      dimensions: {
        preferences: 0.99,
        impact: 0.99,
        energy_fit: 0.99,
        dependencies: 0.99,
        history: 0.99,
        stakeholders: 0.99,
      },
    }, 'workflow:task_answer:day_plan', 'day_plan')

    expect(selection).toBeNull()
  })

  it('skips a recently resolved broad prompt and exposes the skipped candidate in EVPI debug metadata', () => {
    const recentImpact = {
      ...event('answered', 2, 'response_quality_prioritization_impact'),
      entityKey: 'workflow:task_answer:prioritization',
    }
    const card = buildBroadTaskClarification(routed('prioritization'), taskResult(6), 'en', [recentImpact])

    expect(card?.question.id).toBe('response_quality_prioritization_dependencies')
    expect(card?.question.question).toBe('What is blocking or dragging other work?')
    expect(card?.debug?.evpi?.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        questionId: 'response_quality_prioritization_impact',
        skippedReason: 'recently_resolved',
      }),
    ]))
  })

  it('asks an overdue-triage question instead of treating overdue as automatically important', () => {
    const card = buildBroadTaskClarification(routed('overdue_triage'), taskResult(4), 'en', [])

    expect(card?.question.question).toBe('How should I treat overdue tasks?')
    expect(card?.question.options.map(option => option.label)).toEqual([
      'Hard commitments',
      'Real risk',
      'Quick reset',
      'Filter stale',
      'Not sure',
    ])
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
    expect(broadTaskClarificationMemoryKey(routed('prioritization'))).toBe('workflow:task_answer:prioritization')
    expect(broadTaskClarificationMemoryKey(routed())).toBe('workflow:task_answer:general')
  })

  it('asks a stale-context refresh question before broad ranking when lifecycle says memory needs refresh', () => {
    const card = buildBroadTaskClarification(routed('prioritization'), taskResult(6), 'en', [], [
      belief('rankingFocus', 0.9),
      belief('impact', 0.9),
      belief('dependencies', 0.9),
    ], {
      staleEntityKeys: ['project:uncategorized'],
      refreshEntityKeys: ['project:uncategorized'],
      staleParameterBeliefKeys: [],
      refreshParameterBeliefKeys: [],
      staleSnapshotKeys: [],
      refreshSnapshotKeys: [],
      summarizeEntityKeys: [],
      archiveEventCount: 0,
      lowConfidenceEntityCount: 0,
      lowConfidenceBeliefCount: 0,
      lowConfidenceSnapshotCount: 0,
    })

    expect(card?.memoryKey).toBe('project:uncategorized')
    expect(card?.question.id).toBe('memory_refresh_project_uncategorized')
    expect(card?.question.reason).toBe('stale_context')
    expect(card?.question.question).toBe('Is the old context for "uncategorized" still true?')
    expect(card?.question.options.map(option => option.label)).toEqual([
      'Still true',
      'Partly changed',
      'No longer true',
      'Not sure',
    ])
    expect(card?.coverage?.missing).toContain('stale_context')
    expect(card?.debug?.evpi?.targetedParameters).toEqual(['stale_context'])
  })

  it('does not repeat a stale-context refresh question after the user answered it recently', () => {
    const recentRefresh: AIClarificationEvent = {
      id: 'refresh-answer',
      entityKey: 'project:uncategorized',
      entityType: 'project',
      eventType: 'answered',
      questionId: 'memory_refresh_project_uncategorized',
      question: 'Is the old context for "uncategorized" still true?',
      selectedLabel: 'Still true',
      createdAt: new Date(Date.UTC(2026, 5, 8)).toISOString(),
    }

    const card = buildBroadTaskClarification(routed('prioritization'), taskResult(6), 'en', [recentRefresh], [
      belief('rankingFocus', 0.9),
      belief('impact', 0.9),
      belief('dependencies', 0.9),
    ], {
      staleEntityKeys: ['project:uncategorized'],
      refreshEntityKeys: ['project:uncategorized'],
      staleParameterBeliefKeys: [],
      refreshParameterBeliefKeys: [],
      staleSnapshotKeys: [],
      refreshSnapshotKeys: [],
      summarizeEntityKeys: [],
      archiveEventCount: 0,
      lowConfidenceEntityCount: 0,
      lowConfidenceBeliefCount: 0,
      lowConfidenceSnapshotCount: 0,
    })

    expect(card).toBeNull()
  })

  it('asks a stale remembered-answer refresh question when parameter belief lifecycle needs refresh', () => {
    const card = buildBroadTaskClarification(routed('day_plan'), taskResult(5), 'en', [], [
      belief('impact', 0.9),
      belief('preferences', 0.9),
    ], {
      staleEntityKeys: [],
      refreshEntityKeys: [],
      staleParameterBeliefKeys: ['workflow:task_answer:day_plan:rankingFocus'],
      refreshParameterBeliefKeys: ['workflow:task_answer:day_plan:rankingFocus'],
      staleSnapshotKeys: [],
      refreshSnapshotKeys: [],
      summarizeEntityKeys: [],
      archiveEventCount: 0,
      lowConfidenceEntityCount: 0,
      lowConfidenceBeliefCount: 0,
      lowConfidenceSnapshotCount: 0,
    })

    expect(card?.memoryKey).toBe('workflow:task_answer:day_plan')
    expect(card?.question.id).toBe('memory_refresh_workflow_task_answer_day_plan_rankingFocus')
    expect(card?.question.reason).toBe('stale_context')
    expect(card?.question.options[0]?.memoryPatch?.field).toBe('rankingFocus')
    expect(card?.debug?.retrieval.lifecycle).toMatchObject({
      staleParameterBeliefKeys: ['workflow:task_answer:day_plan:rankingFocus'],
      refreshParameterBeliefKeys: ['workflow:task_answer:day_plan:rankingFocus'],
    })
    expect(card?.debug?.evpi?.targetedParameters).toEqual(['stale_context'])
  })
})
