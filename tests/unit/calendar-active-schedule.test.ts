import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useCalendarDayView } from '@/composables/calendar/useCalendarDayView'
import { useCalendarWeekView } from '@/composables/calendar/useCalendarWeekView'
import { useCalendarMonthView } from '@/composables/calendar/useCalendarMonthView'

vi.mock('@/composables/useDatabase', () => ({
  useDatabase: () => ({
    save: vi.fn(),
    load: vi.fn().mockResolvedValue(null)
  }),
  DB_KEYS: {
    TASKS: 'tasks',
    PROJECTS: 'projects',
    CANVAS: 'canvas'
  }
}))

describe('active calendar schedule rendering', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders active scheduled tasks in day, week, and month views', async () => {
    const store = useTaskStore()
    const date = new Date('2026-06-07T12:00:00')
    const task = await store.createTask({ title: 'Active scheduled task', status: 'todo' })
    await store.createTaskInstance(task.id, {
      scheduledDate: '2026-06-07',
      scheduledTime: '16:00',
      duration: 30
    })

    const day = useCalendarDayView(ref(date), ref(null))
    const week = useCalendarWeekView(ref(date), ref(null))
    const month = useCalendarMonthView(ref(date), ref(null))

    expect(day.calendarEvents.value.map(event => event.taskId)).toContain(task.id)
    expect(week.weekEvents.value.map(event => event.taskId)).toContain(task.id)
    expect(month.monthDays.value.flatMap(day => day.events).map(event => event.taskId)).toContain(task.id)
  })

  it('does not render done tasks, completion records, completed instances, or skipped instances as active events', async () => {
    const store = useTaskStore()
    const date = new Date('2026-06-07T12:00:00')

    const doneTask = await store.createTask({ title: 'Done scheduled task', status: 'done' })
    await store.createTaskInstance(doneTask.id, {
      scheduledDate: '2026-06-07',
      scheduledTime: '16:00',
      duration: 30
    })

    const completionRecord = await store.createTask({
      title: 'Completion record',
      status: 'done',
      isCompletionRecord: true
    })
    await store.createTaskInstance(completionRecord.id, {
      scheduledDate: '2026-06-07',
      scheduledTime: '17:00',
      duration: 30
    })

    const completedInstanceTask = await store.createTask({
      title: 'Completed instance task',
      status: 'todo',
      instances: [{
        id: 'completed-instance',
        scheduledDate: '2026-06-07',
        scheduledTime: '18:00',
        duration: 30,
        status: 'completed'
      }]
    })

    const skippedInstanceTask = await store.createTask({
      title: 'Skipped instance task',
      status: 'todo',
      instances: [{
        id: 'skipped-instance',
        scheduledDate: '2026-06-07',
        scheduledTime: '19:00',
        duration: 30,
        status: 'skipped'
      }]
    })

    const day = useCalendarDayView(ref(date), ref(null))
    const week = useCalendarWeekView(ref(date), ref(null))
    const month = useCalendarMonthView(ref(date), ref(null))

    const excludedIds = [
      doneTask.id,
      completionRecord.id,
      completedInstanceTask.id,
      skippedInstanceTask.id
    ]

    const dayIds = day.calendarEvents.value.map(event => event.taskId)
    const weekIds = week.weekEvents.value.map(event => event.taskId)
    const monthIds = month.monthDays.value.flatMap(day => day.events).map(event => event.taskId)

    for (const id of excludedIds) {
      expect(dayIds).not.toContain(id)
      expect(weekIds).not.toContain(id)
      expect(monthIds).not.toContain(id)
    }
  })
})
