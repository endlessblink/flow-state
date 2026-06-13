import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const mockEnqueue = vi.fn().mockResolvedValue({ id: 1, status: 'pending' })
const mockDeleteTask = vi.fn().mockResolvedValue(undefined)

vi.mock('@/composables/sync/useSyncOrchestrator', () => ({
  useSyncOrchestrator: () => ({
    enqueue: mockEnqueue,
    onPermanentFailure: vi.fn(),
    status: { value: 'idle' },
    pendingCount: { value: 0 },
    failedCount: { value: 0 },
    lastSyncAt: { value: null },
    lastError: { value: null },
    isOnline: { value: true },
    isProcessing: { value: false },
    hasPendingChanges: { value: false },
    hasErrors: { value: false },
    retryFailed: vi.fn(),
    clearFailed: vi.fn(),
    getQueueStats: vi.fn(),
    forceSync: vi.fn(),
  }),
}))

vi.mock('@/composables/useDatabase', () => ({
  useDatabase: () => ({
    save: vi.fn(),
    load: vi.fn().mockResolvedValue(null),
  }),
  DB_KEYS: {
    TASKS: 'tasks',
    PROJECTS: 'projects',
    CANVAS: 'canvas',
  },
}))

vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    saveTask: vi.fn().mockResolvedValue(undefined),
    saveTasks: vi.fn().mockResolvedValue(undefined),
    deleteTask: mockDeleteTask,
    fetchTasks: vi.fn().mockResolvedValue([]),
    fetchGroups: vi.fn().mockResolvedValue([]),
    saveGroup: vi.fn().mockResolvedValue(undefined),
    deleteGroup: vi.fn().mockResolvedValue(undefined),
    fetchProjects: vi.fn().mockResolvedValue([]),
    saveProject: vi.fn().mockResolvedValue(undefined),
    saveProjects: vi.fn().mockResolvedValue(undefined),
    deleteProject: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/services/auth/supabase', () => ({
  supabase: null,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: '00000000-0000-0000-0000-000000000001' },
    isAuthenticated: true,
  }),
}))

vi.mock('@/stores/workspace', () => ({
  useWorkspaceStore: () => ({
    activeWorkspaceId: null,
  }),
}))

vi.mock('@/utils/demoContentGuard', () => ({
  guardTaskCreation: vi.fn(),
}))

import {
  applyAICommandBatch,
  buildAICommandBatchPreview,
  clearAICommandAuditStoreForTests,
  getAICommandAuditTrail,
  loadAICommandAuditTrail,
  rollbackAICommandBatch,
} from '@/services/ai/actionCommands'
import { useTaskStore } from '@/stores/tasks'

describe('AI action command substrate', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockEnqueue.mockResolvedValue({ id: 1, status: 'pending' })
    mockDeleteTask.mockResolvedValue(undefined)
    localStorage.clear()
    await clearAICommandAuditStoreForTests()
  })

  it('renders a preview without mutating task state', async () => {
    const taskStore = useTaskStore()

    const batch = buildAICommandBatchPreview({
      sourcePrompt: 'Create invoice follow-up',
      sourceRunId: 'run-preview',
      sourceMessageId: 'msg-preview',
      dataUsed: { mode: 'unit-test' },
      commands: [{
        id: 'cmd-create-followup',
        kind: 'task.create',
        title: 'Send invoice follow-up',
        priority: 'high',
        dueDate: '2026-06-20',
      }],
      tasks: taskStore.tasks,
    })

    expect(taskStore._rawTasks).toHaveLength(0)
    expect(batch.preview.commands).toHaveLength(1)
    expect(batch.preview.commands[0]).toMatchObject({
      id: 'cmd-create-followup',
      kind: 'task.create',
      status: 'will_create',
      diff: {
        entityType: 'task',
        before: null,
        after: expect.objectContaining({
          title: 'Send invoice follow-up',
          priority: 'high',
          dueDate: '2026-06-20',
        }),
      },
    })
  })

  it('applies only selected commands and records applied versus rejected commands', async () => {
    const taskStore = useTaskStore()

    const batch = buildAICommandBatchPreview({
      sourcePrompt: 'Create two possible follow-ups',
      sourceRunId: 'run-selected',
      sourceMessageId: 'msg-selected',
      dataUsed: { visibleTaskIds: [] },
      commands: [
        { id: 'cmd-selected', kind: 'task.create', title: 'Selected AI task', priority: 'high' },
        { id: 'cmd-rejected', kind: 'task.create', title: 'Rejected AI task', priority: 'low' },
      ],
      tasks: taskStore.tasks,
    })

    const result = await applyAICommandBatch(batch, {
      selectedCommandIds: ['cmd-selected'],
      taskStore,
    })

    expect(result.appliedCommands.map(command => command.id)).toEqual(['cmd-selected'])
    expect(result.rejectedCommands.map(command => command.id)).toEqual(['cmd-rejected'])
    expect(taskStore.tasks.map(task => task.title)).toEqual(['Selected AI task'])

    const audit = getAICommandAuditTrail()
    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({
      sourcePrompt: 'Create two possible follow-ups',
      sourceRunId: 'run-selected',
      sourceMessageId: 'msg-selected',
      dataUsed: { visibleTaskIds: [] },
      rollbackPointer: result.rollbackPointer,
      commandsApplied: [expect.objectContaining({ id: 'cmd-selected' })],
      commandsRejected: [expect.objectContaining({ id: 'cmd-rejected', reason: 'not_selected' })],
    })
  })

  it('reuses semantic duplicates during apply and keeps repeated apply idempotent', async () => {
    const taskStore = useTaskStore()

    const batch = buildAICommandBatchPreview({
      sourcePrompt: 'Create the same follow-up twice',
      sourceRunId: 'run-idempotent',
      sourceMessageId: 'msg-idempotent',
      dataUsed: {},
      commands: [{
        id: 'cmd-repeat',
        kind: 'task.create',
        title: 'Check renewal numbers',
        dueDate: '2026-06-21',
      }],
      tasks: taskStore.tasks,
    })

    const first = await applyAICommandBatch(batch, {
      selectedCommandIds: ['cmd-repeat'],
      taskStore,
    })
    const replay = await applyAICommandBatch(batch, {
      selectedCommandIds: ['cmd-repeat'],
      taskStore,
    })

    expect(taskStore.tasks.filter(task => task.title === 'Check renewal numbers')).toHaveLength(1)
    expect(first.appliedCommands[0]).toMatchObject({ result: 'created' })
    expect(replay.appliedCommands[0]).toMatchObject({ result: 'reused_existing' })
  })

  it('blocks low-confidence or high-impact commands without explicit approval', async () => {
    const taskStore = useTaskStore()

    const batch = buildAICommandBatchPreview({
      sourcePrompt: 'Risky command',
      sourceRunId: 'run-risk',
      sourceMessageId: 'msg-risk',
      dataUsed: {},
      commands: [{
        id: 'cmd-risky',
        kind: 'task.create',
        title: 'High impact unclear task',
        confidence: 0.3,
        impact: 'high',
      }],
      tasks: taskStore.tasks,
    })

    const result = await applyAICommandBatch(batch, {
      selectedCommandIds: ['cmd-risky'],
      taskStore,
    })

    expect(taskStore.tasks).toHaveLength(0)
    expect(result.appliedCommands).toEqual([])
    expect(result.rejectedCommands).toEqual([
      expect.objectContaining({ id: 'cmd-risky', reason: 'requires_explicit_approval' }),
    ])
  })

  it('rolls back an applied batch to the pre-AI task state', async () => {
    const taskStore = useTaskStore()
    const parent = await taskStore.createTask({ title: 'Parent task' })

    const batch = buildAICommandBatchPreview({
      sourcePrompt: 'Create rollback task and subtask',
      sourceRunId: 'run-rollback',
      sourceMessageId: 'msg-rollback',
      dataUsed: { parentTaskId: parent.id },
      commands: [
        { id: 'cmd-task', kind: 'task.create', title: 'Temporary AI task' },
        { id: 'cmd-subtask', kind: 'task.subtask.create', parentTaskId: parent.id, title: 'Temporary AI subtask' },
      ],
      tasks: taskStore.tasks,
    })

    const result = await applyAICommandBatch(batch, {
      selectedCommandIds: ['cmd-task', 'cmd-subtask'],
      taskStore,
    })
    expect(taskStore.tasks.some(task => task.title === 'Temporary AI task')).toBe(true)
    expect(taskStore.tasks.find(task => task.id === parent.id)?.subtasks.map(subtask => subtask.title)).toEqual(['Temporary AI subtask'])

    await rollbackAICommandBatch(result.rollbackPointer, { taskStore })

    expect(taskStore.tasks.map(task => task.title)).toEqual(['Parent task'])
    expect(taskStore.tasks.find(task => task.id === parent.id)?.subtasks).toEqual([])
  })

  it('loads durable audit entries by source run after localStorage is cleared', async () => {
    const taskStore = useTaskStore()

    const firstBatch = buildAICommandBatchPreview({
      sourcePrompt: 'Create first durable task',
      sourceRunId: 'run-durable-a',
      sourceMessageId: 'msg-durable-a',
      dataUsed: { card: 'first' },
      commands: [{ id: 'cmd-durable-a', kind: 'task.create', title: 'First durable AI task' }],
      tasks: taskStore.tasks,
    })
    const secondBatch = buildAICommandBatchPreview({
      sourcePrompt: 'Create second durable task',
      sourceRunId: 'run-durable-b',
      sourceMessageId: 'msg-durable-b',
      dataUsed: { card: 'second' },
      commands: [{ id: 'cmd-durable-b', kind: 'task.create', title: 'Second durable AI task' }],
      tasks: taskStore.tasks,
    })

    await applyAICommandBatch(firstBatch, {
      selectedCommandIds: ['cmd-durable-a'],
      taskStore,
    })
    await applyAICommandBatch(secondBatch, {
      selectedCommandIds: ['cmd-durable-b'],
      taskStore,
    })

    localStorage.clear()

    const durableAudit = await loadAICommandAuditTrail({ sourceRunId: 'run-durable-a' })

    expect(durableAudit).toHaveLength(1)
    expect(durableAudit[0]).toMatchObject({
      batchId: firstBatch.id,
      sourceRunId: 'run-durable-a',
      sourceMessageId: 'msg-durable-a',
      commandsApplied: [expect.objectContaining({ id: 'cmd-durable-a' })],
    })
  })

  it('rolls back from a durable rollback snapshot after localStorage is cleared', async () => {
    const taskStore = useTaskStore()
    const parent = await taskStore.createTask({ title: 'Durable rollback parent' })

    const batch = buildAICommandBatchPreview({
      sourcePrompt: 'Create durable rollback subtask',
      sourceRunId: 'run-durable-rollback',
      sourceMessageId: 'msg-durable-rollback',
      dataUsed: { parentTaskId: parent.id },
      commands: [
        { id: 'cmd-durable-task', kind: 'task.create', title: 'Durable rollback AI task' },
        { id: 'cmd-durable-subtask', kind: 'task.subtask.create', parentTaskId: parent.id, title: 'Durable rollback AI subtask' },
      ],
      tasks: taskStore.tasks,
    })

    const result = await applyAICommandBatch(batch, {
      selectedCommandIds: ['cmd-durable-task', 'cmd-durable-subtask'],
      taskStore,
    })
    localStorage.clear()

    await rollbackAICommandBatch(result.rollbackPointer, { taskStore })

    expect(taskStore.tasks.map(task => task.title)).toEqual(['Durable rollback parent'])
    expect(taskStore.tasks.find(task => task.id === parent.id)?.subtasks).toEqual([])
  })
})
