import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import AIChatPanel from '@/components/ai/AIChatPanel.vue'
import ChatMessage from '@/components/ai/ChatMessage.vue'
import { useAIChatStore } from '@/stores/aiChat'
import { useTaskStore } from '@/stores/tasks'
import type { Task } from '@/types/tasks'

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

  it('keeps deterministic task answers from spinning forever when formatter output fails', () => {
    const aiChat = src('src/composables/useAIChat.ts')

    expect(aiChat).toContain('FINAL_FORMATTER_TIMEOUT_MS')
    expect(aiChat).toContain('buildFormatterFallback(toolResults, routed.language, routed.responseMode)')
    expect(aiChat).toContain("Formatter timed out or failed; using fallback answer")
  })

  it('keeps AI task cards paired under the matching answer line and dismisses local suggestions', async () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: {
          id: 'msg-inline-cards',
          role: 'assistant',
          content: [
            'Start with Task Alpha because it protects the payment decision.',
            'Then handle Task Beta while the context is still fresh.',
          ].join('\n'),
          timestamp: Date.now(),
          metadata: {
            cardGroups: {
              kind: 'week_plan',
              total: 2,
              groups: [
                {
                  name: 'Money',
                  tasks: [
                    {
                      id: 'task-alpha',
                      title: 'Task Alpha',
                      status: 'todo',
                      priority: 'high',
                      reason: 'payment decision risk',
                    },
                  ],
                },
                {
                  name: 'Follow-up',
                  tasks: [
                    {
                      id: 'task-beta',
                      title: 'Task Beta',
                      status: 'todo',
                      priority: 'medium',
                      reason: 'stakeholder follow-through',
                    },
                  ],
                },
              ],
            },
          },
        },
      },
      global: {
        stubs: {
          TaskQuickEditPopover: true,
        },
      },
    })

    expect(wrapper.findAll('[data-testid="inline-ai-task-card"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="inline-ai-task-card"]')[0].text()).toContain('Task Alpha')
    expect(wrapper.findAll('[data-testid="inline-ai-task-card"]')[1].text()).toContain('Task Beta')

    await wrapper.find('.inline-dismiss-btn').trigger('click')

    const remaining = wrapper.findAll('[data-testid="inline-ai-task-card"]')
    expect(remaining).toHaveLength(1)
    expect(remaining[0].text()).toContain('Task Beta')
    expect(wrapper.text()).not.toContain('payment decision risk')
  })

  it('refreshes inline recommendation card due metadata when a task is postponed', () => {
    const taskStore = useTaskStore()
    taskStore._rawTasks.push({
      id: 'task-postponed',
      title: 'Postpone me',
      description: '',
      status: 'todo',
      priority: 'high',
      progress: 0,
      completedPomodoros: 0,
      subtasks: [],
      dueDate: '2999-01-01',
      projectId: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Task)

    const wrapper = mount(ChatMessage, {
      props: {
        message: {
          id: 'msg-postponed-card',
          role: 'assistant',
          content: 'Postpone me should stay visible only if it still makes sense for this plan.',
          timestamp: Date.now(),
          metadata: {
            cardGroups: {
              kind: 'week_plan',
              total: 1,
              groups: [
                {
                  name: 'Focus',
                  tasks: [
                    {
                      id: 'task-postponed',
                      title: 'Postpone me',
                      status: 'todo',
                      priority: 'high',
                      dueDate: '2026-06-01',
                      daysOverdue: 6,
                      reason: 'old snapshot reason',
                    },
                  ],
                },
              ],
            },
          },
        },
      },
      global: {
        stubs: {
          TaskQuickEditPopover: true,
        },
      },
    })

    expect(wrapper.findAll('[data-testid="inline-ai-task-card"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Postpone me')
    expect(wrapper.text()).not.toContain('6d overdue')
    expect(wrapper.text()).not.toContain('today')
  })

  it('clears stale overdue metadata from completed inline recommendation cards', () => {
    const taskStore = useTaskStore()
    taskStore._rawTasks.push({
      id: 'task-completed',
      title: 'Completed recommendation',
      description: '',
      status: 'done',
      priority: 'medium',
      progress: 100,
      completedPomodoros: 0,
      subtasks: [],
      dueDate: '2026-06-01',
      projectId: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Task)

    const wrapper = mount(ChatMessage, {
      props: {
        message: {
          id: 'msg-completed-card',
          role: 'assistant',
          content: 'Completed recommendation no longer belongs in the active plan as an overdue item.',
          timestamp: Date.now(),
          metadata: {
            cardGroups: {
              kind: 'week_plan',
              total: 1,
              groups: [
                {
                  name: 'Focus',
                  tasks: [
                    {
                      id: 'task-completed',
                      title: 'Completed recommendation',
                      status: 'todo',
                      priority: 'medium',
                      dueDate: '2026-06-01',
                      daysOverdue: 6,
                      reason: 'old snapshot reason',
                    },
                  ],
                },
              ],
            },
          },
        },
      },
      global: {
        stubs: {
          TaskQuickEditPopover: true,
        },
      },
    })

    expect(wrapper.findAll('[data-testid="inline-ai-task-card"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Completed recommendation')
    expect(wrapper.text()).toContain('done')
    expect(wrapper.text()).not.toContain('6d overdue')
  })

  it('anchors cards inline even when the answer uses markdown or different casing', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: {
          id: 'msg-inline-fuzzy-card',
          role: 'assistant',
          content: '**task   alpha** is the first focus because it protects the payment decision.',
          timestamp: Date.now(),
          metadata: {
            cardGroups: {
              kind: 'week_plan',
              total: 1,
              groups: [
                {
                  name: 'Money',
                  tasks: [
                    {
                      id: 'task-alpha',
                      title: 'Task Alpha',
                      status: 'todo',
                      priority: 'high',
                      reason: 'payment decision risk',
                    },
                  ],
                },
              ],
            },
          },
        },
      },
      global: {
        stubs: {
          TaskQuickEditPopover: true,
        },
      },
    })

    expect(wrapper.findAll('[data-testid="inline-ai-task-card"]')).toHaveLength(1)
    expect(wrapper.find('.card-groups').exists()).toBe(false)
  })

  it('keeps unmatched weekly planning cards inline instead of batching them at the bottom', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: {
          id: 'msg-week-plan-unmatched-card',
          role: 'assistant',
          content: 'The week should protect payment follow-through and leave admin for a lower-energy slot.',
          timestamp: Date.now(),
          metadata: {
            cardGroups: {
              kind: 'week_plan',
              total: 1,
              groups: [
                {
                  name: 'Money',
                  tasks: [
                    {
                      id: 'cardcom-payment',
                      title: 'Check Cardcom payment',
                      status: 'todo',
                      priority: 'high',
                      reason: 'money can get stuck if this slips',
                    },
                  ],
                },
              ],
            },
          },
        },
      },
      global: {
        stubs: {
          TaskQuickEditPopover: true,
        },
      },
    })

    expect(wrapper.findAll('[data-testid="inline-ai-task-card"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Check Cardcom payment')
    expect(wrapper.text()).toContain('money can get stuck if this slips')
    expect(wrapper.find('.card-groups').exists()).toBe(false)
  })

  it('splits collapsed weekly planning prose so each task card sits under its own sentence', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: {
          id: 'msg-week-plan-collapsed-prose',
          role: 'assistant',
          content: 'Task Alpha should go first because it protects the payment decision and prevents a blocked handoff. Task Beta belongs later because it is follow-through work for a lower-energy slot.',
          timestamp: Date.now(),
          metadata: {
            cardGroups: {
              kind: 'week_plan',
              total: 2,
              groups: [
                {
                  name: 'Focus',
                  tasks: [
                    {
                      id: 'task-alpha',
                      title: 'Task Alpha',
                      status: 'todo',
                      priority: 'high',
                      reason: 'payment decision risk',
                    },
                    {
                      id: 'task-beta',
                      title: 'Task Beta',
                      status: 'todo',
                      priority: 'medium',
                      reason: 'lower-energy follow-through',
                    },
                  ],
                },
              ],
            },
          },
        },
      },
      global: {
        stubs: {
          TaskQuickEditPopover: true,
        },
      },
    })

    const blocks = wrapper.findAll('.inline-response-block')
    expect(blocks).toHaveLength(2)
    expect(blocks[0].findAll('[data-testid="inline-ai-task-card"]')).toHaveLength(1)
    expect(blocks[0].text()).toContain('Task Alpha')
    expect(blocks[0].text()).not.toContain('Task Beta')
    expect(blocks[1].findAll('[data-testid="inline-ai-task-card"]')).toHaveLength(1)
    expect(blocks[1].text()).toContain('Task Beta')
    expect(wrapper.find('.card-groups').exists()).toBe(false)
  })

  it('documents weekly planning as selective coach reasoning rather than a one-sentence task dump', () => {
    const aiChat = src('src/composables/useAIChat.ts')

    expect(aiChat).toContain('Act like a thoughtful planning coach, not a sorter')
    expect(aiChat).toContain('why now, expected impact, and the tradeoff/slot')
    expect(aiChat).toContain('omissions/defer line')
    expect(aiChat).toContain('Due dates and priority labels are metadata, not reasons')
    expect(aiChat).toContain('what it unblocks, who is waiting, what risk it prevents')
    expect(aiChat).not.toContain('use overdue days, priority, project deadlines')
    expect(aiChat).toContain('ensureCardTaskMentions')
    expect(aiChat).toContain('if (!cardData && cardsInstruction && hasTaskList)')
    expect(aiChat).toContain('rankFallbackTasks')
    expect(aiChat).toContain('fallbackTaskScore')
    expect(aiChat).toContain('__cardIndex: tasks.length + 1')
    expect(aiChat).toContain('i: Number(task.__cardIndex) || index + 1')
    expect(aiChat).toContain('fallbackTaskRecommendation')
    expect(aiChat).toContain('weeklyPlanNeedsQualityRepair')
    expect(aiChat).toContain('const requiredAnchors = selectedTasks.length')
    expect(aiChat).toContain('taskAnchoredLineCount < requiredAnchors')
    expect(aiChat).toContain('shallowMetadataOnly && !hasStakeLanguage')
    expect(aiChat).toContain('if (isWeekPlan && cardData && weeklyPlanNeedsQualityRepair')
    expect(aiChat).toContain('Why now:')
    expect(aiChat).toContain('Expected impact:')
    expect(aiChat).toContain('Tradeoff/slot:')
    expect(aiChat).toContain('למה עכשיו:')
    expect(aiChat).toContain('השפעה:')
    expect(aiChat).toContain('מיקום/טריידאוף:')
    expect(aiChat).not.toContain('const lines = tasks.map((task, index) => `${index + 1}. **${task.title}**')
    expect(aiChat).not.toContain('these look like the highest-impact tasks right now')
  })

  it('anchors ReAct bridge cards before attaching grouped card metadata', () => {
    const aiChat = src('src/composables/useAIChat.ts')
    const reactSection = aiChat.slice(
      aiChat.indexOf('if (reactCards)'),
      aiChat.indexOf('// Update content after all post-processing'),
    )

    expect(reactSection).toContain('ensureCardTaskMentions')
    expect(reactSection).toContain('reactCards.rawBlock')
    expect(reactSection).toContain('cardGroups: { groups: reactCards.groups')
  })

  it('routes the Plan Week quick action through the normal weekly planner instead of a missing chain', () => {
    const aiChat = src('src/composables/useAIChat.ts')

    expect(aiChat).toContain("lang === 'he' ? 'תעזור לי לתכנן את השבוע' : 'Help me plan my week'")
    expect(aiChat).not.toContain("executeAgentChain('plan_my_week')")
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
