import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DatabaseContext } from '@/composables/supabase/_infrastructure'
import {
  clearPendingAIMemoryWritesForTest,
  getPendingAIMemoryWriteCount,
  useAIMemoryDatabase,
} from '@/composables/supabase/useAIMemoryDatabase'

let schemaReady = false
let entityUpsertCount = 0
let eventInsertCount = 0

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
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => {
      if (!schemaReady && table === 'ai_context_entities') {
        return {
          data: null,
          error: {
            code: 'PGRST205',
            message: "Could not find the table 'public.ai_context_entities' in the schema cache",
          },
        }
      }
      return { data: null, error: null }
    }),
    upsert: vi.fn(async () => {
      if (table === 'ai_context_entities') entityUpsertCount += 1
      return { error: null }
    }),
    insert: vi.fn(async () => {
      if (table === 'ai_clarification_events') eventInsertCount += 1
      return { error: null }
    }),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    in: vi.fn(() => builder),
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
    schemaReady = false
    entityUpsertCount = 0
    eventInsertCount = 0
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

    schemaReady = true
    await db.flushPendingAIMemoryWrites()

    expect(getPendingAIMemoryWriteCount()).toBe(0)
    expect(entityUpsertCount).toBe(1)
    expect(eventInsertCount).toBe(1)
  })
})
