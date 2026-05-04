/**
 * TASK-1756 v8: Canonical day-group layout primitive.
 *
 * Pure helper shared between `useDayGroupRotation` (automatic catchup +
 * toolbar rotate button) and `useTidyLayout` (new toolbar tidy button).
 * Produces a clean single-row layout:
 *   - All day-of-week + smart (Today/Tomorrow) groups share one Y.
 *   - Uniform width (350 or 700 for 2-column overflow).
 *   - Uniform height (920 — fits 8 tasks in a single column).
 *   - Evenly spaced on X with a fixed gutter between actual rendered widths.
 *   - Tasks inside each group stacked vertically, wrapping to a 2nd column
 *     when task count exceeds 8 (group width bumped to 700 for those).
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
  let nextGroupX = originX

  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i]
    const dg = byId.get(id)
    if (!dg) continue

    const taskCount = dg.tasks.length
    const taskLayout = options.taskLayout ?? 'vertical'
    const hasOverflow = taskLayout === 'vertical' && taskCount > CANVAS.DAY_GROUP_MAX_TASKS_PER_COLUMN

    const groupX = nextGroupX
    const groupY = originY
    const groupWidth = taskLayout === 'horizontal'
      ? taskCount > 1 ? CANVAS.DAY_GROUP_WIDTH_2COL : CANVAS.DAY_GROUP_WIDTH_1COL
      : hasOverflow ? CANVAS.DAY_GROUP_WIDTH_2COL : CANVAS.DAY_GROUP_WIDTH_1COL
    const groupHeight = CANVAS.DAY_GROUP_HEIGHT

    groupMoves.push({
      nodeId: `section-${dg.group.id}`,
      groupId: dg.group.id,
      position: { x: groupX, y: groupY },
      size: { width: groupWidth, height: groupHeight },
    })

    nextGroupX += groupWidth + groupGutter

    // Stable task order: top-most first. Fall back to created-at so ties
    // behave predictably across runs.
    const sortedTasks = [...dg.tasks].sort((a, b) => {
      const ay = a.canvasPosition?.y ?? Number.MAX_SAFE_INTEGER
      const by = b.canvasPosition?.y ?? Number.MAX_SAFE_INTEGER
      if (ay !== by) return ay - by
      const at = a.createdAt ? Date.parse(a.createdAt) : 0
      const bt = b.createdAt ? Date.parse(b.createdAt) : 0
      return at - bt
    })

    for (let t = 0; t < sortedTasks.length; t++) {
      const task = sortedTasks[t]
      const maxHorizontalColumns = 2
      const column = taskLayout === 'horizontal'
        ? t % maxHorizontalColumns
        : t < CANVAS.DAY_GROUP_MAX_TASKS_PER_COLUMN ? 0 : 1
      const row = taskLayout === 'horizontal'
        ? Math.floor(t / maxHorizontalColumns)
        : t % CANVAS.DAY_GROUP_MAX_TASKS_PER_COLUMN

      const taskX =
        groupX +
        CANVAS.GROUP_PADDING +
        column * (CANVAS.DEFAULT_TASK_WIDTH + CANVAS.DAY_GROUP_COLUMN_GAP)
      const taskY =
        groupY +
        CANVAS.DAY_GROUP_HEADER_HEIGHT +
        CANVAS.GROUP_PADDING +
        row * (CANVAS.DEFAULT_TASK_HEIGHT + CANVAS.TASK_MARGIN)

      taskMoves.push({
        taskId: task.id,
        parentId: dg.group.id,
        position: { x: taskX, y: taskY },
      })
    }
  }

  return { groupMoves, taskMoves }
}
