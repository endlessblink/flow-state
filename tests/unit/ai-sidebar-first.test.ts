import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import AIChatPanel from '@/components/ai/AIChatPanel.vue'
import { useAIChatStore } from '@/stores/aiChat'

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual<typeof import('@vueuse/core')>('@vueuse/core')
  return {
    ...actual,
    onClickOutside: vi.fn(),
  }
})

vi.mock('@/composables/useAIChat', async () => {
  const { ref } = await import('vue')
  const { storeToRefs } = await import('pinia')
  const { useAIChatStore } = await import('@/stores/aiChat')

  return {
    useAIChat: () => {
      const store = useAIChatStore()
      const refs = storeToRefs(store)
      return {
        isPanelOpen: refs.isPanelOpen,
        visibleMessages: refs.visibleMessages,
        inputText: refs.inputText,
        isGenerating: refs.isGenerating,
        canSend: refs.canSend,
        error: refs.error,
        activeProvider: ref('groq'),
        selectedProvider: ref('auto'),
        selectedModel: ref(''),
        availableOllamaModels: ref([]),
        isLoadingModels: ref(false),
        pendingConfirmation: ref(null),
        aiPersonality: ref('professional'),
        chatDirection: refs.chatDirection,
        setProvider: vi.fn(),
        selectBrain: vi.fn(),
        setModel: vi.fn(),
        refreshOllamaModels: vi.fn(),
        closePanel: store.closePanel,
        sendMessage: vi.fn(),
        clearMessages: store.clearMessages,
        clearError: store.clearError,
        initialize: vi.fn(),
        handleKeyboardShortcut: vi.fn(),
        confirmPendingAction: vi.fn(),
        cancelPendingAction: vi.fn(),
        executeDirectTool: vi.fn(),
        setPersonality: vi.fn(),
        setChatDirection: store.setChatDirection,
      }
    },
  }
})

function src(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('AI sidebar-first desktop experience', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('removes AI as a standalone desktop header tab while keeping the sparkles panel toggle', () => {
    const header = src('src/layouts/AppHeader.vue')

    expect(header).not.toContain('to="/ai" class="view-tab"')
    expect(header).toContain('class="ai-toggle-btn"')
    expect(header).toContain('@click="aiChatStore.togglePanel"')
  })

  it('keeps /ai as a compatibility fallback and preserves the mobile full-screen route', () => {
    const router = src('src/router/index.ts')
    const mobileNav = src('src/mobile/components/MobileNav.vue')

    expect(router).toContain("path: '/ai'")
    expect(router).toContain("component: () => import('@/views/AISidebarFallbackView.vue')")
    expect(router).toContain("path: '/mobile-ai-chat'")
    expect(router).toContain("component: () => import('@/mobile/views/MobileAIChatView.vue')")
    expect(mobileNav).toContain("router.push('/mobile-ai-chat')")
  })

  it('stores bounded live activity states for success, failure, confirmation, and undo availability', () => {
    const store = useAIChatStore()

    const runningId = store.addActivityEvent({
      type: 'read',
      status: 'running',
      label: 'Reading FlowState',
      tool: 'list_tasks',
    })
    store.updateActivityEvent(runningId, {
      status: 'success',
      label: 'Read complete',
      message: 'Loaded tasks',
    })
    store.addActivityEvent({
      type: 'write',
      status: 'success',
      label: 'Action complete',
      message: 'Updated task',
      undoAvailable: true,
      tool: 'update_task',
    })
    store.addActivityEvent({
      type: 'destructive',
      status: 'waiting_confirmation',
      label: 'Waiting for confirmation',
      tool: 'delete_task',
    })
    store.addActivityEvent({
      type: 'read',
      status: 'failed',
      label: 'Read failed',
      message: 'Network error',
      tool: 'get_daily_summary',
    })

    expect(store.activityEvents).toHaveLength(4)
    expect(store.activityEvents.map(event => event.status)).toEqual([
      'failed',
      'waiting_confirmation',
      'success',
      'success',
    ])
    expect(store.activityEvents.some(event => event.undoAvailable)).toBe(true)
  })

  it('renders timeline rows from real activity state in the AI sidebar', () => {
    const store = useAIChatStore()
    store.openPanel()
    store.addActivityEvent({
      type: 'read',
      status: 'running',
      label: 'Reading FlowState',
      message: 'list tasks',
      tool: 'list_tasks',
    })
    store.addActivityEvent({
      type: 'destructive',
      status: 'waiting_confirmation',
      label: 'Waiting for confirmation',
      message: 'delete task',
      tool: 'delete_task',
    })
    store.pushUndoEntry({
      toolName: 'update_task',
      timestamp: Date.now(),
      params: { taskId: 'task-1' },
      undoAction: { toolName: 'update_task', params: { taskId: 'task-1', updates: { status: 'todo' } } },
      description: 'Updated task',
    })

    const wrapper = mount(AIChatPanel, {
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: {
          ChatMessage: true,
          CustomSelect: true,
          OverflowTooltip: {
            template: '<span><slot /></span>',
          },
        },
      },
    })

    expect(wrapper.get('[data-testid="ai-activity-timeline"]').text()).toContain('Activity')
    expect(wrapper.find('[data-testid="ai-activity-running"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ai-activity-waiting_confirmation"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Reading FlowState')
    expect(wrapper.text()).toContain('Waiting for confirmation')
    expect(wrapper.text()).toContain('Undo available')
  })

  it('keeps a visible New Chat control in the AI sidebar header', async () => {
    const store = useAIChatStore()
    store.openPanel()
    const firstConversation = store.createConversation()
    const initialConversationCount = store.conversations.length

    const wrapper = mount(AIChatPanel, {
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: {
          ChatMessage: true,
          CustomSelect: true,
          OverflowTooltip: {
            template: '<span><slot /></span>',
          },
        },
      },
    })

    const newChatButton = wrapper.get('.new-chat-header-btn')
    expect(newChatButton.text()).toContain('ai_chat.new_chat')

    await newChatButton.trigger('click')

    expect(store.conversations).toHaveLength(initialConversationCount + 1)
    expect(store.activeConversationId).not.toBe(firstConversation.id)
    expect(store.activeConversation?.title).toBe('New Chat')
  })
})
