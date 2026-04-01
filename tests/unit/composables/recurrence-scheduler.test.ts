/**
 * Regression tests for useRecurrenceScheduler (src/composables/useRecurrenceScheduler.ts)
 *
 * Tests the deferred clone creation logic that runs on app init.
 * Zero prior test coverage despite 6 distinct logic paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Task } from '@/types/tasks'

// ── Shared state for mocks ──────────────────────────────────────────

// These MUST be declared before vi.mock so the hoisted factories can reference them
const shared = {
  createTask: vi.fn().mockResolvedValue({}),
  rawTasks: [] as Task[],
  computeNextDueDate: vi.fn(),
}

const TODAY = '2026-04-01'

vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => ({
    _rawTasks: shared.rawTasks,
    createTask: shared.createTask,
  })
}))

vi.mock('@/utils/recurrenceUtils', () => ({
  computeNextDueDate: (...args: unknown[]) => shared.computeNextDueDate(...args),
}))

vi.mock('@/utils/dateUtils', () => ({
  formatDateKey: () => TODAY,
}))

vi.mock('@/constants/storageKeys', () => ({
  recurrenceLockKey: (date: string) => `recurrence-lock-${date}`,
}))

vi.mock('@/constants/dbTables', () => ({
  DB_TABLES: { TASKS: 'tasks' },
}))

vi.mock('@/services/auth/supabase', () => ({
  supabase: null,
}))

// localStorage mock
const localStorageMap = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => localStorageMap.get(key) ?? null,
  setItem: (key: string, value: string) => localStorageMap.set(key, value),
  removeItem: (key: string) => localStorageMap.delete(key),
  clear: () => localStorageMap.clear(),
  get length() { return localStorageMap.size },
  key: () => null,
})

// ── Helpers ──────────────────────────────────────────────────────────

function makeDoneRecurringTask(overrides: Partial<Task> = {}): Task {
  return {
    id: crypto.randomUUID(),
    title: 'Daily Standup',
    description: 'Team meeting',
    status: 'done',
    priority: 'medium',
    progress: 0,
    completedPomodoros: 1,
    subtasks: [{ id: '1', title: 'Prep', isCompleted: true }],
    dueDate: '2026-03-31',
    projectId: 'proj-1',
    estimatedPomodoros: 1,
    tags: ['meetings'],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-03-31'),
    recurrenceRule: { frequency: 'daily', interval: 1 },
    _soft_deleted: false,
    ...overrides,
  } as Task
}

import { useRecurrenceScheduler } from '@/composables/useRecurrenceScheduler'

// ── Tests ────────────────────────────────────────────────────────────

describe('useRecurrenceScheduler — processDeferred()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMap.clear()
    shared.rawTasks.length = 0
    shared.computeNextDueDate.mockReset()
    shared.createTask.mockReset().mockResolvedValue({})
  })

  function callProcessDeferred(): Promise<number> {
    const scheduler = useRecurrenceScheduler()
    return scheduler.processDeferred()
  }

  // ── localStorage lock ──

  it('returns 0 when localStorage lock is active (< 24h)', async () => {
    localStorageMap.set(`recurrence-lock-${TODAY}`, String(Date.now() - 1000))

    const result = await callProcessDeferred()

    expect(result).toBe(0)
    expect(shared.createTask).not.toHaveBeenCalled()
  })

  it('processes tasks when lock is stale (> 24h)', async () => {
    localStorageMap.set(`recurrence-lock-${TODAY}`, String(Date.now() - 90_000_000))

    const task = makeDoneRecurringTask()
    shared.rawTasks.push(task)
    shared.computeNextDueDate.mockReturnValue(TODAY)

    const result = await callProcessDeferred()

    expect(result).toBe(1)
    expect(shared.createTask).toHaveBeenCalledTimes(1)
  })

  it('sets lock before processing', async () => {
    const task = makeDoneRecurringTask()
    shared.rawTasks.push(task)
    shared.computeNextDueDate.mockReturnValue(TODAY)

    await callProcessDeferred()

    expect(localStorageMap.get(`recurrence-lock-${TODAY}`)).toBeDefined()
  })

  // ── No candidates ──

  it('returns 0 when no done tasks with recurrenceRule exist', async () => {
    shared.rawTasks.push(
      makeDoneRecurringTask({ status: 'todo' } as any),
      makeDoneRecurringTask({ recurrenceRule: undefined } as any),
    )

    const result = await callProcessDeferred()

    expect(result).toBe(0)
    expect(shared.createTask).not.toHaveBeenCalled()
  })

  it('skips soft-deleted tasks', async () => {
    shared.rawTasks.push(makeDoneRecurringTask({ _soft_deleted: true }))
    shared.computeNextDueDate.mockReturnValue(TODAY)

    const result = await callProcessDeferred()

    expect(result).toBe(0)
  })

  // ── Chain dedup ──

  it('creates only one clone per chain even with multiple done tasks', async () => {
    const chainId = crypto.randomUUID()
    shared.rawTasks.push(
      makeDoneRecurringTask({ recurrenceParentId: chainId, recurrenceCount: 1 }),
      makeDoneRecurringTask({ recurrenceParentId: chainId, recurrenceCount: 2 }),
    )
    shared.computeNextDueDate.mockReturnValue(TODAY)

    const result = await callProcessDeferred()

    expect(result).toBe(1)
    expect(shared.createTask).toHaveBeenCalledTimes(1)
  })

  // ── Active successor check ──

  it('skips chain when non-done active task exists in the chain', async () => {
    const chainId = crypto.randomUUID()
    shared.rawTasks.push(
      makeDoneRecurringTask({ recurrenceParentId: chainId }),
      makeDoneRecurringTask({
        id: crypto.randomUUID(),
        recurrenceParentId: chainId,
        status: 'todo',
        _soft_deleted: false,
      } as any),
    )
    shared.computeNextDueDate.mockReturnValue(TODAY)

    const result = await callProcessDeferred()

    expect(result).toBe(0)
    expect(shared.createTask).not.toHaveBeenCalled()
  })

  // ── Today-clone check ──

  it('skips chain when a clone for today already exists', async () => {
    const chainId = crypto.randomUUID()
    shared.rawTasks.push(
      makeDoneRecurringTask({ recurrenceParentId: chainId }),
      makeDoneRecurringTask({
        id: crypto.randomUUID(),
        recurrenceParentId: chainId,
        status: 'done',
        dueDate: TODAY,
        _soft_deleted: false,
      } as any),
    )
    shared.computeNextDueDate.mockReturnValue(TODAY)

    const result = await callProcessDeferred()

    expect(result).toBe(0)
  })

  // ── Skip-past-missed ──

  it('skips past missed occurrences to land on today', async () => {
    const task = makeDoneRecurringTask({ dueDate: '2026-03-25' })
    shared.rawTasks.push(task)

    // Simulate: computeNextDueDate returns advancing dates
    let callCount = 0
    shared.computeNextDueDate.mockImplementation(() => {
      callCount++
      const dates = ['2026-03-26', '2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31', TODAY]
      return dates[Math.min(callCount - 1, dates.length - 1)]
    })

    const result = await callProcessDeferred()

    expect(result).toBe(1)
    expect(shared.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ dueDate: TODAY })
    )
  })

  // ── Clone field correctness ──

  it('creates clone with correct fields from parent task', async () => {
    const task = makeDoneRecurringTask({
      title: 'Weekly Review',
      description: 'Review progress',
      priority: 'high',
      projectId: 'proj-weekly',
      tags: ['review', 'weekly'],
      subtasks: [
        { id: '1', title: 'Check metrics', isCompleted: true },
        { id: '2', title: 'Update plan', isCompleted: true },
      ],
      estimatedPomodoros: 3,
      recurrenceRule: { frequency: 'weekly', interval: 1 } as any,
    })
    shared.rawTasks.push(task)
    shared.computeNextDueDate.mockReturnValue(TODAY)

    await callProcessDeferred()

    expect(shared.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Weekly Review',
        description: 'Review progress',
        priority: 'high',
        projectId: 'proj-weekly',
        tags: ['review', 'weekly'],
        status: 'todo',
        isInInbox: true,
        dueDate: TODAY,
        recurrenceRule: { frequency: 'weekly', interval: 1 },
        recurrenceParentId: task.recurrenceParentId || task.id,
      })
    )

    // Subtasks should be reset to uncompleted
    const call = shared.createTask.mock.calls[0][0]
    expect(call.subtasks.every((st: any) => st.isCompleted === false)).toBe(true)
  })

  // ── Error handling ──

  it('catches DB unique constraint error (23505) gracefully', async () => {
    const task = makeDoneRecurringTask()
    shared.rawTasks.push(task)
    shared.computeNextDueDate.mockReturnValue(TODAY)
    shared.createTask.mockRejectedValueOnce({ code: '23505', message: 'duplicate key' })

    const result = await callProcessDeferred()
    expect(result).toBe(0) // Clone wasn't counted since it was a dup
  })

  it('catches generic unique constraint message gracefully', async () => {
    const task = makeDoneRecurringTask()
    shared.rawTasks.push(task)
    shared.computeNextDueDate.mockReturnValue(TODAY)
    shared.createTask.mockRejectedValueOnce(new Error('unique constraint violation'))

    const result = await callProcessDeferred()
    expect(result).toBe(0)
  })
})
