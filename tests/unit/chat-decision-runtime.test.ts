import { describe, expect, it } from 'vitest'
import {
  decideChatRuntimeAction,
  questionKey,
  type ChatQuestionCandidate,
} from '@/services/ai/runtime/chatDecisionRuntime'

const baseCandidate: ChatQuestionCandidate = {
  id: 'weekly_available_hours',
  question: 'How many hours are realistically available?',
  scope: 'planning',
  targetEntityKey: 'week:2026-06-09',
  durableLearningTarget: 'available_hours',
  infoValueScore: 0.9,
  interruptionCost: 0.18,
  actionImpact: 'high',
}

describe('chat decision runtime', () => {
  it('asks the highest-value durable question when it is worth the interruption', () => {
    const result = decideChatRuntimeAction({
      requestId: 'req-ask',
      scope: 'planning',
      candidates: [
        {
          ...baseCandidate,
          id: 'low_value_label',
          question: 'What does Work mean?',
          durableLearningTarget: 'project_label_meaning',
          infoValueScore: 0.32,
          interruptionCost: 0.2,
        },
        baseCandidate,
      ],
    })

    expect(result.decision).toBe('ask')
    expect(result.question?.id).toBe('weekly_available_hours')
    expect(result.trace.selectedQuestionKey).toBe(questionKey(baseCandidate))
    expect(result.trace.candidates[0]).toMatchObject({
      id: 'weekly_available_hours',
      decision: 'eligible',
      reason: 'eligible',
    })
  })

  it('proceeds instead of asking action-only or low-value questions', () => {
    const result = decideChatRuntimeAction({
      requestId: 'req-proceed',
      scope: 'task_breakdown',
      candidates: [
        {
          id: 'add_followup',
          question: 'Add a follow-up task after this?',
          scope: 'task_breakdown',
          targetEntityKey: 'task:123',
          infoValueScore: 0.7,
          interruptionCost: 0.12,
        },
        {
          id: 'tiny_preference',
          question: 'Should I use bullets?',
          scope: 'task_breakdown',
          targetEntityKey: 'task:123',
          durableLearningTarget: 'format_preference',
          infoValueScore: 0.2,
          interruptionCost: 0.18,
        },
      ],
    })

    expect(result.decision).toBe('proceed')
    expect(result.trace.candidates.map(candidate => candidate.reason)).toEqual([
      'no_durable_learning_target',
      'below_ask_threshold',
    ])
  })

  it('blocks repeats immediately from same-session resolved question keys', () => {
    const key = questionKey(baseCandidate)
    const result = decideChatRuntimeAction({
      requestId: 'req-session-repeat',
      scope: 'planning',
      candidates: [baseCandidate],
      sessionResolvedQuestionKeys: [key],
    })

    expect(result.decision).toBe('proceed')
    expect(result.trace.candidates[0]).toMatchObject({
      decision: 'blocked',
      reason: 'already_resolved_in_session',
    })
  })

  it('blocks repeats from persisted answered or dismissed events', () => {
    const key = questionKey(baseCandidate)
    const result = decideChatRuntimeAction({
      requestId: 'req-persisted-repeat',
      scope: 'planning',
      candidates: [baseCandidate],
      now: new Date('2026-06-09T12:00:00Z'),
      recentEvents: [{
        questionKey: key,
        scope: 'planning',
        targetEntityKey: 'week:2026-06-09',
        eventType: 'answered',
        createdAt: '2026-06-09T11:59:00Z',
      }],
    })

    expect(result.decision).toBe('proceed')
    expect(result.trace.candidates[0].reason).toBe('recently_resolved')
  })

  it('infers when confidence is high enough and asking is not worth it', () => {
    const result = decideChatRuntimeAction({
      requestId: 'req-infer',
      scope: 'next_task',
      candidates: [{
        id: 'energy_fit',
        question: 'Do mornings work better for deep work?',
        scope: 'next_task',
        targetEntityKey: 'preference:energy',
        durableLearningTarget: 'energy_peak',
        infoValueScore: 0.3,
        interruptionCost: 0.18,
        confidenceToInfer: 0.9,
      }],
    })

    expect(result.decision).toBe('infer')
    expect(result.inferredQuestion?.id).toBe('energy_fit')
    expect(result.trace.reason).toBe('confidence_high_enough_to_infer')
  })
})
