/**
 * TASK-1756 v8: Tidy Layout composable.
 *
 * Wraps `computeCanonicalLayout` to produce a clean single-row layout for
 * every group on the canvas (day-of-week, smart Today/Tomorrow, AND
 * custom-named groups), preserving the user's current left-to-right X
 * order. Tasks inside each group are restacked vertically.
 *
 * Same move-application contract as rotation: returns { groupMoves,
 * taskMoves, release }. Caller applies Vue Flow moves via updateNode and
 * invokes release() on nextTick.
 */

import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import { canvasSyncInProgress } from './useCanvasSync'
import { positionManager } from '@/services/canvas/PositionManager'
import {
  computeCanonicalLayout,
  type DayGroupInput,
  type GroupMove,
  type TaskMove,
} from '@/composables/canvas/useCanonicalDayGroupLayout'
import { findMatchingGroupForDueDate } from '@/composables/canvas/useSmartGroupMatcher'

export interface TidyLayoutOptions {
  /** Read a Vue Flow node's current visual position. */
  getNodePosition?: (nodeId: string) => { x: number; y: number } | undefined
}

export function useTidyLayout(options: TidyLayoutOptions = {}) {
  const canvasStore = useCanvasStore()
  const taskStore = useTaskStore()

  /**
   * Lay out smart + day-of-week groups in a canonical single row, preserving
   * the user's current left-to-right X order. Restacks tasks inside each group.
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
      inputs.push({ group, visualPos, tasks })
    }

    if (inputs.length === 0) {
      release()
      return { groupMoves: [], taskMoves: [], release }
    }

    // Preserve user's left-to-right order: sort by current visual X.
    const orderedIds = [...inputs]
      .sort((a, b) => a.visualPos.x - b.visualPos.x)
      .map((i) => i.group.id)

    const { groupMoves, taskMoves } = computeCanonicalLayout(inputs, orderedIds, { taskLayout: 'horizontal' })

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
