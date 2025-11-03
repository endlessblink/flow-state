import { computed, type Ref } from 'vue'
import { useTaskStore, getTaskInstances } from '@/stores/tasks'
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
          const instances = getTaskInstances(task)
          instances
            .filter(instance => instance.scheduledDate === dateString)
            .forEach(instance => {
              const [hour, minute] = instance.scheduledTime.split(':').map(Number)
              const duration = instance.duration || task.estimatedDuration || 30

              dayEvents.push({
                id: instance.id,
                taskId: task.id,
                instanceId: instance.id,
                title: task.title,
                startTime: new Date(`${instance.scheduledDate}T${instance.scheduledTime}`),
                endTime: new Date(new Date(`${instance.scheduledDate}T${instance.scheduledTime}`).getTime() + duration * 60000),
                duration,
                startSlot: 0,
                slotSpan: 0,
                color: getPriorityColor(task.priority),
                column: 0,
                totalColumns: 1
              })
            })
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

    if (instanceId) {
      // Moving existing event - update its date, keep time
      taskStore.updateTaskInstance(taskId, instanceId, {
        scheduledDate: targetDate
      })
    } else {
      // Creating new instance from sidebar
      taskStore.createTaskInstance(taskId, {
        scheduledDate: targetDate,
        scheduledTime: '09:00' // Default to 9 AM
      })
    }
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
