import { describe, expect, it } from 'vitest'
import { assessAIContextEntityLifecycle, summarizeAIMemoryLifecycle } from '@/services/ai/pipeline/memoryLifecycle'
import type { AIClarificationEvent, AIContextEntity } from '@/types/aiMemory'

function entity(overrides: Partial<AIContextEntity> = {}): AIContextEntity {
  return {
    entityKey: 'project:ai-planner',
    entityType: 'project',
    displayName: 'AI Planner',
    facts: {},
    corrections: [],
    confidence: 0.8,
    completenessScore: 0.7,
    askCount: 1,
    lastAnsweredAt: '2026-04-01T10:00:00.000Z',
    reinforcementCount: 0,
    ...overrides,
  }
}

function event(daysAgo: number, key = 'project:ai-planner'): AIClarificationEvent {
  const date = new Date('2026-06-08T10:00:00.000Z')
  date.setDate(date.getDate() - daysAgo)
  return {
    entityKey: key,
    entityType: 'project',
    questionId: `q-${daysAgo}`,
    eventType: 'answered',
    createdAt: date.toISOString(),
  }
}

describe('AI memory lifecycle policy', () => {
  const now = new Date('2026-06-08T10:00:00.000Z')

  it('marks old or explicitly expired context for refresh instead of treating it as fresh memory', () => {
    const decision = assessAIContextEntityLifecycle(entity({
      staleAfter: '2026-06-01T00:00:00.000Z',
      lastAnsweredAt: '2026-03-01T00:00:00.000Z',
    }), [], now)

    expect(decision.stale).toBe(true)
    expect(decision.needsRefresh).toBe(true)
    expect(decision.reasons).toEqual(expect.arrayContaining(['explicit_stale_after', 'old_confirmation']))
  })

  it('uses reinforcement to slow confidence decay for repeatedly confirmed facts', () => {
    const weak = assessAIContextEntityLifecycle(entity({
      lastAnsweredAt: '2026-01-01T00:00:00.000Z',
      lastReinforcedAt: '2026-01-01T00:00:00.000Z',
      reinforcementCount: 0,
    }), [], now)
    const reinforced = assessAIContextEntityLifecycle(entity({
      lastAnsweredAt: '2026-01-01T00:00:00.000Z',
      lastReinforcedAt: '2026-01-01T00:00:00.000Z',
      reinforcementCount: 5,
    }), [], now)

    expect(reinforced.effectiveConfidence).toBeGreaterThan(weak.effectiveConfidence)
    expect(weak.needsRefresh).toBe(true)
  })

  it('flags noisy event history for summarization and old events for archival', () => {
    const events = Array.from({ length: 22 }, (_, index) => event(index < 12 ? 220 : index))
    const summary = summarizeAIMemoryLifecycle([entity()], events, now)

    expect(summary.summarizeEntityKeys).toContain('project:ai-planner')
    expect(summary.refreshEntityKeys).toContain('project:ai-planner')
    expect(summary.archiveEventCount).toBe(0)
    expect(summary.lowConfidenceEntityCount).toBeGreaterThanOrEqual(0)
  })

  it('counts year-old events for retention/archive follow-up', () => {
    const summary = summarizeAIMemoryLifecycle([entity()], [event(370)], now)

    expect(summary.archiveEventCount).toBe(1)
  })
})
