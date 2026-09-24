import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const tasks = vi.hoisted(() => ({
  calendarFilteredTasks: [] as any[],
  getTask: vi.fn(),
  updateTaskWithUndo: vi.fn(),
}))

vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => tasks,
  getTaskInstances: (task: { instances?: unknown[] }) => task.instances ?? [],
}))
vi.mock('@/stores/settings', () => ({ useSettingsStore: () => ({ weekStartsOn: 0 }) }))
vi.mock('@/composables/useCalendarCore', () => ({
  useCalendarCore: () => ({
    getPriorityColor: () => '#000',
    getDateString: (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
  }),
}))
vi.mock('@/composables/useDragAndDrop', () => ({ useDragAndDrop: () => ({ endDrag: vi.fn() }) }))
vi.mock('@/utils/recurrenceUtils', () => ({ generateVirtualCalendarEvents: () => [] }))

import { useCalendarMonthView } from '@/composables/calendar/useCalendarMonthView'

describe('Calendar month explicit timing', () => {
  beforeEach(() => {
    tasks.calendarFilteredTasks = []
    tasks.getTask.mockReset()
    tasks.updateTaskWithUndo.mockReset()
  })

  it('shows only explicitly timed instances, never a date-only task at a fallback hour', () => {
    tasks.calendarFilteredTasks = [
      { id: 'date-only', title: 'Due today', instances: [{ id: 'untimed', scheduledDate: '2026-09-24' }] },
      { id: 'timed', title: 'Meeting', instances: [{ id: 'meeting', scheduledDate: '2026-09-24', scheduledTime: '14:00' }] },
    ]
    const view = useCalendarMonthView(ref(new Date(2026, 8, 24)), ref(null))
    const day = view.monthDays.value.find(item => item.dateString === '2026-09-24')

    expect(day?.events.map(event => event.taskId)).toEqual(['timed'])
    expect(day?.events[0].startTime.getHours()).toBe(14)
  })

  it('a month-cell date move removes the active time and preserves completed history', async () => {
    const task = {
      id: 'dishes',
      dueDate: '2026-09-23',
      instances: [
        { id: 'old', scheduledDate: '2026-09-22', scheduledTime: '14:00', status: 'completed' },
        { id: 'active', scheduledDate: '2026-09-23', scheduledTime: '14:00' },
      ],
    }
    tasks.getTask.mockReturnValue(task)
    const view = useCalendarMonthView(ref(new Date(2026, 8, 24)), ref(null))

    await view.handleMonthDrop({
      preventDefault: vi.fn(),
      dataTransfer: { getData: () => JSON.stringify({ taskId: 'dishes', instanceId: 'active' }) },
    } as unknown as DragEvent, '2026-09-24')

    expect(tasks.updateTaskWithUndo).toHaveBeenCalledWith('dishes', expect.objectContaining({
      dueDate: '2026-09-24',
      dueTime: undefined,
      instances: [
        expect.objectContaining({ id: 'old', scheduledDate: '2026-09-22', scheduledTime: '14:00', status: 'completed' }),
        expect.objectContaining({ id: 'active', scheduledDate: '2026-09-24', scheduledTime: undefined }),
      ],
    }))
  })
})
