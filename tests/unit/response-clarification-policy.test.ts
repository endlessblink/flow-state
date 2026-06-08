import { describe, expect, it } from 'vitest'
import { computeBroadTaskClarificationCoverage } from '@/services/ai/pipeline/responseClarificationPolicy'

describe('computeBroadTaskClarificationCoverage', () => {
  it('asks before broad high-materiality task recommendations with several candidates', () => {
    expect(computeBroadTaskClarificationCoverage('day_plan', 8)).toMatchObject({
      materiality: 'high',
      missing: expect.arrayContaining(['preferences', 'impact']),
      decision: 'ask',
    })
  })

  it('does not force a clarification card for tiny task sets', () => {
    expect(computeBroadTaskClarificationCoverage('general', 1)).toMatchObject({
      materiality: 'medium',
      missing: ['preferences'],
      decision: 'proceed_with_uncertainty',
    })
  })

  it('uses neutral candidates for cold-start empty inputs', () => {
    expect(computeBroadTaskClarificationCoverage('general', 0)).toMatchObject({
      materiality: 'low',
      decision: 'neutral_candidates',
    })
  })

  it('treats saved response-direction beliefs as enough coverage to avoid re-asking', () => {
    expect(computeBroadTaskClarificationCoverage('day_plan', 8, [{
      entityKey: 'workflow:task_answer:day_plan',
      entityType: 'workflow',
      parameterKey: 'rankingFocus',
      beliefJson: { value: 'real impact or consequence' },
      confidence: 0.9,
      impactWeight: 0.65,
    }])).toMatchObject({
      materiality: 'high',
      missing: [],
      decision: 'proceed',
    })
  })

  it.each([
    'prioritization',
    'next_task',
    'overdue_triage',
  ] as const)('treats %s as high-materiality even with a small candidate set', (mode) => {
    expect(computeBroadTaskClarificationCoverage(mode, 2)).toMatchObject({
      materiality: 'high',
      decision: 'ask',
    })
  })

  it('lets saved response-direction memory suppress prioritization re-asks', () => {
    expect(computeBroadTaskClarificationCoverage('prioritization', 6, [{
      entityKey: 'workflow:task_answer:prioritization',
      entityType: 'workflow',
      parameterKey: 'rankingFocus',
      beliefJson: { value: 'project momentum' },
      confidence: 0.9,
      impactWeight: 0.65,
    }])).toMatchObject({
      materiality: 'high',
      missing: [],
      decision: 'proceed',
    })
  })
})
