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
    upsert: vi.fn(async () => {
      if (!readyTables.has(table)) return { error: schemaError() }
      if (table === 'ai_context_entities') entityUpsertCount += 1
      if (table === 'ai_parameter_beliefs') parameterBeliefUpsertCount += 1
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

describe('AI memory pending write queue', () => {
  beforeEach(() => {
    readyTables = new Set()
    entityUpsertCount = 0
    eventInsertCount = 0
    feedbackInsertCount = 0
    parameterBeliefUpsertCount = 0
    tableRows = {}
    clearPendingAIMemoryWritesForTest()
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
    expect(snapshot.clarificationEvents[0]).toMatchObject({ selectedLabel: 'Real impact' })
    expect(snapshot.parameterBeliefs[0]).toMatchObject({ parameterKey: 'rankingFocus', confidence: 0.9 })
    expect(snapshot.recommendationFeedback[0]).toMatchObject({ action: 'dismiss', reasonCategory: 'not_important' })
    expect(snapshot.pendingWriteCount).toBe(0)
  })
})
