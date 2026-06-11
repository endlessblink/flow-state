import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'

const mocks = vi.hoisted(() => ({
  chatLanguage: { value: 'auto' as 'auto' | 'en' | 'he' },
  setChatLanguage: vi.fn(),
  setProvider: vi.fn(),
  selectBrain: vi.fn(),
  setModel: vi.fn(),
  initialize: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (_key: string, fallback?: string) => fallback || _key }),
}))

vi.mock('@/stores/aiChat', () => ({
  useAIChatStore: () => ({
    sortedConversations: [],
    activeConversationId: null,
    undoBuffer: [],
    activityEvents: [],
    context: {},
    createConversation: vi.fn(),
    switchConversation: vi.fn(),
    deleteConversation: vi.fn(),
    undoLastAction: vi.fn(),
  }),
}))

vi.mock('@/stores/timer', () => ({
  useTimerStore: () => ({ isTimerActive: false }),
}))

vi.mock('@/services/ai/router', () => ({
  createAIRouter: () => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getProviderHealthStatus: () => ({}),
    dispose: vi.fn(),
  }),
}))

vi.mock('@/composables/useAIChat', () => ({
  useAIChat: () => ({
    isPanelOpen: ref(true),
    visibleMessages: ref([]),
    inputText: ref(''),
    isGenerating: ref(false),
    canSend: ref(false),
    error: ref(null),
    activeProvider: ref('bridge'),
    selectedProvider: ref('auto'),
    selectedModel: ref(''),
    availableOllamaModels: ref([]),
    isLoadingModels: ref(false),
    setProvider: mocks.setProvider,
    selectBrain: mocks.selectBrain,
    setModel: mocks.setModel,
    refreshOllamaModels: vi.fn(),
    closePanel: vi.fn(),
    sendMessage: vi.fn(),
    clearMessages: vi.fn(),
    clearError: vi.fn(),
    initialize: mocks.initialize,
    handleKeyboardShortcut: vi.fn(),
    pendingConfirmation: ref(null),
    confirmPendingAction: vi.fn(),
    cancelPendingAction: vi.fn(),
    executeDirectTool: vi.fn(),
    aiPersonality: ref('professional'),
    setPersonality: vi.fn(),
    chatLanguage: mocks.chatLanguage,
    setChatLanguage: mocks.setChatLanguage,
    activeProviderLabel: computed(() => 'Claude'),
  }),
}))

vi.mock('@/config/aiModels', () => ({
  GROQ_MODELS: [],
  OPENROUTER_MODELS: [],
  asValueLabel: () => [],
  getDisplayName: (model: string) => model,
  filterFreeModels: () => [],
}))

describe('AIChatPanel message language setting', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.chatLanguage.value = 'auto'
    vi.clearAllMocks()
  })

  it('renders message language options and updates the selected language', async () => {
    const { default: AIChatPanel } = await import('@/components/ai/AIChatPanel.vue')
    const wrapper = mount(AIChatPanel, {
      global: {
        plugins: [createPinia()],
        stubs: {
          OverflowTooltip: { template: '<span><slot /></span>' },
          ChatMessage: true,
          CustomSelect: true,
        },
        mocks: {
          $t: (_key: string, fallback?: string) => fallback || _key,
        },
      },
    })

    await wrapper.find('.settings-btn').trigger('click')

    expect(wrapper.text()).toContain('Chat Language')
    expect(wrapper.text()).toContain('Auto')
    expect(wrapper.text()).toContain('English')
    expect(wrapper.text()).toContain('עברית')

    const languageButtons = wrapper.findAll('.settings-section').find(section =>
      section.text().includes('Chat Language')
    )?.findAll('button')

    await languageButtons?.find(button => button.text() === 'עברית')?.trigger('click')
    expect(mocks.setChatLanguage).toHaveBeenCalledWith('he')
  })

  it('forces the chat shell to RTL when Hebrew is selected', async () => {
    mocks.chatLanguage.value = 'he'
    const { default: AIChatPanel } = await import('@/components/ai/AIChatPanel.vue')
    const wrapper = mount(AIChatPanel, {
      global: {
        plugins: [createPinia()],
        stubs: {
          OverflowTooltip: { template: '<span><slot /></span>' },
          ChatMessage: true,
          CustomSelect: true,
        },
        mocks: {
          $t: (_key: string, fallback?: string) => fallback || _key,
        },
      },
    })

    expect(wrapper.find('.ai-chat-messages').attributes('dir')).toBe('rtl')
    expect(wrapper.find('.ai-chat-input').attributes('placeholder')).toContain('שאל')
  })
})
