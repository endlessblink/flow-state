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
    release: () => void
  } {
    console.log('[TIDY] Tidying day-group layout...')

    canvasSyncInProgress.value = true
    let released = false
    const release = () => {
      if (released) return
      released = true
      canvasSyncInProgress.value = false
    }

    // TASK-1756 v10: re-home orphans first. Prior buggy versions of
    // rotation/tidy wrote task positions that fell outside their parents'
    // new bounds → BUG-1203 cleared parentId on those tasks. Tidy should
    // heal that state by reattaching orphans whose dueDate matches an
    // existing day-group, so the next step can restack them canonically.
    let rehomedCount = 0
    for (const task of taskStore.rawTasks) {
      if (task.parentId) continue
      if (!task.canvasPosition) continue // inbox-only, skip
      if (!task.dueDate) continue
      const match = findMatchingGroupForDueDate(task.dueDate, canvasStore.groups)
      if (match) {
        taskStore.updateTask(task.id, { parentId: match.id }, 'DRAG')
        rehomedCount++
      }
    }
    if (rehomedCount > 0) {
      console.log('[TIDY] Re-homed', rehomedCount, 'orphaned tasks into matching day-groups')
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
      for (const task of tasks) {
        const size = options.getNodeSize?.(task.id)
        if (size) taskSizes.set(task.id, size)
      }
      inputs.push({ group, visualPos, tasks, taskSizes })
    }

    if (inputs.length === 0) {
      release()
      return { groupMoves: [], taskMoves: [], release }
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
      taskPositioning: 'compactFromCurrentTop',
    })

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
        taskStore.updateTask(tm.taskId, { canvasPosition: tm.position }, 'DRAG')
        positionManager.updatePosition(tm.taskId, tm.position, 'user-drag', tm.parentId)
      }
    } catch (err) {
      release()
      throw err
    }

    console.log('[TIDY] Wrote', groupMoves.length, 'group moves +', taskMoves.length, 'task moves')
    return { groupMoves, taskMoves, release }
  }

  return { tidyDayGroups }
}
