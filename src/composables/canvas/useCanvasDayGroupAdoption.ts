import type { CanvasGroup } from '@/types/canvas'
import type { Task } from '@/types/tasks'
import { findMatchingGroupForDueDate } from './useSmartGroupMatcher'

type CanvasAdoptionTask = Task & {
  isVisible?: boolean
}

/**
 * Tidy may repair membership only from visible geometry.  Due dates are not
 * membership: changing a task's date must never make it jump between groups.
 */
export function isEligibleForDayGroupAdoption(task: CanvasAdoptionTask): boolean {
  return Boolean(task.dueDate)
    && task.status !== 'done'
    && !task._soft_deleted
    && !task.isCompletionRecord
    && !task.isPinned
    && !task.canvasDismissed
    && task.isVisible !== false
}

function groupContainsTaskColumn(task: CanvasAdoptionTask, group: CanvasGroup): boolean {
  if (!task.canvasPosition || !group.position) return false
  const x = task.canvasPosition.x
  const left = group.position.x
  const right = left + group.position.width
  return x >= left && x <= right
}

export function collectDayGroupAdoptions(
  tasks: CanvasAdoptionTask[],
  groups: CanvasGroup[],
  options: { mode?: 'dueDate' | 'spatial'; allowReparented?: boolean } = {},
): Map<string, string> {
  const mode = options.mode ?? 'dueDate'
  const allowReparented = options.allowReparented ?? true
  const adoptions = new Map<string, string>()
  for (const task of tasks) {
    if (mode === 'spatial' && !allowReparented && task.parentId) continue
    const eligible = mode === 'spatial'
      ? task.status !== 'done'
        && !task._soft_deleted
        && !task.isCompletionRecord
        && !task.isPinned
        && !task.canvasDismissed
        && task.isVisible !== false
        && Boolean(task.canvasPosition)
      : isEligibleForDayGroupAdoption(task)
    if (!eligible) continue
    const matchingGroup = mode === 'spatial'
      ? groups.find((group) => groupContainsTaskColumn(task, group))
      : findMatchingGroupForDueDate(task.dueDate, groups)
    if (matchingGroup && matchingGroup.id !== task.parentId) {
      adoptions.set(task.id, matchingGroup.id)
    }
  }
  return adoptions
}
