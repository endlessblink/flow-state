import type { AIClarificationCoverage } from '@/types/aiMemory'
import type { RoutedIntent } from './intentRouter'
import { decideClarificationPath } from './uncertaintyPolicy'

export function computeBroadTaskClarificationCoverage(
  responseMode: RoutedIntent['responseMode'] | undefined,
  candidateCount: number,
): AIClarificationCoverage {
  const materiality = candidateCount >= 3 || responseMode === 'day_plan' || responseMode === 'smart_lanes'
    ? 'high'
    : candidateCount > 0
      ? 'medium'
      : 'low'
  const dimensions = {
    preferences: 0.25,
    impact: candidateCount >= 3 ? 0.35 : 0.55,
  }
  const missing: AIClarificationCoverage['missing'] = []
  if (dimensions.preferences < 0.45) missing.push('preferences')
  if (dimensions.impact < 0.45) missing.push('impact')
  const policy = decideClarificationPath({
    score: (dimensions.preferences * 0.45) + (dimensions.impact * 0.55),
    materiality,
    missing,
    candidateCount,
  })
  return {
    score: policy.score,
    materiality,
    dimensions,
    missing,
    decision: policy.decision,
  }
}
