import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTaskContextMenuActions } from '../useTaskContextMenuActions'
import type { Task } from '@/types/tasks'

const createTaskWithUndo = vi.fn()
const updateTaskWithUndo = vi.fn()
const startTaskNowWithUndo = vi.fn()
const getTask = vi.fn()
const requestSync = vi.fn()
const startTimer = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({
    currentRoute: { value: { name: 'calendar' } },
    push: vi.fn()
  })
}))

vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => ({
    createTaskWithUndo,
    updateTaskWithUndo,
    startTaskNowWithUndo,
    getTask
  })
}))

vi.mock('@/stores/timer', () => ({
  useTimerStore: () => ({
    settings: { workDuration: 25 },
    startTimer
  })
}))

vi.mock('@/stores/canvas', () => ({
  useCanvasStore: () => ({
    requestSync,
    _rawGroups: []
  })
}))

vi.mock('@/composables/canvas/useSmartGroupMatcher', () => ({
  findMatchingGroupForDueDate: () => null
}))

vi.mock('@/composables/canvas/useMoveToCanvasGroup', () => ({
  useMoveToCanvasGroup: () => ({
    moveToGroupWithToast: vi.fn()
  })
}))

describe('useTaskContextMenuActions duplicateTask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('duplicates the active calendar instance when invoked from calendar context menu', async () => {
    const props = {
      task: {
        id: 'task-1',
        title: 'Calendar Task',
        description: 'desc',
        status: 'planned',
        priority: 'medium',
        estimatedDuration: 45,
        instances: [
          {
            id: 'inst-1',
            scheduledDate: '2026-02-19',
            scheduledTime: '09:00',
            duration: 45,
            status: 'scheduled'
          }
        ],
        // Added by ModalManager for calendar-origin context menu calls
        instanceId: 'inst-1',
        isCalendarEvent: true
      } as unknown as Task,
      contextTask: null,
      selectedCount: 1
    }
    const emit = vi.fn()

    const { duplicateTask } = useTaskContextMenuActions(props, emit)
    await duplicateTask()

    expect(createTaskWithUndo).toHaveBeenCalledTimes(1)
    const payload = createTaskWithUndo.mock.calls[0][0]

    expect(payload.title).toBe('Calendar Task (Copy)')
    expect(payload.instances).toBeTruthy()
    expect(payload.instances).toHaveLength(1)
    expect(payload.instances[0]).toMatchObject({
      scheduledDate: '2026-02-19',
      scheduledTime: '09:00',
      duration: 45,
      status: 'scheduled'
    })
    expect(typeof payload.instances[0].id).toBe('string')
    expect(emit).toHaveBeenCalledWith('close')
  })
})

/**
 * BUG-1909: quick-setting a due date from a task card must reschedule stale
 * PAST calendar instances onto the picked date. Otherwise the badge
 * (computeDueStatus — instances stay authoritative for recurring tasks) keeps
 * showing "Overdue <old date>" and the click looks like a no-op.
 */
describe('useTaskContextMenuActions setDueDate stale-instance reconcile (BUG-1909)', () => {
  const makeProps = (task: Partial<Task>) => ({
    task: {
      id: 'task-1',
      title: 'Weekly plan',
      status: 'planned',
      ...task
    } as unknown as Task,
    contextTask: null,
    selectedCount: 1
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 3, 11, 0, 0)) // 2026-07-03 local
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('USER REPRO: "Next Week" on a card with a stale past instance moves the instance too', async () => {
    const props = makeProps({
      dueDate: '2026-05-29',
      recurrenceRule: { pattern: 'weekly', interval: 1 } as unknown as Task['recurrenceRule'],
      instances: [
        { id: 'inst-1', scheduledDate: '2026-05-30', scheduledTime: '10:00', duration: 60 }
      ] as unknown as Task['instances']
    })
    getTask.mockReturnValue(props.task)
    const emit = vi.fn()

    const { setDueDate } = useTaskContextMenuActions(props, emit)
    await setDueDate('nextweek')

    expect(updateTaskWithUndo).toHaveBeenCalledTimes(1)
    const [taskId, payload] = updateTaskWithUndo.mock.calls[0]
    expect(taskId).toBe('task-1')
    expect(payload.dueDate).toBe('2026-07-10')
    expect(payload.instances).toHaveLength(1)
    expect(payload.instances[0]).toMatchObject({ id: 'inst-1', scheduledDate: '2026-07-10' })
  })

  it('does not write instances back when none are stale (no double-write)', async () => {
    const props = makeProps({
      dueDate: '2026-07-01',
      instances: [
        { id: 'inst-1', scheduledDate: '2026-07-05', scheduledTime: '10:00', duration: 60 }
      ] as unknown as Task['instances']
    })
    getTask.mockReturnValue(props.task)
    const emit = vi.fn()

    const { setDueDate } = useTaskContextMenuActions(props, emit)
    await setDueDate('tomorrow')

    expect(updateTaskWithUndo).toHaveBeenCalledTimes(1)
    const [, payload] = updateTaskWithUndo.mock.calls[0]
    expect(payload.dueDate).toBe('2026-07-04')
    expect(payload).not.toHaveProperty('instances')
  })

  it('calendar-event path still moves the clicked instance AND reconciles other stale ones', async () => {
    const props = makeProps({
      dueDate: '2026-05-29',
      instances: [
        { id: 'inst-old', scheduledDate: '2026-05-30', scheduledTime: '10:00', duration: 60 },
        { id: 'inst-clicked', scheduledDate: '2026-07-06', scheduledTime: '12:00', duration: 30 }
      ] as unknown as Task['instances']
    })
    ;(props.task as unknown as Record<string, unknown>).instanceId = 'inst-clicked'
    ;(props.task as unknown as Record<string, unknown>).isCalendarEvent = true
    getTask.mockReturnValue(props.task)
    const emit = vi.fn()

    const { setDueDate } = useTaskContextMenuActions(props, emit)
    await setDueDate('nextweek')

    const [, payload] = updateTaskWithUndo.mock.calls[0]
    expect(payload.dueDate).toBe('2026-07-10')
    const byId = Object.fromEntries((payload.instances as Array<{ id: string; scheduledDate: string }>).map(i => [i.id, i.scheduledDate]))
    expect(byId['inst-clicked']).toBe('2026-07-10') // explicit move (TASK-1362 behavior preserved)
    expect(byId['inst-old']).toBe('2026-07-10')     // stale past instance follows too
  })
})
