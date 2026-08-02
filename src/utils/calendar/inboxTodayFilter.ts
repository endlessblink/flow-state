import type { Task } from '@/types/tasks'

const localDateString = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Calendar inbox Today means the task's due date is today, not its event schedule. */
export const isCalendarInboxTaskDueToday = (task: Pick<Task, 'dueDate'>, now = new Date()): boolean => {
  if (!task.dueDate) return false
  return task.dueDate.trim().substring(0, 10) === localDateString(now)
}
