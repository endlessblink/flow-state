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
import { detectPowerKeyword } from '@/composables/usePowerKeywords'
import { getDeepestContainingGroup } from '@/utils/canvas/spatialContainment'
import { getUndoSystem } from '@/composables/undoSingleton'

function cloneCanvasGeometrySnapshot(
  tasks: unknown[],
  groups: unknown[],
  affectedIds: string[]
) {
  const ids = new Set(affectedIds)
  return JSON.parse(JSON.stringify({
    tasks: tasks.filter((task) => ids.has((task as { id: string }).id)),
    groups,
  }))
}

function findColumnContainingGroup(
  task: { position: { x: number; y: number }; width?: number; height?: number },
  groups: Array<{ id: string; position?: { x: number; y: number; width?: number; height?: number } }>
) {
  const taskWidth = task.width ?? 220
  const centerX = task.position.x + taskWidth / 2
  const candidates = groups.filter((group) => {
    if (!group.position) return false
    const width = group.position.width ?? 400
    return centerX >= group.position.x
      && centerX <= group.position.x + width
      && task.position.y >= group.position.y
  })

  if (candidates.length === 0) return null
  return candidates.reduce((closest, current) => {
    const closestDistance = Math.abs(task.position.y - (closest.position?.y ?? 0))
    const currentDistance = Math.abs(task.position.y - (current.position?.y ?? 0))
    return currentDistance < closestDistance ? current : closest
  })
}

export interface TidyLayoutOptions {
  /** Read a Vue Flow node's current visual position. */
  getNodePosition?: (nodeId: string) => { x: number; y: number } | undefined
  /** Read a Vue Flow node's current rendered dimensions. */
  getNodeSize?: (nodeId: string) => { width: number; height: number } | undefined
  /** Return false when a task node is currently hidden/not rendered on canvas. */
  isTaskVisible?: (taskId: string) => boolean | undefined
}

interface TidyPlan {
  inputs: DayGroupInput[]
  groupMoves: GroupMove[]
  taskMoves: TaskMove[]
  adoptedParents: Map<string, string>
}

function isOverdue(dueDate?: string | null) {
  if (!dueDate) return false
  const due = new Date(dueDate)
  if (!Number.isFinite(due.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

export function useTidyLayout(options: TidyLayoutOptions = {}) {
  const canvasStore = useCanvasStore()
  const taskStore = useTaskStore()
  const settingsStore = useSettingsStore()

  function planTidyDayGroups(): TidyPlan {
    // Collect every visible group with a position. Day-of-week / smart / custom
    // all get the canonical single-row treatment so the Tidy button always does
    // something visible regardless of the user's group naming.
    const visibleGroups = canvasStore.groups.filter((group) => group.position && group.isVisible !== false)

    // Tidy should not move already-parented tasks between groups by due date or
    // geometry. It can safely repair loose canvas tasks that are visibly inside
    // a group, because otherwise the user sees them in the group but Tidy has no
    // membership to stack.
    const layoutTasks = taskStore.rawTasks.filter((task) => {
      if (!task.canvasPosition) return false
      if (task._soft_deleted || task.isCompletionRecord || task.isPinned) return false
      if (taskStore.hideCanvasDoneTasks && task.status === 'done') return false
      if (taskStore.hideCanvasOverdueTasks && isOverdue(task.dueDate)) return false
      return options.isTaskVisible?.(task.id) !== false
    })

    const adoptedParents = new Map<string, string>()
    for (const task of layoutTasks) {
      if (task.parentId) continue

      const absPos = options.getNodePosition?.(task.id) ?? task.canvasPosition
      if (!absPos) continue
      const size = options.getNodeSize?.(task.id)
      const spatialTask = { position: absPos, width: size?.width, height: size?.height }
      const containing =
        getDeepestContainingGroup(spatialTask, visibleGroups) ??
        findColumnContainingGroup(spatialTask, visibleGroups)
      if (containing) adoptedParents.set(task.id, containing.id)
    }
    if (adoptedParents.size > 0) {
      console.log('[TIDY] Adopted', adoptedParents.size, 'loose tasks into containing groups')
    }

    const inputs: DayGroupInput[] = []
    for (const group of visibleGroups) {
      const vfPos = options.getNodePosition?.(`section-${group.id}`)
      const visualPos = vfPos ?? { x: group.position.x, y: group.position.y }
      const tasks = layoutTasks.filter((t) => (adoptedParents.get(t.id) ?? t.parentId) === group.id)
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
      return { inputs: [], groupMoves: [], taskMoves: [], adoptedParents }
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
      // Tidy is vertical-first: keep the user's preferred single-column stack.
      // The group may grow tall, but cards should never jump into side-by-side columns.
      maxTasksPerColumn: null,
      // Use measured card heights so the visible blank space between cards is
      // consistent. Equal top-edge rows look uneven when cards have different
      // rendered heights.
      taskSpacing: 'contentGap',
    })

    return { inputs, groupMoves, taskMoves, adoptedParents }
  }

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
    let pendingGroupMoves: GroupMove[] = []
    let pendingTaskMoves: TaskMove[] = []
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
    const { inputs, groupMoves: allGroupMoves, taskMoves: allTaskMoves, adoptedParents } = planTidyDayGroups()

    // TASK-1871: Drop NO-OP moves (target == current position/parent). The canonical
    // layout emits a move for EVERY group/task regardless of whether it changed, so
    // re-running tidy re-wrote identical positions (x=1616 -> 1616) — hundreds of
    // pointless saves that flooded the API ("API rate limit exceeded") and cascaded
    // into auth/sync failures. Skipping unchanged moves makes re-runs write nothing.
    const EPS = 0.5
    const groupMoves = allGroupMoves.filter((gm) => {
      const p = canvasStore.groups.find((g) => g.id === gm.groupId)?.position
      if (!p) return true
      return Math.abs((p.x ?? 0) - gm.position.x) > EPS
        || Math.abs((p.y ?? 0) - gm.position.y) > EPS
        || Math.abs((p.width ?? 0) - gm.size.width) > EPS
        || Math.abs((p.height ?? 0) - gm.size.height) > EPS
    })
    const taskMoves = allTaskMoves.filter((tm) => {
      const t = taskStore.rawTasks.find((x) => x.id === tm.taskId)
      const cp = t?.canvasPosition
      const adopted = adoptedParents.get(tm.taskId)
      const parentChanged = adopted !== undefined && t?.parentId !== adopted
      if (parentChanged) return true
      if (!cp) return true
      return Math.abs(cp.x - tm.position.x) > EPS || Math.abs(cp.y - tm.position.y) > EPS
    })
    pendingGroupMoves = groupMoves
    pendingTaskMoves = taskMoves

    if (inputs.length === 0 || (groupMoves.length === 0 && taskMoves.length === 0)) {
      release()
      return { groupMoves: [], taskMoves: [], pendingWrites: Promise.resolve(), release }
    }

    const affectedIds = [...new Set([
      ...groupMoves.map((move) => move.groupId),
      ...taskMoves.map((move) => move.taskId),
    ])]
    const undoSystem = getUndoSystem()
    const snapshotBefore = cloneCanvasGeometrySnapshot(taskStore.rawTasks, canvasStore.groups, affectedIds)

    // Apply store + PositionManager writes synchronously. Caller applies Vue
    // Flow moves immediately after this function returns.
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
        const adoptedParentId = adoptedParents.get(tm.taskId)
        pendingWrites.push(taskStore.updateTask(
          tm.taskId,
          adoptedParentId
            ? { parentId: adoptedParentId, canvasPosition: tm.position, positionFormat: 'absolute' }
            : { canvasPosition: tm.position, positionFormat: 'absolute' },
          'DRAG'
        ))
        positionManager.updatePosition(tm.taskId, tm.position, 'user-drag', tm.parentId)
      }
    } catch (err) {
      release()
      throw err
    }

    const pendingWritesWithUndo = Promise.all(pendingWrites).then(() => {
      if (groupMoves.length > 0 || taskMoves.length > 0) {
        const snapshotAfter = cloneCanvasGeometrySnapshot(taskStore.rawTasks, canvasStore.groups, affectedIds)
        undoSystem.pushCanvasGeometryUndoSnapshot(
          `Tidy ${affectedIds.length} canvas item${affectedIds.length === 1 ? '' : 's'}`,
          affectedIds,
          snapshotBefore,
          snapshotAfter
        )
      }
    })

    console.log('[TIDY] Wrote', groupMoves.length, 'group moves +', taskMoves.length, 'task moves')
    return { groupMoves, taskMoves, pendingWrites: pendingWritesWithUndo, release }
  }

  /**
   * TASK-1809: Plan a single-column restack for ONE group. Pure — no mutations.
   *
   * Used by Shift-drag reorder: tasks inside the target group are re-stacked
   * from the header down in their current Y order, so a card dropped higher up
   * rises to the top and the rest shift down (insert-and-shift). Reuses
   * computeCanonicalLayout but scoped to the single group, so neither the group
   * nor its siblings move on X — only the group's height grows to fit.
   */
  function planReorderColumn(groupId: string): {
    input: DayGroupInput | null
    groupMoves: GroupMove[]
    taskMoves: TaskMove[]
  } {
    const group = canvasStore.groups.find((g) => g.id === groupId)
    if (!group?.position) return { input: null, groupMoves: [], taskMoves: [] }

    const layoutTasks = taskStore.rawTasks.filter((task) => {
      if (task.parentId !== groupId) return false
      if (!task.canvasPosition) return false
      if (task._soft_deleted || task.isCompletionRecord || task.isPinned) return false
      if (taskStore.hideCanvasDoneTasks && task.status === 'done') return false
      if (taskStore.hideCanvasOverdueTasks && isOverdue(task.dueDate)) return false
      return options.isTaskVisible?.(task.id) !== false
    })

    // Nothing to reorder with fewer than 2 cards.
    if (layoutTasks.length < 2) return { input: null, groupMoves: [], taskMoves: [] }

    const vfPos = options.getNodePosition?.(`section-${groupId}`)
    const visualPos = vfPos ?? { x: group.position.x, y: group.position.y }
    const taskSizes = new Map<string, { width: number; height: number }>()
    const taskPositions = new Map<string, { x: number; y: number }>()
    for (const task of layoutTasks) {
      const size = options.getNodeSize?.(task.id)
      if (size) taskSizes.set(task.id, size)
      const position = options.getNodePosition?.(task.id)
      if (position) taskPositions.set(task.id, position)
    }

    const input: DayGroupInput = { group, visualPos, tasks: layoutTasks, taskSizes, taskPositions }
    const { groupMoves, taskMoves } = computeCanonicalLayout([input], [groupId], {
      taskPositioning: 'fromHeader',
      maxTasksPerColumn: null,
      taskSpacing: 'contentGap',
    })
    return { input, groupMoves, taskMoves }
  }

  /**
   * TASK-1809b: Apply a single-column restack for ONE group (F2-drag reorder),
   * split so the visual paint is INSTANT and the task persistence is deferred.
   *
   * Synchronous part: set `canvasSyncInProgress`, plan, apply GROUP geometry
   * (height — not raced by a task drag), acquire group lock, capture the undo
   * "before" snapshot, and return the moves. The caller paints these moves via
   * `applyCanonicalMoves` immediately.
   *
   * Deferred `commit()`: writes each TASK's `canvasPosition` (and PositionManager
   * entry). The wrapper calls `commit()` AFTER awaiting the drag handler's own
   * write, so reorder's `updated_at` lands last and wins the last-write-wins race
   * — otherwise a refresh would revert the card to its raw drop position.
   */
  function reorderColumn(groupId: string): {
    groupMoves: GroupMove[]
    taskMoves: TaskMove[]
    commit: () => Promise<void>
    release: () => void
  } {
    canvasSyncInProgress.value = true
    let released = false
    let pendingGroupMoves: GroupMove[] = []
    let pendingTaskMoves: TaskMove[] = []
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

    const { input, groupMoves, taskMoves } = planReorderColumn(groupId)
    pendingGroupMoves = groupMoves
    pendingTaskMoves = taskMoves

    if (!input || taskMoves.length === 0) {
      release()
      return { groupMoves: [], taskMoves: [], commit: () => Promise.resolve(), release }
    }

    const affectedIds = [...new Set([
      ...groupMoves.map((move) => move.groupId),
      ...taskMoves.map((move) => move.taskId),
    ])]
    const undoSystem = getUndoSystem()
    const snapshotBefore = cloneCanvasGeometrySnapshot(taskStore.rawTasks, canvasStore.groups, affectedIds)

    // Group geometry is local-store only and not raced by a task drag — apply it
    // synchronously so the painted group box matches the restack immediately.
    try {
      for (const gm of groupMoves) {
        if (!input.group.position) continue
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
    } catch (err) {
      release()
      throw err
    }

    let committed = false
    const commit = (): Promise<void> => {
      if (committed) return Promise.resolve()
      committed = true
      const pendingWrites: Promise<unknown>[] = []
      for (const tm of taskMoves) {
        pendingWrites.push(taskStore.updateTask(
          tm.taskId,
          { canvasPosition: tm.position, positionFormat: 'absolute' },
          'DRAG'
        ))
        // PositionManager updated here (after the drag handler's write) so the
        // reorder position is the authoritative one during subsequent syncs.
        positionManager.updatePosition(tm.taskId, tm.position, 'user-drag', tm.parentId)
      }
      return Promise.all(pendingWrites).then(() => {
        const snapshotAfter = cloneCanvasGeometrySnapshot(taskStore.rawTasks, canvasStore.groups, affectedIds)
        undoSystem.pushCanvasGeometryUndoSnapshot(
          `Reorder ${taskMoves.length} task${taskMoves.length === 1 ? '' : 's'}`,
          affectedIds,
          snapshotBefore,
          snapshotAfter
        )
      })
    }

    return { groupMoves, taskMoves, commit, release }
  }

  return { tidyDayGroups, planTidyDayGroups, reorderColumn, planReorderColumn }
}
