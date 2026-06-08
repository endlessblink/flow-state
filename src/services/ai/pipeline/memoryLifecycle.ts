import type { AIClarificationEvent, AIContextEntity, AIMemorySnapshotInput, AIParameterBelief } from '@/types/aiMemory'

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
  staleParameterBeliefKeys: string[]
  refreshParameterBeliefKeys: string[]
  summarizeEntityKeys: string[]
  archiveEventCount: number
  lowConfidenceEntityCount: number
  lowConfidenceBeliefCount: number
}

export type AIMemoryFreshnessInput = {
  staleAfter?: string | null
  lastConfirmedAt?: string | null
  lastUpdatedAt?: string | null
  confidence?: number | null
}

export type AIMemoryFreshnessDecision = {
  fresh: boolean
  reasons: Array<'explicit_stale_after' | 'old_confirmation' | 'low_confidence'>
}

export function assessAIMemoryFreshness(
  input: AIMemoryFreshnessInput,
  now: Date = new Date(),
): AIMemoryFreshnessDecision {
  const nowMs = now.getTime()
  const staleAfterMs = parseMs(input.staleAfter ?? null)
  const lastConfirmedMs = parseMs(input.lastConfirmedAt ?? input.lastUpdatedAt ?? null)
  const confidence = typeof input.confidence === 'number' ? clamp01(input.confidence) : 0.5
  const reasons: AIMemoryFreshnessDecision['reasons'] = []

  if (staleAfterMs && staleAfterMs <= nowMs) reasons.push('explicit_stale_after')
  if (lastConfirmedMs && nowMs - lastConfirmedMs > 45 * DAY_MS) reasons.push('old_confirmation')
  if (confidence < 0.45) reasons.push('low_confidence')

  return {
    fresh: reasons.length === 0,
    reasons,
  }
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
  const ageDays = lastTouchedMs && Number.isFinite(nowMs) ? Math.max(0, (nowMs - lastTouchedMs) / DAY_MS) : 0
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

export function assessAIParameterBeliefFreshness(
  belief: AIParameterBelief,
  now: Date = new Date(),
): AIMemoryFreshnessDecision {
  const storedDecay = typeof belief.decayScore === 'number' ? clamp01(belief.decayScore) : 1
  return assessAIMemoryFreshness({
    staleAfter: belief.staleAfter,
    lastConfirmedAt: belief.lastReinforcedAt ?? belief.lastAnsweredAt ?? belief.updatedAt ?? belief.createdAt ?? null,
    confidence: clamp01(belief.confidence) * storedDecay,
  }, now)
}

export function summarizeAIMemoryLifecycle(
  entities: AIContextEntity[],
  events: AIClarificationEvent[] = [],
  now: Date = new Date(),
  parameterBeliefs: AIParameterBelief[] = [],
): AIMemoryLifecycleSummary {
  const decisions = entities.map(entity => assessAIContextEntityLifecycle(entity, events, now))
  const beliefDecisions = parameterBeliefs.map(belief => ({
    key: `${belief.entityKey}:${belief.parameterKey}`,
    entityKey: belief.entityKey,
    decision: assessAIParameterBeliefFreshness(belief, now),
  }))
  return {
    staleEntityKeys: decisions.filter(decision => decision.stale).map(decision => decision.entityKey),
    refreshEntityKeys: decisions.filter(decision => decision.needsRefresh).map(decision => decision.entityKey),
    staleParameterBeliefKeys: beliefDecisions.filter(item => item.decision.reasons.includes('explicit_stale_after')).map(item => item.key),
    refreshParameterBeliefKeys: beliefDecisions.filter(item => !item.decision.fresh).map(item => item.key),
    summarizeEntityKeys: decisions.filter(decision => decision.shouldSummarize).map(decision => decision.entityKey),
    archiveEventCount: events.filter(event => {
      const createdAt = parseMs(event.createdAt ?? null)
      return createdAt ? now.getTime() - createdAt > 365 * DAY_MS : false
    }).length,
    lowConfidenceEntityCount: decisions.filter(decision => decision.effectiveConfidence < 0.45).length,
    lowConfidenceBeliefCount: beliefDecisions.filter(item => item.decision.reasons.includes('low_confidence')).length,
  }
}

export function buildAIMemorySnapshotInput(input: {
  snapshotKey: string
  scope: AIMemorySnapshotInput['scope']
  entityKeys: string[]
  entities: AIContextEntity[]
  events: AIClarificationEvent[]
  now?: Date
}): AIMemorySnapshotInput {
  const entityKeys = uniqueStrings(input.entityKeys)
  const entityKeySet = new Set(entityKeys)
  const entities = input.entities.filter(entity => entityKeySet.has(entity.entityKey))
  const events = input.events.filter(event => entityKeySet.has(event.entityKey))
  const now = input.now ?? new Date()
  const latestAnswers = events
    .filter(event => event.eventType === 'answered')
    .sort((a, b) => (parseMs(b.createdAt ?? null) ?? 0) - (parseMs(a.createdAt ?? null) ?? 0))
    .slice(0, 4)
    .map(event => sanitizeSnapshotText(event.selectedLabel || event.freeText || event.questionId, 120))
    .filter(Boolean)
  const corrections = uniqueStrings([
    ...entities.flatMap(entity => entity.corrections ?? []),
    ...events
      .filter(event => event.eventType === 'correction' || event.memoryPatch?.source === 'user_correction')
      .sort((a, b) => (parseMs(b.createdAt ?? null) ?? 0) - (parseMs(a.createdAt ?? null) ?? 0))
      .map(event => correctionSnapshotText(event)),
  ])
    .map(value => sanitizeSnapshotText(value, 140))
    .filter(Boolean)
    .slice(0, 4)
  const entitySummaries = entities
    .slice(0, 4)
    .map(entity => {
      const meaning = entity.summary
        || stringFact(entity.facts, 'whyItMatters')
        || stringFact(entity.facts, 'domain')
        || entity.displayName
      return `${sanitizeSnapshotText(entity.displayName, 80)}: ${sanitizeSnapshotText(meaning, 160)}`
    })
  const summaryText = [
    ...entitySummaries,
    latestAnswers.length ? `Recent answers: ${latestAnswers.join('; ')}` : '',
    corrections.length ? `Corrections: ${corrections.join('; ')}` : '',
  ].filter(Boolean).join(' | ') || 'No compact memory facts available yet.'
  const confidence = entities.length
    ? entities.reduce((sum, entity) => sum + Math.max(0, Math.min(1, entity.confidence ?? 0)), 0) / entities.length
    : 0.5
  const staleAfter = new Date(now.getTime() + 90 * DAY_MS).toISOString()

  return {
    snapshotKey: input.snapshotKey,
    scope: input.scope,
    entityKeys,
    summaryText: sanitizeSnapshotText(summaryText, 520),
    facts: {
      entityCount: entities.length,
      eventCount: events.length,
      latestAnswers,
      corrections,
      summarizedAt: now.toISOString(),
    },
    sourceEventCount: events.length,
    sourceEntityCount: entities.length,
    confidence: Number(confidence.toFixed(3)),
    staleAfter,
  }
}

function correctionSnapshotText(event: AIClarificationEvent): string {
  const value = event.freeText
    || event.selectedLabel
    || event.memoryPatch?.field
    || event.questionId
  return `correction: ${value}`
}

function parseMs(value: string | null): number | null {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
}

function stringFact(facts: Record<string, unknown>, key: string): string {
  const value = facts[key]
  return typeof value === 'string' ? value : ''
}

function sanitizeSnapshotText(value: unknown, maxLength: number): string {
  const text = String(value ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/```+/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...` : text
}
