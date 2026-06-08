import type { AIClarificationCoverage, AIUncertaintyDimension } from '@/types/aiMemory'

export type UncertaintyDecisionInput = {
  score: number
  materiality: AIClarificationCoverage['materiality']
  missing: AIUncertaintyDimension[]
  candidateCount: number
  forceAskDimensions?: AIUncertaintyDimension[]
}

export type UncertaintyDecisionResult = {
  decision: AIClarificationCoverage['decision']
  score: number
  reason: 'cold_start' | 'forced_dimension' | 'low_coverage_high_materiality' | 'medium_coverage' | 'sufficient_context'
}

const HIGH_COVERAGE_THRESHOLD = 0.8
const ASK_THRESHOLD = 0.5

export function decideClarificationPath(input: UncertaintyDecisionInput): UncertaintyDecisionResult {
  const score = Number(Math.min(1, Math.max(0, input.score)).toFixed(3))
  const forceAskDimensions = input.forceAskDimensions ?? []
  const hasForcedMissingDimension = forceAskDimensions.some(dimension => input.missing.includes(dimension))
  const isColdStart = input.candidateCount === 0 && score < HIGH_COVERAGE_THRESHOLD

  if (isColdStart) {
    return {
      decision: input.materiality === 'high' ? 'ask' : 'neutral_candidates',
      score,
      reason: 'cold_start',
    }
  }

  if (hasForcedMissingDimension && input.materiality === 'high') {
    return {
      decision: 'ask',
      score: Math.min(score, ASK_THRESHOLD - 0.001),
      reason: 'forced_dimension',
    }
  }

  if (score < ASK_THRESHOLD && input.materiality === 'high') {
    return {
      decision: 'ask',
      score,
      reason: 'low_coverage_high_materiality',
    }
  }

  if (score < HIGH_COVERAGE_THRESHOLD) {
    return {
      decision: 'proceed_with_uncertainty',
      score,
      reason: 'medium_coverage',
    }
  }

  return {
    decision: 'proceed',
    score,
    reason: 'sufficient_context',
  }
}
