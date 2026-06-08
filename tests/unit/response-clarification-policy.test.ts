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
})
