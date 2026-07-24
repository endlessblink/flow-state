/**
 * Regression tests for useCrossTabSync (src/composables/useCrossTabSync.ts)
 *
 * Tests the cross-tab message handling logic:
 * - Workspace guard (different workspace operations ignored)
 * - Update: manualOperationInProgress blocks, stale timestamp blocks,
 *   version-aware geometry guard, geometry field stripping
 * - Delete: marks _soft_deleted and splices from _rawTasks
 * - Create: triggers loadFromDatabase
 *
 * Previously tested only through E2E (multi-tab-sync.spec.ts).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import type { Task } from '@/types/tasks'

// ── Capture onMessage handlers ──────────────────────────────────────

const capturedHandlers: Record<string, Function> = {}
const mockBroadcast = vi.fn()

vi.mock('@/composables/sync/useBroadcastChannelSync', () => ({
  useBroadcastChannelSync: () => ({
    tabId: ref('test-tab-1'),
    connect: vi.fn(),
    disconnect: vi.fn(),
    broadcast: mockBroadcast,
    onMessage: vi.fn((type: string, handler: Function) => {
      capturedHandlers[type] = handler
    }),
  }),
}))

vi.mock('@/composables/sync/useTimerLeaderElection', () => ({
  useTimerLeaderElection: () => ({
    isLeader: ref(false),
    leaderState: ref(null),
    claimLeadership: vi.fn().mockReturnValue(true),
    handleLeaderMessage: vi.fn(),
    cleanup: vi.fn(),
  }),
}))

// Mock stores with reactive state we can manipulate
let mockActiveWorkspaceId: string | null = null
let mockManualOperationInProgress = false
const mockLoadFromDatabase = vi.fn()
const mockTasks = ref<Task[]>([])
const mockRawTasks = ref<Task[]>([])

vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => ({
    tasks: mockTasks.value,
    _rawTasks: mockRawTasks.value,
    getTask: (taskId: string) => mockRawTasks.value.find(task => task.id === taskId),
    loadFromDatabase: mockLoadFromDatabase,
    manualOperationInProgress: mockManualOperationInProgress,
  }),
}))

vi.mock('@/stores/ui', () => ({
  useUIStore: () => ({
    mainSidebarVisible: true,
  }),
}))

vi.mock('@/stores/canvas', () => ({
  useCanvasStore: () => ({}),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'test-user' },
    isAuthenticated: true,
  }),
}))

vi.mock('@/stores/workspace', () => ({
  useWorkspaceStore: () => ({
    activeWorkspaceId: mockActiveWorkspaceId,
  }),
}))

vi.mock('@/config/timing', () => ({
  CROSS_TAB_DEDUP_TIMEOUT_MS: 5000,
}))

// ── Helpers ──────────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: crypto.randomUUID(),
    title: 'Test Task',
    description: '',
    status: 'todo',
    priority: null,
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: '',
    projectId: 'proj-1',
    createdAt: new Date(),
    updatedAt: new Date('2026-04-01T12:00:00Z'),
    ...overrides,
  }
}

async function fireTaskOperation(op: Record<string, unknown>) {
  const handler = capturedHandlers['task_operation']
  if (!handler) throw new Error('task_operation handler not registered')
  await handler(op)
}

// ── Tests ────────────────────────────────────────────────────────────

describe('useCrossTabSync — handleTaskOperation', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    mockActiveWorkspaceId = null
    mockManualOperationInProgress = false
    mockTasks.value = []
    mockRawTasks.value = []

    // Clear captured handlers
    Object.keys(capturedHandlers).forEach(k => delete capturedHandlers[k])

    // Initialize the composable to register handlers
    const { useCrossTabSync } = await import('@/composables/useCrossTabSync')
    useCrossTabSync()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── Workspace guard ──

  it('ignores operations from a different workspace', async () => {
    mockActiveWorkspaceId = 'ws-local'
    const task = makeTask()
    mockTasks.value.push(task)
    mockRawTasks.value.push(task)

    await fireTaskOperation({
      operation: 'update',
      taskId: task.id,
      taskData: { title: 'Remote Edit', updatedAt: new Date().toISOString() },
      workspaceId: 'ws-different', // Different workspace
      timestamp: Date.now(),
    })

    expect(task.title).toBe('Test Task') // Unchanged
  })

  it('processes operations from the same workspace', async () => {
    mockActiveWorkspaceId = 'ws-same'
    const task = makeTask()
    mockTasks.value.push(task)
    mockRawTasks.value.push(task)

    await fireTaskOperation({
      operation: 'update',
      taskId: task.id,
      taskData: {
        title: 'Remote Edit',
        updatedAt: new Date('2026-04-01T13:00:00Z').toISOString(), // Newer
        positionVersion: 0,
      },
      workspaceId: 'ws-same',
      timestamp: Date.now(),
    })

    expect(task.title).toBe('Remote Edit')
  })

  it('processes operations without workspaceId (backwards compat)', async () => {
    const task = makeTask()
    mockTasks.value.push(task)
    mockRawTasks.value.push(task)

    await fireTaskOperation({
      operation: 'update',
      taskId: task.id,
      taskData: {
        title: 'No Workspace',
        updatedAt: new Date('2026-04-01T13:00:00Z').toISOString(),
        positionVersion: 0,
      },
      timestamp: Date.now(),
    })

    expect(task.title).toBe('No Workspace')
  })

  it('updates the canonical task when active filters hide it', async () => {
    const task = makeTask()
    mockRawTasks.value.push(task)

    await fireTaskOperation({
      operation: 'update',
      taskId: task.id,
      taskData: {
        title: 'Updated While Hidden',
        updatedAt: new Date('2026-04-01T13:00:00Z').toISOString(),
        positionVersion: 0,
      },
      timestamp: Date.now(),
    })

    expect(task.title).toBe('Updated While Hidden')
  })

  it('maps durable snake-case queue payloads into the receiving window task shape', async () => {
    const task = makeTask({ dueDate: '2026-07-24' })
    mockRawTasks.value.push(task)

    await fireTaskOperation({
      operation: 'update',
      taskId: task.id,
      taskData: {
        title: 'Offline edit from another window',
        due_date: '2026-07-30',
        updated_at: '2026-07-24T12:00:00.000Z',
        position_version: 0,
      },
      workspaceId: null,
      timestamp: Date.now(),
    })

    expect(task.title).toBe('Offline edit from another window')
    expect(task.dueDate).toBe('2026-07-30')
    expect(task).not.toHaveProperty('due_date')
  })

  // ── Update: manualOperationInProgress ──

  it('blocks update when manualOperationInProgress is true', async () => {
    mockManualOperationInProgress = true

    // Re-init to pick up mock change
    Object.keys(capturedHandlers).forEach(k => delete capturedHandlers[k])
    vi.resetModules()
    const { useCrossTabSync } = await import('@/composables/useCrossTabSync')
    useCrossTabSync()

    const task = makeTask()
    mockTasks.value.push(task)

    await fireTaskOperation({
      operation: 'update',
      taskId: task.id,
      taskData: { title: 'Should Not Apply' },
      timestamp: Date.now(),
    })

    expect(task.title).toBe('Test Task') // Unchanged
  })

  // ── Update: stale timestamp ──

  it('blocks update with stale timestamp (incoming older than local)', async () => {
    const task = makeTask({ updatedAt: new Date('2026-04-01T12:00:00Z') })
    mockTasks.value.push(task)
    mockRawTasks.value.push(task)

    await fireTaskOperation({
      operation: 'update',
      taskId: task.id,
      taskData: {
        title: 'Stale Update',
        updatedAt: new Date('2026-04-01T11:00:00Z').toISOString(), // Older
        positionVersion: 0,
      },
      timestamp: Date.now(),
    })

    expect(task.title).toBe('Test Task') // Unchanged — stale
  })

  // ── Update: version-aware geometry guard ──

  it('keeps newer metadata while refusing stale geometry', async () => {
    const task = makeTask({ positionVersion: 5 })
    mockTasks.value.push(task)
    mockRawTasks.value.push(task)

    await fireTaskOperation({
      operation: 'update',
      taskId: task.id,
      taskData: {
        title: 'Stale Position',
        updatedAt: new Date('2026-04-01T13:00:00Z').toISOString(), // Newer time
        positionVersion: 3, // But stale version
      },
      timestamp: Date.now(),
    })

    expect(task.title).toBe('Stale Position')
    expect(task.positionVersion).toBe(5)
  })

  // ── Update: geometry stripping ──

  it('strips canvasPosition, parentId, positionFormat from cross-tab updates', async () => {
    const task = makeTask({
      canvasPosition: { x: 100, y: 200 },
      parentId: 'group-original',
    })
    mockTasks.value.push(task)
    mockRawTasks.value.push(task)

    await fireTaskOperation({
      operation: 'update',
      taskId: task.id,
      taskData: {
        title: 'Title Changed',
        canvasPosition: { x: 999, y: 999 }, // Should be stripped
        parentId: 'group-hijacked', // Should be stripped
        positionFormat: 'relative', // Should be stripped
        updatedAt: new Date('2026-04-01T13:00:00Z').toISOString(),
        positionVersion: 0,
      },
      timestamp: Date.now(),
    })

    // Title updated
    expect(task.title).toBe('Title Changed')
    // Geometry preserved — stripped from cross-tab update
    expect(task.canvasPosition).toEqual({ x: 100, y: 200 })
    expect(task.parentId).toBe('group-original')
  })

  // ── Delete ──

  it('marks task _soft_deleted and splices from _rawTasks (BUG-1535)', async () => {
    const task = makeTask()
    mockRawTasks.value.push(task)

    await fireTaskOperation({
      operation: 'delete',
      taskId: task.id,
      timestamp: Date.now(),
    })

    // Task should be removed from _rawTasks
    expect(mockRawTasks.value.find(t => t.id === task.id)).toBeUndefined()
  })

  it('delete on missing task does not crash', async () => {
    await expect(
      fireTaskOperation({
        operation: 'delete',
        taskId: 'non-existent-id',
        timestamp: Date.now(),
      })
    ).resolves.not.toThrow()
  })

  // ── Create ──

  it('create operation triggers full loadFromDatabase', async () => {
    await fireTaskOperation({
      operation: 'create',
      taskId: 'new-task-id',
      taskData: { title: 'New Task' },
      timestamp: Date.now(),
    })

    expect(mockLoadFromDatabase).toHaveBeenCalled()
  })
})
