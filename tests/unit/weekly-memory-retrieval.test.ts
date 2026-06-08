import { describe, expect, it, vi } from 'vitest'
import { retrieveWeeklyAIMemory, type WeeklyMemoryDb } from '@/services/ai/pipeline/weeklyMemoryRetrieval'
import type { AIContextEdge, AIContextEntity, AIRecommendationFeedback, ProjectContext, TaskContext } from '@/types/aiMemory'

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
    expect(result.memory.projectContexts?.map(ctx => ctx.projectId)).toEqual([projectId, 'uncategorized'])
    expect(result.memory.taskContexts?.map(ctx => ctx.taskId)).toEqual([taskId])
    expect(result.memory.recommendationFeedback).toEqual(feedback)
    expect(result.clarificationEvents).toHaveLength(21)
    expect(result.edges).toHaveLength(4)
    expect(result.diagnostics).toMatchObject({
      source: 'hybrid_sql',
      entityKeyCount: 5,
      eventCount: 21,
      projectContextCount: 2,
      taskContextCount: 1,
      feedbackCount: 1,
      graphEdgeCount: 1,
      timedOut: false,
      exactEntityCount: 1,
      semanticCandidateCount: 1,
      semanticSkippedReason: 'pgvector_not_configured',
    })
    expect(result.diagnostics.lifecycle).toMatchObject({
      staleEntityKeys: ['project:uncategorized'],
      refreshEntityKeys: ['project:uncategorized'],
      summarizeEntityKeys: ['project:uncategorized'],
    })
    expect(JSON.stringify(result.diagnostics)).not.toContain('User said uncategorized')
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
    expect(result.edges).toHaveLength(2)
  })
})
