import type { Task } from '@/types/tasks'
import { compareTasksBySharedOrder } from '@/utils/taskOrdering'

export type TaskSortKey =
  | 'dueDate'
  | 'priority'
  | 'title'
  | 'created'
  | 'manual'
  | 'status'
  | 'progress'
  | 'estimatedTime'

export type TaskSortDirection = 'asc' | 'desc'

export interface TaskSortSpec {
  key: TaskSortKey
  direction: TaskSortDirection
}

const priorityRank: Record<string, number> = {
  immediate: 0,
  high: 1,
  medium: 2,
  low: 3,
  relaxed: 4,
}

const statusRank: Record<string, number> = {
  in_progress: 0,
  planned: 1,
  backlog: 2,
  on_hold: 3,
  todo: 4,
  done: 5,
}

function compareOptionalNumbers(first: number | null, second: number | null, direction: TaskSortDirection): number {
  if (first === null && second === null) return 0
  if (first === null) return 1
  if (second === null) return -1
  return (direction === 'asc' ? 1 : -1) * (first - second)
}

function timestamp(value: unknown): number | null {
  const parsed = Date.parse(String(value ?? ''))
  return Number.isFinite(parsed) ? parsed : null
}

function progress(task: Task): number | null {
  const subtasks = task.subtasks as Array<{ done?: boolean }> | undefined
  if (!subtasks?.length) return null
  return subtasks.filter(subtask => subtask.done).length / subtasks.length
}

/** Compare only the selected field. Equal values deliberately return zero so an inbox can add a tie-breaker. */
export function compareTaskSortField(first: Task, second: Task, spec: TaskSortSpec): number {
  const multiplier = spec.direction === 'asc' ? 1 : -1

  switch (spec.key) {
    case 'dueDate':
      return compareOptionalNumbers(timestamp(first.dueDate), timestamp(second.dueDate), spec.direction)
    case 'priority':
      return compareOptionalNumbers(
        first.priority ? (priorityRank[first.priority] ?? null) : null,
        second.priority ? (priorityRank[second.priority] ?? null) : null,
        spec.direction,
      )
    case 'title':
      return multiplier * String(first.title ?? '').localeCompare(String(second.title ?? ''))
    case 'created': {
      // Preserve the Catalog convention: ascending means newest first.
      const result = compareOptionalNumbers(timestamp(second.createdAt), timestamp(first.createdAt), 'asc')
      return spec.direction === 'asc' ? result : -result
    }
    case 'manual':
      return multiplier * compareTasksBySharedOrder(first, second)
    case 'status':
      return compareOptionalNumbers(statusRank[first.status] ?? null, statusRank[second.status] ?? null, spec.direction)
    case 'progress':
      return compareOptionalNumbers(progress(first), progress(second), spec.direction)
    case 'estimatedTime':
      return compareOptionalNumbers(
        typeof first.estimatedDuration === 'number' && Number.isFinite(first.estimatedDuration)
          ? first.estimatedDuration
          : null,
        typeof second.estimatedDuration === 'number' && Number.isFinite(second.estimatedDuration)
          ? second.estimatedDuration
          : null,
        spec.direction,
      )
  }
}

export function compareTasksBySort(first: Task, second: Task, spec: TaskSortSpec): number {
  return compareTaskSortField(first, second, spec) || compareTasksBySharedOrder(first, second)
}

export function sortTasksByMainAndSecondary(
  tasks: Task[],
  main: TaskSortSpec,
  secondary?: TaskSortSpec | null,
): Task[] {
  return [...tasks].sort((first, second) => {
    const mainResult = compareTaskSortField(first, second, main)
    if (mainResult !== 0) return mainResult
    if (secondary && secondary.key !== main.key) {
      const secondaryResult = compareTaskSortField(first, second, secondary)
      if (secondaryResult !== 0) return secondaryResult
    }
    return compareTasksBySharedOrder(first, second)
  })
}
