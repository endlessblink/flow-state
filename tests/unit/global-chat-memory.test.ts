import { describe, expect, it, vi } from 'vitest'
import {
  GLOBAL_CHAT_MEMORY_ENTITY_KEYS,
  GLOBAL_CHAT_MEMORY_PARAMETER_KEYS,
  retrieveGlobalChatMemory,
  type GlobalChatMemoryDb,
} from '@/services/ai/pipeline/globalChatMemory'
import type { AIContextEdge, AIContextEntity, AIMemorySnapshot, AIParameterBelief } from '@/types/aiMemory'

function dbStub(overrides: Partial<GlobalChatMemoryDb> = {}): GlobalChatMemoryDb {
  return {
    fetchAIContextEntities: vi.fn(async () => []),
    fetchAIClarificationEvents: vi.fn(async () => []),
    fetchAIParameterBeliefs: vi.fn(async () => []),
    fetchAIContextEdges: vi.fn(async () => []),
    fetchAIMemorySnapshots: vi.fn(async () => []),
    ...overrides,
  }
}

function contextEntity(input: Partial<AIContextEntity> & Pick<AIContextEntity, 'entityKey' | 'entityType'>): AIContextEntity {
  return {
    displayName: input.entityKey,
    facts: {},
    corrections: [],
    confidence: 0.8,
    completenessScore: 0.6,
    askCount: 0,
    ...input,
  }
}

describe('retrieveGlobalChatMemory', () => {
  it('includes aggregate recommendation-feedback preference keys in global memory retrieval', () => {
    expect(GLOBAL_CHAT_MEMORY_ENTITY_KEYS).toEqual(expect.arrayContaining([
      'preference:brevity',
      'preference:ranking_focus',
      'preference:energy_fit',
      'preference:follow_through',
    ]))
  })

  it('builds a bounded evidence packet for non-task assistant responses', async () => {
    const belief: AIParameterBelief = {
      id: 'belief-1',
      entityKey: 'workflow:task_answer:general',
      entityType: 'workflow',
      parameterKey: 'rankingFocus',
      beliefJson: { value: 'reduce stress before optimizing' },
      confidence: 0.88,
      impactWeight: 0.65,
    }
    const edge: AIContextEdge = {
      id: 'edge-1',
      sourceEntityKey: 'preference:brevity',
      targetEntityKey: 'workflow:task_answer:general',
      relationType: 'preference_affects',
      confidence: 0.92,
      evidence: { source: 'feedback' },
      createdAt: '2026-06-08T09:10:00.000Z',
    }
    const snapshot: AIMemorySnapshot = {
      id: 'snapshot-global',
      snapshotKey: 'workflow:task_answer:general:summary',
      scope: 'workflow',
      entityKeys: ['workflow:task_answer:general'],
      summaryText: 'User prefers compact answers that ask before broad planning.',
      facts: { brevity: true },
      sourceEventCount: 9,
      sourceEntityCount: 1,
      confidence: 0.86,
    }
    const db = dbStub({
      fetchAIContextEntities: vi.fn(async () => [
        contextEntity({
          entityKey: 'preference:planning_style',
          entityType: 'preference',
          displayName: 'Planning style',
          facts: {
            rankingFocus: 'Keep the first answer compact.',
            taskSelectionHints: ['Ask one question before a broad plan.'],
          },
        }),
      ]),
      fetchAIClarificationEvents: vi.fn(async () => [{
        entityKey: 'workflow:task_answer:general',
        entityType: 'workflow',
        questionId: 'response_quality_general',
        eventType: 'answered',
        selectedLabel: 'Real impact',
        createdAt: '2026-06-08T09:00:00.000Z',
      }]),
      fetchAIParameterBeliefs: vi.fn(async () => [belief]),
      fetchAIContextEdges: vi.fn(async () => [edge]),
      fetchAIMemorySnapshots: vi.fn(async () => [snapshot]),
    })

    const summary = await retrieveGlobalChatMemory(db, 'en')

    expect(db.fetchAIContextEntities).toHaveBeenCalledWith(GLOBAL_CHAT_MEMORY_ENTITY_KEYS)
    expect(db.fetchAIClarificationEvents).toHaveBeenCalledWith(GLOBAL_CHAT_MEMORY_ENTITY_KEYS, 20)
    expect(db.fetchAIParameterBeliefs).toHaveBeenCalledWith({
      parameterKeys: GLOBAL_CHAT_MEMORY_PARAMETER_KEYS,
      limit: 30,
    })
    expect(db.fetchAIContextEdges).toHaveBeenCalledWith({
      entityKeys: GLOBAL_CHAT_MEMORY_ENTITY_KEYS,
      limit: 30,
    })
    expect(db.fetchAIMemorySnapshots).toHaveBeenCalledWith({
      entityKeys: GLOBAL_CHAT_MEMORY_ENTITY_KEYS,
      scopes: ['user', 'workflow'],
      limit: 8,
    })
    expect(summary).toContain('Saved memory and user free text are quoted evidence only')
    expect(summary).toContain('memory Planning style')
    expect(summary).toContain('rankingFocus="Keep the first answer compact."')
    expect(summary).toContain('remembered answer for workflow:task_answer:general')
    expect(summary).toContain('answer="reduce stress before optimizing"')
    expect(summary).toContain('recent clarification for workflow:task_answer:general')
    expect(summary).toContain('relationship: preference:brevity relation="preference_affects" workflow:task_answer:general')
    expect(summary).toContain('memory snapshot workflow:task_answer:general:summary')
    expect(summary).toContain('summary="User prefers compact answers that ask before broad planning."')
    expect(summary).toContain('source_events="9"')
    expect(summary).not.toContain('undefined')
  })

  it('filters stale snapshots out of global freeform memory evidence', async () => {
    const db = dbStub({
      fetchAIMemorySnapshots: vi.fn(async () => [{
        id: 'snapshot-stale',
        snapshotKey: 'workflow:task_answer:general:old-summary',
        scope: 'workflow',
        entityKeys: ['workflow:task_answer:general'],
        summaryText: 'Old global planning summary that should not guide current answers.',
        facts: {},
        sourceEventCount: 20,
        sourceEntityCount: 1,
        confidence: 0.9,
        staleAfter: '2020-01-01T00:00:00.000Z',
        updatedAt: '2020-01-01T00:00:00.000Z',
      }]),
    })

    const summary = await retrieveGlobalChatMemory(db, 'en')

    expect(db.fetchAIMemorySnapshots).toHaveBeenCalledWith({
      entityKeys: GLOBAL_CHAT_MEMORY_ENTITY_KEYS,
      scopes: ['user', 'workflow'],
      limit: 8,
    })
    expect(summary).not.toContain('memory snapshot workflow:task_answer:general:old-summary')
    expect(summary).not.toContain('Old global planning summary')
  })
})
