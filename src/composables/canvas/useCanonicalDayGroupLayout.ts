/**
 * TASK-1756 v8: Canonical day-group layout primitive.
 *
 * Pure helper shared between `useDayGroupRotation` (automatic catchup +
 * toolbar rotate button) and `useTidyLayout` (new toolbar tidy button).
 * Produces a clean single-row layout:
 *   - All day-of-week + smart (Today/Tomorrow) groups share one Y.
 *   - Uniform width (350 or 700 for 2-column overflow).
 *   - Uniform minimum height (1000 — grows if measured task cards need more).
 *   - Evenly spaced on X with a fixed gutter between actual rendered widths.
 *   - Task positioning is caller-selected: canonical from header, compact from
 *     the current top task, or preserve relative offsets while moving groups.
 *
 * Pure: reads only its inputs, returns new data. No store mutations.
 * No Vue Flow calls. The caller applies the returned moves.
 */

import { CANVAS } from '@/constants/canvas'
import type { CanvasGroup } from '@/types/canvas'
import type { Task } from '@/types/tasks'

export interface DayGroupInput {
  group: CanvasGroup
  /** Absolute visual position (canvas-origin coords). */
  visualPos: { x: number; y: number }
  /** Tasks that belong to this group (parentId === group.id). */
  tasks: Task[]
  /** Rendered task sizes keyed by task id. Falls back to canvas defaults. */
  taskSizes?: Map<string, { width: number; height: number }>
  /** Absolute visual task positions keyed by task id. Falls back to task.canvasPosition. */
  taskPositions?: Map<string, { x: number; y: number }>
}

export interface GroupMove {
  nodeId: string
  groupId: string
  position: { x: number; y: number }
  size: { width: number; height: number }
}

export interface TaskMove {
  taskId: string
  parentId: string
  position: { x: number; y: number }
}

export interface CanonicalLayoutResult {
  groupMoves: GroupMove[]
  taskMoves: TaskMove[]
}

export interface CanonicalLayoutOptions {
  taskLayout?: 'vertical' | 'horizontal'
  taskPositioning?: 'fromHeader' | 'compactFromCurrentTop' | 'preserveRelative'
  /**
   * Vertical-mode column threshold. Default = CANVAS.DAY_GROUP_MAX_TASKS_PER_COLUMN.
   * Pass `null` to disable overflow entirely (always single column, group grows
   * as tall as needed). Tidy uses `null` so it never surprises users with a
   * 2-column grid when they have arranged tasks vertically.
   */
  maxTasksPerColumn?: number | null
}

/**
 * Compute canonical layout for day/smart groups.
 *
 * @param dayGroups   Inputs: (group, visualPos, tasks). Assumes custom
 *                    (non-power-keyword) groups have already been filtered
 *                    out by the caller.
 * @param orderedIds  Group ids in the order they should appear left-to-right.
 *                    Rotation passes weekday-distance order; Tidy passes
 *                    current-X order to preserve the user's left-to-right
 *                    arrangement.
 */
export function computeCanonicalLayout(
  dayGroups: DayGroupInput[],
  orderedIds: string[],
  options: CanonicalLayoutOptions = {}
): CanonicalLayoutResult {
  if (dayGroups.length === 0) {
    return { groupMoves: [], taskMoves: [] }
  }

  // Anchor the canonical row at the top-left of the current cluster so users
  // aren't jarred by a big jump. Min X / min Y of the input groups.
  const originX = Math.min(...dayGroups.map((dg) => dg.visualPos.x))
  const originY = Math.min(...dayGroups.map((dg) => dg.visualPos.y))

  // Index inputs by group id for fast lookup during iteration.
  const byId = new Map<string, DayGroupInput>()
  for (const dg of dayGroups) byId.set(dg.group.id, dg)

  const groupMoves: GroupMove[] = []
  const taskMoves: TaskMove[] = []

  const groupGutter = CANVAS.DAY_GROUP_SPACING - CANVAS.DAY_GROUP_WIDTH_1COL
  const snapToGridFrom = (value: number, origin: number) =>
    origin + Math.ceil((value - origin) / CANVAS.GRID_SNAP_SIZE) * CANVAS.GRID_SNAP_SIZE
  let nextGroupX = originX

  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i]
    const dg = byId.get(id)
    if (!dg) continue

    const taskLayout = options.taskLayout ?? 'vertical'
    const taskPositioning = options.taskPositioning ?? 'fromHeader'
    const sortedTasks = [...dg.tasks].sort((a, b) => {
      const ay = dg.taskPositions?.get(a.id)?.y ?? a.canvasPosition?.y ?? Number.MAX_SAFE_INTEGER
      const by = dg.taskPositions?.get(b.id)?.y ?? b.canvasPosition?.y ?? Number.MAX_SAFE_INTEGER
      if (ay !== by) return ay - by
      const at = a.createdAt ? Date.parse(a.createdAt) : 0
      const bt = b.createdAt ? Date.parse(b.createdAt) : 0
      return at - bt
    })
    const taskCount = sortedTasks.length
    const maxPerColumn = options.maxTasksPerColumn === null
      ? Number.POSITIVE_INFINITY
      : options.maxTasksPerColumn ?? CANVAS.DAY_GROUP_MAX_TASKS_PER_COLUMN
    const hasOverflow = taskLayout === 'vertical' && taskCount > maxPerColumn

    const groupX = nextGroupX
    const groupY = originY
    const groupWidth = taskLayout === 'horizontal'
      ? taskCount > 1 ? CANVAS.DAY_GROUP_WIDTH_2COL : CANVAS.DAY_GROUP_WIDTH_1COL
      : hasOverflow ? CANVAS.DAY_GROUP_WIDTH_2COL : CANVAS.DAY_GROUP_WIDTH_1COL
    const columnHeights = [0, 0]
    for (let t = 0; t < sortedTasks.length; t++) {
      const task = sortedTasks[t]
      const column = taskLayout === 'horizontal'
        ? t % 2
        : t < maxPerColumn ? 0 : 1
      const size = dg.taskSizes?.get(task.id)
      const taskHeight = Math.max(1, size?.height ?? CANVAS.DEFAULT_TASK_HEIGHT)
      columnHeights[column] += taskHeight
      const isColumnEnd = taskLayout === 'horizontal'
        ? t + 2 >= sortedTasks.length
        : column === 0
          ? t === Math.min(sortedTasks.length, maxPerColumn) - 1
          : t === sortedTasks.length - 1
      if (!isColumnEnd) columnHeights[column] += CANVAS.TASK_MARGIN
    }
    const requiredHeight = CANVAS.DAY_GROUP_HEADER_HEIGHT + CANVAS.GROUP_PADDING + Math.max(...columnHeights) + CANVAS.GROUP_PADDING
    const groupHeight = Math.max(CANVAS.DAY_GROUP_HEIGHT, requiredHeight)

    groupMoves.push({
      nodeId: `section-${dg.group.id}`,
      groupId: dg.group.id,
      position: { x: groupX, y: groupY },
      size: { width: groupWidth, height: groupHeight },
    })

    nextGroupX += groupWidth + groupGutter

    const defaultFirstTaskY = groupY + CANVAS.DAY_GROUP_HEADER_HEIGHT + CANVAS.GROUP_PADDING
    const currentTopY = Math.min(...sortedTasks.map((task) => dg.taskPositions?.get(task.id)?.y ?? task.canvasPosition?.y ?? defaultFirstTaskY))
    const currentTopRelativeY = Number.isFinite(currentTopY) ? currentTopY - dg.visualPos.y : CANVAS.DAY_GROUP_HEADER_HEIGHT + CANVAS.GROUP_PADDING
    const compactStartRelativeY = Math.max(CANVAS.DAY_GROUP_HEADER_HEIGHT + CANVAS.GROUP_PADDING, currentTopRelativeY)
    const firstTaskY = taskPositioning === 'compactFromCurrentTop'
      ? groupY + compactStartRelativeY
      : defaultFirstTaskY
    const nextTaskYByColumn = [firstTaskY, firstTaskY]

    for (let t = 0; t < sortedTasks.length; t++) {
      const task = sortedTasks[t]
      const currentTaskPosition = dg.taskPositions?.get(task.id) ?? task.canvasPosition ?? {
        x: dg.visualPos.x + CANVAS.GROUP_PADDING,
        y: dg.visualPos.y + CANVAS.DAY_GROUP_HEADER_HEIGHT + CANVAS.GROUP_PADDING,
      }
      if (taskPositioning === 'preserveRelative') {
        taskMoves.push({
          taskId: task.id,
          parentId: dg.group.id,
          position: {
            x: groupX + (currentTaskPosition.x - dg.visualPos.x),
            y: groupY + (currentTaskPosition.y - dg.visualPos.y),
          },
        })
        continue
      }

      const maxHorizontalColumns = 2
      const column = taskLayout === 'horizontal'
        ? t % maxHorizontalColumns
        : t < maxPerColumn ? 0 : 1
      const taskSize = dg.taskSizes?.get(task.id)

      const taskX =
        groupX +
        CANVAS.GROUP_PADDING +
        column * (CANVAS.DEFAULT_TASK_WIDTH + CANVAS.DAY_GROUP_COLUMN_GAP)
      const taskY = snapToGridFrom(nextTaskYByColumn[column], firstTaskY)

      taskMoves.push({
        taskId: task.id,
        parentId: dg.group.id,
        position: { x: taskX, y: taskY },
      })
      nextTaskYByColumn[column] = taskY + Math.max(1, taskSize?.height ?? CANVAS.DEFAULT_TASK_HEIGHT) + CANVAS.TASK_MARGIN
    }
  }

  return { groupMoves, taskMoves }
}
