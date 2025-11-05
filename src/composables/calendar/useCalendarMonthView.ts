import { computed, type Ref } from 'vue'
import { useTaskStore, formatDateKey } from '@/stores/tasks'
import { useCalendarEventHelpers, type CalendarEvent } from './useCalendarEventHelpers'

export interface MonthDay {
  dateString: string
  dayNumber: number
  isCurrentMonth: boolean
  isToday: boolean
  events: CalendarEvent[]
}

/**
 * Month view specific logic for calendar
 * Handles month grid, day cells, and event aggregation
 */
export function useCalendarMonthView(currentDate: Ref<Date>, statusFilter: Ref<string | null>) {
  const taskStore = useTaskStore()
  const { getPriorityColor, getDateString } = useCalendarEventHelpers()

  // Month days computation
  const monthDays = computed<MonthDay[]>(() => {
    const year = currentDate.value.getFullYear()
    const month = currentDate.value.getMonth()

    const firstDay = new Date(year, month, 1)
    const startDate = new Date(firstDay)

    // Adjust to start on Monday
    const dayOfWeek = firstDay.getDay()
    startDate.setDate(startDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))

    const days: MonthDay[] = []
    const today = getDateString(new Date())

    for (let i = 0; i < 42; i++) { // 6 weeks × 7 days
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)

      const dateString = getDateString(date)

      // Get events for this day
      const dayEvents: CalendarEvent[] = []
      taskStore.filteredTasks
        .filter(task => {
          if (statusFilter.value === null) return true
          return task.status === statusFilter.value
        })
        .forEach(task => {
          // FIXED: Only show unscheduled inbox tasks in today's cell - no auto-scheduling
          // Calendar events are now created only through explicit user action (drag & drop)
          const isInInbox = task.isInInbox !== false && !task.canvasPosition && task.status !== 'done'

          // FIXED: Unscheduled inbox tasks - show in today's cell only (no auto-scheduling)
          if (isInInbox && dateString === today) {
            dayEvents.push({
              id: `unscheduled-${task.id}`,
              taskId: task.id,
              title: task.title,
              startTime: new Date(`${dateString}T08:00:00`),
              endTime: new Date(new Date(`${dateString}T08:00:00`).getTime() + 30 * 60000),
              duration: 30,
              startSlot: 0,
              slotSpan: 0,
              color: getPriorityColor(task.priority),
              column: 0,
              totalColumns: 1,
              isUnscheduled: true
            })
          }
        })

      days.push({
        dateString,
        dayNumber: date.getDate(),
        isCurrentMonth: date.getMonth() === month,
        isToday: dateString === today,
        events: dayEvents
      })
    }

    return days
  })

  // Month drag handlers
  const handleMonthDragStart = (event: DragEvent, calendarEvent: CalendarEvent) => {
    event.dataTransfer?.setData('application/json', JSON.stringify({
      taskId: calendarEvent.taskId,
      instanceId: calendarEvent.instanceId
    }))
  }

  const handleMonthDrop = (event: DragEvent, targetDate: string) => {
    event.preventDefault()

    const data = event.dataTransfer?.getData('application/json')
    if (!data) return

    const { taskId, instanceId } = JSON.parse(data)

    // Simple update: modify task's scheduledDate directly
    // Keep existing time if task has one, otherwise set to 9 AM
    const existingTask = taskStore.getTask(taskId)
    const scheduledTime = existingTask?.scheduledTime || '09:00'

    taskStore.updateTask(taskId, {
      scheduledDate: targetDate,
      scheduledTime: scheduledTime,
      isInInbox: false // Task is now scheduled, no longer in inbox
    })
  }

  const handleMonthDayClick = (dateString: string, viewMode: Ref<'day' | 'week' | 'month'>) => {
    // Switch to Day view for the clicked date
    const [year, month, day] = dateString.split('-').map(Number)
    currentDate.value = new Date(year, month - 1, day)
    viewMode.value = 'day'
  }

  return {
    monthDays,

    // Drag handlers
    handleMonthDragStart,
    handleMonthDrop,
    handleMonthDayClick
  }
}
