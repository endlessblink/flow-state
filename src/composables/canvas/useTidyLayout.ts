/**
 * TASK-1756 v8: Tidy Layout composable.
 *
 * Wraps `computeCanonicalLayout` to produce a clean single-row layout for
 * every group on the canvas (day-of-week, smart Today/Tomorrow, AND
 * custom-named groups). Day groups use today's semantic order; custom groups
 * keep their current left-to-right X order after the smart/day groups. Tasks
 * are stacked vertically so day columns stay compact.
 *
 * Same move-application contract as rotation: returns { groupMoves,
 * taskMoves, release }. Caller applies Vue Flow moves via updateNode and
 * invokes release() on nextTick.
 */

import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import { useSettingsStore } from '@/stores/settings'
import { canvasSyncInProgress } from './useCanvasSync'
import { positionManager } from '@/services/canvas/PositionManager'
import {
  computeCanonicalLayout,
  type DayGroupInput,
  type GroupMove,
  type TaskMove,
} from '@/composables/canvas/useCanonicalDayGroupLayout'
import { findMatchingGroupForDueDate } from '@/composables/canvas/useSmartGroupMatcher'
import { detectPowerKeyword } from '@/composables/usePowerKeywords'
import { getDeepestContainingGroup } from '@/utils/canvas/spatialContainment'
import { CANVAS } from '@/constants/canvas'

export interface TidyLayoutOptions {
  /** Read a Vue Flow node's current visual position. */
  getNodePosition?: (nodeId: string) => { x: number; y: number } | undefined
  /** Read a Vue Flow node's current rendered dimensions. */
  getNodeSize?: (nodeId: string) => { width: number; height: number } | undefined
}

export function useTidyLayout(options: TidyLayoutOptions = {}) {
  const canvasStore = useCanvasStore()
  const taskStore = useTaskStore()
  const settingsStore = useSettingsStore()

  /**
   * Lay out smart + day-of-week groups in a canonical single row. Restacks
   * tasks vertically inside each group.
   */
  function tidyDayGroups(): {
    groupMoves: GroupMove[]
    taskMoves: TaskMove[]
    pendingWrites: Promise<void>
    release: () => void
  } {
    console.log('[TIDY] Tidying day-group layout...')

    canvasSyncInProgress.value = true
    let released = false
    const release = () => {
      if (released) return
      released = true
      for (const gm of pendingGroupMoves) {
        positionManager.releasePositionLock(gm.groupId, 'user-drag')
      }
      for (const tm of pendingTaskMoves) {
        positionManager.releasePositionLock(tm.taskId, 'user-drag')
      }
      canvasSyncInProgress.value = false
    }
    const pendingWrites: Promise<unknown>[] = []
    let pendingGroupMoves: GroupMove[] = []
    let pendingTaskMoves: TaskMove[] = []

    // TASK-1798: pull tasks into the group they belong to before restacking.
    //
    // Pass 1 — date association (primary). A task due "today" belongs in the
    // Today group, tomorrow → Tomorrow, a weekday date → that day-group —
    // regardless of where it currently sits. This widens the old orphan-only
    // re-home (which only healed BUG-1203 orphans) to EVERY dated task, so a
    // task stranded in the wrong day-group gets moved to the matching one.
    // Undated tasks are left alone (findMatchingGroupForDueDate would default
    // them to Today, which would wrongly hoover every undated task in).
    const dateClaimed = new Set<string>()
    let rehomedCount = 0
    for (const task of taskStore.rawTasks) {
      if (!task.canvasPosition) continue // inbox-only, skip
      if (!task.dueDate) continue
      const match = findMatchingGroupForDueDate(task.dueDate, canvasStore.groups)
      if (!match) continue
      dateClaimed.add(task.id)
      if (match.id === task.parentId) continue
      taskStore.updateTask(task.id, { parentId: match.id }, 'DRAG')
      rehomedCount++
    }
    if (rehomedCount > 0) {
      console.log('[TIDY] Date-homed', rehomedCount, 'tasks into matching day/smart groups')
    }

    // Pass 2 — spatial adoption (fallback for custom groups). Custom-named
    // groups have no date, so the only association is containment: adopt any
    // task whose center sits inside a custom group's bounds. Date-claimed tasks
    // are skipped so the date rule always wins. Positions are absolute (visual
    // position preferred; canvasPosition is stored absolute by every drag/Tidy
    // write), so getDeepestContainingGroup works directly.
    const customGroups = canvasStore.groups.filter(
      (g) => g.position && g.isVisible !== false && !detectPowerKeyword(g.name)
    )
    let adoptedCount = 0
    if (customGroups.length > 0) {
      for (const task of taskStore.rawTasks) {
        if (!task.canvasPosition) continue // inbox-only, skip
        if (dateClaimed.has(task.id)) continue
        const absPos = options.getNodePosition?.(task.id) ?? task.canvasPosition
        const size = options.getNodeSize?.(task.id)
        const spatialTask = { position: absPos, width: size?.width, height: size?.height }
        const containing = getDeepestContainingGroup(spatialTask, customGroups)
        if (containing && containing.id !== task.parentId) {
          taskStore.updateTask(task.id, { parentId: containing.id }, 'DRAG')
          adoptedCount++
        }
      }
    }
    if (adoptedCount > 0) {
      console.log('[TIDY] Spatially adopted', adoptedCount, 'loose tasks into custom groups')
    }

    // Collect every group with a position. Day-of-week / smart / custom — all
    // get the canonical single-row treatment so the Tidy button always does
    // something visible regardless of the user's group naming.
    const inputs: DayGroupInput[] = []
    for (const group of canvasStore.groups) {
      if (!group.position) continue

      const vfPos = options.getNodePosition?.(`section-${group.id}`)
      const visualPos = vfPos ?? { x: group.position.x, y: group.position.y }
      const tasks = taskStore.rawTasks.filter((t) => t.parentId === group.id)
      const taskSizes = new Map<string, { width: number; height: number }>()
      const taskPositions = new Map<string, { x: number; y: number }>()
      for (const task of tasks) {
        const size = options.getNodeSize?.(task.id)
        if (size) taskSizes.set(task.id, size)
        const position = options.getNodePosition?.(task.id)
        if (position) taskPositions.set(task.id, position)
      }
      inputs.push({ group, visualPos, tasks, taskSizes, taskPositions })
    }

    if (inputs.length === 0) {
      release()
      return { groupMoves: [], taskMoves: [], pendingWrites: Promise.resolve(), release }
    }

    // Tidy must complement Rotate, not overwrite it. Smart/day groups follow
    // the same order as Rotate; custom groups keep their current X order.
    const today = new Date().getDay()
    const weekStart = settingsStore.weekStartsOn
    const hasSmartToday = inputs.some((input) => {
      const keyword = detectPowerKeyword(input.group.name)
      return keyword?.category === 'date' && (keyword.keyword === 'today' || keyword.keyword === 'tomorrow')
    })
    const startFrom = hasSmartToday ? (today + 2) % 7 : today
    const orderedIds = [...inputs]
      .sort((a, b) => {
        const aKeyword = detectPowerKeyword(a.group.name)
        const bKeyword = detectPowerKeyword(b.group.name)
        const smartOrder: Record<string, number> = { today: 0, tomorrow: 1 }

        const rank = (input: DayGroupInput, keyword: ReturnType<typeof detectPowerKeyword>) => {
          if (keyword?.category === 'date' && keyword.keyword in smartOrder) {
            return smartOrder[keyword.keyword]
          }
          if (keyword?.category === 'day_of_week') {
            const dayIndex = parseInt(keyword.value, 10)
            if (!Number.isFinite(dayIndex)) return 99
            const dayNorm = (dayIndex - weekStart + 7) % 7
            const startNorm = (startFrom - weekStart + 7) % 7
            return 2 + ((dayNorm - startNorm + 7) % 7)
          }
          return 1000 + input.visualPos.x
        }

        const aRank = rank(a, aKeyword)
        const bRank = rank(b, bKeyword)
        return aRank === bRank ? a.visualPos.x - b.visualPos.x : aRank - bRank
      })
      .map((i) => i.group.id)

    const { groupMoves, taskMoves } = computeCanonicalLayout(inputs, orderedIds, {
      // TASK-1798: stack from directly under the header so tasks sitting low in
      // a group rise to the top. 'compactFromCurrentTop' anchored the stack at
      // the current topmost task, so low tasks stayed low — the user's bug.
      taskPositioning: 'fromHeader',
      // Explicit Tidy should make dense day groups usable. A single column turns
      // Today into a huge vertical stack, but keep the layout vertical-first:
      // at most two cards side by side, with measured card widths preventing overlap.
      maxTasksPerColumn: CANVAS.DAY_GROUP_MAX_TASKS_PER_COLUMN,
      maxColumns: 2,
    })
    pendingGroupMoves = groupMoves
    pendingTaskMoves = taskMoves

    // Apply store + PositionManager writes. Caller applies Vue Flow moves.
    try {
      for (const gm of groupMoves) {
        const input = inputs.find((i) => i.group.id === gm.groupId)
        if (!input?.group.position) continue
        canvasStore.updateGroup(gm.groupId, {
          position: {
            ...input.group.position,
            x: gm.position.x,
            y: gm.position.y,
            width: gm.size.width,
            height: gm.size.height,
          },
        })
        positionManager.updatePosition(gm.groupId, gm.position, 'user-drag', null)
      }
      for (const tm of taskMoves) {
        pendingWrites.push(taskStore.updateTask(tm.taskId, { canvasPosition: tm.position }, 'DRAG'))
        positionManager.updatePosition(tm.taskId, tm.position, 'user-drag', tm.parentId)
      }
    } catch (err) {
      release()
      throw err
    }

    console.log('[TIDY] Wrote', groupMoves.length, 'group moves +', taskMoves.length, 'task moves')
    return { groupMoves, taskMoves, pendingWrites: Promise.all(pendingWrites).then(() => undefined), release }
  }

  return { tidyDayGroups }
}
