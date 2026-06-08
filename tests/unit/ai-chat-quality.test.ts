import { describe, expect, it } from 'vitest'
import { auditChatResponseQuality, auditRecommendationEvidence } from '@/services/ai/pipeline/chatQuality'

describe('chat quality evidence audit', () => {
  it('rejects recommendations that infer importance from project names or shallow task metadata', () => {
    const audit = auditRecommendationEvidence([
      {
        recommendationId: 'rec_launch',
        taskId: 'task_1',
        reason: 'This is strategic high stakes work because it belongs to Important Client Launch.',
        taskEvidence: ['priority: high', 'due soon'],
        projectContextEvidence: ['Project: Important Client Launch'],
        missingEvidence: [],
      },
    ])

    expect(audit.level).toBe('bad')
    expect(audit.failures).toEqual(expect.arrayContaining([
      'rec_launch:context_evidence_name_only',
      'rec_launch:unsupported_importance_without_context',
    ]))
  })

  it('accepts missing project context only when the recommendation marks the missing evidence explicitly', () => {
    const audit = auditRecommendationEvidence([
      {
        recommendationId: 'rec_payment',
        taskId: 'task_2',
        reason: 'Do this because the task itself has concrete money-risk evidence; project importance is unknown.',
        taskEvidence: ['note: waiting on payment follow-up', 'overdue by 2 days'],
        projectContextEvidence: [],
        missingEvidence: ['project context unknown'],
      },
    ])

    expect(audit.level).toBe('excellent')
    expect(audit.failures).toEqual([])
  })

  it('scores full task and context citations as excellent evidence', () => {
    const audit = auditRecommendationEvidence([
      {
        recommendationId: 'rec_memory',
        taskId: 'task_3',
        reason: 'This moves the planning assistant toward the saved success criteria.',
        taskEvidence: ['postponed 3 times', 'open subtask: add memory interview'],
        projectContextEvidence: [
          'success criteria: weekly answers must feel grounded',
          'why it matters: weak planning makes the assistant feel fake',
        ],
        missingEvidence: [],
      },
    ])

    expect(audit.level).toBe('excellent')
    expect(audit.checkedCount).toBe(1)
    expect(audit.failures).toEqual([])
  })

  it('folds structured evidence failures into the broad answer quality gate', () => {
    const audit = auditChatResponseQuality({
      language: 'en',
      mode: 'day_plan',
      hasTaskList: true,
      hasCards: true,
      taskCount: 1,
      hasFeedbackControls: true,
      hasLearningSignal: true,
      text: 'Start with the client launch task. Use the card controls if this is wrong.',
      recommendationEvidence: [
        {
          recommendationId: 'rec_bad',
          reason: 'This is important strategic work because it is part of Client Launch.',
          taskEvidence: ['priority: high'],
          projectContextEvidence: ['Project: Client Launch'],
          missingEvidence: [],
        },
      ],
    })

    expect(audit.level).toBe('bad')
    expect(audit.failures).toEqual(expect.arrayContaining([
      'rec_bad:context_evidence_name_only',
      'rec_bad:unsupported_importance_without_context',
    ]))
  })
})
