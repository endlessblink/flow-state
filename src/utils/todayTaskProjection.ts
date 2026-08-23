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

/**
 * Tasks that still claim the smart Today Canvas group but are not in the
 * canonical Today projection. These must not remain visible in that group.
 */
export function getStaleTodayTaskIds(
  tasks: Task[],
  todayGroupId: string | undefined,
  hideDoneTasks = false,
): Set<string> {
  if (!todayGroupId) return new Set()
  const canonicalIds = getCanonicalTodayTaskIds(tasks, hideDoneTasks)
  return new Set(
    tasks
      .filter(task => task.parentId === todayGroupId && !canonicalIds.has(task.id))
      .map(task => task.id),
  )
}
