import type { AIClarificationCoverage, AIParameterBelief } from '@/types/aiMemory'
import type { RoutedIntent } from './intentRouter'
import { decideClarificationPath } from './uncertaintyPolicy'

export function computeBroadTaskClarificationCoverage(
  responseMode: RoutedIntent['responseMode'] | undefined,
  candidateCount: number,
  beliefs: AIParameterBelief[] = [],
): AIClarificationCoverage {
  const highMaterialityModes: Array<RoutedIntent['responseMode']> = [
    'day_plan',
    'smart_lanes',
    'prioritization',
    'next_task',
    'overdue_triage',
    'task_breakdown',
  ]
  const materiality = candidateCount >= 3 || (responseMode ? highMaterialityModes.includes(responseMode) : false)
    ? 'high'
    : candidateCount > 0
      ? 'medium'
      : 'low'
  const preferenceBelief = strongestBelief(beliefs, ['rankingFocus', 'preferences'])
  const impactBelief = strongestBelief(beliefs, ['impact', 'project_meaning', 'task_context', 'stakeholders', 'dependencies', 'currentStakes'])
  const energyBelief = strongestBelief(beliefs, ['energy_fit', 'energy', 'workload', 'effort'])
  const dependencyBelief = strongestBelief(beliefs, ['dependencies', 'blocking', 'sequence'])
  const historyBelief = strongestBelief(beliefs, ['history', 'postponed', 'task_recommendation_fit'])
  const stakeholderBelief = strongestBelief(beliefs, ['stakeholders', 'commitments', 'currentStakes'])
  const dimensions = {
    preferences: Math.max(0.25, preferenceBelief),
    impact: Math.max(candidateCount >= 3 ? 0.35 : 0.55, impactBelief, preferenceBelief * 0.85),
    energy_fit: energyBelief,
    dependencies: dependencyBelief,
    history: historyBelief,
    stakeholders: stakeholderBelief,
  }
  const missing: AIClarificationCoverage['missing'] = []
  if (dimensions.preferences < 0.45) missing.push('preferences')
  if (dimensions.impact < 0.45) missing.push('impact')
  if (responseMode === 'next_task' && dimensions.energy_fit < 0.45) missing.push('energy_fit')
  if (responseMode === 'prioritization' && dimensions.dependencies < 0.45) missing.push('dependencies')
  if ((responseMode === 'prioritization' || responseMode === 'overdue_triage') && dimensions.history < 0.45) missing.push('history')
  if (responseMode === 'overdue_triage' && dimensions.stakeholders < 0.45) missing.push('stakeholders')
  const forceAskDimensions: AIClarificationCoverage['missing'] = []
  if (responseMode === 'next_task') forceAskDimensions.push('energy_fit')
  if (responseMode === 'prioritization') forceAskDimensions.push('dependencies')
  if (responseMode === 'overdue_triage') forceAskDimensions.push('stakeholders')
  const policy = decideClarificationPath({
    score: (dimensions.preferences * 0.45) + (dimensions.impact * 0.55),
    materiality,
    missing,
    candidateCount,
    forceAskDimensions,
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
