import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMockTask } from '../../factories'

const { rpc, enqueue, saveTask, saveTasks } = vi.hoisted(() => ({
  rpc: vi.fn(),
  enqueue: vi.fn(),
  saveTask: vi.fn(),
  saveTasks: vi.fn(),
}))

vi.mock('@/services/auth/supabase', () => ({ supabase: { rpc } }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: '00000000-0000-4000-8000-000000000001' },
    isAuthenticated: true,
  }),
}))
vi.mock('@/stores/workspace', () => ({
  useWorkspaceStore: () => ({
    activeWorkspaceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  }),
}))
vi.mock('@/composables/sync/useSyncOrchestrator', () => ({
  useSyncOrchestrator: () => ({
    enqueue,
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
vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    saveTask,
    saveTasks,
    deleteTask: vi.fn(),
    fetchTasks: vi.fn().mockResolvedValue([]),
    fetchGroups: vi.fn().mockResolvedValue([]),
    saveGroup: vi.fn(),
    deleteGroup: vi.fn(),
    fetchUserSettings: vi.fn().mockResolvedValue(null),
    saveProject: vi.fn(),
    saveProjects: vi.fn(),
    fetchProjects: vi.fn().mockResolvedValue([]),
    deleteProject: vi.fn(),
  }),
}))
vi.mock('@/composables/useDatabase', () => ({
  useDatabase: () => ({ save: vi.fn(), load: vi.fn().mockResolvedValue(null) }),
  DB_KEYS: { TASKS: 'tasks', PROJECTS: 'projects', CANVAS: 'canvas' },
}))
vi.mock('@/composables/useGamificationHooks', () => ({
  useGamificationHooks: () => ({ onTaskCompleted: vi.fn() }),
}))
vi.mock('@/stores/timer', () => ({
  useTimerStore: () => ({ currentTaskId: null, isTimerActive: false, stopTimer: vi.fn() }),
}))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }))
vi.mock('@/services/offline/readCacheDB', () => ({
  cacheTasks: vi.fn(),
  cacheProjects: vi.fn(),
}))
vi.mock('@/utils/demoContentGuard', () => ({ guardTaskCreation: vi.fn() }))

import { useTaskStore } from '@/stores/tasks'
import { canonicalJsonHash } from '@/services/sync/canonicalSubtaskBatch'

const TASK_ID = '11111111-1111-4111-8111-111111111111'
const WORKSPACE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const existing = {
  id: 'existing-step',
  parentTaskId: TASK_ID,
  title: 'Collect sources',
  description: '',
  completedPomodoros: 0,
  isCompleted: false,
  createdAt: new Date('2026-07-15T20:00:00Z'),
  updatedAt: new Date('2026-07-15T20:00:00Z'),
}

function installCanonicalRpc(nextSubtasks: unknown[]) {
  rpc.mockImplementation(async (_name: string, args: Record<string, unknown>) => {
    const operationId = args.p_operation_id
    const readBack = {
      id: TASK_ID,
      title: 'Prepare launch brief',
      status: 'todo',
      workspaceId: WORKSPACE_ID,
      canonicalRevision: args.p_preview ? 7 : 8,
      canonicalUpdatedAt: '2026-07-15T21:01:00.000Z',
      subtasks: args.p_preview ? [existing] : nextSubtasks,
    }
    if (args.p_preview) {
      return {
        data: {
          ok: true,
          result: 'preview',
          contractVersion: 'task-v1',
          action: 'subtask_batch',
          operationId,
          taskId: TASK_ID,
          baseRevision: 7,
          requestHash: 'c'.repeat(64),
          previewDigest: 'a'.repeat(64),
          previewExpiresAt: '2026-07-15T21:15:00.000Z',
          normalizedPayload: { taskId: TASK_ID, operations: args.p_operations },
          readBack,
        },
        error: null,
      }
    }
    const receipt = {
      ok: true,
      status: 'committed',
      contractVersion: 'task-v1',
      operationId,
      requestHash: 'c'.repeat(64),
      source: 'web-pwa',
      entityType: 'task',
      action: 'subtask_batch',
      entityId: TASK_ID,
      canonicalRevision: 8,
      canonicalUpdatedAt: readBack.canonicalUpdatedAt,
      changeSequence: 61,
      replayed: false,
      committedAt: '2026-07-15T21:01:00.010Z',
      affected: [{
        entityId: TASK_ID,
        entityType: 'task',
        action: 'update',
        canonicalRevision: 8,
        changeSequence: 61,
        readBack,
        readBackHash: await canonicalJsonHash(readBack),
      }],
      readBack,
      readBackHash: await canonicalJsonHash(readBack),
    }
    return {
      data: {
        ok: true,
        result: 'committed',
        operationId,
        action: 'subtask_batch',
        taskId: TASK_ID,
        requestHash: 'c'.repeat(64),
        receipt,
      },
      error: null,
    }
  })
}

function parentTask() {
  return createMockTask({
    id: TASK_ID,
    title: 'Prepare launch brief',
    workspaceId: WORKSPACE_ID,
    canonicalRevision: 7,
    subtasks: [existing],
  })
}

describe('task store canonical subtask authority', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('reconciles create from canonical read-back without queue or whole-task fallback', async () => {
    const canonicalCreated = {
      id: '21111111-1111-4111-8111-111111111111',
      clientId: 'renderer-client-step',
      parentTaskId: TASK_ID,
      title: 'Draft the smallest useful outline',
      isCompleted: false,
      order: 1,
    }
    installCanonicalRpc([existing, canonicalCreated])
    const store = useTaskStore()
    store._rawTasks.push(parentTask())

    const created = await store.createSubtask(TASK_ID, {
      id: 'renderer-client-step',
      title: canonicalCreated.title,
    })

    expect(created).toMatchObject(canonicalCreated)
    expect(store._rawTasks[0].subtasks).toEqual([existing, canonicalCreated])
    expect(store._rawTasks[0].canonicalRevision).toBe(8)
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc.mock.calls[0][0]).toBe('flowstate_subtask_batch_v1')
    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_base_revision: 7,
      p_workspace_id: WORKSPACE_ID,
      p_source: 'web-pwa',
      p_preview: true,
    })
    expect(rpc.mock.calls[1][1].p_operation_id).toBe(rpc.mock.calls[0][1].p_operation_id)
    expect(enqueue).not.toHaveBeenCalled()
    expect(saveTask).not.toHaveBeenCalled()
    expect(saveTasks).not.toHaveBeenCalled()
  })

  it('keeps local state unchanged when canonical authority reports a stale revision', async () => {
    rpc.mockResolvedValue({
      data: {
        ok: false,
        result: 'conflict',
        error: { code: 'stale_revision', message: 'Task changed', currentRevision: 9 },
      },
      error: null,
    })
    const store = useTaskStore()
    store._rawTasks.push(parentTask())
    const beforeSubtasks = store._rawTasks[0].subtasks.map(subtask => ({ ...subtask }))
    const beforeRevision = store._rawTasks[0].canonicalRevision

    await expect(store.updateSubtask(TASK_ID, existing.id, { title: 'Changed locally' }))
      .rejects.toMatchObject({ code: 'stale_revision' })

    expect(store._rawTasks[0].subtasks).toEqual(beforeSubtasks)
    expect(store._rawTasks[0].canonicalRevision).toBe(beforeRevision)
    expect(enqueue).not.toHaveBeenCalled()
    expect(saveTask).not.toHaveBeenCalled()
    expect(saveTasks).not.toHaveBeenCalled()
  })

  it('routes whole-array editor and mini-canvas updates through canonical operations', async () => {
    const updated = { ...existing, title: 'Collect only verified sources' }
    installCanonicalRpc([updated])
    const store = useTaskStore()
    store._rawTasks.push(parentTask())

    await store.updateTask(TASK_ID, { subtasks: [updated] })

    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc.mock.calls[0][1].p_operations).toEqual([{
      kind: 'update',
      subtaskId: existing.id,
      title: updated.title,
      order: 0,
    }])
    expect(store._rawTasks[0].subtasks).toEqual([updated])
    expect(store._rawTasks[0].canonicalRevision).toBe(8)
    expect(enqueue).not.toHaveBeenCalled()
    expect(saveTask).not.toHaveBeenCalled()
    expect(saveTasks).not.toHaveBeenCalled()
  })

  it('does not swallow mini-canvas position or pomodoro progress changes', async () => {
    const updated = {
      ...existing,
      canvasPosition: { x: 420, y: 260 },
      completedPomodoros: 2,
    }
    installCanonicalRpc([updated])
    const store = useTaskStore()
    store._rawTasks.push(parentTask())

    await store.updateTask(TASK_ID, { subtasks: [updated] })

    expect(rpc.mock.calls[0][1].p_operations).toEqual([{
      kind: 'update',
      subtaskId: existing.id,
      completedPomodoros: 2,
      canvasPosition: { x: 420, y: 260 },
      order: 0,
    }])
    expect(store._rawTasks[0].subtasks).toEqual([updated])
    expect(enqueue).not.toHaveBeenCalled()
    expect(saveTask).not.toHaveBeenCalled()
  })
})
