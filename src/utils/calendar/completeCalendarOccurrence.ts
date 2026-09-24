import type { Task } from '@/types/tasks'

export type CalendarOccurrenceUpdate = Pick<Task, 'dueDate' | 'doneForNowUntil' | 'dueTime' | 'scheduledDate' | 'scheduledTime' | 'instances'>

export function buildCalendarDoneForTodayUpdate(
  task: Task,
  instanceId: string,
  tomorrow: string,
  _createInstanceId: () => string = () => crypto.randomUUID()
): CalendarOccurrenceUpdate {
  const instances = task.instances || []
  const currentInstance = instances.find(instance => instance.id === instanceId)

  if (!currentInstance) {
    return {
      dueDate: tomorrow,
      doneForNowUntil: tomorrow,
      dueTime: undefined,
      scheduledDate: undefined,
      scheduledTime: undefined,
      instances: instances.filter(instance => instance.status === 'completed' || instance.status === 'skipped')
    }
  }

  return {
    dueDate: tomorrow,
    doneForNowUntil: tomorrow,
    dueTime: undefined,
    scheduledDate: undefined,
    scheduledTime: undefined,
    instances: instances.map(instance =>
      instance.id === instanceId
        ? { ...instance, status: 'completed' as const }
        : instance
    ).filter(instance => instance.status === 'completed' || instance.status === 'skipped')
  }
}
