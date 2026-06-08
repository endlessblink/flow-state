import { describe, expect, it, vi } from 'vitest'
import { retrieveBroadAIMemory, type BroadMemoryDb } from '@/services/ai/pipeline/broadMemoryRetrieval'
import type {
  AIClarificationEvent,
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
    expect(result.summary).toContain('project uncategorized')
    expect(result.summary).toContain('domain="admin"')
    expect(result.summary).toContain('remembered answer for uncategorized')
    expect(result.summary).toContain('project_meaning')
    expect(result.summary).toContain('recent clarification for uncategorized')
    expect(result.summary).toContain('recommendation feedback for uncategorized')
    expect(result.summary).not.toContain('context unknown for projects: uncategorized')
    expect(result.recommendationFeedback).toEqual(feedback)
    expect(result.diagnostics).toMatchObject({
      projectContextCount: 1,
      exactEntityCount: 1,
      eventCount: 1,
      beliefCount: 1,
      feedbackCount: 1,
    })
  })
})
