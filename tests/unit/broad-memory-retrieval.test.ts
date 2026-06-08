import { describe, expect, it, vi } from 'vitest'
import {
  BROAD_TASK_GLOBAL_MEMORY_ENTITY_KEYS,
  retrieveBroadAIMemory,
  type BroadMemoryDb,
} from '@/services/ai/pipeline/broadMemoryRetrieval'
import type {
  AIClarificationEvent,
  AIContextEdge,
  AIContextEntity,
  AIParameterBelief,
  AIRecommendationFeedback,
  ProjectContext,
  TaskContext,
} from '@/types/aiMemory'

const taskId = '11111111-1111-4111-8111-111111111111'
const projectId = '22222222-2222-4222-8222-222222222222'

function dbStub(overrides: Partial<BroadMemoryDb> = {}): BroadMemoryDb {
  return {
    fetchProjectContexts: vi.fn(async () => []),
    fetchTaskContexts: vi.fn(async () => []),
    fetchAIContextEntities: vi.fn(async () => []),
    fetchAIClarificationEvents: vi.fn(async () => []),
    fetchAIParameterBeliefs: vi.fn(async () => []),
    fetchAIRecommendationFeedback: vi.fn(async () => []),
    fetchAIContextEdges: vi.fn(async () => []),
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

describe('retrieveBroadAIMemory', () => {
  it('falls back with bounded diagnostics when broad memory retrieval times out', async () => {
    vi.useFakeTimers()
    const db = dbStub({
      fetchProjectContexts: vi.fn(() => new Promise<ProjectContext[]>(resolve => setTimeout(() => resolve([]), 100))),
    })
    const pending = retrieveBroadAIMemory({
      db,
      lang: 'en',
      timeoutMs: 10,
      cardTasks: [
        { id: taskId, projectId, title: 'Known task' },
        { id: 'local-task', projectId: 'uncategorized', title: 'Loose admin' },
      ],
    })

    await vi.advanceTimersByTimeAsync(11)
    const result = await pending
    vi.useRealTimers()

    expect(result.summary).toBe('')
    expect(result.recommendationFeedback).toEqual([])
    expect(result.entityKeys).toEqual([
      ...BROAD_TASK_GLOBAL_MEMORY_ENTITY_KEYS,
      `project:${projectId}`,
      'project:uncategorized',
      `task:${taskId}`,
      'task:local-task',
    ])
    expect(result.diagnostics).toMatchObject({
      source: 'fallback',
      timedOut: true,
      entityKeyCount: BROAD_TASK_GLOBAL_MEMORY_ENTITY_KEYS.length + 4,
      projectContextCount: 0,
      taskContextCount: 0,
      exactEntityCount: 0,
      eventCount: 0,
      beliefCount: 0,
      feedbackCount: 0,
      graphEdgeCount: 0,
    })
    expect(JSON.stringify(result.diagnostics)).not.toContain('Known task')
  })

  it('uses server-backed entity memory and parameter beliefs for broad task answers with synthetic project keys', async () => {
    const feedback: AIRecommendationFeedback[] = [{
      id: 'feedback-1',
      recommendationId: 'inline_task',
      entityKey: 'project:uncategorized',
      action: 'postpone',
      reasonCategory: 'low_energy',
      implicitPositive: false,
      revisitAt: '2026-06-15T09:00:00.000Z',
      createdAt: '2026-06-08T09:00:00.000Z',
    }]
    const belief: AIParameterBelief = {
      id: 'belief-1',
      entityKey: 'project:uncategorized',
      entityType: 'synthetic_group',
      parameterKey: 'project_meaning',
      beliefJson: {
        value: 'Small admin bucket unless the user says otherwise',
        selectedLabel: 'Admin/maintenance',
      },
      confidence: 0.86,
      impactWeight: 0.85,
      lastAnsweredAt: '2026-06-08T08:00:00.000Z',
    }
    const answeredEvent: AIClarificationEvent = {
      id: 'event-1',
      entityKey: 'project:uncategorized',
      entityType: 'synthetic_group',
      questionId: 'project_meaning',
      eventType: 'answered',
      selectedLabel: 'Admin/maintenance',
      freeText: 'This is not strategic work.',
      createdAt: '2026-06-08T08:00:00.000Z',
    }
    const graphEdge: AIContextEdge = {
      id: 'edge-1',
      sourceEntityKey: 'task:local-task',
      targetEntityKey: 'project:uncategorized',
      relationType: 'belongs_to',
      confidence: 0.9,
      evidence: { source: 'clarification' },
      createdAt: '2026-06-08T08:15:00.000Z',
    }
    const db = dbStub({
      fetchProjectContexts: vi.fn(async (): Promise<ProjectContext[]> => []),
      fetchTaskContexts: vi.fn(async (): Promise<TaskContext[]> => []),
      fetchAIContextEntities: vi.fn(async () => [
        contextEntity({
          entityKey: 'project:uncategorized',
          entityType: 'synthetic_group',
          facts: {
            domain: 'admin',
            whyItMatters: 'Keeps loose tasks from being treated as strategic by name.',
            currentStakes: 'low',
          },
        }),
      ]),
      fetchAIClarificationEvents: vi.fn(async () => [answeredEvent]),
      fetchAIParameterBeliefs: vi.fn(async () => [belief]),
      fetchAIRecommendationFeedback: vi.fn(async () => feedback),
      fetchAIContextEdges: vi.fn(async () => [graphEdge]),
    })

    const result = await retrieveBroadAIMemory({
      db,
      lang: 'en',
      cardTasks: [
        { id: taskId, projectId, title: 'Known task' },
        { id: 'local-task', projectId: 'uncategorized', title: 'Loose admin' },
      ],
      getTaskProjectId: id => id === taskId ? projectId : 'uncategorized',
      getTaskTitle: id => id === taskId ? 'Known task' : 'Loose admin',
      getProjectDisplayName: id => id === 'uncategorized' ? 'uncategorized' : 'Client Project',
    })

    expect(db.fetchProjectContexts).toHaveBeenCalledWith([projectId])
    expect(db.fetchTaskContexts).toHaveBeenCalledWith([taskId])
    expect(db.fetchAIContextEntities).toHaveBeenCalledWith([
      ...BROAD_TASK_GLOBAL_MEMORY_ENTITY_KEYS,
      `project:${projectId}`,
      'project:uncategorized',
      `task:${taskId}`,
      'task:local-task',
    ])
    expect(db.fetchAIClarificationEvents).toHaveBeenCalledWith(result.entityKeys, 30)
    expect(db.fetchAIParameterBeliefs).toHaveBeenCalledWith({ entityKeys: result.entityKeys, limit: 40 })
    expect(db.fetchAIRecommendationFeedback).toHaveBeenCalledWith({
      taskIds: [taskId],
      entityKeys: result.entityKeys,
      limit: 30,
    })
    expect(db.fetchAIContextEdges).toHaveBeenCalledWith({
      entityKeys: result.entityKeys,
      limit: 40,
    })
    expect(result.summary).toContain('project uncategorized')
    expect(result.summary).toContain('domain="admin"')
    expect(result.summary).toContain('remembered answer for uncategorized')
    expect(result.summary).toContain('project_meaning')
    expect(result.summary).toContain('recent clarification for uncategorized')
    expect(result.summary).toContain('relationship: Loose admin relation=\"belongs_to\" uncategorized')
    expect(result.summary).toContain('recommendation feedback for uncategorized')
    expect(result.summary).not.toContain('context unknown for projects: uncategorized')
    expect(result.recommendationFeedback).toEqual(feedback)
    expect(result.compactPreference).toBe(false)
    expect(result.diagnostics).toMatchObject({
      projectContextCount: 1,
      exactEntityCount: 1,
      eventCount: 1,
      beliefCount: 1,
      feedbackCount: 1,
      graphEdgeCount: 1,
    })
  })

  it('retrieves global brevity preference for broad task answers and exposes a compact signal', async () => {
    const brevityBelief: AIParameterBelief = {
      id: 'belief-brevity',
      entityKey: 'preference:brevity',
      entityType: 'preference',
      parameterKey: 'preferences',
      beliefJson: {
        value: 'User marked the previous planning answer as too much; keep future task recommendations shorter and compact.',
      },
      confidence: 0.9,
      impactWeight: 0.65,
      sourceQuestionId: 'recommendation_feedback:simplify',
      updatedAt: '2026-06-08T09:00:00.000Z',
    }
    const db = dbStub({
      fetchAIContextEntities: vi.fn(async keys => keys.includes('preference:brevity')
        ? [
            contextEntity({
              entityKey: 'preference:brevity',
              entityType: 'preference',
              displayName: 'Brevity',
              facts: {
                preferences: 'Keep broad planning answers compact after too-much feedback.',
              },
            }),
          ]
        : []),
      fetchAIParameterBeliefs: vi.fn(async () => [brevityBelief]),
    })

    const result = await retrieveBroadAIMemory({
      db,
      lang: 'en',
      cardTasks: [
        { id: 'local-a', projectId: 'uncategorized', title: 'First task' },
        { id: 'local-b', projectId: 'uncategorized', title: 'Second task' },
      ],
    })

    expect(result.entityKeys).toEqual(expect.arrayContaining(['preference:brevity', 'workflow:task_answer:next_task']))
    expect(db.fetchAIContextEntities).toHaveBeenCalledWith(expect.arrayContaining(['preference:brevity']))
    expect(db.fetchAIParameterBeliefs).toHaveBeenCalledWith({
      entityKeys: result.entityKeys,
      limit: 40,
    })
    expect(result.compactPreference).toBe(true)
    expect(result.summary).toContain('response preference Brevity')
    expect(result.summary).toContain('preferences="Keep broad planning answers compact after too-much feedback."')
    expect(result.summary).toContain('remembered answer for preference:brevity')
  })
})
