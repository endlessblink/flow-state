import type { AIClarificationEvent, AIContextEntity } from '@/types/aiMemory'

const DAY_MS = 24 * 60 * 60 * 1000

export type AIMemoryLifecycleDecision = {
  entityKey: string
  effectiveConfidence: number
  stale: boolean
  needsRefresh: boolean
  shouldSummarize: boolean
  shouldArchiveEvents: boolean
  reasons: Array<'explicit_stale_after' | 'old_confirmation' | 'low_confidence' | 'decayed' | 'many_events' | 'old_events'>
}

export type AIMemoryLifecycleSummary = {
  staleEntityKeys: string[]
  refreshEntityKeys: string[]
  summarizeEntityKeys: string[]
  archiveEventCount: number
  lowConfidenceEntityCount: number
}

export function assessAIContextEntityLifecycle(
  entity: AIContextEntity,
  events: AIClarificationEvent[] = [],
  now: Date = new Date(),
): AIMemoryLifecycleDecision {
  const nowMs = now.getTime()
  const lastConfirmedMs = parseMs(entity.lastAnsweredAt ?? entity.lastReinforcedAt ?? null)
  const lastTouchedMs = parseMs(entity.lastReinforcedAt ?? entity.lastAnsweredAt ?? entity.lastAskedAt ?? null)
  const staleAfterMs = parseMs(entity.staleAfter ?? null)
  const reinforcementCount = Math.max(0, entity.reinforcementCount ?? 0)
  const baseConfidence = clamp01(entity.confidence)
  const storedDecay = typeof entity.decayScore === 'number' ? clamp01(entity.decayScore) : null
  const ageDays = lastTouchedMs && Number.isFinite(nowMs) ? Math.max(0, (nowMs - lastTouchedMs) / DAY_MS) : 90
  const decayGraceDays = 30 + Math.min(45, reinforcementCount * 10)
  const timeDecay = ageDays <= decayGraceDays ? 1 : Math.max(0.25, 1 - ((ageDays - decayGraceDays) / 120))
  const effectiveConfidence = clamp01(baseConfidence * timeDecay * (storedDecay ?? 1))
  const reasons: AIMemoryLifecycleDecision['reasons'] = []

  if (staleAfterMs && staleAfterMs <= nowMs) reasons.push('explicit_stale_after')
  if (lastConfirmedMs && nowMs - lastConfirmedMs > 45 * DAY_MS) reasons.push('old_confirmation')
  if (effectiveConfidence < 0.45) reasons.push('low_confidence')
  if (timeDecay < 0.8 || (storedDecay !== null && storedDecay < 0.7)) reasons.push('decayed')

  const entityEvents = events.filter(event => event.entityKey === entity.entityKey)
  const oldEventCount = entityEvents.filter(event => {
    const createdAt = parseMs(event.createdAt ?? null)
    return createdAt ? nowMs - createdAt > 180 * DAY_MS : false
  }).length
  if (entityEvents.length >= 20) reasons.push('many_events')
  if (oldEventCount >= 10) reasons.push('old_events')

  const stale = reasons.includes('explicit_stale_after') || reasons.includes('old_confirmation')
  const needsRefresh = stale || reasons.includes('low_confidence') || reasons.includes('decayed')
  const shouldSummarize = entityEvents.length >= 20 || oldEventCount >= 10

  return {
    entityKey: entity.entityKey,
    effectiveConfidence: Number(effectiveConfidence.toFixed(3)),
    stale,
    needsRefresh,
    shouldSummarize,
    shouldArchiveEvents: oldEventCount >= 10,
    reasons,
  }
}

export function summarizeAIMemoryLifecycle(
  entities: AIContextEntity[],
  events: AIClarificationEvent[] = [],
  now: Date = new Date(),
): AIMemoryLifecycleSummary {
  const decisions = entities.map(entity => assessAIContextEntityLifecycle(entity, events, now))
  return {
    staleEntityKeys: decisions.filter(decision => decision.stale).map(decision => decision.entityKey),
    refreshEntityKeys: decisions.filter(decision => decision.needsRefresh).map(decision => decision.entityKey),
    summarizeEntityKeys: decisions.filter(decision => decision.shouldSummarize).map(decision => decision.entityKey),
    archiveEventCount: events.filter(event => {
      const createdAt = parseMs(event.createdAt ?? null)
      return createdAt ? now.getTime() - createdAt > 365 * DAY_MS : false
    }).length,
    lowConfidenceEntityCount: decisions.filter(decision => decision.effectiveConfidence < 0.45).length,
  }
}

function parseMs(value: string | null): number | null {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
