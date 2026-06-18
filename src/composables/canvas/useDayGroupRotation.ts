/**
 * FEATURE-1048: Canvas Auto-Rotating Day Groups
 *
 * Watches for midnight transitions and updates dueDate on tasks inside
 * day-of-week canvas groups (Monday–Sunday) so date suffixes stay current.
 *
 * Also physically rotates group positions at midnight so today's group is
 * always leftmost (rotateDayGroupPositions). This is a discrete once-per-day
 * operation, not a continuous watcher — safe per canvas geometry invariants.
 *
 * GEOMETRY INVARIANT: rotateDayGroups() only modifies dueDate (metadata).
 * rotateDayGroupPositions() uses 'DRAG' source and sync suppression, as
 * approved for discrete geometry writes.
 */

import { ref } from 'vue'
import { useStorage } from '@vueuse/core'
import { useDateTransition } from '@/composables/useDateTransition'
import { useCurrentDay } from '@/composables/useCurrentDay'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import { useSettingsStore } from '@/stores/settings'
import { detectPowerKeyword } from '@/composables/usePowerKeywords'
import { canvasSyncInProgress } from './useCanvasSync'
import { positionManager } from '@/services/canvas/PositionManager'
import { getDayGroupDate, toDateString } from '@/utils/dayGroupDate'
import { findMatchingGroupForDueDate } from '@/composables/canvas/useSmartGroupMatcher'
import {
  computeCanonicalLayout,
  type DayGroupInput,
  type GroupMove,
  type TaskMove,
} from '@/composables/canvas/useCanonicalDayGroupLayout'
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

// TASK-1756: persisted "last rotation YYYY-MM-DD" — prevents double-rotation
// when mount catch-up, midnight setTimeout, and visibility/focus all fire on
// the same day. Module-scoped so every canvas mount shares the same marker
// and cross-tab syncs via the native `storage` event.
const lastRotationDate = useStorage<string>('flowstate:day-group-last-rotation', '')

/** Test helper — read the current marker (bypasses useStorage async flush). */
export function __getLastRotationDateForTest(): string {
  return lastRotationDate.value
}

/** Test helper — set the marker directly so tests can simulate a prior run. */
export function __setLastRotationDateForTest(value: string): void {
  lastRotationDate.value = value
}

export interface DayGroupRotationOptions {
  /**
   * Called with Vue Flow moves after rotation. Caller applies position +
   * size to VF via updateNode(id, { position, style }).
   */
  onMoves?: (moves: GroupMove[]) => void
  /** Read a Vue Flow node's current visual position. Used to ensure rotation works
   *  even when store and Vue Flow are out of sync. */
  getNodePosition?: (nodeId: string) => { x: number; y: number } | undefined
  /** Read a Vue Flow node's current rendered dimensions for stable task stacking. */
  getNodeSize?: (nodeId: string) => { width: number; height: number } | undefined
  /** Return false when a task node is currently hidden/not rendered on canvas. */
  isTaskVisible?: (taskId: string) => boolean | undefined
}

function isOverdue(dueDate?: string | null) {
  if (!dueDate) return false
  const due = new Date(dueDate)
  if (!Number.isFinite(due.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

function isRotatableDayGroup(groupName: string): boolean {
  const keyword = detectPowerKeyword(groupName)
  if (!keyword) return false
  if (keyword.category === 'day_of_week') return true
  return keyword.category === 'date' && (keyword.keyword === 'today' || keyword.keyword === 'tomorrow')
}

export function useDayGroupRotation(options: DayGroupRotationOptions = {}) {
  const canvasStore = useCanvasStore()
  const taskStore = useTaskStore()
  const settingsStore = useSettingsStore()

  const rotatedGroupsCount = ref(0)
  const lastRotationTime = ref<Date | null>(null)
  const showBanner = ref(false)

  /**
   * Compute the next calendar date that falls on the given JS day-of-week index.
   * Delegates to shared helper so the group header and rotation agree.
   */
  function getNextOccurrence(dayIndex: number): Date {
    const hasTodayOrTomorrow = canvasStore.groups.some((g) => {
      const kw = detectPowerKeyword(g.name)
      return kw?.category === 'date' && (kw.keyword === 'today' || kw.keyword === 'tomorrow')
    })
    // TASK-1756: read the reactive "today" so header suffix + rotation agree
    // even if "today" has flipped since initial mount.
    return getDayGroupDate(dayIndex, useCurrentDay().value, hasTodayOrTomorrow)
  }

  /**
   * Iterate all canvas groups, find day-of-week ones, and update the dueDate
   * of non-done tasks inside each group to the next occurrence of that weekday.
   *
   * Only dueDate is written — geometry (canvasPosition, parentId) is untouched.
   */
  function rotateDayGroups(opts: { force?: boolean } = {}) {
    if (!settingsStore.enableDayGroupSuggestions) return

    // TASK-1756: persisted guard — skip if we already rotated today (unless
    // the caller forces it, e.g. toolbar button).
    const todayStr = toDateString(useCurrentDay().value)
    if (!opts.force && lastRotationDate.value === todayStr) return

    const groups = canvasStore.groups
    let count = 0

    for (const group of groups) {
      const keyword = detectPowerKeyword(group.name)
      if (keyword?.category !== 'day_of_week') continue

      // keyword.value is the stringified JS day index (e.g. "1" for Monday)
      const dayIndex = parseInt(keyword.value, 10)
      if (isNaN(dayIndex) || dayIndex < 0 || dayIndex > 6) continue

      const nextDate = getNextOccurrence(dayIndex)
      const nextDateStr = toDateString(nextDate)

      // Update metadata-only for non-done tasks in this group
      const tasksInGroup = taskStore.rawTasks.filter(
        (t) => t.parentId === group.id && t.status !== 'done'
      )

      for (const task of tasksInGroup) {
        // Skip if dueDate already matches — avoid unnecessary writes
        if (task.dueDate === nextDateStr) continue

        // GEOMETRY INVARIANT: source = 'SMART-GROUP' → no geometry changes
        taskStore.updateTask(task.id, { dueDate: nextDateStr }, 'SMART-GROUP')
      }

      count++
    }

    // TASK-1756: write the marker even when no tasks changed — we still
    // "rotated" in the sense that today was processed; no need to re-enter
    // on the next visibility/focus event.
    if (count > 0) {
      rotatedGroupsCount.value = count
      lastRotationTime.value = new Date()
      showBanner.value = true
    }
    lastRotationDate.value = todayStr
  }

  /**
   * Physically rotate day-of-week group positions so that today's group is
   * leftmost, with subsequent days flowing left-to-right.
   *
   * Algorithm:
   *  1. Collect groups that have a day_of_week power-keyword.
   *  2. Sort their current X positions to build an ordered list of "slots".
   *  3. Re-sort the groups by distance from today (today=0, tomorrow=1, …).
   *  4. Assign each group to the slot at the same rank and move it + its
   *     child tasks by the resulting delta.
   *
   * This is a discrete once-per-day write, not a continuous watcher.
   * canvasSyncInProgress is set during the batch to prevent spurious sync.
   */
  /**
   * Returns an array of { nodeId, position } for all nodes that need to move.
   * The caller (CanvasView) must apply these to Vue Flow directly via updateNode().
   * Store positions are also updated for persistence.
   */
  // TASK-1756 v8: layout constants moved to `@/constants/canvas` (DAY_GROUP_*).
  // The canonical primitive owns all layout math now.

  function rotateDayGroupPositions(): {
    groupMoves: GroupMove[]
    taskMoves: TaskMove[]
    pendingWrites: Promise<void>
    release: () => void
  } {
    console.log('[DAY-ROTATION] Rotating day group positions...')

    // TASK-1756 v2: hold canvasSyncInProgress across the caller's apply step.
    // Callers MUST invoke release() after Vue Flow has absorbed the moves
    // (typically on nextTick). Without this, syncStoreToCanvas can flush
    // between the store writes and updateNode() and revert geometry via
    // BUG-1504 preservation.
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

    const groups = canvasStore.groups

    // Collect BOTH day-of-week and smart (Today/Tomorrow) groups. The canonical
    // primitive arranges whatever we pass; we filter to the relevant set here
    // and decide sort order below.
    type WithKeyword = DayGroupInput & {
      category: 'date' | 'day_of_week'
      keyword: string
      dayIndex: number | null
    }
    const layoutTasks = taskStore.rawTasks.filter((task) => {
      if (!task.canvasPosition) return false
      if (task._soft_deleted || task.isCompletionRecord || task.isPinned) return false
      if (taskStore.hideCanvasDoneTasks && task.status === 'done') return false
      if (taskStore.hideCanvasOverdueTasks && isOverdue(task.dueDate)) return false
      return options.isTaskVisible?.(task.id) !== false
    })
    const rotatableGroupIds = new Set(
      groups
        .filter((group) => group.position && isRotatableDayGroup(group.name))
        .map((group) => group.id)
    )
    const rehomedParents = new Map<string, string>()
    for (const task of layoutTasks) {
      if (!task.dueDate) continue
      const matchingGroup = findMatchingGroupForDueDate(task.dueDate, groups)
      if (!matchingGroup || !rotatableGroupIds.has(matchingGroup.id)) continue
      if (task.parentId !== matchingGroup.id) rehomedParents.set(task.id, matchingGroup.id)
    }

    const inputs: WithKeyword[] = []
    for (const group of groups) {
      const keyword = detectPowerKeyword(group.name)
      if (!keyword || !isRotatableDayGroup(group.name)) continue
      if (!group.position) continue
      const category: 'date' | 'day_of_week' =
        keyword.category === 'day_of_week' ? 'day_of_week' : 'date'

      const vfPos = options.getNodePosition?.(`section-${group.id}`)
      const visualPos = vfPos ?? { x: group.position.x, y: group.position.y }
      const tasks = layoutTasks.filter((t) => (rehomedParents.get(t.id) ?? t.parentId) === group.id)
      const taskSizes = new Map<string, { width: number; height: number }>()
      const taskPositions = new Map<string, { x: number; y: number }>()
      for (const task of tasks) {
        const size = options.getNodeSize?.(task.id)
        if (size) taskSizes.set(task.id, size)
        const position = options.getNodePosition?.(task.id)
        if (position) taskPositions.set(task.id, position)
      }

      const dayIndex =
        keyword.category === 'day_of_week'
          ? parseInt(keyword.value, 10)
          : null
      if (dayIndex !== null && (isNaN(dayIndex) || dayIndex < 0 || dayIndex > 6)) continue

      inputs.push({
        group,
        visualPos,
        tasks,
        taskSizes,
        taskPositions,
        category,
        keyword: keyword.keyword,
        dayIndex,
      })
    }

    if (inputs.length < 2) {
      release()
      return { groupMoves: [], taskMoves: [], pendingWrites: Promise.resolve(), release }
    }

    console.log(
      '[DAY-ROTATION] Inputs:',
      inputs.map((i) => ({ name: i.group.name, category: i.category, taskCount: i.tasks.length }))
    )

    // Sort: Today → Tomorrow → day-of-week by weekday-distance-from-startFrom.
    const today = new Date().getDay() // 0=Sun … 6=Sat. Explicit toolbar rotation must use the live clock.
    const weekStart = settingsStore.weekStartsOn
    const hasSmartToday = inputs.some(
      (i) => i.category === 'date' && (i.keyword === 'today' || i.keyword === 'tomorrow')
    )
    const startFrom = hasSmartToday ? (today + 2) % 7 : today

    const sortedInputs = [...inputs].sort((a, b) => {
      // Smart groups first (Today before Tomorrow).
      const smartOrder: Record<string, number> = { today: 0, tomorrow: 1 }
      const aSmart = a.category === 'date' ? smartOrder[a.keyword] ?? 99 : 99
      const bSmart = b.category === 'date' ? smartOrder[b.keyword] ?? 99 : 99
      if (a.category === 'date' && b.category === 'date') return aSmart - bSmart
      if (a.category === 'date') return -1
      if (b.category === 'date') return 1
      // Both day_of_week — sort by distance from startFrom.
      const aDay = a.dayIndex ?? 0
      const bDay = b.dayIndex ?? 0
      const aNorm = (aDay - weekStart + 7) % 7
      const bNorm = (bDay - weekStart + 7) % 7
      const startNorm = (startFrom - weekStart + 7) % 7
      const aDist = (aNorm - startNorm + 7) % 7
      const bDist = (bNorm - startNorm + 7) % 7
      return aDist - bDist
    })

    const orderedIds = sortedInputs.map((i) => i.group.id)
    console.log(
      '[DAY-ROTATION] Sorted order:',
      sortedInputs.map((i) => i.group.name)
    )

    const { groupMoves: allGroupMoves, taskMoves: allTaskMoves } = computeCanonicalLayout(
      inputs.map((i) => ({ group: i.group, visualPos: i.visualPos, tasks: i.tasks, taskSizes: i.taskSizes, taskPositions: i.taskPositions })),
      orderedIds,
      {
        taskPositioning: 'fromHeader',
        maxTasksPerColumn: null,
        taskSpacing: 'contentGap',
      }
    )
    // TASK-1871: skip NO-OP moves (target == current). Without this, rotation re-wrote
    // identical positions every time it ran, flooding the API ("rate limit exceeded").
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
      const task = taskStore.rawTasks.find((x) => x.id === tm.taskId)
      const cp = task?.canvasPosition
      const rehomedParentId = rehomedParents.get(tm.taskId)
      if (rehomedParentId !== undefined && task?.parentId !== rehomedParentId) return true
      if (!cp) return true
      return Math.abs(cp.x - tm.position.x) > EPS || Math.abs(cp.y - tm.position.y) > EPS
    })
    pendingGroupMoves = groupMoves
    pendingTaskMoves = taskMoves

    const affectedIds = [...new Set([
      ...groupMoves.map((move) => move.groupId),
      ...taskMoves.map((move) => move.taskId),
    ])]
    const undoSystem = getUndoSystem()
    const snapshotBefore = cloneCanvasGeometrySnapshot(taskStore.rawTasks, canvasStore.groups, affectedIds)

    // Apply STORE + PositionManager writes synchronously. The caller applies
    // Vue Flow moves via updateNode with both position AND style (width/height).
    try {
      for (const gm of groupMoves) {
        const storePos = inputs.find((i) => i.group.id === gm.groupId)?.group.position
        if (!storePos) continue
        canvasStore.updateGroup(gm.groupId, {
          position: {
            ...storePos,
            x: gm.position.x,
            y: gm.position.y,
            width: gm.size.width,
            height: gm.size.height,
          },
        })
        positionManager.updatePosition(
          gm.groupId,
          gm.position,
          'user-drag',
          null
        )
      }
      for (const tm of taskMoves) {
        const rehomedParentId = rehomedParents.get(tm.taskId)
        pendingWrites.push(taskStore.updateTask(
          tm.taskId,
          rehomedParentId
            ? { parentId: rehomedParentId, canvasPosition: tm.position, positionFormat: 'absolute' }
            : { canvasPosition: tm.position, positionFormat: 'absolute' },
          'DRAG'
        ))
        positionManager.updatePosition(tm.taskId, tm.position, 'user-drag', rehomedParentId ?? tm.parentId)
      }
    } catch (err) {
      release()
      throw err
    }

    const pendingWritesWithUndo = Promise.all(pendingWrites).then(() => {
      if (groupMoves.length > 0 || taskMoves.length > 0) {
        const snapshotAfter = cloneCanvasGeometrySnapshot(taskStore.rawTasks, canvasStore.groups, affectedIds)
        undoSystem.pushCanvasGeometryUndoSnapshot(
          `Rotate ${affectedIds.length} canvas day item${affectedIds.length === 1 ? '' : 's'}`,
          affectedIds,
          snapshotBefore,
          snapshotAfter
        )
      }
    })

    return { groupMoves, taskMoves, pendingWrites: pendingWritesWithUndo, release }
  }

  function dismissBanner() {
    showBanner.value = false
  }

  /**
   * TASK-1756: idempotent "catch up if today hasn't been rotated yet".
   * Safe to call on mount, on canvas-ready, on `useCurrentDay` flip, on
   * visibility regain — the persisted `lastRotationDate` guard inside
   * `rotateDayGroups()` makes repeated calls no-ops until the day changes.
   *
   * Automatic catch-up must be metadata-only. Calling rotateDayGroupPositions()
   * here writes canonical group positions into the store before CanvasView can
   * choose not to apply them visually, which resets manually arranged spacing on
   * app reload/update. Geometry changes are reserved for explicit user actions.
   */
  function runCatchupIfNeeded(): {
    groupMoves: GroupMove[]
    taskMoves: TaskMove[]
    release: () => void
  } {
    const todayStr = toDateString(useCurrentDay().value)
    if (lastRotationDate.value === todayStr) {
      return { groupMoves: [], taskMoves: [], release: () => {} }
    }
    rotateDayGroups()
    return { groupMoves: [], taskMoves: [], release: () => {} }
  }

  // Hook into midnight transition — fires automatically at 00:00 each day
  useDateTransition({
    onDayChange: (_prev: Date, _next: Date) => {
      rotateDayGroups()
    }
  })

  return {
    rotatedGroupsCount,
    lastRotationTime,
    showBanner,
    dismissBanner,
    /** Expose for manual trigger (e.g. testing or on-mount warm-up) */
    rotateDayGroups,
    /** Expose for manual trigger and testing */
    rotateDayGroupPositions,
    /** TASK-1756: idempotent catch-up for mount / visibility / midnight */
    runCatchupIfNeeded
  }
}
