import type { AIClarificationCoverage, AIParameterBelief } from '@/types/aiMemory'
import type { RoutedIntent } from './intentRouter'
import { decideClarificationPath } from './uncertaintyPolicy'

export function computeBroadTaskClarificationCoverage(
  responseMode: RoutedIntent['responseMode'] | undefined,
  candidateCount: number,
  beliefs: AIParameterBelief[] = [],
): AIClarificationCoverage {
  const materiality = candidateCount >= 3 || responseMode === 'day_plan' || responseMode === 'smart_lanes'
    ? 'high'
    : candidateCount > 0
      ? 'medium'
      : 'low'
  const preferenceBelief = strongestBelief(beliefs, ['rankingFocus', 'preferences'])
  const impactBelief = strongestBelief(beliefs, ['impact', 'project_meaning', 'task_context', 'stakeholders', 'dependencies', 'currentStakes'])
  const dimensions = {
    preferences: Math.max(0.25, preferenceBelief),
    impact: Math.max(candidateCount >= 3 ? 0.35 : 0.55, impactBelief, preferenceBelief * 0.85),
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

function strongestBelief(beliefs: AIParameterBelief[], keys: string[]): number {
  return beliefs
    .filter(belief => keys.includes(belief.parameterKey))
    .reduce((max, belief) => Math.max(max, Math.min(1, Math.max(0, belief.confidence))), 0)
}
