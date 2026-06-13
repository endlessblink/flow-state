import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const mockEnqueue = vi.fn().mockResolvedValue({ id: 1, status: 'pending' })
const mockDeleteTask = vi.fn().mockResolvedValue(undefined)
const mockSaveGroup = vi.fn().mockResolvedValue(undefined)
const mockDeleteGroup = vi.fn().mockResolvedValue(undefined)
const mockSaveLane = vi.fn().mockResolvedValue(undefined)
const mockDeleteLane = vi.fn().mockResolvedValue(undefined)

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
    saveGroup: mockSaveGroup,
    deleteGroup: mockDeleteGroup,
    fetchLanes: vi.fn().mockResolvedValue([]),
    saveLane: mockSaveLane,
    deleteLane: mockDeleteLane,
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
import { useLaneStore } from '@/stores/lanes'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'

describe('AI action command substrate', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockEnqueue.mockResolvedValue({ id: 1, status: 'pending' })
    mockDeleteTask.mockResolvedValue(undefined)
    mockSaveGroup.mockResolvedValue(undefined)
    mockDeleteGroup.mockResolvedValue(undefined)
    mockSaveLane.mockResolvedValue(undefined)
    mockDeleteLane.mockResolvedValue(undefined)
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

  it('previews AI lane creation without mutating lane state', async () => {
    const taskStore = useTaskStore()
    const laneStore = useLaneStore()

    const batch = buildAICommandBatchPreview({
      sourcePrompt: 'Create a lane for launch follow-up',
      sourceRunId: 'run-lane-preview',
      sourceMessageId: 'msg-lane-preview',
      dataUsed: { currentLaneCount: 0 },
      commands: [{
        id: 'cmd-lane-preview',
        kind: 'lane.create',
        name: 'Launch Follow-up',
        color: '#7C3AED',
      }],
      tasks: taskStore.tasks,
      lanes: laneStore.lanes,
    })

    expect(laneStore.lanes).toHaveLength(0)
    expect(batch.preview.commands).toEqual([
      expect.objectContaining({
        id: 'cmd-lane-preview',
        kind: 'lane.create',
        status: 'will_create',
        identity: expect.objectContaining({
          kind: 'lane.create',
          scope: 'lanes',
        }),
        diff: {
          entityType: 'lane',
          before: null,
          after: expect.objectContaining({
            name: 'Launch Follow-up',
            color: '#7C3AED',
          }),
        },
      }),
    ])
  })

  it('applies AI lane creation through the lane store and reuses semantic duplicates on replay', async () => {
    const taskStore = useTaskStore()
    const laneStore = useLaneStore()

    const batch = buildAICommandBatchPreview({
      sourcePrompt: 'Create one durable lane',
      sourceRunId: 'run-lane-create',
      sourceMessageId: 'msg-lane-create',
      dataUsed: {},
      commands: [{
        id: 'cmd-lane-create',
        kind: 'lane.create',
        name: 'Revenue Recovery',
        color: '#16A34A',
      }],
      tasks: taskStore.tasks,
      lanes: laneStore.lanes,
    })

    const first = await applyAICommandBatch(batch, {
      selectedCommandIds: ['cmd-lane-create'],
      taskStore,
      laneStore,
    })
    const replay = await applyAICommandBatch(batch, {
      selectedCommandIds: ['cmd-lane-create'],
      taskStore,
      laneStore,
    })

    expect(laneStore.lanes.map(lane => lane.name)).toEqual(['Revenue Recovery'])
    expect(mockSaveLane).toHaveBeenCalledTimes(1)
    expect(first.appliedCommands[0]).toMatchObject({ kind: 'lane.create', result: 'created' })
    expect(replay.appliedCommands[0]).toMatchObject({ kind: 'lane.create', result: 'reused_existing' })
  })

  it('rolls back AI-created lanes to the pre-AI lane state', async () => {
    const taskStore = useTaskStore()
    const laneStore = useLaneStore()
    await laneStore.createLane({ name: 'Existing Lane', color: '#0EA5E9' })

    const batch = buildAICommandBatchPreview({
      sourcePrompt: 'Create temporary lane',
      sourceRunId: 'run-lane-rollback',
      sourceMessageId: 'msg-lane-rollback',
      dataUsed: {},
      commands: [{
        id: 'cmd-lane-rollback',
        kind: 'lane.create',
        name: 'Temporary AI Lane',
        color: '#F97316',
      }],
      tasks: taskStore.tasks,
      lanes: laneStore.lanes,
    })

    const result = await applyAICommandBatch(batch, {
      selectedCommandIds: ['cmd-lane-rollback'],
      taskStore,
      laneStore,
    })
    expect(laneStore.lanes.map(lane => lane.name)).toEqual(['Existing Lane', 'Temporary AI Lane'])

    await rollbackAICommandBatch(result.rollbackPointer, {
      taskStore,
      laneStore,
    })

    expect(laneStore.lanes.map(lane => lane.name)).toEqual(['Existing Lane'])
    expect(mockDeleteLane).toHaveBeenCalledWith(expect.stringMatching(/.+/))
  })

  it('previews AI canvas group creation without mutating canvas groups', async () => {
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()

    const batch = buildAICommandBatchPreview({
      sourcePrompt: 'Create canvas focus group',
      sourceRunId: 'run-canvas-preview',
      sourceMessageId: 'msg-canvas-preview',
      dataUsed: { visibleGroupCount: 0 },
      commands: [{
        id: 'cmd-canvas-preview',
        kind: 'canvas.group.create',
        name: 'Deep Work',
        position: { x: 120, y: 240, width: 520, height: 360 },
        color: '#2563EB',
      }],
      tasks: taskStore.tasks,
      canvasGroups: canvasStore.groups,
    })

    expect(canvasStore.groups).toHaveLength(0)
    expect(batch.preview.commands).toEqual([
      expect.objectContaining({
        id: 'cmd-canvas-preview',
        kind: 'canvas.group.create',
        status: 'will_create',
        identity: expect.objectContaining({
          kind: 'canvas.group.create',
          scope: 'canvas:groups',
        }),
        diff: {
          entityType: 'canvas_group',
          before: null,
          after: expect.objectContaining({
            name: 'Deep Work',
            color: '#2563EB',
            layout: 'vertical',
            position: { x: 120, y: 240, width: 520, height: 360 },
          }),
        },
      }),
    ])
  })

  it('applies AI canvas group creation through the canvas store and reuses semantic duplicates on replay', async () => {
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()
    const createGroupSpy = vi.spyOn(canvasStore, 'createGroup')

    const batch = buildAICommandBatchPreview({
      sourcePrompt: 'Create one canvas group',
      sourceRunId: 'run-canvas-create',
      sourceMessageId: 'msg-canvas-create',
      dataUsed: {},
      commands: [{
        id: 'cmd-canvas-create',
        kind: 'canvas.group.create',
        name: 'Revenue Follow-up',
        position: { x: 80, y: 140, width: 480, height: 320 },
      }],
      tasks: taskStore.tasks,
      canvasGroups: canvasStore.groups,
    })

    const first = await applyAICommandBatch(batch, {
      selectedCommandIds: ['cmd-canvas-create'],
      taskStore,
      canvasStore,
    })
    const replay = await applyAICommandBatch(batch, {
      selectedCommandIds: ['cmd-canvas-create'],
      taskStore,
      canvasStore,
    })

    expect(canvasStore.groups.map(group => group.name)).toEqual(['Revenue Follow-up'])
    expect(createGroupSpy).toHaveBeenCalledTimes(1)
    expect(mockSaveGroup).toHaveBeenCalledTimes(1)
    expect(first.appliedCommands[0]).toMatchObject({ kind: 'canvas.group.create', result: 'created' })
    expect(replay.appliedCommands[0]).toMatchObject({ kind: 'canvas.group.create', result: 'reused_existing' })
  })

  it('rolls back AI-created canvas groups to the pre-AI canvas group state', async () => {
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()
    await canvasStore.createGroup({
      name: 'Existing Group',
      type: 'custom',
      position: { x: 0, y: 0, width: 400, height: 300 },
      color: '#0EA5E9',
      layout: 'vertical',
      isVisible: true,
      isCollapsed: false,
    })

    const batch = buildAICommandBatchPreview({
      sourcePrompt: 'Create temporary canvas group',
      sourceRunId: 'run-canvas-rollback',
      sourceMessageId: 'msg-canvas-rollback',
      dataUsed: {},
      commands: [{
        id: 'cmd-canvas-rollback',
        kind: 'canvas.group.create',
        name: 'Temporary AI Group',
        position: { x: 500, y: 0, width: 400, height: 300 },
      }],
      tasks: taskStore.tasks,
      canvasGroups: canvasStore.groups,
    })

    const result = await applyAICommandBatch(batch, {
      selectedCommandIds: ['cmd-canvas-rollback'],
      taskStore,
      canvasStore,
    })
    expect(canvasStore.groups.map(group => group.name)).toEqual(['Existing Group', 'Temporary AI Group'])

    await rollbackAICommandBatch(result.rollbackPointer, {
      taskStore,
      canvasStore,
    })

    expect(canvasStore.groups.map(group => group.name)).toEqual(['Existing Group'])
    expect(mockDeleteGroup).toHaveBeenCalledWith(expect.stringMatching(/.+/))
  })

  it('previews AI canvas task moves without mutating task geometry', async () => {
    const taskStore = useTaskStore()
    const task = await taskStore.createTask({
      title: 'Move me on canvas',
      canvasPosition: { x: 10, y: 20 },
      parentId: 'old-group',
    })

    const batch = buildAICommandBatchPreview({
      sourcePrompt: 'Move task into focus group',
      sourceRunId: 'run-canvas-move-preview',
      sourceMessageId: 'msg-canvas-move-preview',
      dataUsed: { taskId: task.id },
      commands: [{
        id: 'cmd-canvas-move-preview',
        kind: 'canvas.node.move',
        nodeType: 'task',
        nodeId: task.id,
        position: { x: 240, y: 360 },
        parentId: 'focus-group',
      }],
      tasks: taskStore.tasks,
    })

    expect(taskStore.tasks.find(item => item.id === task.id)?.canvasPosition).toEqual({ x: 10, y: 20 })
    expect(taskStore.tasks.find(item => item.id === task.id)?.parentId).toBe('old-group')
    expect(batch.preview.commands).toEqual([
      expect.objectContaining({
        id: 'cmd-canvas-move-preview',
        kind: 'canvas.node.move',
        status: 'will_create',
        identity: expect.objectContaining({
          kind: 'canvas.node.move',
          targetEntityId: task.id,
          scope: `canvas:task:${task.id}`,
        }),
        diff: {
          entityType: 'canvas_layout',
          before: expect.objectContaining({
            id: task.id,
            position: { x: 10, y: 20 },
            parentId: 'old-group',
          }),
          after: expect.objectContaining({
            id: task.id,
            nodeType: 'task',
            position: { x: 240, y: 360 },
            parentId: 'focus-group',
          }),
        },
      }),
    ])
  })

  it('applies AI canvas task moves through the task store and reuses replay duplicates', async () => {
    const taskStore = useTaskStore()
    const task = await taskStore.createTask({
      title: 'Move task once',
      canvasPosition: { x: 0, y: 0 },
    })
    const updateTaskSpy = vi.spyOn(taskStore, 'updateTask')

    const batch = buildAICommandBatchPreview({
      sourcePrompt: 'Move task once',
      sourceRunId: 'run-canvas-task-move',
      sourceMessageId: 'msg-canvas-task-move',
      dataUsed: { taskId: task.id },
      commands: [{
        id: 'cmd-canvas-task-move',
        kind: 'canvas.node.move',
        nodeType: 'task',
        nodeId: task.id,
        position: { x: 144, y: 288 },
        parentId: 'group-target',
      }],
      tasks: taskStore.tasks,
    })

    const first = await applyAICommandBatch(batch, {
      selectedCommandIds: ['cmd-canvas-task-move'],
      taskStore,
    })
    const replay = await applyAICommandBatch(batch, {
      selectedCommandIds: ['cmd-canvas-task-move'],
      taskStore,
    })

    const movedTask = taskStore.tasks.find(item => item.id === task.id)
    expect(movedTask?.canvasPosition).toEqual({ x: 144, y: 288 })
    expect(movedTask?.parentId).toBe('group-target')
    expect(updateTaskSpy).toHaveBeenCalledTimes(1)
    expect(first.appliedCommands[0]).toMatchObject({ kind: 'canvas.node.move', result: 'created' })
    expect(replay.appliedCommands[0]).toMatchObject({ kind: 'canvas.node.move', result: 'reused_existing' })
  })

  it('applies and rolls back AI canvas group moves through the canvas store', async () => {
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()
    const group = await canvasStore.createGroup({
      name: 'Moveable Group',
      type: 'custom',
      position: { x: 0, y: 0, width: 400, height: 300 },
      color: '#0EA5E9',
      layout: 'vertical',
      isVisible: true,
      isCollapsed: false,
    })
    const updateGroupSpy = vi.spyOn(canvasStore, 'updateGroup')

    const batch = buildAICommandBatchPreview({
      sourcePrompt: 'Move canvas group',
      sourceRunId: 'run-canvas-group-move',
      sourceMessageId: 'msg-canvas-group-move',
      dataUsed: { groupId: group.id },
      commands: [{
        id: 'cmd-canvas-group-move',
        kind: 'canvas.node.move',
        nodeType: 'group',
        nodeId: group.id,
        position: { x: 640, y: 120, width: 520, height: 360 },
      }],
      tasks: taskStore.tasks,
      canvasGroups: canvasStore.groups,
    })

    const first = await applyAICommandBatch(batch, {
      selectedCommandIds: ['cmd-canvas-group-move'],
      taskStore,
      canvasStore,
    })
    const replay = await applyAICommandBatch(batch, {
      selectedCommandIds: ['cmd-canvas-group-move'],
      taskStore,
      canvasStore,
    })

    expect(canvasStore.groups.find(item => item.id === group.id)?.position).toEqual({ x: 640, y: 120, width: 520, height: 360 })
    expect(updateGroupSpy).toHaveBeenCalledTimes(1)
    expect(first.appliedCommands[0]).toMatchObject({ kind: 'canvas.node.move', result: 'created' })
    expect(replay.appliedCommands[0]).toMatchObject({ kind: 'canvas.node.move', result: 'reused_existing' })

    await rollbackAICommandBatch(first.rollbackPointer, {
      taskStore,
      canvasStore,
    })

    expect(canvasStore.groups.find(item => item.id === group.id)?.position).toEqual({ x: 0, y: 0, width: 400, height: 300 })
  })

  it('previews AI calendar scheduling without mutating task instances', async () => {
    const taskStore = useTaskStore()
    const task = await taskStore.createTask({ title: 'Write launch follow-up' })

    const batch = buildAICommandBatchPreview({
      sourcePrompt: 'Protect a focus block',
      sourceRunId: 'run-calendar-preview',
      sourceMessageId: 'msg-calendar-preview',
      dataUsed: { taskId: task.id },
      commands: [{
        id: 'cmd-calendar-preview',
        kind: 'calendar.schedule_task',
        taskId: task.id,
        scheduledDate: '2026-06-16',
        scheduledTime: '10:30',
        duration: 90,
      }],
      tasks: taskStore.tasks,
    })

    expect(taskStore.tasks.find(item => item.id === task.id)?.instances).toEqual([])
    expect(batch.preview.commands).toEqual([
      expect.objectContaining({
        id: 'cmd-calendar-preview',
        kind: 'calendar.schedule_task',
        status: 'will_create',
        identity: expect.objectContaining({
          kind: 'calendar.schedule_task',
          targetEntityId: task.id,
          scope: `task:${task.id}:calendar`,
        }),
        diff: {
          entityType: 'calendar',
          before: null,
          after: expect.objectContaining({
            taskId: task.id,
            scheduledDate: '2026-06-16',
            scheduledTime: '10:30',
            duration: 90,
          }),
        },
      }),
    ])
  })

  it('applies AI calendar scheduling through task instances and reuses replay duplicates', async () => {
    const taskStore = useTaskStore()
    const task = await taskStore.createTask({
      title: 'Schedule launch work',
      estimatedDuration: 75,
    })
    const createInstanceSpy = vi.spyOn(taskStore, 'createTaskInstance')

    const batch = buildAICommandBatchPreview({
      sourcePrompt: 'Schedule launch work',
      sourceRunId: 'run-calendar-create',
      sourceMessageId: 'msg-calendar-create',
      dataUsed: { taskId: task.id },
      commands: [{
        id: 'cmd-calendar-create',
        kind: 'calendar.schedule_task',
        taskId: task.id,
        scheduledDate: '2026-06-16',
        scheduledTime: '11:00',
      }],
      tasks: taskStore.tasks,
    })

    const first = await applyAICommandBatch(batch, {
      selectedCommandIds: ['cmd-calendar-create'],
      taskStore,
    })
    const replay = await applyAICommandBatch(batch, {
      selectedCommandIds: ['cmd-calendar-create'],
      taskStore,
    })

    const scheduledTask = taskStore.tasks.find(item => item.id === task.id)
    expect(scheduledTask?.instances).toEqual([
      expect.objectContaining({
        taskId: task.id,
        scheduledDate: '2026-06-16',
        scheduledTime: '11:00',
        duration: 75,
        status: 'scheduled',
      }),
    ])
    expect(createInstanceSpy).toHaveBeenCalledTimes(1)
    expect(first.appliedCommands[0]).toMatchObject({ kind: 'calendar.schedule_task', result: 'created' })
    expect(replay.appliedCommands[0]).toMatchObject({ kind: 'calendar.schedule_task', result: 'reused_existing' })
  })

  it('rolls back AI calendar scheduling to the pre-AI task instance state', async () => {
    const taskStore = useTaskStore()
    const task = await taskStore.createTask({ title: 'Temporary calendar block' })

    const batch = buildAICommandBatchPreview({
      sourcePrompt: 'Schedule temporary block',
      sourceRunId: 'run-calendar-rollback',
      sourceMessageId: 'msg-calendar-rollback',
      dataUsed: { taskId: task.id },
      commands: [{
        id: 'cmd-calendar-rollback',
        kind: 'calendar.schedule_task',
        taskId: task.id,
        scheduledDate: '2026-06-16',
        scheduledTime: '14:00',
        duration: 45,
      }],
      tasks: taskStore.tasks,
    })

    const result = await applyAICommandBatch(batch, {
      selectedCommandIds: ['cmd-calendar-rollback'],
      taskStore,
    })
    expect(taskStore.tasks.find(item => item.id === task.id)?.instances).toHaveLength(1)

    await rollbackAICommandBatch(result.rollbackPointer, { taskStore })

    expect(taskStore.tasks.find(item => item.id === task.id)?.instances).toEqual([])
  })
})
