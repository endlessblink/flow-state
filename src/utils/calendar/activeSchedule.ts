import type { Task, TaskInstance } from '@/types/tasks'

export const isActiveCalendarTask = (task: Task | null | undefined): task is Task => {
  return !!task &&
    !task._soft_deleted &&
    !task.isCompletionRecord &&
    task.status !== 'done'
}

export const isActiveCalendarInstance = (instance: TaskInstance | null | undefined): instance is TaskInstance => {
  return !!instance &&
    !!instance.scheduledDate &&
    instance.status !== 'completed' &&
    instance.status !== 'skipped'
}

export const getActiveCalendarInstances = (task: Task): TaskInstance[] => {
  return (task.instances ?? []).filter(isActiveCalendarInstance)
}

export const hasActiveCalendarInstance = (task: Task): boolean => {
  return getActiveCalendarInstances(task).length > 0
}
