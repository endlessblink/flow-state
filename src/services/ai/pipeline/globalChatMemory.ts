import type { AIClarificationEvent, AIContextEdge, AIContextEntity, AIMemorySnapshot, AIParameterBelief } from '@/types/aiMemory'
import { buildMemoryEvidenceHeader, formatMemoryEvidence, sanitizeMemoryEvidenceText } from './memoryEvidence'
import { assessAIMemorySnapshotFreshness } from './memoryLifecycle'

export const GLOBAL_CHAT_MEMORY_ENTITY_KEYS = [
  'workflow:task_answer:general',
  'workflow:task_answer:day_plan',
  'workflow:task_answer:smart_lanes',
  'workflow:task_answer:week_plan',
  'preference:planning_style',
  'preference:energy',
  'preference:energy_fit',
  'preference:constraints',
  'preference:brevity',
  'preference:ranking_focus',
  'preference:follow_through',
]

export const GLOBAL_CHAT_MEMORY_PARAMETER_KEYS = [
  'rankingFocus',
  'preferences',
  'energy_fit',
  'impact',
  'project_meaning',
  'task_context',
  'stakeholders',
  'dependencies',
  'successCriteria',
  'currentStakes',
]

export type GlobalChatMemoryDb = {
  fetchAIContextEntities(entityKeys: string[]): Promise<AIContextEntity[]>
  fetchAIClarificationEvents(entityKeys: string[], limit?: number): Promise<AIClarificationEvent[]>
  fetchAIParameterBeliefs(input: { entityKeys?: string[]; parameterKeys?: string[]; limit?: number }): Promise<AIParameterBelief[]>
  fetchAIContextEdges?(input: { entityKeys: string[]; limit?: number }): Promise<AIContextEdge[]>
  fetchAIMemorySnapshots?(input: { entityKeys?: string[]; scopes?: AIMemorySnapshot['scope'][]; limit?: number }): Promise<AIMemorySnapshot[]>
}

export async function retrieveGlobalChatMemory(
  db: GlobalChatMemoryDb,
  lang: 'he' | 'en',
): Promise<string> {
  const [entities, events, beliefs, edges, snapshots] = await Promise.all([
    db.fetchAIContextEntities(GLOBAL_CHAT_MEMORY_ENTITY_KEYS),
    db.fetchAIClarificationEvents(GLOBAL_CHAT_MEMORY_ENTITY_KEYS, 20),
    db.fetchAIParameterBeliefs({ parameterKeys: GLOBAL_CHAT_MEMORY_PARAMETER_KEYS, limit: 30 }),
    db.fetchAIContextEdges?.({ entityKeys: GLOBAL_CHAT_MEMORY_ENTITY_KEYS, limit: 30 }) ?? Promise.resolve([]),
    db.fetchAIMemorySnapshots?.({ entityKeys: GLOBAL_CHAT_MEMORY_ENTITY_KEYS, scopes: ['user', 'workflow'], limit: 8 }) ?? Promise.resolve([]),
  ])
  const freshSnapshots = snapshots.filter(snapshot => assessAIMemorySnapshotFreshness(snapshot).fresh)
  return buildGlobalChatMemorySummary({ lang, entities, events, beliefs, edges, snapshots: freshSnapshots })
}

export function buildGlobalChatMemorySummary(input: {
  lang: 'he' | 'en'
  entities: AIContextEntity[]
  events: AIClarificationEvent[]
  beliefs: AIParameterBelief[]
  edges: AIContextEdge[]
  snapshots: AIMemorySnapshot[]
}): string {
  const lines: string[] = [buildMemoryEvidenceHeader(input.lang)]
  for (const entity of input.entities.slice(0, 6)) {
    const label = sanitizeMemoryEvidenceText(entity.displayName || entity.entityKey, 120)
    const facts = entity.facts ?? {}
    const bits = [
      factLabel(facts, 'rankingFocus', 140),
      factLabel(facts, 'whyItMatters', 160),
      factLabel(facts, 'taskSelectionHints', 160),
      entity.confidence ? formatMemoryEvidence('confidence', entity.confidence.toFixed(2), 20) : '',
    ].filter(Boolean)
    if (bits.length) lines.push(`- memory ${label}: ${bits.join(' | ')}`)
  }
  for (const belief of input.beliefs.slice(0, 8)) {
    const target = sanitizeMemoryEvidenceText(belief.entityKey, 120)
    const value = beliefValueLabel(belief)
    const bits = [
      formatMemoryEvidence('parameter', belief.parameterKey, 80),
      value ? formatMemoryEvidence('answer', value, 140) : '',
      formatMemoryEvidence('confidence', belief.confidence.toFixed(2), 20),
    ].filter(Boolean)
    if (bits.length) lines.push(`- remembered answer for ${target}: ${bits.join(' | ')}`)
  }
  for (const event of input.events.filter(event => event.eventType === 'answered').slice(0, 5)) {
    const answer = event.selectedLabel || event.freeText
    if (!answer) continue
    const target = sanitizeMemoryEvidenceText(event.entityKey, 120)
    lines.push(`- recent clarification for ${target}: ${formatMemoryEvidence('answer', answer, 140)}`)
  }
  for (const edge of input.edges.slice(0, 6)) {
    const source = sanitizeMemoryEvidenceText(edge.sourceEntityKey, 120)
    const target = sanitizeMemoryEvidenceText(edge.targetEntityKey, 120)
    lines.push(`- relationship: ${source} ${formatMemoryEvidence('relation', edge.relationType, 80)} ${target} ${formatMemoryEvidence('confidence', edge.confidence.toFixed(2), 20)}`)
  }
  for (const snapshot of input.snapshots.slice(0, 4)) {
    const label = sanitizeMemoryEvidenceText(snapshot.snapshotKey, 140)
    lines.push(`- memory snapshot ${label}: ${formatMemoryEvidence('summary', snapshot.summaryText, 220)} | ${formatMemoryEvidence('source_events', `${snapshot.sourceEventCount}`, 40)} | ${formatMemoryEvidence('confidence', snapshot.confidence.toFixed(2), 20)}`)
  }
  return lines.length > 1 ? lines.join('\n') : ''
}

function factLabel(facts: Record<string, unknown>, key: string, limit: number): string {
  const raw = facts[key]
  const value = Array.isArray(raw) ? raw.map(String).join('; ') : typeof raw === 'string' ? raw : ''
  return value.trim() ? formatMemoryEvidence(key, value, limit) : ''
}

function beliefValueLabel(belief: AIParameterBelief): string {
  const raw = belief.beliefJson.value ?? belief.beliefJson.selectedLabel ?? belief.beliefJson.freeText
  if (Array.isArray(raw)) return raw.map(String).join(', ')
  return typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean' ? String(raw) : ''
}
