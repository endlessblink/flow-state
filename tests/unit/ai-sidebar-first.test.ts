import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import AIChatPanel from '@/components/ai/AIChatPanel.vue'
import ChatMessage from '@/components/ai/ChatMessage.vue'
import { useAIChatStore } from '@/stores/aiChat'
import { useTaskStore } from '@/stores/tasks'
import type { Task } from '@/types/tasks'
import { buildQuickDraftWeeklyPlan, buildWeekContextFromToolResults, buildWeeklyPlanningInterview, buildWeeklyPlanPrompt, validateWeeklyPlanOutput } from '@/services/ai/pipeline/weeklyPlan'

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

  it('renders grouped inline cards while the immediate weekly fallback is still streaming', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: {
          id: 'msg-streaming-week-plan-cards',
          role: 'assistant',
          content: 'Task Alpha belongs to the outreach pipeline because it unblocks the first send.',
          timestamp: Date.now(),
          isStreaming: true,
          metadata: {
            cardGroups: {
              kind: 'week_plan',
              total: 1,
              groups: [
                {
                  name: 'Outreach pipeline',
                  tasks: [
                    {
                      id: 'task-alpha',
                      title: 'Task Alpha',
                      status: 'todo',
                      priority: 'high',
                      reason: 'unblocks first send',
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
    expect(wrapper.find('.tool-results').exists()).toBe(false)
  })

  it('renders structured weekly plan sections with cards bound by task id', async () => {
    const taskStore = useTaskStore()
    taskStore._rawTasks.push({
      id: 'task-renewal',
      title: 'Send renewal proposal to Amit',
      description: 'Amit needs numbers before Wednesday budget meeting.',
      status: 'todo',
      priority: 'high',
      progress: 0,
      completedPomodoros: 0,
      subtasks: [],
      dueDate: '2026-06-10',
      projectId: 'client-renewals',
      createdAt: new Date('2026-06-01T08:00:00Z'),
      updatedAt: new Date('2026-06-07T08:00:00Z'),
    } as Task)

    const wrapper = mount(ChatMessage, {
      props: {
        message: {
          id: 'msg-weekly-plan-structured',
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          metadata: {
            weeklyPlan: {
              schemaVersion: 'weekly-plan.v2',
              requestId: 'req-week',
              locale: 'en',
              direction: 'ltr',
              headline: 'Protect the decision windows first',
              weekRead: {
                summary: 'One client decision window matters more than generic cleanup.',
                workloadReality: 'Keep the plan focused.',
                mainTradeoff: 'Client work beats low-context admin.',
              },
              recommendations: [
                {
                  sectionId: 'rec-renewal',
                  rank: 1,
                  focusArea: 'Client renewals',
                  primaryTaskId: 'task-renewal',
                  relatedTaskIds: [],
                  recommendationType: 'protect',
                  title: 'Protect Amit’s renewal proposal',
                  whyThisMatters: 'Amit needs numbers before the budget meeting, so this affects a real decision window.',
                  whyThisWeek: 'The task is already in the current week and has clear external context.',
                  riskIfIgnored: 'The decision may move before the proposal lands.',
                  nextAction: 'Draft only the numbers table and send Amit a short confirmation.',
                  evidence: [
                    { taskId: 'task-renewal', field: 'notes', value: 'budget meeting', interpretation: 'external decision window' },
                    { taskId: 'task-renewal', field: 'dueIso', value: '2026-06-10', interpretation: 'original plan date' },
                    { taskId: 'task-renewal', field: 'priority', value: 'high', interpretation: 'priority signal' },
                  ],
                  cardPlacement: 'immediately_after_explanation',
                },
              ],
              deferrals: [],
              openQuestions: [],
              quality: { selectedTaskCount: 1, confidence: 'high', caveats: [] },
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

    expect(wrapper.get('[data-testid="weekly-plan"]').text()).toContain('Protect the decision windows first')
    expect(wrapper.get('[data-section-id="rec-renewal"]').text()).toContain('Client renewals')
    expect(wrapper.get('[data-section-id="rec-renewal"]').text()).toContain('Amit needs numbers')
    expect(wrapper.findAll('[data-testid="inline-plan-card"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="inline-plan-card"]').text()).toContain('Send renewal proposal to Amit')
    expect(wrapper.findAll('[data-testid="inline-ai-task-card"]')).toHaveLength(0)

    taskStore._rawTasks[0].dueDate = '2026-06-12'
    await nextTick()
    expect(wrapper.get('[data-testid="inline-plan-card"]').text()).toContain('rescheduled after this plan was generated')

    await wrapper.get('[aria-label="Hide from these options"]').trigger('click')
    expect(wrapper.findAll('[data-testid="inline-plan-card"]')).toHaveLength(0)
    expect(wrapper.get('[data-section-id="rec-renewal"]').text()).toContain('Amit needs numbers')
  })

  it('rejects shallow weekly plan JSON and falls back to evidence-only quick drafts', () => {
    const task: Task = {
      id: 'task-renewal',
      title: 'Send renewal proposal to Amit',
      description: 'Amit asked for numbers before Wednesday budget meeting.',
      status: 'todo',
      priority: 'high',
      progress: 0,
      completedPomodoros: 0,
      subtasks: [],
      dueDate: '2026-06-10',
      projectId: 'client-renewals',
      createdAt: new Date('2026-06-01T08:00:00Z'),
      updatedAt: new Date('2026-06-07T08:00:00Z'),
    } as Task
    const relatedTasks = [
      task,
      {
        ...task,
        id: 'task-bug',
        title: 'Fix timer sync blocker',
        description: 'Blocks QA signoff for release.',
        projectId: 'release',
        dependsOn: [],
        dueDate: '2026-06-11',
      } as Task,
      {
        ...task,
        id: 'task-health',
        title: 'Book Dad blood test',
        description: 'Family health admin.',
        projectId: 'family-admin',
        priority: 'medium',
        dueDate: '2026-06-12',
      } as Task,
    ]
    const context = buildWeekContextFromToolResults(
      [{ success: true, data: relatedTasks }],
      relatedTasks,
      'en',
      new Date('2026-06-07T09:00:00Z'),
    )
    expect(context.workstreams.length).toBeGreaterThan(0)
    const badPlan = {
      schemaVersion: 'weekly-plan.v2',
      requestId: context.requestId,
      locale: 'en',
      direction: 'ltr',
      headline: 'Do due tasks',
      weekRead: { summary: 'Do due tasks.', workloadReality: 'Fine.', mainTradeoff: 'None.' },
      recommendations: context.tasks.slice(0, 3).map((candidate, index) => ({
        sectionId: `bad-${index}`,
        rank: index + 1,
        focusArea: 'Due tasks',
        primaryTaskId: candidate.id,
        relatedTaskIds: [],
        recommendationType: 'protect',
        title: candidate.title,
        whyThisMatters: 'This task is high priority and due soon. Completing it will help you stay on track.',
        whyThisWeek: 'It is due this week.',
        riskIfIgnored: 'You may not make progress.',
        nextAction: 'Schedule a focused block.',
        evidence: [
          { taskId: candidate.id, field: 'dueIso', value: candidate.dueIso ?? '', interpretation: 'due this week' },
          { taskId: candidate.id, field: 'priority', value: candidate.priority ?? 'medium', interpretation: 'priority signal' },
          ...(index === 1
            ? [{ taskId: candidate.id, field: 'notes', value: 'Blue banana archive note from another task', interpretation: 'invented context' }]
            : []),
        ],
        cardPlacement: 'immediately_after_explanation',
      })),
      deferrals: [],
      openQuestions: [],
      quality: { selectedTaskCount: 3, confidence: 'medium', caveats: [] },
    }

    expect(validateWeeklyPlanOutput(badPlan, context)).toEqual(expect.arrayContaining([
      'generic_reasoning:bad-0',
      'generic_focus_area:bad-0',
      'date_priority_only_reasoning:bad-0',
      'missing_real_consequence:bad-2',
      'unsupported_evidence_value:bad-1:task-bug:notes',
      'missing_related_workstream_binding',
      'insufficient_real_consequence_coverage',
    ]))

    const quickDraft = buildQuickDraftWeeklyPlan(context)
    expect(quickDraft.source).toBe('quick_draft')
    expect(quickDraft.headline).toContain('Best plan')
    expect(quickDraft.recommendations[0].evidence.length).toBeGreaterThanOrEqual(2)
    expect(quickDraft.recommendations[0].focusArea).toBeTruthy()
    expect(new Set(quickDraft.recommendations.map(rec => rec.whyThisMatters)).size).toBeGreaterThan(1)
    const recommendationText = quickDraft.recommendations.map(rec => rec.whyThisMatters).join(' ')
    expect(recommendationText).not.toMatch(/coaching explanation is unavailable.*coaching explanation is unavailable/i)
    expect(recommendationText).not.toMatch(/Evidence-only draft|not a replacement|left waiting/i)
    expect(quickDraft.recommendations.some(rec => rec.relatedTaskIds.length > 0)).toBe(true)
  })

  it('keeps quick drafts focused on substantial work before small home errands', () => {
    const baseTask = {
      status: 'todo',
      priority: 'medium',
      progress: 0,
      completedPomodoros: 0,
      subtasks: [],
      dueDate: '2026-06-10',
      createdAt: new Date('2026-06-01T08:00:00Z'),
      updatedAt: new Date('2026-06-07T08:00:00Z'),
    } satisfies Partial<Task>
    const tasks = [
      {
        ...baseTask,
        id: 'task-outreach',
        title: 'Build list of 10 real cold-outreach targets',
        description: '',
        projectId: 'sales-pipeline',
        estimatedDuration: 90,
        subtasks: [
          {
            id: 'sub-outreach-1',
            parentTaskId: 'task-outreach',
            title: 'Review the target company list',
            description: '',
            completedPomodoros: 0,
            isCompleted: false,
            createdAt: new Date('2026-06-01T08:00:00Z'),
            updatedAt: new Date('2026-06-07T08:00:00Z'),
          },
        ],
      } as Task,
      {
        ...baseTask,
        id: 'task-present',
        title: 'Buy Sivan a present',
        description: '',
        projectId: 'Home',
        estimatedDuration: 20,
      } as Task,
      {
        ...baseTask,
        id: 'task-fridge-food',
        title: 'Cook the food in the fridge',
        description: '',
        projectId: 'Home',
        estimatedDuration: 25,
      } as Task,
      {
        ...baseTask,
        id: 'task-water',
        title: 'Replace water',
        description: '',
        projectId: 'Home',
        estimatedDuration: 10,
      } as Task,
      {
        ...baseTask,
        id: 'task-pet-food',
        title: 'Buy pet food and litter',
        description: '',
        projectId: 'Home',
        estimatedDuration: 25,
      } as Task,
    ]

    const context = buildWeekContextFromToolResults(
      [{ success: true, data: tasks }],
      tasks,
      'en',
      new Date('2026-06-07T09:00:00Z'),
    )
    const quickDraft = buildQuickDraftWeeklyPlan(context)

    expect(quickDraft.recommendations[0].primaryTaskId).toBe('task-outreach')
    expect(quickDraft.recommendations[0].evidence.some(item => item.field === 'subtasks')).toBe(true)
    expect(quickDraft.recommendations[0].nextAction).toContain('Review the target company list')
    expect(quickDraft.recommendations[0].whyThisMatters).toContain('substantial work focus')
    expect(quickDraft.recommendations.filter(rec => rec.focusArea === 'Home').length).toBeLessThanOrEqual(2)
    expect(quickDraft.deferrals.length).toBeGreaterThanOrEqual(2)
    expect(new Set([...quickDraft.recommendations.map(rec => rec.primaryTaskId), ...quickDraft.deferrals.map(item => item.taskId)]).size).toBeGreaterThanOrEqual(5)
    expect(quickDraft.openQuestions.some(question => question.options?.length && question.allowFreeText)).toBe(true)
  })

  it('does not infer project importance from name alone and asks for saved project understanding', () => {
    const tasks = [
      {
        id: 'task-launch',
        title: 'Polish homepage copy',
        description: '',
        status: 'todo',
        priority: 'medium',
        progress: 0,
        completedPomodoros: 0,
        subtasks: [],
        dueDate: '2026-06-12',
        projectId: 'important-client-launch',
        createdAt: new Date('2026-06-01T08:00:00Z'),
        updatedAt: new Date('2026-06-07T08:00:00Z'),
      } as Task,
      {
        id: 'task-admin',
        title: 'Review insurance form',
        description: 'Admin paperwork.',
        status: 'todo',
        priority: 'medium',
        progress: 0,
        completedPomodoros: 0,
        subtasks: [],
        dueDate: '2026-06-10',
        projectId: 'admin',
        createdAt: new Date('2026-06-01T08:00:00Z'),
        updatedAt: new Date('2026-06-07T08:00:00Z'),
      } as Task,
      {
        id: 'task-reply',
        title: 'Reply to approval email',
        description: 'Waiting on my response.',
        status: 'todo',
        priority: 'medium',
        progress: 0,
        completedPomodoros: 0,
        subtasks: [],
        dueDate: '2026-06-11',
        projectId: 'inbox',
        createdAt: new Date('2026-06-01T08:00:00Z'),
        updatedAt: new Date('2026-06-07T08:00:00Z'),
      } as Task,
    ]
    const context = buildWeekContextFromToolResults(
      [{ success: true, data: tasks }],
      tasks,
      'en',
      new Date('2026-06-07T09:00:00Z'),
    )
    const quickDraft = buildQuickDraftWeeklyPlan(context)

    expect(context.uncertaintyNotes.join(' ')).toContain('do not infer importance from the project name alone')
    expect(quickDraft.headline).toBe('Before I rank the week')
    expect(quickDraft.recommendations).toHaveLength(0)
    expect(quickDraft.deferrals).toHaveLength(0)
    expect(quickDraft.quality.caveats.join(' ')).toContain('No full plan was generated')
    const projectQuestion = quickDraft.openQuestions.find(question => question.entityType === 'project')
    expect(projectQuestion).toMatchObject({
      entityId: 'important-client-launch',
      reason: 'missing_project_understanding',
      allowFreeText: true,
      freeTextPatch: { field: 'whyItMatters', operation: 'set' },
    })
    expect(projectQuestion?.options?.length).toBeGreaterThan(2)
    expect(projectQuestion?.options?.[0].memoryPatch).toMatchObject({
      entityType: 'project',
      field: 'domain',
      source: 'button_answer',
    })

    const interview = buildWeeklyPlanningInterview(context, [], {
      retrieval: {
        source: 'exact_entity_lookup',
        entityKeyCount: 4,
        eventCount: 0,
        projectContextCount: 0,
        taskContextCount: 0,
        elapsedMs: 12,
      },
      reason: 'coverage score says context would change ranking',
      candidateCount: 3,
    })
    expect(interview).toMatchObject({
      schemaVersion: 'ai-clarification.v1',
      pathType: 'clarify_first',
      coverage: expect.objectContaining({
        decision: 'ask',
        materiality: 'high',
      }),
      debug: expect.objectContaining({
        retrieval: expect.objectContaining({ entityKeyCount: 4, elapsedMs: 12 }),
      }),
    })
    expect(interview?.coverage?.score).toBeLessThan(0.5)
    expect(interview?.coverage?.missing).toEqual(expect.arrayContaining(['project_meaning']))
  })

  it('uses saved project context as ranking evidence instead of project-name guessing', () => {
    const tasks = [
      {
        id: 'task-paper',
        title: 'Buy printer paper',
        description: '',
        status: 'todo',
        priority: 'high',
        progress: 0,
        completedPomodoros: 0,
        subtasks: [],
        dueDate: null,
        projectId: 'admin',
        createdAt: new Date('2026-06-01T08:00:00Z'),
        updatedAt: new Date('2026-06-07T08:00:00Z'),
      } as Task,
      {
        id: 'task-memory',
        title: 'Fix weekly planner memory',
        description: '',
        status: 'todo',
        priority: 'medium',
        progress: 0,
        completedPomodoros: 0,
        subtasks: [],
        dueDate: null,
        projectId: 'ai-planner',
        estimatedDuration: 90,
        createdAt: new Date('2026-06-01T08:00:00Z'),
        updatedAt: new Date('2026-06-07T08:00:00Z'),
      } as Task,
      {
        id: 'task-clean',
        title: 'Clean inbox',
        description: '',
        status: 'todo',
        priority: 'low',
        progress: 0,
        completedPomodoros: 0,
        subtasks: [],
        dueDate: null,
        projectId: 'admin',
        createdAt: new Date('2026-06-01T08:00:00Z'),
        updatedAt: new Date('2026-06-07T08:00:00Z'),
      } as Task,
    ]
    const context = buildWeekContextFromToolResults(
      [{ success: true, data: tasks }],
      tasks,
      'en',
      new Date('2026-06-07T09:00:00Z'),
      {
        projectContexts: [{
          projectId: 'ai-planner',
          summary: 'Build project-understanding memory for FlowState chat.',
          domain: 'work',
          whyItMatters: 'Weak planning makes the assistant feel fake.',
          successCriteria: ['Weekly answers must cite real project meaning.'],
          failureRisks: [],
          currentStakes: 'high',
          urgencyWindow: 'this_week',
          taskSelectionHints: [],
          nonGoals: ['Treating this as UI polish'],
          userCorrections: [],
          confidence: 0.95,
          completenessScore: 0.8,
        }],
        taskContexts: [],
      },
    )
    const quickDraft = buildQuickDraftWeeklyPlan(context)

    expect(quickDraft.recommendations[0].primaryTaskId).toBe('task-memory')
    expect(quickDraft.recommendations[0].evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'projectContext', value: expect.stringContaining('Weak planning') }),
    ]))
    expect(quickDraft.recommendations[0].whyThisMatters).toContain('Saved project context')
  })

  it('uses recent recommendation feedback to suppress repeated weekly suggestions', () => {
    const baseTask = {
      status: 'todo',
      priority: 'medium',
      progress: 0,
      completedPomodoros: 0,
      subtasks: [],
      dueDate: '2026-06-12',
      createdAt: new Date('2026-06-01T08:00:00Z'),
      updatedAt: new Date('2026-06-07T08:00:00Z'),
    } satisfies Partial<Task>
    const tasks = [
      {
        ...baseTask,
        id: 'task-dismissed-client',
        title: 'Prepare client renewal packet',
        description: 'Client renewal context is clear but the user dismissed this exact recommendation yesterday.',
        projectId: 'client-renewals',
        priority: 'high',
        estimatedDuration: 90,
      } as Task,
      {
        ...baseTask,
        id: 'task-memory-quality',
        title: 'Tighten planner memory rubric',
        description: 'Product work that improves whether weekly planning feels grounded in real context.',
        projectId: 'ai-planner',
        estimatedDuration: 90,
      } as Task,
      {
        ...baseTask,
        id: 'task-release-blocker',
        title: 'Fix release blocker before QA',
        description: 'Blocks QA signoff and prevents a reliable release handoff this week.',
        projectId: 'release',
        estimatedDuration: 60,
      } as Task,
      {
        ...baseTask,
        id: 'task-admin-review',
        title: 'Review admin document',
        description: 'Admin paperwork with enough context to avoid a clarification-first plan.',
        projectId: 'admin',
        estimatedDuration: 30,
      } as Task,
    ]
    const context = buildWeekContextFromToolResults(
      [{ success: true, data: tasks }],
      tasks,
      'en',
      new Date('2026-06-07T09:00:00Z'),
      {
        recommendationFeedback: [{
          recommendationId: 'quick_1_task-dismissed-client',
          taskId: null,
          entityKey: 'project:client-renewals',
          action: 'dismiss',
          reasonCategory: 'not_important',
          implicitPositive: false,
          createdAt: '2026-06-06T09:00:00Z',
        }],
      },
    )
    const quickDraft = buildQuickDraftWeeklyPlan(context)

    expect(context.tasks.find(task => task.id === 'task-dismissed-client')?.derived.recommendationFeedback.penalty).toBeGreaterThan(0.7)
    expect(quickDraft.recommendations.map(rec => rec.primaryTaskId)).not.toContain('task-dismissed-client')
    expect(quickDraft.deferrals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        taskId: 'task-dismissed-client',
        reason: expect.stringContaining('dismissed it recently'),
      }),
    ]))
    expect(buildWeeklyPlanPrompt(context)).toContain('recommendationFeedbackSummary')
  })

  it('lets weekly-plan question buttons create a linked follow-up task with optional user text', async () => {
    const taskStore = useTaskStore()
    taskStore._rawTasks.push({
      id: 'task-renewal',
      title: 'Send renewal proposal to Amit',
      description: 'Amit asked for numbers before Wednesday budget meeting.',
      status: 'todo',
      priority: 'high',
      progress: 0,
      completedPomodoros: 0,
      subtasks: [],
      dueDate: '2026-06-10',
      projectId: 'client-renewals',
      createdAt: new Date('2026-06-01T08:00:00Z'),
      updatedAt: new Date('2026-06-07T08:00:00Z'),
    } as Task)
    const createFollowup = vi.spyOn(taskStore, 'createTaskWithUndo').mockResolvedValue({ id: 'follow-up-task' } as Task)

    const wrapper = mount(ChatMessage, {
      props: {
        message: {
          id: 'msg-weekly-followup-question',
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          metadata: {
            weeklyPlan: {
              schemaVersion: 'weekly-plan.v2',
              requestId: 'req-week',
              locale: 'en',
              direction: 'ltr',
              source: 'quick_draft',
              headline: 'Best plan from task evidence',
              weekRead: {
                summary: 'There are enough signals to act now.',
                workloadReality: 'Keep the plan focused.',
                mainTradeoff: 'Client work beats low-context admin.',
              },
              recommendations: [
                {
                  sectionId: 'rec-renewal',
                  rank: 1,
                  focusArea: 'Client renewals',
                  primaryTaskId: 'task-renewal',
                  relatedTaskIds: [],
                  recommendationType: 'protect',
                  title: 'Send renewal proposal to Amit',
                  whyThisMatters: 'Amit needs numbers before the budget meeting.',
                  whyThisWeek: 'The task is inside the current planning window.',
                  riskIfIgnored: 'The decision may move before the proposal lands.',
                  nextAction: 'Draft the numbers table.',
                  evidence: [
                    { taskId: 'task-renewal', field: 'notes', value: 'budget meeting', interpretation: 'external decision window' },
                    { taskId: 'task-renewal', field: 'dueIso', value: '2026-06-10', interpretation: 'original plan date' },
                  ],
                  cardPlacement: 'immediately_after_explanation',
                },
              ],
              deferrals: [],
              openQuestions: [
                {
                  id: 'followup_task-renewal',
                  question: 'Add a follow-up task after "Send renewal proposal to Amit"?',
                  options: [
                    { id: 'add_followup', label: 'Yes, add it', effect: 'Create a follow-up task linked to this recommendation.' },
                    { id: 'no_followup', label: 'No follow-up', effect: 'Do not suggest a follow-up for this task again in this plan.' },
                  ],
                  allowFreeText: true,
                  relatedTaskIds: ['task-renewal'],
                },
              ],
              quality: { selectedTaskCount: 1, confidence: 'medium', caveats: [] },
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

    expect(wrapper.text()).toContain('Grounded task-evidence plan')
    await wrapper.get('.weekly-question-option').trigger('click')
    await wrapper.get('.weekly-question-free-text').setValue('Confirm renewal numbers were received')
    await wrapper.get('.weekly-question-apply').trigger('click')
    await nextTick()

    expect(createFollowup).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Confirm renewal numbers were received',
      parentTaskId: 'task-renewal',
      projectId: 'client-renewals',
      priority: 'high',
    }))
    expect(wrapper.text()).toContain('Follow-up task added')
  })

  it('shows local candidate cards immediately when clarification is skipped for candidates', async () => {
    const taskStore = useTaskStore()
    taskStore._rawTasks.push({
      id: 'task-candidate-a',
      title: 'Define planner memory success criteria',
      description: '',
      status: 'todo',
      priority: 'medium',
      progress: 0,
      completedPomodoros: 0,
      subtasks: [],
      dueDate: null,
      projectId: 'ai-planner',
      createdAt: new Date('2026-06-01T08:00:00Z'),
      updatedAt: new Date('2026-06-07T08:00:00Z'),
    } as Task)

    const wrapper = mount(ChatMessage, {
      props: {
        message: {
          id: 'msg-clarification-candidates',
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          metadata: {
            clarification: {
              schemaVersion: 'ai-clarification.v1',
              kind: 'weekly_planning',
              locale: 'en',
              direction: 'ltr',
              progressLabel: 'Clarifying priorities • Step 1/3',
              summary: 'I am missing one detail that would change the ranking.',
              memoryKey: 'project:ai-planner',
              pathType: 'clarify_first',
              candidateTaskIds: ['task-candidate-a'],
              actions: ['show_candidates', 'pause_save'],
              coverage: {
                score: 0.32,
                materiality: 'high',
                dimensions: { project_meaning: 0 },
                missing: ['project_meaning'],
                decision: 'ask',
              },
              question: {
                id: 'project_context_ai-planner',
                entityType: 'project',
                entityId: 'ai-planner',
                reason: 'missing_project_understanding',
                question: 'What kind of project is "AI Planner"?',
                options: [{ id: 'domain_work', label: 'Work/Product', effect: 'Save work context.' }],
                allowFreeText: true,
                relatedTaskIds: ['task-candidate-a'],
              },
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

    expect(wrapper.find('[data-testid="ai-clarification"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="weekly-plan"]').exists()).toBe(false)
    await wrapper.findAll('.weekly-question-escape')[0].trigger('click')
    await nextTick()

    expect(wrapper.find('[data-testid="ai-clarification-inline-result"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="weekly-plan"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="ai-clarification-candidate-card"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Unranked candidates')
    expect(wrapper.text()).toContain('Define planner memory success criteria')
  })

  it('keeps deterministic task answers from spinning forever when formatter output fails', () => {
    const aiChat = src('src/composables/useAIChat.ts')

    expect(aiChat).toContain('FINAL_FORMATTER_TIMEOUT_MS')
    expect(aiChat).toContain('WEEK_PLAN_STRUCTURED_TIMEOUT_MS = 8_000')
    expect(aiChat).toContain('isBridgeActive() && isWeekPlan')
    expect(aiChat).toContain('buildWeeklyPlanningInterview(weekContext, clarificationEvents, {')
    expect(aiChat).toContain('timeout: WEEK_PLAN_STRUCTURED_TIMEOUT_MS')
    expect(aiChat).toContain('} else if (isBridgeActive())')
    expect(aiChat).not.toContain('const immediateFallback = buildFormatterFallback(toolResults, routed.language, routed.responseMode)')
    expect(aiChat).not.toContain('lastMsg.content = cleanResponse(immediateDisplay)')
    expect(aiChat).not.toContain('cardGroups: { groups: immediateCards.groups, total: immediateCards.total, kind: immediateCards.kind }')
    expect(aiChat).toContain('buildFormatterFallback(toolResults, routed.language, routed.responseMode)')
    expect(aiChat).toContain("Formatter timed out or failed; using fallback answer")
  })

  it('does not force-scroll the chat while the user is reading older streaming content', () => {
    const panel = src('src/components/ai/AIChatPanel.vue')

    expect(panel).toContain('function isNearBottom')
    expect(panel).toContain('if (!container || !isNearBottom(container)) return')
    expect(panel).not.toContain('watch(visibleMessages, () => {\n  scrollToBottom()\n}, { deep: true })')
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

  it('clears an inline week-plan recommendation card when the task is postponed out of the plan window', () => {
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

    expect(wrapper.findAll('[data-testid="inline-ai-task-card"]')).toHaveLength(0)
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

  it('documents weekly planning as a structured artifact instead of prose plus detached cards', () => {
    const aiChat = src('src/composables/useAIChat.ts')
    const weeklyPlan = src('src/services/ai/pipeline/weeklyPlan.ts')
    const chatMessage = src('src/components/ai/ChatMessage.vue')

    expect(aiChat).toContain('buildWeekContextFromToolResults')
    expect(aiChat).toContain('buildWeeklyPlanPrompt')
    expect(aiChat).toContain('parseWeeklyPlanOutput')
    expect(aiChat).toContain('fetchProjectContexts(projectIds)')
    expect(aiChat).toContain('fetchTaskContexts(taskIds)')
    expect(aiChat).toContain('fetchAIRecommendationFeedback({ taskIds, entityKeys, limit: 80 })')
    expect(aiChat).toContain('const clarification = buildWeeklyPlanningInterview(weekContext, clarificationEvents, {')
    expect(aiChat).toContain('clarification,')
    expect(aiChat).toContain('recordAIClarificationEvent')
    expect(aiChat).toContain('weeklyPlan: finalPlan')
    expect(aiChat).toContain('const finalPlan = weeklyPlan ?? buildWeeklyPlanReliabilityFallback(weekContext, validationErrors)')
    expect(aiChat).toContain('buildWeeklyPlanReliabilityFallback')
    expect(aiChat).toContain('Return ONLY valid JSON matching schemaVersion weekly-plan.v2')
    expect(aiChat).toContain('store.completeStreamingMessage()')
    expect(aiChat).not.toContain('const immediateFallback = buildFormatterFallback(toolResults, routed.language, routed.responseMode)')

    expect(weeklyPlan).toContain("schemaVersion: 'weekly-plan.v2'")
    expect(weeklyPlan).toContain('validateWeeklyPlanOutput')
    expect(weeklyPlan).toContain('date_priority_only_reasoning')
    expect(weeklyPlan).toContain('missing_project_understanding_evidence')
    expect(weeklyPlan).toContain('do not infer importance from the project name alone')
    expect(weeklyPlan).toContain('generic_reasoning')
    expect(weeklyPlan).toContain('buildQuickDraftWeeklyPlan')
    expect(weeklyPlan).toContain('buildWeeklyPlanReliabilityFallback')
    expect(weeklyPlan).toContain('buildWeeklyPlanningInterview')
    expect(weeklyPlan).toContain('recommendationFeedbackSummary')
    expect(weeklyPlan).toContain('isSuppressedByRecommendationFeedback')
    expect(weeklyPlan).toContain('feedbackDeferralReason')
    expect(weeklyPlan).toContain("schemaVersion: 'ai-clarification.v1'")
    expect(weeklyPlan).toContain('I did not get a reliable enough plan')
    expect(weeklyPlan).toContain('Best plan from task evidence')
    expect(weeklyPlan).not.toContain('Evidence-only draft:')

    expect(chatMessage).toContain('data-testid="weekly-plan"')
    expect(chatMessage).toContain('data-testid="weekly-plan-questions"')
    expect(chatMessage.indexOf('data-testid="weekly-plan-questions"')).toBeLessThan(chatMessage.indexOf('class="weekly-plan-section"'))
    expect(chatMessage.indexOf('class="weekly-plan-section"')).toBeLessThan(chatMessage.indexOf('class="weekly-plan-footer"'))
    expect(chatMessage).toContain('data-testid="inline-plan-card"')
    expect(chatMessage).toContain('taskCardFromId(taskId)')
    expect(chatMessage).toContain('weeklyPlanTaskStaleLabel')
    expect(chatMessage).toContain('Grounded task-evidence plan')
    expect(chatMessage).toContain('applyWeeklyQuestion')
    expect(chatMessage).toContain('applyAIMemoryPatch')
    expect(chatMessage).toContain('recordRecommendationFeedback')
    expect(chatMessage).toContain('weekly-feedback-btn')
    expect(chatMessage).toContain('Why ask?')
    expect(chatMessage).toContain('clarificationDebugLines')
    expect(chatMessage).toContain('createTaskWithUndo')
    expect(src('src/services/ai/chatPersistence.ts')).toContain('weeklyPlan: m.metadata.weeklyPlan')
    expect(src('src/services/ai/chatPersistence.ts')).toContain('clarification: m.metadata.clarification')
    expect(src('src/composables/useAIChat.ts')).toContain('fetchProjectContexts(projectIds)')
    expect(src('src/composables/useAIChat.ts')).toContain('fetchTaskContexts(taskIds)')
    expect(src('src/composables/useAIChat.ts')).toContain('uniqueSupabaseIds')
    expect(src('src/composables/supabase/useAIMemoryDatabase.ts')).toContain('filter(isSupabaseUuid)')
    expect(src('src/composables/supabase/useAIMemoryDatabase.ts')).toContain('Skipping ${patch.entityType} memory patch for non-Supabase UUID')
    expect(src('src/composables/supabase/useAIMemoryDatabase.ts')).toContain("from('ai_context_entities')")
    expect(src('src/composables/supabase/useAIMemoryDatabase.ts')).toContain("from('ai_clarification_events')")
    expect(src('src/composables/supabase/useAIMemoryDatabase.ts')).toContain('recordAIClarificationEvent')
    expect(src('src/composables/supabase/useAIMemoryDatabase.ts')).toContain('recordAIRecommendationFeedback')
    expect(src('src/composables/supabase/useAIMemoryDatabase.ts')).toContain('fetchAIRecommendationFeedback')
    expect(src('src/composables/supabase/useAIMemoryDatabase.ts')).toContain('upsertAIContextEdges')
    expect(src('supabase/migrations/20260608090000_ai_clarification_memory.sql')).toContain('create table if not exists public.ai_context_entities')
    expect(src('supabase/migrations/20260608090000_ai_clarification_memory.sql')).toContain('create table if not exists public.ai_clarification_events')
    expect(src('supabase/migrations/20260608093000_ai_assistant_memory_metadata.sql')).toContain('create table if not exists public.ai_recommendation_feedback')
    expect(src('supabase/migrations/20260608093000_ai_assistant_memory_metadata.sql')).toContain('create table if not exists public.ai_context_edges')
    expect(src('src/composables/useAIChat.ts')).toContain('LOW-OVERWHELM QUALITY CONTRACT')
    expect(src('src/composables/useAIChat.ts')).toContain('No greeting, throat-clearing, recap, motivational line, or generic productivity advice')
    expect(src('src/composables/useAIChat.ts')).toContain('if (clarification)')
    expect(src('src/composables/useAIChat.ts')).toContain('coverageScoreAtTime: clarification.coverage?.score')
    expect(src('src/composables/useAIChat.ts')).toContain('pathType: clarification.pathType')
    expect(src('src/composables/useAIChat.ts')).toContain('must not infer importance, stakes, work/personal category, or success criteria from project names alone')
    expect(aiChat).toContain('depends on:')
    expect(aiChat).toContain('connections:')
    expect(aiChat).toContain('planning notes:')
    expect(aiChat).toContain('scheduled:')
    expect(aiChat).toContain('focus history today:')
    expect(aiChat).toContain('function buildRichToolResultsData')
    expect(aiChat).toContain('let nextTaskIndex = 1')
    expect(aiChat).toContain('buildRichTaskData(r, lang, nextTaskIndex)')
    expect(aiChat).toContain('nextTaskIndex += collectCardTasks([r]).length')
    expect(aiChat).not.toContain('למה עכשיו: ${why}. השפעה: ${impact}. מיקום/טריידאוף: ${slot}')
    expect(aiChat).not.toContain('Why now: ${why}. Expected impact: ${impact}. Tradeoff/slot: ${slot}')
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
