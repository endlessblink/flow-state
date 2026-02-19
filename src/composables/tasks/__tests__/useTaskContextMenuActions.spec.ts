import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTaskContextMenuActions } from '../useTaskContextMenuActions'

const createTaskWithUndo = vi.fn()
const updateTaskWithUndo = vi.fn()
const startTaskNowWithUndo = vi.fn()
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
    startTaskNowWithUndo
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
    requestSync
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
      } as any,
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

