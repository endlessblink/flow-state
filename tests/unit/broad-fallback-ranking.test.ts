import { describe, expect, it, vi } from 'vitest'
import {
  broadFeedbackMatchesTask,
  broadFeedbackSignal,
  rankBroadFallbackTasks,
  scoreBroadFallbackTask,
} from '@/services/ai/pipeline/broadFallbackRanking'
import type { AIRecommendationFeedback } from '@/types/aiMemory'

const now = new Date('2026-06-08T09:00:00.000Z').getTime()

const task = (id: string, title: string, projectId = 'project-a', overrides: Record<string, unknown> = {}) => ({
  id,
  title,
  projectId,
  status: 'todo',
  priority: 'medium',
  description: '',
  dueDate: '2026-06-10',
  ...overrides,
})

const feedback = (input: Partial<AIRecommendationFeedback> & Pick<AIRecommendationFeedback, 'recommendationId' | 'action'>): AIRecommendationFeedback => ({
  id: `feedback-${input.recommendationId}-${input.action}`,
  recommendationId: input.recommendationId,
  action: input.action,
  generatedPlanId: null,
  taskId: null,
  entityKey: null,
  reasonCategory: null,
  freeText: null,
  revisitAt: null,
  outcomeSignals: {},
  implicitPositive: false,
  sourceMessageId: null,
  createdAt: '2026-06-08T08:00:00.000Z',
  ...input,
})

describe('broad fallback ranking feedback memory', () => {
  it('suppresses a dismissed local task so broad answers do not repeat it next turn', () => {
    const dismissed = task('local-task-a', 'Pay invoice before billing closes', 'project-a', {
      priority: 'high',
      description: 'Payment and billing risk would normally rank first.',
    })
    const alternative = task('local-task-b', 'Write stakeholder update', 'project-b', {
      description: 'Message the stakeholder with the current decision.',
    })
    const ranked = rankBroadFallbackTasks([dismissed, alternative], [
      feedback({
        recommendationId: 'inline_day_plan_local-task-a',
        taskId: 'local-task-a',
        entityKey: 'task:local-task-a',
        action: 'dismiss',
        reasonCategory: 'not_important',
      }),
    ])

    expect(broadFeedbackSignal(dismissed, [feedback({
      recommendationId: 'inline_day_plan_local-task-a',
      taskId: 'local-task-a',
      entityKey: 'task:local-task-a',
      action: 'dismiss',
    })], now)).toMatchObject({ suppressed: true, penalty: 0.9 })
    expect(ranked.map(item => item.id)).toEqual(['local-task-b'])
  })

  it('keeps postponed tasks hidden until their revisit window has passed', () => {
    const postponed = task('task-postponed', 'Review launch notes', 'project-a', {
      priority: 'high',
      description: 'Send final launch notes to stakeholders.',
    })
    const competing = task('task-next', 'Prepare support reply', 'project-b', {
      description: 'Reply to the support thread.',
    })
    const memory = feedback({
      recommendationId: 'inline_prioritization_task-postponed',
      taskId: 'task-postponed',
      entityKey: 'task:task-postponed',
      action: 'postpone',
      reasonCategory: 'low_energy',
      revisitAt: '2026-06-15T09:00:00.000Z',
    })

    expect(broadFeedbackSignal(postponed, [memory], now)).toMatchObject({ suppressed: true, penalty: 0.85 })
    expect(rankBroadFallbackTasks([postponed, competing], [memory]).map(item => item.id)).toEqual(['task-next'])
  })

  it('does not let inline project feedback suppress every task in the same project', () => {
    const first = task('task-first', 'First project task', 'shared-project')
    const second = task('task-second', 'Second project task', 'shared-project')
    const inlineProjectFeedback = feedback({
      recommendationId: 'inline_day_plan_task-first',
      entityKey: 'project:shared-project',
      action: 'dismiss',
      reasonCategory: 'wrong_context',
    })

    expect(broadFeedbackMatchesTask(inlineProjectFeedback, first)).toBe(true)
    expect(broadFeedbackMatchesTask(inlineProjectFeedback, second)).toBe(false)
  })

  it('uses accepted feedback as a positive follow-through signal', () => {
    vi.setSystemTime(new Date(now))
    const accepted = task('task-accepted', 'Write client update', 'project-a', {
      description: 'Send the client update.',
    })
    const neutral = task('task-neutral', 'Collect screenshots', 'project-b')
    const baseScore = scoreBroadFallbackTask(accepted, [])
    const boostedScore = scoreBroadFallbackTask(accepted, [
      feedback({
        recommendationId: 'inline_next_task_task-accepted',
        taskId: 'task-accepted',
        entityKey: 'task:task-accepted',
        action: 'accept',
      }),
    ])

    expect(boostedScore).toBeGreaterThan(baseScore)
    expect(rankBroadFallbackTasks([neutral, accepted], [
      feedback({
        recommendationId: 'inline_next_task_task-accepted',
        taskId: 'task-accepted',
        entityKey: 'task:task-accepted',
        action: 'accept',
      }),
    ])[0].id).toBe('task-accepted')
    vi.useRealTimers()
  })

  it('uses time-blocked and implicit-positive feedback as follow-through signals', () => {
    vi.setSystemTime(new Date(now))
    const timeblocked = task('task-timeblocked', 'Draft stakeholder update', 'project-a', {
      description: 'Send the stakeholder update.',
    })
    const implicit = task('task-implicit', 'Prepare client reply', 'project-b', {
      description: 'Reply to the client thread.',
    })
    const neutral = task('task-neutral', 'Collect references', 'project-c')

    expect(scoreBroadFallbackTask(timeblocked, [
      feedback({
        recommendationId: 'inline_next_task_task-timeblocked',
        taskId: 'task-timeblocked',
        entityKey: 'task:task-timeblocked',
        action: 'timeblock',
      }),
    ])).toBeGreaterThan(scoreBroadFallbackTask(timeblocked, []))

    expect(scoreBroadFallbackTask(implicit, [
      feedback({
        recommendationId: 'inline_next_task_task-implicit',
        taskId: 'task-implicit',
        entityKey: 'task:task-implicit',
        action: 'accept',
        implicitPositive: true,
      }),
    ])).toBeGreaterThan(scoreBroadFallbackTask(implicit, []))

    expect(rankBroadFallbackTasks([neutral, timeblocked], [
      feedback({
        recommendationId: 'inline_next_task_task-timeblocked',
        taskId: 'task-timeblocked',
        entityKey: 'task:task-timeblocked',
        action: 'timeblock',
      }),
    ])[0].id).toBe('task-timeblocked')
    vi.useRealTimers()
  })
})
