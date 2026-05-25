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
   * as tall as needed).
   */
  maxTasksPerColumn?: number | null
  /** Maximum overflow columns for dense vertical layouts. Default preserves legacy 2-column behavior. */
  maxColumns?: number
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
    const maxColumns = Math.max(1, options.maxColumns ?? 2)
    const columnCount = taskLayout === 'horizontal'
      ? Math.min(maxColumns, Math.max(1, taskCount))
      : hasOverflow
        ? Math.min(maxColumns, Math.ceil(taskCount / maxPerColumn))
        : 1

    const groupX = nextGroupX
    const groupY = originY
    const overflowWidth =
      CANVAS.GROUP_PADDING * 2 +
      columnCount * CANVAS.DEFAULT_TASK_WIDTH +
      Math.max(0, columnCount - 1) * CANVAS.DAY_GROUP_COLUMN_GAP
    const groupWidth = columnCount === 1
      ? CANVAS.DAY_GROUP_WIDTH_1COL
      : columnCount === 2
        ? CANVAS.DAY_GROUP_WIDTH_2COL
        : Math.max(CANVAS.DAY_GROUP_WIDTH_2COL, overflowWidth)
    // Place tasks first, then size the group to the tasks' ACTUAL footprint.
    // BUG (TASK-1798): group height used to be summed from raw task heights,
    // independently of the position loop. But positions are grid-snapped UP each
    // step (snapToGridFrom), so the real footprint drifts below that sum and the
    // group clipped its tail tasks — overflow that grew with task count. Deriving
    // height from where tasks truly land keeps the box self-consistent.
    const defaultFirstTaskY = groupY + CANVAS.DAY_GROUP_HEADER_HEIGHT + CANVAS.GROUP_PADDING
    const currentTopY = Math.min(...sortedTasks.map((task) => dg.taskPositions?.get(task.id)?.y ?? task.canvasPosition?.y ?? defaultFirstTaskY))
    const currentTopRelativeY = Number.isFinite(currentTopY) ? currentTopY - dg.visualPos.y : CANVAS.DAY_GROUP_HEADER_HEIGHT + CANVAS.GROUP_PADDING
    const compactStartRelativeY = Math.max(CANVAS.DAY_GROUP_HEADER_HEIGHT + CANVAS.GROUP_PADDING, currentTopRelativeY)
    const firstTaskY = taskPositioning === 'compactFromCurrentTop'
      ? groupY + compactStartRelativeY
      : defaultFirstTaskY
    const nextTaskYByColumn = Array.from({ length: columnCount }, () => firstTaskY)

    let maxTaskBottomRelative = 0
    for (let t = 0; t < sortedTasks.length; t++) {
      const task = sortedTasks[t]
      const currentTaskPosition = dg.taskPositions?.get(task.id) ?? task.canvasPosition ?? {
        x: dg.visualPos.x + CANVAS.GROUP_PADDING,
        y: dg.visualPos.y + CANVAS.DAY_GROUP_HEADER_HEIGHT + CANVAS.GROUP_PADDING,
      }
      const taskHeight = Math.max(1, dg.taskSizes?.get(task.id)?.height ?? CANVAS.DEFAULT_TASK_HEIGHT)

      if (taskPositioning === 'preserveRelative') {
        const posY = groupY + (currentTaskPosition.y - dg.visualPos.y)
        taskMoves.push({
          taskId: task.id,
          parentId: dg.group.id,
          position: {
            x: groupX + (currentTaskPosition.x - dg.visualPos.x),
            y: posY,
          },
        })
        maxTaskBottomRelative = Math.max(maxTaskBottomRelative, posY - groupY + taskHeight)
        continue
      }

      const column = taskLayout === 'horizontal'
        ? t % columnCount
        : hasOverflow ? Math.floor(t / maxPerColumn) : 0

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
      nextTaskYByColumn[column] = taskY + taskHeight + CANVAS.TASK_MARGIN
      maxTaskBottomRelative = Math.max(maxTaskBottomRelative, taskY - groupY + taskHeight)
    }

    // Size the group to contain its tasks (+ bottom padding), floored at the
    // canonical minimum height. Empty groups keep the minimum.
    const contentHeight = sortedTasks.length > 0
      ? maxTaskBottomRelative + CANVAS.GROUP_PADDING
      : CANVAS.DAY_GROUP_HEIGHT
    const groupHeight = Math.max(CANVAS.DAY_GROUP_HEIGHT, contentHeight)

    groupMoves.push({
      nodeId: `section-${dg.group.id}`,
      groupId: dg.group.id,
      position: { x: groupX, y: groupY },
      size: { width: groupWidth, height: groupHeight },
    })

    nextGroupX += groupWidth + groupGutter
  }

  return { groupMoves, taskMoves }
}
