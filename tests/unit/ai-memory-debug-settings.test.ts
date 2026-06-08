import { flushPromises, mount } from '@vue/test-utils'
import { computed, defineComponent, h, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AISettingsTab from '@/components/settings/tabs/AISettingsTab.vue'
import type { AIMemoryDebugSnapshot } from '@/types/aiMemory'

const state = vi.hoisted(() => ({
  fetchAIMemoryDebugSnapshot: vi.fn(),
}))

vi.mock('@/services/ai/proxy/bridgeClient', () => ({
  isBridgeAvailable: vi.fn(async () => false),
}))

vi.mock('@/composables/useAIUsageTracking', () => ({
  useAIUsageTracking: () => ({
    usageSummary: ref({
      period: 'all',
      periodLabel: 'All Time',
      totalTokens: 0,
      totalRequests: 0,
      totalCostUSD: 0,
      providers: [],
    }),
    weekUsage: ref({
      period: 'week',
      periodLabel: 'This Week',
      totalTokens: 0,
      totalRequests: 0,
      totalCostUSD: 0,
      providers: [],
    }),
    monthUsage: ref({
      period: 'month',
      periodLabel: 'This Month',
      totalTokens: 0,
      totalRequests: 0,
      totalCostUSD: 0,
      providers: [],
    }),
    hasUsageData: computed(() => false),
    pricingCatalog: [],
    clearUsageData: vi.fn(),
  }),
}))

vi.mock('@/composables/useAIChat', () => ({
  useAIChat: () => ({
    selectedProvider: ref('auto'),
    selectedModel: ref(null),
    availableOllamaModels: ref([]),
    setProvider: vi.fn(),
    setModel: vi.fn(),
    refreshOllamaModels: vi.fn(),
  }),
}))

vi.mock('@/composables/useWorkProfile', () => ({
  useWorkProfile: () => ({
    profile: ref({
      avgWorkMinutesPerDay: 0,
      avgTasksCompletedPerDay: 0,
      avgPlanAccuracy: 0,
      peakProductivityDays: [],
      memoryGraph: [],
    }),
    loadProfile: vi.fn(async () => undefined),
    savePreferences: vi.fn(async () => undefined),
    computeCapacityMetrics: vi.fn(async () => undefined),
    resetLearnedData: vi.fn(async () => undefined),
  }),
}))

vi.mock('@/composables/useMemoryAssessment', () => ({
  useMemoryAssessment: () => ({
    isRunning: ref(false),
    progress: ref(0),
    currentCheck: ref(''),
    report: ref(null),
    error: ref(''),
    runFastAssessment: vi.fn(),
    getHistory: vi.fn(() => []),
  }),
}))

vi.mock('@/stores/settings', () => ({
  useSettingsStore: () => ({
    aiUseSubscription: false,
    aiBrain: 'claude',
    weeklyPlanProvider: 'auto',
    weeklyPlanModel: '',
    groqApiKey: '',
    aiSmartRouting: false,
    aiPremiumModel: 'openai/gpt-4o-mini',
    aiMonthlyBudgetCents: 0,
    aiLearningEnabled: true,
    updateSetting: vi.fn(),
  }),
}))

vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    fetchAIMemoryDebugSnapshot: state.fetchAIMemoryDebugSnapshot,
    clearAIMemoryDebugData: vi.fn(async () => undefined),
  }),
}))

function debugSnapshot(overrides: Partial<AIMemoryDebugSnapshot>): AIMemoryDebugSnapshot {
  return {
    schemaStatus: 'ready',
    schemaMissingTables: [],
    contextEntities: [],
    contextEdges: [],
    parameterBeliefs: [],
    memorySnapshots: [],
    clarificationEvents: [],
    recommendationFeedback: [],
    pendingWriteCount: 0,
    ...overrides,
  }
}

async function mountSettingsWithSnapshot(snapshot: AIMemoryDebugSnapshot) {
  state.fetchAIMemoryDebugSnapshot.mockResolvedValue(snapshot)
  const wrapper = mount(AISettingsTab, {
    global: {
      stubs: {
        SettingsSection: defineComponent({
          name: 'SettingsSection',
          props: { title: String },
          setup(props, { slots }) {
            return () => h('section', { 'data-title': props.title }, slots.default?.())
          },
        }),
        SettingsToggle: defineComponent({
          name: 'SettingsToggle',
          props: { label: String, value: Boolean },
          setup(props) {
            return () => h('button', { type: 'button' }, props.label)
          },
        }),
      },
    },
  })
  await flushPromises()
  return wrapper
}

describe('AI settings memory debug status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders missing server schema as local fallback with missing table names', async () => {
    const wrapper = await mountSettingsWithSnapshot(debugSnapshot({
      schemaStatus: 'missing',
      schemaMissingTables: ['ai_context_entities', 'ai_parameter_beliefs'],
      pendingWriteCount: 2,
    }))

    const debug = wrapper.get('[data-testid="ai-memory-debug"]')
    expect(debug.text()).toContain('Server schema unavailable; chat is using local fallback and queued writes')
    expect(debug.text()).toContain('AI memory schema missing')
    expect(debug.text()).toContain('2 queued writes')
    expect(debug.text()).toContain('Missing: ai_context_entities, ai_parameter_beliefs')
  })

  it('renders local-only memory without implying cross-device server memory', async () => {
    const wrapper = await mountSettingsWithSnapshot(debugSnapshot({
      schemaStatus: 'local_only',
      pendingWriteCount: 1,
    }))

    const text = wrapper.get('[data-testid="ai-memory-debug"]').text()
    expect(text).toContain('Local-only memory on this device; sign in for cross-device memory')
    expect(text).toContain('Local memory only')
    expect(text).not.toContain('Server-backed context currently available to chat')
  })

  it('renders ready schema as server-backed context', async () => {
    const wrapper = await mountSettingsWithSnapshot(debugSnapshot({
      schemaStatus: 'ready',
    }))

    const text = wrapper.get('[data-testid="ai-memory-debug"]').text()
    expect(text).toContain('Server-backed context currently available to chat')
    expect(text).toContain('Server schema ready')
    expect(text).not.toContain('local fallback')
  })
})
