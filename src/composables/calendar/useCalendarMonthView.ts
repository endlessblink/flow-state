import { computed, type Ref } from 'vue'
import { useTaskStore, getTaskInstances } from '@/stores/tasks'
import type { TaskInstance } from '@/types/tasks'
import { useCalendarCore } from '@/composables/useCalendarCore'
import { useDragAndDrop } from '@/composables/useDragAndDrop'
import { useSettingsStore } from '@/stores/settings'
import type { CalendarEvent } from '@/types/tasks'
import { generateVirtualCalendarEvents } from '@/utils/recurrenceUtils'

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
export function useCalendarMonthView(currentDate: Ref<Date>, _statusFilter: Ref<string | null>) {
  const taskStore = useTaskStore()
  const settings = useSettingsStore()
  const { getPriorityColor, getDateString } = useCalendarCore()
  const { endDrag: endGlobalDrag } = useDragAndDrop()

  // Month days computation
  const monthDays = computed<MonthDay[]>(() => {
    const year = currentDate.value.getFullYear()
    const month = currentDate.value.getMonth()

    const firstDay = new Date(year, month, 1)
    const startDate = new Date(firstDay)

    // TASK-1321: Adjust to start on the configured week start day
    const dayOfWeek = firstDay.getDay()
    const weekStartsOn = settings.weekStartsOn ?? 0
    const daysToSubtract = (dayOfWeek - weekStartsOn + 7) % 7
    startDate.setDate(startDate.getDate() - daysToSubtract)

    const days: MonthDay[] = []
    const today = getDateString(new Date())

    for (let i = 0; i < 42; i++) { // 6 weeks × 7 days
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)

      const dateString = getDateString(date)

      // Get events for this day
      const dayEvents: CalendarEvent[] = []
      // Use calendarFilteredTasks to bypass smart view filters (consistent with week/day views)
      taskStore.calendarFilteredTasks
        .forEach(task => {
          const instances = getTaskInstances(task)
          instances
            .filter((instance) => instance.scheduledDate === dateString)
            .forEach((instance) => {
              const [_hour, _minute] = (instance.scheduledTime || '12:00').split(':').map(Number)
              const duration = instance.duration || task.estimatedDuration || 30

              dayEvents.push({
                id: instance.id ?? '',
                taskId: task.id,
                instanceId: instance.id ?? '',
                title: task.title,
                projectId: task.projectId,
                startTime: new Date(`${instance.scheduledDate}T${instance.scheduledTime}`),
                endTime: new Date(new Date(`${instance.scheduledDate}T${instance.scheduledTime}`).getTime() + duration * 60000),
                duration,
                startSlot: 0,
                slotSpan: 0,
                color: getPriorityColor(task.priority),
                column: 0,
                totalColumns: 1,
                isDueDate: false
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

    // TASK-1418: Merge virtual recurring events when toggle is ON
    if (taskStore.showFutureRecurring && days.length >= 2) {
      const rangeStart = days[0].dateString
      const rangeEnd = days[days.length - 1].dateString
      const virtualEvents = generateVirtualCalendarEvents(
        taskStore.calendarFilteredTasks,
        rangeStart,
        rangeEnd
      )

      for (const virtual of virtualEvents) {
        const dayEntry = days.find(d => d.dateString === virtual.scheduledDate)
        if (dayEntry) {
          dayEntry.events.push({
            id: virtual.id,
            taskId: virtual.taskId,
            instanceId: virtual.id,
            title: virtual.title,
            projectId: virtual.projectId,
            startTime: new Date(`${virtual.scheduledDate}T${virtual.scheduledTime || '09:00'}`),
            endTime: new Date(`${virtual.scheduledDate}T${virtual.scheduledTime || '09:00'}`),
            duration: virtual.duration || 30,
            startSlot: 0,
            slotSpan: 0,
            color: getPriorityColor(virtual.priority),
            column: 0,
            totalColumns: 1,
            isDueDate: false,
            isVirtual: true,
          } as CalendarEvent & { isVirtual: boolean })
        }
      }
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

  const handleMonthDrop = async (event: DragEvent, targetDate: string) => {
    event.preventDefault()

    // BUG-1361: Clean up global drag ghost pill on drop (same fix as day view).
    endGlobalDrag()

    const data = event.dataTransfer?.getData('application/json')
    if (!data) return

    const { taskId, instanceId } = JSON.parse(data)
    const existingTask = taskStore.getTask(taskId)
    if (!existingTask) return

    // TASK-1322: Properly handle both instances[] and legacy fields
    if (existingTask.instances && existingTask.instances.length > 0 && instanceId) {
      // Update the specific instance's scheduledDate (move, not duplicate)
      const updatedInstances = existingTask.instances.map((inst: TaskInstance) =>
        inst.id === instanceId
          ? { ...inst, scheduledDate: targetDate }
          : inst
      )
      await taskStore.updateTask(taskId, {
        instances: updatedInstances
      })
    } else {
      // BUG-1325: Create an explicit instance instead of using legacy scheduledDate fields.
      // This is an explicit user action (month view drag), so it SHOULD create calendar visibility.
      const scheduledTime = existingTask.scheduledTime || '09:00'
      await taskStore.updateTask(taskId, { // BUG-1051: AWAIT to ensure persistence
        instances: [{
          id: `instance-${taskId}-${Date.now()}`,
          scheduledDate: targetDate,
          scheduledTime: scheduledTime,
          duration: existingTask.estimatedDuration || 60
        }]
      })
    }
  }

  const handleMonthDragEnd = (_event: DragEvent) => {
    // Cleanup any drag states
    // Currently no specific cleanup needed for month view
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
    handleMonthDragEnd,
    handleMonthDayClick
  }
}
