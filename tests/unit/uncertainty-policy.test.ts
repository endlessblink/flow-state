import { describe, expect, it } from 'vitest'
import { decideClarificationPath } from '@/services/ai/pipeline/uncertaintyPolicy'

describe('decideClarificationPath', () => {
  it('asks when high-materiality coverage is below the ask threshold', () => {
    expect(decideClarificationPath({
      score: 0.42,
      materiality: 'high',
      missing: ['impact'],
      candidateCount: 6,
    })).toMatchObject({
      decision: 'ask',
      score: 0.42,
      reason: 'low_coverage_high_materiality',
    })
  })

  it('asks when a high-materiality forced dimension is missing even if the average score is medium', () => {
    expect(decideClarificationPath({
      score: 0.64,
      materiality: 'high',
      missing: ['project_meaning'],
      candidateCount: 5,
      forceAskDimensions: ['project_meaning', 'stale_context'],
    })).toMatchObject({
      decision: 'ask',
      score: 0.499,
      reason: 'forced_dimension',
    })
  })

  it('proceeds with visible uncertainty for medium coverage instead of asking mechanically', () => {
    expect(decideClarificationPath({
      score: 0.67,
      materiality: 'medium',
      missing: ['preferences'],
      candidateCount: 2,
    })).toMatchObject({
      decision: 'proceed_with_uncertainty',
      score: 0.67,
      reason: 'medium_coverage',
    })
  })

  it('proceeds when coverage is high enough', () => {
    expect(decideClarificationPath({
      score: 0.86,
      materiality: 'high',
      missing: [],
      candidateCount: 4,
    })).toMatchObject({
      decision: 'proceed',
      score: 0.86,
      reason: 'sufficient_context',
    })
  })

  it('uses a neutral cold-start path for low-materiality empty inputs', () => {
    expect(decideClarificationPath({
      score: 0,
      materiality: 'low',
      missing: ['preferences'],
      candidateCount: 0,
    })).toMatchObject({
      decision: 'neutral_candidates',
      score: 0,
      reason: 'cold_start',
    })
  })

  it('does not block low-materiality mechanical requests behind clarification even with low coverage', () => {
    expect(decideClarificationPath({
      score: 0.18,
      materiality: 'low',
      missing: ['impact', 'preferences'],
      candidateCount: 4,
    })).toMatchObject({
      decision: 'proceed_with_uncertainty',
      score: 0.18,
      reason: 'medium_coverage',
    })
  })
})
