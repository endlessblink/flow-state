import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DatabaseContext } from '@/composables/supabase/_infrastructure'
import {
  clearPendingAIMemoryWritesForTest,
  getPendingAIMemoryWriteCount,
  useAIMemoryDatabase,
} from '@/composables/supabase/useAIMemoryDatabase'

let readyTables = new Set<string>()
let entityUpsertCount = 0
let eventInsertCount = 0
let feedbackInsertCount = 0
let parameterBeliefUpsertCount = 0
let tableRows: Record<string, unknown[]> = {}
let upsertPayloads: Record<string, unknown[]> = {}

vi.mock('@/composables/supabase/_infrastructure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/composables/supabase/_infrastructure')>()
  return {
    ...actual,
    getSupabase: () => ({
      from: (table: string) => createTableBuilder(table),
    }),
    invalidateCache: {
      all: vi.fn(),
      pattern: vi.fn(),
    },
    swrCache: {
      getOrFetch: vi.fn((_: string, fetcher: () => unknown) => fetcher()),
    },
  }
})

function createTableBuilder(table: string) {
  const schemaError = () => ({
    code: 'PGRST205',
    message: `Could not find the table 'public.${table}' in the schema cache`,
  })
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => {
      if (!readyTables.has(table)) {
        return { data: null, error: schemaError() }
      }
      return { data: null, error: null }
    }),
    upsert: vi.fn(async (payload: unknown) => {
      if (!readyTables.has(table)) return { error: schemaError() }
      if (table === 'ai_context_entities') entityUpsertCount += 1
      if (table === 'ai_parameter_beliefs') parameterBeliefUpsertCount += 1
      upsertPayloads[table] = [...(upsertPayloads[table] ?? []), payload]
      return { error: null }
    }),
    insert: vi.fn(async () => {
      if (!readyTables.has(table)) return { error: schemaError() }
      if (table === 'ai_clarification_events') eventInsertCount += 1
      if (table === 'ai_recommendation_feedback') feedbackInsertCount += 1
      return { error: null }
    }),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    in: vi.fn(() => builder),
    then: (resolve: (value: { data: unknown[] | null; error: unknown }) => unknown, reject?: (reason: unknown) => unknown) => {
      const result = readyTables.has(table)
        ? { data: tableRows[table] ?? [], error: null }
        : { data: null, error: schemaError() }
      return Promise.resolve(result).then(resolve, reject)
    },
  }
  return builder
}

function createContext(): DatabaseContext {
  return {
    authStore: {
      isInitialized: true,
      initialize: vi.fn(async () => undefined),
    } as unknown as DatabaseContext['authStore'],
    isSyncing: ref(false),
    getUserIdSafe: () => '00000000-0000-4000-8000-000000000001',
    withRetry: async <T>(operation: () => Promise<T>) => operation(),
    handleError: vi.fn(),
  }
}

function createGuestContext(): DatabaseContext {
  return {
    authStore: {
      isInitialized: true,
      initialize: vi.fn(async () => undefined),
    } as unknown as DatabaseContext['authStore'],
    isSyncing: ref(false),
    getUserIdSafe: () => null,
    withRetry: async <T>(operation: () => Promise<T>) => operation(),
    handleError: vi.fn(),
  }
}

describe('AI memory pending write queue', () => {
  beforeEach(() => {
    readyTables = new Set()
    entityUpsertCount = 0
    eventInsertCount = 0
    feedbackInsertCount = 0
    parameterBeliefUpsertCount = 0
    tableRows = {}
    upsertPayloads = {}
    clearPendingAIMemoryWritesForTest()
    localStorage.removeItem('flowstate-ai-clarification-local-memory-v1')
  })

  it('stores guest clarification answers locally so broad prompts do not re-ask immediately', async () => {
    const db = useAIMemoryDatabase(createGuestContext())

    await db.recordAIClarificationEvent({
      entityKey: 'workflow:task_answer:next_task',
      entityType: 'workflow',
      displayName: 'next_task',
      questionId: 'response_quality_next_task',
      eventType: 'answered',
      question: 'What would make one task right for now?',
      selectedOptionId: 'ranking_energy',
      selectedLabel: 'Energy fit',
      memoryPatch: {
        entityType: 'workflow',
        entityId: 'next_task',
        operation: 'set',
        field: 'rankingFocus',
        value: 'energy fit right now',
        confidence: 0.9,
        source: 'button_answer',
      },
      coverageScoreAtTime: 0.42,
      uncertaintyDimensions: ['preferences', 'impact'],
      pathType: 'clarify_first',
    })

    const events = await db.fetchAIClarificationEvents(['workflow:task_answer:next_task'], 10)
    const beliefs = await db.fetchAIParameterBeliefs({
      entityKeys: ['workflow:task_answer:next_task'],
      parameterKeys: ['rankingFocus'],
      limit: 10,
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      eventType: 'answered',
      selectedLabel: 'Energy fit',
      questionId: 'response_quality_next_task',
    })
    expect(beliefs).toHaveLength(1)
    expect(beliefs[0]).toMatchObject({
      entityKey: 'workflow:task_answer:next_task',
      parameterKey: 'rankingFocus',
      confidence: 0.9,
    })
  })

  it('stores guest recommendation feedback locally so broad suggestions can learn without auth', async () => {
    const db = useAIMemoryDatabase(createGuestContext())

    await expect(db.recordAIRecommendationFeedback({
      recommendationId: 'inline_task_local-task',
      taskId: 'local-task',
      entityKey: 'task:local-task',
      action: 'postpone',
      reasonCategory: 'low_energy',
      revisitAt: '2026-06-15T09:00:00.000Z',
      sourceMessageId: 'msg-local',
    })).resolves.toBeUndefined()

    const feedback = await db.fetchAIRecommendationFeedback({
      taskIds: ['local-task'],
      entityKeys: ['task:local-task'],
      limit: 10,
    })
    const beliefs = await db.fetchAIParameterBeliefs({
      entityKeys: ['task:local-task'],
      parameterKeys: ['energy_fit'],
      limit: 10,
    })

    expect(feedback).toHaveLength(1)
    expect(feedback[0]).toMatchObject({
      recommendationId: 'inline_task_local-task',
      taskId: 'local-task',
      entityKey: 'task:local-task',
      action: 'postpone',
      reasonCategory: 'low_energy',
      revisitAt: '2026-06-15T09:00:00.000Z',
    })
    expect(beliefs).toHaveLength(1)
    expect(beliefs[0]).toMatchObject({
      entityKey: 'task:local-task',
      parameterKey: 'energy_fit',
    })
  })

  it('retrieves guest local feedback through broad task memory inputs', async () => {
    const db = useAIMemoryDatabase(createGuestContext())

    await db.recordAIRecommendationFeedback({
      recommendationId: 'inline_task_local-task',
      taskId: 'local-task',
      entityKey: 'task:local-task',
      action: 'dismiss',
      reasonCategory: 'not_important',
      sourceMessageId: 'msg-local',
    })

    const feedback = await db.fetchAIRecommendationFeedback({
      taskIds: ['00000000-0000-4000-8000-000000000002', 'local-task'],
      entityKeys: ['task:local-task', 'project:uncategorized'],
      limit: 10,
    })

    expect(feedback).toHaveLength(1)
    expect(feedback[0]).toMatchObject({
      recommendationId: 'inline_task_local-task',
      action: 'dismiss',
      reasonCategory: 'not_important',
    })
  })

  it('queues clarification writes skipped by missing schema and flushes them later', async () => {
    const db = useAIMemoryDatabase(createContext())

    await expect(db.recordAIClarificationEvent({
      entityKey: 'synthetic:Work',
      entityType: 'synthetic_group',
      displayName: 'Work',
      questionId: 'weekly-domain',
      eventType: 'answered',
      question: 'What kind of project is Work?',
      selectedOptionId: 'work_product',
      selectedLabel: 'Work/product',
      coverageScoreAtTime: 0.34,
      pathType: 'clarify_first',
      uncertaintyDimensions: ['project_meaning'],
    })).resolves.toBeUndefined()

    expect(getPendingAIMemoryWriteCount()).toBe(1)
    expect(entityUpsertCount).toBe(0)
    expect(eventInsertCount).toBe(0)

    readyTables = new Set(['ai_context_entities', 'ai_clarification_events', 'ai_parameter_beliefs'])
    await db.flushPendingAIMemoryWrites()

    expect(getPendingAIMemoryWriteCount()).toBe(0)
    expect(entityUpsertCount).toBe(1)
    expect(eventInsertCount).toBe(1)
  })

  it('queues recommendation feedback writes skipped by missing schema and flushes them later', async () => {
    const db = useAIMemoryDatabase(createContext())

    await expect(db.recordAIRecommendationFeedback({
      recommendationId: 'rec_1',
      entityKey: 'workflow:task_answer:general',
      action: 'postpone',
      reasonCategory: 'low_energy',
      revisitAt: '2026-06-15T09:00:00.000Z',
      sourceMessageId: 'msg_1',
    })).resolves.toBeUndefined()

    expect(getPendingAIMemoryWriteCount()).toBe(1)
    expect(feedbackInsertCount).toBe(0)

    readyTables = new Set(['ai_recommendation_feedback'])
    await db.flushPendingAIMemoryWrites()

    expect(getPendingAIMemoryWriteCount()).toBe(0)
    expect(feedbackInsertCount).toBe(1)
    expect(parameterBeliefUpsertCount).toBe(0)
  })

  it('promotes recommendation feedback into parameter beliefs when the belief table exists', async () => {
    readyTables = new Set(['ai_recommendation_feedback', 'ai_parameter_beliefs'])
    const db = useAIMemoryDatabase(createContext())

    await expect(db.recordAIRecommendationFeedback({
      recommendationId: 'inline_task_task-1',
      taskId: '11111111-1111-4111-8111-111111111111',
      entityKey: 'project:uncategorized',
      action: 'dismiss',
      reasonCategory: 'not_important',
      sourceMessageId: 'msg_1',
    })).resolves.toBeUndefined()

    expect(feedbackInsertCount).toBe(1)
    expect(parameterBeliefUpsertCount).toBe(1)
  })

  it('refreshes stale context entity freshness when a stale-context clarification is answered', async () => {
    readyTables = new Set(['ai_context_entities', 'ai_clarification_events', 'ai_parameter_beliefs'])
    const db = useAIMemoryDatabase(createContext())

    await db.recordAIClarificationEvent({
      entityKey: 'project:uncategorized',
      entityType: 'project',
      displayName: 'uncategorized',
      questionId: 'memory_refresh_project_uncategorized',
      eventType: 'answered',
      question: 'Is the old context for "uncategorized" still true?',
      selectedOptionId: 'still_true',
      selectedLabel: 'Still true',
      memoryPatch: {
        entityType: 'project',
        entityId: 'uncategorized',
        operation: 'confirm',
        field: 'stale_context',
        value: 'still true',
        confidence: 0.9,
        source: 'button_answer',
      },
      uncertaintyDimensions: ['stale_context'],
      pathType: 'clarify_first',
    })

    const entityPayload = upsertPayloads.ai_context_entities?.[0] as Record<string, unknown>

    expect(entityPayload).toMatchObject({
      entity_key: 'project:uncategorized',
      last_answered_at: expect.any(String),
      last_reinforced_at: expect.any(String),
      reinforcement_count: 1,
      decay_score: 1,
    })
    expect(new Date(String(entityPayload.stale_after)).getTime()).toBeGreaterThan(Date.now() + 40 * 24 * 60 * 60 * 1000)
    expect(parameterBeliefUpsertCount).toBeGreaterThan(0)
  })

  it('queues parameter belief writes skipped by missing schema and flushes them later', async () => {
    const db = useAIMemoryDatabase(createContext())

    await expect(db.upsertAIParameterBelief({
      entityKey: 'synthetic:Work',
      entityType: 'synthetic_group',
      parameterKey: 'impact',
      value: 'real consequence',
      confidence: 0.86,
      impactWeight: 0.9,
      sourceQuestionId: 'weekly-impact',
    })).resolves.toBeUndefined()

    expect(getPendingAIMemoryWriteCount()).toBe(1)
    expect(parameterBeliefUpsertCount).toBe(0)

    readyTables = new Set(['ai_parameter_beliefs'])
    await db.flushPendingAIMemoryWrites()

    expect(getPendingAIMemoryWriteCount()).toBe(0)
    expect(parameterBeliefUpsertCount).toBe(1)
  })

  it('reads a bounded debug snapshot across server-backed memory tables', async () => {
    readyTables = new Set([
      'ai_context_entities',
      'ai_context_edges',
      'ai_clarification_events',
      'ai_parameter_beliefs',
      'ai_recommendation_feedback',
    ])
    tableRows = {
      ai_context_entities: [{
        entity_key: 'workflow:task_answer:general',
        entity_type: 'workflow',
        display_name: 'Task answer',
        facts: { rankingFocus: 'impact' },
        corrections: [],
        confidence: 0.8,
        completeness_score: 0.4,
        ask_count: 1,
      }],
      ai_context_edges: [{
        source_entity_key: 'task:local-task',
        target_entity_key: 'project:uncategorized',
        relation_type: 'belongs_to',
        confidence: 0.9,
        evidence: { source: 'test' },
        created_at: '2026-06-08T09:01:00.000Z',
      }],
      ai_clarification_events: [{
        entity_key: 'workflow:task_answer:general',
        entity_type: 'workflow',
        question_id: 'response_quality_general',
        event_type: 'answered',
        selected_label: 'Real impact',
        created_at: '2026-06-08T09:00:00.000Z',
      }],
      ai_parameter_beliefs: [{
        entity_key: 'workflow:task_answer:general',
        entity_type: 'workflow',
        parameter_key: 'rankingFocus',
        belief_json: { value: 'real impact' },
        confidence: 0.9,
        impact_weight: 0.8,
      }],
      ai_recommendation_feedback: [{
        recommendation_id: 'rec-1',
        entity_key: 'workflow:task_answer:general',
        action: 'dismiss',
        reason_category: 'not_important',
        implicit_positive: false,
        created_at: '2026-06-08T09:05:00.000Z',
      }],
    }
    const db = useAIMemoryDatabase(createContext())

    const snapshot = await db.fetchAIMemoryDebugSnapshot(6)

    expect(snapshot.contextEntities).toHaveLength(1)
    expect(snapshot.contextEdges[0]).toMatchObject({ sourceEntityKey: 'task:local-task', relationType: 'belongs_to' })
    expect(snapshot.clarificationEvents[0]).toMatchObject({ selectedLabel: 'Real impact' })
    expect(snapshot.parameterBeliefs[0]).toMatchObject({ parameterKey: 'rankingFocus', confidence: 0.9 })
    expect(snapshot.recommendationFeedback[0]).toMatchObject({ action: 'dismiss', reasonCategory: 'not_important' })
    expect(snapshot.schemaStatus).toBe('ready')
    expect(snapshot.schemaMissingTables).toEqual([])
    expect(snapshot.pendingWriteCount).toBe(0)
  })

  it('reports missing server memory schema in the debug snapshot instead of throwing', async () => {
    const db = useAIMemoryDatabase(createContext())

    const snapshot = await db.fetchAIMemoryDebugSnapshot(6)

    expect(snapshot.schemaStatus).toBe('missing')
    expect(snapshot.schemaMissingTables).toEqual([
      'ai_clarification_events',
      'ai_context_edges',
      'ai_context_entities',
      'ai_parameter_beliefs',
      'ai_recommendation_feedback',
    ])
    expect(snapshot.contextEntities).toEqual([])
    expect(snapshot.pendingWriteCount).toBe(0)
  })

  it('reports local-only memory mode for guests', async () => {
    const db = useAIMemoryDatabase(createGuestContext())

    const snapshot = await db.fetchAIMemoryDebugSnapshot(6)

    expect(snapshot.schemaStatus).toBe('local_only')
    expect(snapshot.schemaMissingTables).toEqual([])
  })

  it('reads graph edges by source or target entity key without UUID casting', async () => {
    readyTables = new Set(['ai_context_edges'])
    tableRows = {
      ai_context_edges: [{
        id: 'edge-1',
        source_entity_key: 'task:local-task',
        target_entity_key: 'project:uncategorized',
        relation_type: 'belongs_to',
        confidence: 0.88,
        evidence: { source: 'weekly_plan_candidates' },
        created_at: '2026-06-08T09:01:00.000Z',
      }],
    }
    const db = useAIMemoryDatabase(createContext())

    const edges = await db.fetchAIContextEdges({
      entityKeys: ['project:uncategorized'],
      limit: 6,
    })

    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({
      sourceEntityKey: 'task:local-task',
      targetEntityKey: 'project:uncategorized',
      relationType: 'belongs_to',
      confidence: 0.88,
    })
  })
})
