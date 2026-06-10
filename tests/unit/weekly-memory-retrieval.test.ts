import { describe, expect, it, vi } from 'vitest'
import { retrieveWeeklyAIMemory, type WeeklyMemoryDb } from '@/services/ai/pipeline/weeklyMemoryRetrieval'
import type { AIClarificationEvent, AIContextEdge, AIContextEntity, AIMemorySnapshot, AIParameterBelief, AIRecommendationFeedback, ProjectContext, TaskContext } from '@/types/aiMemory'

const taskId = '11111111-1111-4111-8111-111111111111'
const projectId = '22222222-2222-4222-8222-222222222222'

function projectContext(id: string, whyItMatters = 'User-confirmed project reason'): ProjectContext {
  return {
    projectId: id,
    summary: null,
    domain: 'unknown',
    lifeArea: null,
    whyItMatters,
    successCriteria: [],
    failureRisks: [],
    currentStakes: 'unknown',
    urgencyWindow: 'unknown',
    preferredCadence: null,
    taskSelectionHints: [],
    nonGoals: [],
    userCorrections: [],
    confidence: 0.7,
    completenessScore: 0.6,
    lastConfirmedAt: null,
    lastUpdatedAt: null,
    staleAfter: null,
  }
}

function taskContext(id: string): TaskContext {
  return {
    taskId: id,
    projectId,
    summary: 'Known task meaning',
    whyItMatters: 'This task unblocks the plan',
    successCriteria: [],
    currentStakes: 'medium',
    urgencyWindow: 'this_week',
    selectionHints: [],
    nonGoals: [],
    userCorrections: [],
    confidence: 0.8,
    completenessScore: 0.7,
    lastConfirmedAt: null,
    lastUpdatedAt: null,
    staleAfter: null,
  }
}

function contextEntity(entity: Partial<AIContextEntity> & Pick<AIContextEntity, 'entityKey' | 'entityType'>): AIContextEntity {
  return {
    displayName: entity.entityKey,
    facts: {},
    corrections: [],
    confidence: 0.7,
    completenessScore: 0.7,
    askCount: 0,
    ...entity,
  }
}

function dbStub(overrides: Partial<WeeklyMemoryDb> = {}): WeeklyMemoryDb {
  return {
    fetchProjectContexts: vi.fn(async () => []),
    fetchTaskContexts: vi.fn(async () => []),
    fetchAIContextEntities: vi.fn(async () => []),
    fetchAIClarificationEvents: vi.fn(async () => []),
    fetchAIRecommendationFeedback: vi.fn(async () => []),
    fetchAIContextEdges: vi.fn(async () => []),
    fetchAIMemorySnapshots: vi.fn(async () => []),
    fetchAIParameterBeliefs: vi.fn(async () => []),
    ...overrides,
  }
}

describe('retrieveWeeklyAIMemory', () => {
  it('retrieves exact SQL memory without sending synthetic buckets to UUID-only calls', async () => {
    const feedback: AIRecommendationFeedback[] = [{
      id: 'feedback-1',
      recommendationId: 'rec-1',
      taskId,
      entityKey: `task:${taskId}`,
      action: 'dismiss',
      reasonCategory: 'not_important',
      implicitPositive: false,
      createdAt: '2026-06-08T08:00:00.000Z',
    }]
    const contextEdges: AIContextEdge[] = [{
      id: 'edge-1',
      sourceEntityKey: `task:${taskId}`,
      targetEntityKey: `project:${projectId}`,
      relationType: 'belongs_to',
      confidence: 0.95,
      evidence: { source: 'test' },
      createdAt: '2026-06-08T08:10:00.000Z',
    }]
    const memorySnapshots: AIMemorySnapshot[] = [{
      snapshotKey: 'week:2026-06-08:summary',
      scope: 'week',
      entityKeys: [`task:${taskId}`, `project:${projectId}`, 'week:2026-06-08'],
      summaryText: 'User-confirmed weekly focus is memory reliability.',
      facts: { focus: 'memory reliability' },
      sourceEventCount: 4,
      sourceEntityCount: 2,
      confidence: 0.82,
      staleAfter: '2026-07-08T08:00:00.000Z',
    }]
    const parameterBeliefs: AIParameterBelief[] = [{
      entityKey: 'week:2026-06-08',
      entityType: 'week',
      parameterKey: 'thisWeekImportance',
      beliefJson: { value: 'client_money' },
      confidence: 0.88,
      impactWeight: 0.85,
      updatedAt: '2026-06-08T08:15:00.000Z',
    }]
    const db = dbStub({
      fetchProjectContexts: vi.fn(async ids => ids.map(id => projectContext(id, 'Legacy project context'))),
      fetchTaskContexts: vi.fn(async ids => ids.map(id => taskContext(id))),
      fetchAIContextEntities: vi.fn(async () => [
        contextEntity({
          entityKey: 'project:uncategorized',
          entityType: 'synthetic_group',
          summary: 'Synthetic bucket context',
          facts: { whyItMatters: 'User said uncategorized is mostly admin cleanup' },
          relatedEntities: ['preference:planning_style'],
          lastAnsweredAt: '2026-03-01T08:00:00.000Z',
          staleAfter: '2026-06-01T08:00:00.000Z',
        }),
      ]),
      fetchAIClarificationEvents: vi.fn(async () => [
        {
          entityKey: 'project:uncategorized',
          entityType: 'synthetic_group',
          questionId: 'project_domain',
          eventType: 'answered',
          selectedLabel: 'Admin',
          createdAt: '2026-06-08T08:00:00.000Z',
        },
        ...Array.from({ length: 20 }, (_, index) => ({
          entityKey: 'project:uncategorized',
          entityType: 'synthetic_group' as const,
          questionId: `old-${index}`,
          eventType: 'answered' as const,
          selectedLabel: 'Old answer',
          createdAt: '2025-10-01T08:00:00.000Z',
        })),
      ]),
      fetchAIRecommendationFeedback: vi.fn(async () => feedback),
      fetchAIContextEdges: vi.fn(async () => contextEdges),
      fetchAIMemorySnapshots: vi.fn(async () => memorySnapshots),
      fetchAIParameterBeliefs: vi.fn(async () => parameterBeliefs),
    })

    const result = await retrieveWeeklyAIMemory({
      db,
      now: new Date('2026-06-08T10:00:00.000Z'),
      timeoutMs: 200,
      cardTasks: [
        { id: taskId, projectId, title: 'Known task' },
        { id: 'local-temp-task', projectId: 'uncategorized', title: 'Synthetic task' },
      ],
      getTaskProjectId: id => id === taskId ? projectId : 'uncategorized',
    })

    expect(db.fetchProjectContexts).toHaveBeenCalledWith([projectId])
    expect(db.fetchTaskContexts).toHaveBeenCalledWith([taskId])
    expect(db.fetchAIContextEntities).toHaveBeenCalledWith([
      `project:${projectId}`,
      'project:uncategorized',
      `task:${taskId}`,
      'task:local-temp-task',
      'week:2026-06-08',
    ])
    expect(db.fetchAIRecommendationFeedback).toHaveBeenCalledWith({
      taskIds: [taskId],
      entityKeys: result.entityKeys,
      limit: 80,
    })
    expect(db.fetchAIContextEdges).toHaveBeenCalledWith({
      entityKeys: result.entityKeys,
      limit: 80,
    })
    expect(db.fetchAIMemorySnapshots).toHaveBeenCalledWith({
      entityKeys: result.entityKeys,
      scopes: ['user', 'project', 'task', 'week'],
      limit: 12,
    })
    const expectedBeliefEntityKeys = [
      `project:${projectId}`,
      'project:uncategorized',
      `task:${taskId}`,
      'task:local-temp-task',
      'week:2026-06-08',
      'week:2026-06-01',
      'week:2026-05-25',
      'week:2026-05-18',
      'week:2026-05-11',
      'week:2026-05-04',
      'week:2026-04-27',
      'week:2026-04-20',
      'preference:ranking_focus',
      'preference:energy_fit',
      'preference:follow_through',
      'preference:brevity',
    ]
    expect(db.fetchAIClarificationEvents).toHaveBeenCalledWith(expectedBeliefEntityKeys, 40)
    expect(db.fetchAIParameterBeliefs).toHaveBeenCalledWith({
      entityKeys: expectedBeliefEntityKeys,
      limit: 60,
    })
    expect(result.memory.projectContexts?.map(ctx => ctx.projectId)).toEqual([projectId])
    expect(result.memory.taskContexts?.map(ctx => ctx.taskId)).toEqual([taskId])
    expect(result.memory.memorySnapshots).toEqual(memorySnapshots)
    expect(result.memory.parameterBeliefs).toEqual(parameterBeliefs)
    expect(result.memory.recommendationFeedback).toEqual(feedback)
    expect(result.clarificationEvents).toHaveLength(21)
    expect(result.edges).toHaveLength(4)
    expect(result.diagnostics).toMatchObject({
      source: 'hybrid_sql',
      entityKeyCount: 5,
      eventCount: 21,
      projectContextCount: 1,
      taskContextCount: 1,
      feedbackCount: 1,
      graphEdgeCount: 1,
      snapshotCount: 1,
      parameterBeliefCount: 1,
      timedOut: false,
      exactEntityCount: 1,
      semanticCandidateCount: 1,
      semanticSkippedReason: 'pgvector_not_configured',
    })
    expect(result.diagnostics.stageTimings).toMatchObject({
      projectContexts: expect.any(Number),
      taskContexts: expect.any(Number),
      contextEntities: expect.any(Number),
      clarificationEvents: expect.any(Number),
      recommendationFeedback: expect.any(Number),
      contextEdges: expect.any(Number),
      memorySnapshots: expect.any(Number),
      parameterBeliefs: expect.any(Number),
    })
    expect(result.diagnostics.lifecycle).toMatchObject({
      staleEntityKeys: ['project:uncategorized'],
      refreshEntityKeys: ['project:uncategorized'],
      summarizeEntityKeys: ['project:uncategorized'],
    })
    expect(JSON.stringify(result.memory)).not.toContain('User said uncategorized')
    expect(JSON.stringify(result.memory)).not.toContain('Synthetic bucket context')
    expect(JSON.stringify(result.diagnostics)).not.toContain('User said uncategorized')
  })

  it('retrieves recent weekly clarification history so repeated priority questions are visible', async () => {
    const db = dbStub()

    await retrieveWeeklyAIMemory({
      db,
      now: new Date('2026-06-10T10:00:00.000Z'),
      timeoutMs: 200,
      cardTasks: [{ id: taskId, projectId, title: 'Known task' }],
    })

    expect(db.fetchAIClarificationEvents).toHaveBeenCalledWith(expect.arrayContaining([
      'week:2026-06-08',
      'week:2026-06-01',
      'week:2026-05-25',
      'week:2026-05-18',
    ]), 40)
  })

  it('filters stale memory snapshots out of weekly planning evidence while keeping lifecycle diagnostics', async () => {
    const memorySnapshots: AIMemorySnapshot[] = [
      {
        snapshotKey: 'week:2026-06-01:summary',
        scope: 'week',
        entityKeys: [`task:${taskId}`, `project:${projectId}`, 'week:2026-06-08'],
        summaryText: 'Outdated weekly focus that should be refreshed before ranking.',
        facts: { focus: 'old priority' },
        sourceEventCount: 12,
        sourceEntityCount: 2,
        confidence: 0.9,
        staleAfter: '2026-06-01T08:00:00.000Z',
        updatedAt: '2026-05-20T08:00:00.000Z',
      },
      {
        snapshotKey: 'project:weak-summary',
        scope: 'project',
        entityKeys: [`project:${projectId}`],
        summaryText: 'Low-confidence summary that should not suppress a clarification.',
        facts: {},
        sourceEventCount: 3,
        sourceEntityCount: 1,
        confidence: 0.3,
        staleAfter: '2026-07-01T08:00:00.000Z',
        updatedAt: '2026-06-01T08:00:00.000Z',
      },
    ]
    const db = dbStub({
      fetchAIMemorySnapshots: vi.fn(async () => memorySnapshots),
    })

    const result = await retrieveWeeklyAIMemory({
      db,
      now: new Date('2026-06-08T10:00:00.000Z'),
      timeoutMs: 200,
      cardTasks: [{ id: taskId, projectId, title: 'Known task' }],
    })

    expect(result.memory.memorySnapshots).toEqual([])
    expect(result.diagnostics.snapshotCount).toBe(0)
    expect(result.diagnostics.lifecycle.staleSnapshotKeys).toEqual(['week:2026-06-01:summary'])
    expect(result.diagnostics.lifecycle.refreshSnapshotKeys).toEqual([
      'week:2026-06-01:summary',
      'project:weak-summary',
    ])
    expect(result.diagnostics.lifecycle.lowConfidenceSnapshotCount).toBe(1)
    expect(JSON.stringify(result.memory)).not.toContain('Outdated weekly focus')
    expect(JSON.stringify(result.memory)).not.toContain('Low-confidence summary')
  })

  it('suggests compact snapshots when weekly memory lifecycle says an entity needs summarization', async () => {
    const entityKey = `project:${projectId}`
    const db = dbStub({
      fetchAIContextEntities: vi.fn(async () => [
        contextEntity({
          entityKey,
          entityType: 'project',
          displayName: 'Memory Reliability',
          facts: { whyItMatters: 'Prevents repeated clarification and fake planning.' },
          confidence: 0.86,
          lastAnsweredAt: '2026-06-07T10:00:00.000Z',
        }),
      ]),
      fetchAIClarificationEvents: vi.fn(async () => Array.from({ length: 20 }, (_, index) => ({
        entityKey,
        entityType: 'project',
        questionId: `q-${index}`,
        eventType: 'answered',
        selectedLabel: `Answer ${index}`,
        createdAt: `2026-06-${String(Math.max(1, 8 - (index % 5))).padStart(2, '0')}T10:00:00.000Z`,
      } as AIClarificationEvent))),
    })

    const result = await retrieveWeeklyAIMemory({
      db,
      cardTasks: [{ id: taskId, projectId }],
      now: new Date('2026-06-08T10:00:00.000Z'),
      timeoutMs: 1000,
    })

    expect(result.diagnostics.lifecycle.summarizeEntityKeys).toContain(entityKey)
    expect(result.diagnostics.snapshotSuggestions).toEqual([
      expect.objectContaining({
        snapshotKey: `${entityKey}:summary`,
        scope: 'project',
        entityKeys: [entityKey],
        summaryText: expect.stringContaining('Prevents repeated clarification'),
        sourceEventCount: 20,
        sourceEntityCount: 1,
      }),
    ])
  })

  it('falls back on timeout without inventing memory evidence', async () => {
    vi.useFakeTimers()
    const db = dbStub({
      fetchProjectContexts: vi.fn(() => new Promise<ProjectContext[]>(resolve => setTimeout(() => resolve([projectContext(projectId)]), 100))),
    })
    const pending = retrieveWeeklyAIMemory({
      db,
      now: new Date('2026-06-08T10:00:00.000Z'),
      timeoutMs: 10,
      cardTasks: [{ id: taskId, projectId, title: 'Known task' }],
    })

    await vi.advanceTimersByTimeAsync(11)
    const result = await pending
    vi.useRealTimers()

    expect(result.memory).toEqual({})
    expect(result.clarificationEvents).toEqual([])
    expect(result.diagnostics.source).toBe('fallback')
    expect(result.diagnostics.timedOut).toBe(true)
    expect(result.diagnostics.projectContextCount).toBe(0)
    expect(result.diagnostics.taskContextCount).toBe(0)
    expect(result.diagnostics.snapshotCount).toBe(0)
    expect(result.diagnostics.parameterBeliefCount).toBe(0)
    expect(result.edges).toHaveLength(2)
  })

  it('filters stale parameter beliefs out of weekly planning memory', async () => {
    const staleBelief: AIParameterBelief = {
      entityKey: 'week:2026-06-08',
      entityType: 'week',
      parameterKey: 'thisWeekImportance',
      beliefJson: { value: 'old launch focus' },
      confidence: 0.9,
      impactWeight: 0.85,
      lastReinforcedAt: '2026-01-01T08:00:00.000Z',
      staleAfter: '2026-05-01T08:00:00.000Z',
      decayScore: 1,
    }
    const freshBelief: AIParameterBelief = {
      entityKey: 'preference:ranking_focus',
      entityType: 'preference',
      parameterKey: 'rankingFocus',
      beliefJson: { value: 'real consequences first' },
      confidence: 0.88,
      impactWeight: 0.75,
      lastReinforcedAt: '2026-06-08T08:00:00.000Z',
      staleAfter: '2026-07-08T08:00:00.000Z',
      decayScore: 1,
    }
    const db = dbStub({
      fetchAIParameterBeliefs: vi.fn(async () => [staleBelief, freshBelief]),
    })

    const result = await retrieveWeeklyAIMemory({
      db,
      now: new Date('2026-06-08T10:00:00.000Z'),
      timeoutMs: 200,
      cardTasks: [{ id: taskId, projectId, title: 'Known task' }],
    })

    expect(result.memory.parameterBeliefs).toEqual([freshBelief])
    expect(result.diagnostics.parameterBeliefCount).toBe(1)
    expect(result.diagnostics.lifecycle).toMatchObject({
      staleParameterBeliefKeys: ['week:2026-06-08:thisWeekImportance'],
      refreshParameterBeliefKeys: ['week:2026-06-08:thisWeekImportance'],
    })
  })
})
