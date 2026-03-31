import type { Task } from '@/types/tasks'

/**
 * Scores how complete a task's metadata is.
 * Used to identify tasks that could benefit from AI Assist suggestions.
 *
 * @returns score (0-1) and list of missing field names
 */
export function getTaskCompleteness(task: Task): { score: number; missing: string[] } {
  const missing: string[] = []
  let filled = 0
  const total = 4

  if (task.priority) filled++
  else missing.push('priority')

  if (task.dueDate) filled++
  else missing.push('dueDate')

  if (task.estimatedDuration) filled++
  else missing.push('estimatedDuration')

  if (task.subtasks && task.subtasks.length > 0) filled++
  else missing.push('subtasks')

  return { score: filled / total, missing }
}
