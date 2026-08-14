import type { Task } from '@/types/tasks'
import { groupTasksByDate } from '@/composables/board/useBoardState'

/**
 * Canonical Today projection shared by Board, Canvas, and Catalogue.
 *
 * Membership and ordering must come from the same date grouping used by the
 * Board. Consumers may project the returned tasks into their own layout, but
 * must not derive a second Today list.
 */
export function getCanonicalTodayTasks(tasks: Task[], hideDoneTasks = false): Task[] {
  return groupTasksByDate(tasks, hideDoneTasks).today
}

export function getCanonicalTodayTaskIds(tasks: Task[], hideDoneTasks = false): Set<string> {
  return new Set(getCanonicalTodayTasks(tasks, hideDoneTasks).map(task => task.id))
}
