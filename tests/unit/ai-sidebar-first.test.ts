import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import AIChatPanel from '@/components/ai/AIChatPanel.vue'
import ChatMessage from '@/components/ai/ChatMessage.vue'
import { useAIChatStore } from '@/stores/aiChat'
import { useTaskStore } from '@/stores/tasks'
import { formatRelativeDate } from '@/utils/dateUtils'
import { createMockTask } from '../factories'

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
        chatLanguage: refs.chatLanguage,
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
        setChatLanguage: store.setChatLanguage,
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
      taskIds: ['task-1'],
      visualKind: 'changed',
      shouldReveal: true,
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
    expect(store.activityEvents.find(event => event.tool === 'update_task')).toMatchObject({
      taskIds: ['task-1'],
      visualKind: 'changed',
      shouldReveal: true,
    })
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

  it('reveals activity-linked tasks on the canvas without auto-revealing every row', async () => {
    const store = useAIChatStore()
    store.openPanel()
    store.addActivityEvent({
      type: 'read',
      status: 'success',
      label: 'Read complete',
      message: 'Loaded canvas tasks',
      tool: 'list_tasks',
      taskIds: ['task-1', 'task-2'],
      visualKind: 'spotlight',
      shouldReveal: true,
    })
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

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

    const revealButton = wrapper.get('.activity-reveal-btn')
    expect(revealButton.text()).toBe('Show')

    await revealButton.trigger('click')

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'ai-task-spotlight' }))
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'reveal-task-on-canvas' }))
    const revealEvent = dispatchSpy.mock.calls.find(([event]) => event.type === 'reveal-task-on-canvas')?.[0] as CustomEvent
    expect(revealEvent.detail).toEqual({ taskId: 'task-1' })
    dispatchSpy.mockRestore()
  })

  it('keeps canvas AI spotlight transform-free and event-driven', () => {
    const taskNode = src('src/components/canvas/TaskNode.vue')

    expect(taskNode).toContain("window.addEventListener('ai-task-spotlight'")
    expect(taskNode).toContain("'ai-spotlight': isAISpotlight")
    expect(taskNode).toContain('@media (prefers-reduced-motion: reduce)')
    const spotlightCss = taskNode.slice(
      taskNode.indexOf('.ai-spotlight'),
      taskNode.indexOf('/*\n * BUG-1808')
    )
    expect(spotlightCss).not.toContain('transform:')
  })

  it('does not show raw tool-result task cards before the assistant answer finishes', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: {
          id: 'msg-1',
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          isStreaming: true,
          metadata: {
            toolResults: [
              {
                tool: 'list_tasks',
                message: 'Found 15 tasks',
                success: true,
                type: 'read',
                data: [
                  { id: 'task-1', title: 'Do not render yet', status: 'todo' },
                ],
              },
            ],
          },
        },
      },
      global: {
        stubs: {
          TaskQuickEditPopover: true,
        },
      },
    })

    expect(wrapper.find('.thinking-indicator').exists()).toBe(true)
    expect(wrapper.find('.tool-results').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Do not render yet')
  })

  it('does not show raw tool-result task cards as a deterministic fallback after the answer finishes', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: {
          id: 'msg-raw-results',
          role: 'assistant',
          content: 'The model chose a different summary.',
          timestamp: Date.now(),
          isStreaming: false,
          metadata: {
            toolResults: [
              {
                tool: 'list_tasks',
                message: 'Found 15 tasks',
                success: true,
                type: 'read',
                data: [
                  { id: 'task-raw', title: 'Raw deterministic task', status: 'todo' },
                ],
              },
            ],
          },
        },
      },
      global: {
        stubs: {
          TaskQuickEditPopover: true,
        },
      },
    })

    expect(wrapper.text()).toContain('The model chose a different summary.')
    expect(wrapper.find('.tool-results').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Raw deterministic task')
  })

  it('shows grouped task cards only when they are paired with visible model prose', () => {
    const withProse = mount(ChatMessage, {
      props: {
        message: {
          id: 'msg-cards-with-prose',
          role: 'assistant',
          content: 'Start with the payment task.',
          timestamp: Date.now(),
          isStreaming: false,
          metadata: {
            cardGroups: {
              total: 1,
              groups: [
                {
                  name: 'Money',
                  tasks: [
                    { id: 'task-card', title: 'Check Cardcom payment', status: 'todo', reason: 'Payment may be stuck' },
                  ],
                },
              ],
            },
          },
        },
      },
      global: { stubs: { TaskQuickEditPopover: true } },
    })

    expect(withProse.text()).toContain('Start with the payment task.')
    expect(withProse.text()).toContain('Check Cardcom payment')

    const withoutProse = mount(ChatMessage, {
      props: {
        message: {
          id: 'msg-cards-without-prose',
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          isStreaming: false,
          metadata: {
            cardGroups: {
              total: 1,
              groups: [
                {
                  name: 'Money',
                  tasks: [
                    { id: 'task-card', title: 'Check Cardcom payment', status: 'todo', reason: 'Payment may be stuck' },
                  ],
                },
              ],
            },
          },
        },
      },
      global: { stubs: { TaskQuickEditPopover: true } },
    })

    expect(withoutProse.text()).not.toContain('Check Cardcom payment')
    expect(withoutProse.find('.card-groups').exists()).toBe(false)
  })

  it('places matched AI task cards under the sentence that mentions them', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: {
          id: 'msg-inline-cards',
          role: 'assistant',
          content: [
            '1. **Task Alpha** - handle this first because it unblocks the next person.',
            '2. **Task Beta** - then do this because it keeps the sequence moving.',
          ].join('\n'),
          timestamp: Date.now(),
          isStreaming: false,
          metadata: {
            cardGroups: {
              total: 2,
              groups: [
                {
                  name: 'Tasks from answer',
                  tasks: [
                    { id: 'task-alpha', title: 'Task Alpha', status: 'todo', reason: 'unblocks the next person' },
                    { id: 'task-beta', title: 'Task Beta', status: 'todo', reason: 'keeps the sequence moving' },
                  ],
                },
              ],
            },
          },
        },
      },
      global: { stubs: { TaskQuickEditPopover: true } },
    })

    const inlineCards = wrapper.findAll('[data-testid="inline-ai-task-card"]')
    expect(inlineCards).toHaveLength(2)
    expect(inlineCards[0].text()).toContain('Task Alpha')
    expect(inlineCards[1].text()).toContain('Task Beta')
    expect(wrapper.find('.card-groups .card-group').exists()).toBe(false)
  })

  it('renders grouped AI task cards from live task store fields after edits', () => {
    const taskStore = useTaskStore()
    taskStore._rawTasks.push(createMockTask({
      id: 'task-live-date',
      title: 'Live Date Task',
      status: 'todo',
      dueDate: '2026-06-11',
      priority: 'medium',
    }))

    const wrapper = mount(ChatMessage, {
      props: {
        message: {
          id: 'msg-live-task-card',
          role: 'assistant',
          content: 'Start with the live date task.',
          timestamp: Date.now(),
          isStreaming: false,
          metadata: {
            cardGroups: {
              total: 1,
              groups: [
                {
                  name: 'Tasks from answer',
                  tasks: [
                    {
                      id: 'task-live-date',
                      title: 'Live Date Task',
                      status: 'todo',
                      dueDate: '2026-06-07',
                      priority: 'high',
                      reason: 'deadline risk',
                    },
                  ],
                },
              ],
            },
          },
        },
      },
      global: { stubs: { TaskQuickEditPopover: true } },
    })

    expect(wrapper.text()).toContain(formatRelativeDate('2026-06-11'))
    expect(wrapper.text()).not.toContain('today')
  })

  it('keeps deterministic task answers from spinning forever when formatter output fails', () => {
    const aiChat = src('src/composables/useAIChat.ts')

    expect(aiChat).toContain('FINAL_FORMATTER_TIMEOUT_MS')
    expect(aiChat).toContain('buildFormatterFallback(toolResults, routed.language)')
    expect(aiChat).toContain("Formatter timed out or failed; using fallback answer")
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
