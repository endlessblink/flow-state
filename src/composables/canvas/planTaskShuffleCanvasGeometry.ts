import { CANVAS } from '@/constants/canvas'
import type { CanvasGroup } from '@/types/canvas'
import type { Task } from '@/types/tasks'

type Position = { x: number; y: number }
type Size = { width: number; height: number }

/** Restack existing group members without moving groups or changing membership. */
export function planTaskShuffleCanvasGeometry(
  groups: CanvasGroup[],
  orderedTasks: Task[],
  getTaskSize: (taskId: string) => Size | undefined,
): {
  taskPositions: Map<string, Position>
  groupPositions: Map<string, Position & Size>
} {
  const taskPositions = new Map<string, Position>()
  const groupPositions = new Map<string, Position & Size>()

  for (const group of groups) {
    if (!group.position) continue
    let nextY = group.position.y + CANVAS.DAY_GROUP_HEADER_HEIGHT + CANVAS.GROUP_PADDING
    let taskCount = 0

    for (const task of orderedTasks) {
      if (task.parentId !== group.id || !task.canvasPosition) continue
      if (task._soft_deleted || task.isCompletionRecord || task.canvasDismissed) continue

      taskPositions.set(task.id, {
        x: group.position.x + CANVAS.GROUP_PADDING,
        y: nextY,
      })
      const renderedHeight = getTaskSize(task.id)?.height
      const height = renderedHeight != null && Number.isFinite(renderedHeight) && renderedHeight >= 24
        ? renderedHeight
        : CANVAS.DEFAULT_TASK_HEIGHT
      nextY += height + CANVAS.TASK_MARGIN
      taskCount += 1
    }

    if (taskCount > 0) {
      const requiredHeight = nextY - CANVAS.TASK_MARGIN - group.position.y + CANVAS.GROUP_PADDING
      if (requiredHeight > group.position.height) {
        groupPositions.set(group.id, { ...group.position, height: requiredHeight })
      }
    }
  }

  return { taskPositions, groupPositions }
}
