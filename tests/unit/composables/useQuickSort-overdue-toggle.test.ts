/**
 * TASK-1786: Quick Sort "Include overdue & no-due" toggle regression tests
 *
 * Covers:
 * - isOverdueTask / isMissingDueDateTask predicates (edge cases)
 * - Queue filter with toggle OFF (default) excludes overdue + no-due tasks that have a project
 * - Queue filter with toggle ON includes them
 * - Toggle does not strip projectId or otherwise mutate tasks
 * - Done / soft-deleted / pinned tasks still excluded when toggle is ON
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Task } from '@/types/tasks'

// --- Mocks for deps pulled in by quickSort store / useQuickSort ----------------
vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    fetchQuickSortHistory: vi.fn().mockResolvedValue([]),
  })
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: 'test-user-id' } })
}))
vi.mock('@/services/offline/writeQueueDB', () => ({
  enqueueOperation: vi.fn().mockResolvedValue({ id: 1 })
}))
vi.mock('@/utils/supabaseMappers', () => ({
  toSupabaseQuickSortSession: vi.fn().mockReturnValue({})
}))

const localStore: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((k: string) => localStore[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { localStore[k] = v }),
  removeItem: vi.fn((k: string) => { delete localStore[k] }),
  clear: vi.fn(() => { Object.keys(localStore).forEach(k => delete localStore[k]) }),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

// Build a synthetic date relative to "now" so tests are timezone-stable.
function daysFromNow(days: number): string {
  const d = new Date()
  d.setHours(12, 0, 0, 0) // mid-day, avoids DST boundary surprises
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: `t-${Math.random().toString(36).slice(2, 9)}`,
    title: 'Test',
    description: '',
    status: 'todo',
    priority: null,
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: '',
    projectId: 'project-real-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Task
}

describe('TASK-1786: isOverdueTask / isMissingDueDateTask predicates', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  afterEach(() => vi.restoreAllMocks())

  it('isOverdueTask: true for past dueDate with status=todo', async () => {
    const { useSmartViews } = await import('@/composables/useSmartViews')
    const { isOverdueTask } = useSmartViews()
    expect(isOverdueTask(makeTask({ dueDate: daysFromNow(-1) }))).toBe(true)
    expect(isOverdueTask(makeTask({ dueDate: daysFromNow(-30) }))).toBe(true)
  })

  it('isOverdueTask: false for today, future, missing, or invalid dueDate', async () => {
    const { useSmartViews } = await import('@/composables/useSmartViews')
    const { isOverdueTask } = useSmartViews()
    expect(isOverdueTask(makeTask({ dueDate: daysFromNow(0) }))).toBe(false)
    expect(isOverdueTask(makeTask({ dueDate: daysFromNow(1) }))).toBe(false)
    expect(isOverdueTask(makeTask({ dueDate: '' }))).toBe(false)
    expect(isOverdueTask(makeTask({ dueDate: 'not-a-date' }))).toBe(false)
  })

  it('isOverdueTask: false for done tasks even when past due', async () => {
    const { useSmartViews } = await import('@/composables/useSmartViews')
    const { isOverdueTask } = useSmartViews()
    expect(isOverdueTask(makeTask({ status: 'done', dueDate: daysFromNow(-5) }))).toBe(false)
  })

  it('isMissingDueDateTask: true when dueDate is empty/whitespace and not done', async () => {
    const { useSmartViews } = await import('@/composables/useSmartViews')
    const { isMissingDueDateTask } = useSmartViews()
    expect(isMissingDueDateTask(makeTask({ dueDate: '' }))).toBe(true)
    expect(isMissingDueDateTask(makeTask({ dueDate: '   ' }))).toBe(true)
  })

  it('isMissingDueDateTask: false when dueDate present, or when status=done', async () => {
    const { useSmartViews } = await import('@/composables/useSmartViews')
    const { isMissingDueDateTask } = useSmartViews()
    expect(isMissingDueDateTask(makeTask({ dueDate: daysFromNow(1) }))).toBe(false)
    expect(isMissingDueDateTask(makeTask({ status: 'done', dueDate: '' }))).toBe(false)
  })
})

describe('TASK-1786: Quick Sort queue with includeOverdueInQuickSort toggle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  afterEach(() => vi.restoreAllMocks())

  async function setup(tasks: Task[]) {
    const { useTaskStore } = await import('@/stores/tasks')
    const { useSettingsStore } = await import('@/stores/settings')
    const { useQuickSort } = await import('@/composables/useQuickSort')

    const taskStore = useTaskStore()
    const settings = useSettingsStore()

    // Inject tasks directly into the raw store array (same pattern as other unit tests)
    taskStore._rawTasks.length = 0
    taskStore._rawTasks.push(...tasks)

    const qs = useQuickSort()
    return { qs, settings, taskStore }
  }

  it('OFF (default): excludes overdue & no-due tasks that already have a project', async () => {
    const tasks: Task[] = [
      makeTask({ id: 'overdue-with-project', projectId: 'project-real-1', dueDate: daysFromNow(-2) }),
      makeTask({ id: 'no-due-with-project', projectId: 'project-real-1', dueDate: '' }),
      makeTask({ id: 'truly-uncategorized', projectId: '', dueDate: '' }),
    ]
    const { qs, settings } = await setup(tasks)
    expect(settings.includeOverdueInQuickSort).toBe(false)

    const ids = qs.uncategorizedTasks.value.map(t => t.id)
    expect(ids).toContain('truly-uncategorized')
    expect(ids).not.toContain('overdue-with-project')
    expect(ids).not.toContain('no-due-with-project')
  })

  it('ON: includes overdue tasks (even with a project assigned)', async () => {
    const tasks: Task[] = [
      makeTask({ id: 'overdue-with-project', projectId: 'project-real-1', dueDate: daysFromNow(-3) }),
    ]
    const { qs, settings } = await setup(tasks)
    settings.includeOverdueInQuickSort = true

    const ids = qs.uncategorizedTasks.value.map(t => t.id)
    expect(ids).toContain('overdue-with-project')
  })

  it('ON: includes no-due-date tasks (even with a project assigned)', async () => {
    const tasks: Task[] = [
      makeTask({ id: 'no-due-with-project', projectId: 'project-real-1', dueDate: '' }),
    ]
    const { qs, settings } = await setup(tasks)
    settings.includeOverdueInQuickSort = true

    const ids = qs.uncategorizedTasks.value.map(t => t.id)
    expect(ids).toContain('no-due-with-project')
  })

  it('ON: still excludes done, soft-deleted, and pinned tasks', async () => {
    const tasks: Task[] = [
      makeTask({ id: 'overdue-done', projectId: 'p1', dueDate: daysFromNow(-2), status: 'done' }),
      makeTask({ id: 'overdue-soft-deleted', projectId: 'p1', dueDate: daysFromNow(-2), _soft_deleted: true }),
      makeTask({ id: 'no-due-pinned', projectId: 'p1', dueDate: '', isPinned: true } as Partial<Task>),
      makeTask({ id: 'overdue-keep', projectId: 'p1', dueDate: daysFromNow(-2) }),
    ]
    const { qs, settings } = await setup(tasks)
    settings.includeOverdueInQuickSort = true

    const ids = qs.uncategorizedTasks.value.map(t => t.id)
    expect(ids).toContain('overdue-keep')
    expect(ids).not.toContain('overdue-done')
    expect(ids).not.toContain('overdue-soft-deleted')
    expect(ids).not.toContain('no-due-pinned')
  })

  it('ON: future-dated, non-overdue tasks with a project remain excluded', async () => {
    const tasks: Task[] = [
      makeTask({ id: 'future', projectId: 'p1', dueDate: daysFromNow(5) }),
    ]
    const { qs, settings } = await setup(tasks)
    settings.includeOverdueInQuickSort = true

    const ids = qs.uncategorizedTasks.value.map(t => t.id)
    expect(ids).not.toContain('future')
  })

  it('non-destructive: toggling ON does not mutate task.projectId or task.isUncategorized', async () => {
    const overdue = makeTask({ id: 'overdue', projectId: 'project-real-1', dueDate: daysFromNow(-1) })
    const noDue = makeTask({ id: 'no-due', projectId: 'project-real-1', dueDate: '' })
    const { qs, settings, taskStore } = await setup([overdue, noDue])

    settings.includeOverdueInQuickSort = true
    // Force the computed to evaluate
    expect(qs.uncategorizedTasks.value.length).toBe(2)

    const overdueAfter = taskStore._rawTasks.find(t => t.id === 'overdue')!
    const noDueAfter = taskStore._rawTasks.find(t => t.id === 'no-due')!
    expect(overdueAfter.projectId).toBe('project-real-1')
    expect(noDueAfter.projectId).toBe('project-real-1')
    expect(overdueAfter.isUncategorized).toBeFalsy()
    expect(noDueAfter.isUncategorized).toBeFalsy()
  })

  it('ghost protection: excludes tasks with empty or whitespace-only titles', async () => {
    const tasks: Task[] = [
      makeTask({ id: 'real', projectId: '', title: 'Real task' }),
      makeTask({ id: 'ghost-empty', projectId: '', title: '' }),
      makeTask({ id: 'ghost-whitespace', projectId: '', title: '   ' }),
      makeTask({ id: 'ghost-null', projectId: '', title: undefined as unknown as string }),
    ]
    const { qs } = await setup(tasks)
    const ids = qs.uncategorizedTasks.value.map(t => t.id)
    expect(ids).toContain('real')
    expect(ids).not.toContain('ghost-empty')
    expect(ids).not.toContain('ghost-whitespace')
    expect(ids).not.toContain('ghost-null')
  })

  it('ghost protection: also applies when overdue toggle is ON', async () => {
    const tasks: Task[] = [
      makeTask({ id: 'real-overdue', projectId: 'p1', title: 'Real overdue', dueDate: daysFromNow(-1) }),
      makeTask({ id: 'ghost-overdue', projectId: 'p1', title: '', dueDate: daysFromNow(-1) }),
    ]
    const { qs, settings } = await setup(tasks)
    settings.includeOverdueInQuickSort = true
    const ids = qs.uncategorizedTasks.value.map(t => t.id)
    expect(ids).toContain('real-overdue')
    expect(ids).not.toContain('ghost-overdue')
  })

  it('ghost protection: warns once to console when ghost rows are skipped', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const tasks: Task[] = [
        makeTask({ id: 'real', projectId: '', title: 'Real' }),
        makeTask({ id: 'ghost-1', projectId: '', title: '' }),
        makeTask({ id: 'ghost-2', projectId: '', title: '' }),
      ]
      const { qs } = await setup(tasks)
      // Read the computed twice; warning must fire only once
      qs.uncategorizedTasks.value
      qs.uncategorizedTasks.value
      const ghostWarnings = warnSpy.mock.calls.filter(args =>
        typeof args[0] === 'string' && args[0].includes('[QuickSort]') && args[0].includes('empty title')
      )
      expect(ghostWarnings.length).toBe(1)
      expect(ghostWarnings[0][0]).toContain('Skipped 2')
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('toggle is reactive: flipping the setting recomputes the queue without restart', async () => {
    const tasks: Task[] = [
      makeTask({ id: 'overdue-with-project', projectId: 'project-real-1', dueDate: daysFromNow(-2) }),
    ]
    const { qs, settings } = await setup(tasks)
    expect(qs.uncategorizedTasks.value.map(t => t.id)).not.toContain('overdue-with-project')

    settings.includeOverdueInQuickSort = true
    expect(qs.uncategorizedTasks.value.map(t => t.id)).toContain('overdue-with-project')

    settings.includeOverdueInQuickSort = false
    expect(qs.uncategorizedTasks.value.map(t => t.id)).not.toContain('overdue-with-project')
  })
})
