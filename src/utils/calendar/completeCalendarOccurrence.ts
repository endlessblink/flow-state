import type { Task, TaskInstance } from '@/types/tasks'

export type CalendarOccurrenceUpdate = Pick<Task, 'dueDate' | 'doneForNowUntil'> & {
  scheduledDate?: string
  instances?: TaskInstance[]
}

export function buildCalendarDoneForTodayUpdate(
  task: Task,
  instanceId: string,
  tomorrow: string,
  createInstanceId: () => string = () => crypto.randomUUID()
): CalendarOccurrenceUpdate {
  const instances = task.instances || []
  const currentInstance = instances.find(instance => instance.id === instanceId)

  if (!currentInstance) {
    return {
      dueDate: tomorrow,
      doneForNowUntil: tomorrow,
      ...(task.scheduledDate ? { scheduledDate: tomorrow } : {})
    }
  }

  const tomorrowInstance: TaskInstance = {
    ...currentInstance,
    id: createInstanceId(),
    taskId: task.id,
    scheduledDate: tomorrow,
    status: 'scheduled'
  }

  return {
    dueDate: tomorrow,
    doneForNowUntil: tomorrow,
    ...(task.scheduledDate ? { scheduledDate: tomorrow } : {}),
    instances: instances.map(instance =>
      instance.id === instanceId
        ? { ...instance, status: 'completed' as const }
        : instance
    ).concat(tomorrowInstance)
  }
}
