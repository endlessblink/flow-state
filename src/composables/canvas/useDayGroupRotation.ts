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

import { nextTick, ref } from 'vue'
import { useDateTransition } from '@/composables/useDateTransition'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import { useSettingsStore } from '@/stores/settings'
import { detectPowerKeyword } from '@/composables/usePowerKeywords'
import { canvasSyncInProgress } from './useCanvasSync'
import { positionManager } from '@/services/canvas/PositionManager'
import { getDayGroupDate, toDateString } from '@/utils/dayGroupDate'

export interface DayGroupRotationOptions {
  /** Called with Vue Flow node moves after position rotation. Caller applies via updateNode(). */
  onMoves?: (moves: Array<{ nodeId: string; position: { x: number; y: number } }>) => void
  /** Read a Vue Flow node's current visual position. Used to ensure rotation works
   *  even when store and Vue Flow are out of sync. */
  getNodePosition?: (nodeId: string) => { x: number; y: number } | undefined
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
    return getDayGroupDate(dayIndex, new Date(), hasTodayOrTomorrow)
  }

  /**
   * Iterate all canvas groups, find day-of-week ones, and update the dueDate
   * of non-done tasks inside each group to the next occurrence of that weekday.
   *
   * Only dueDate is written — geometry (canvasPosition, parentId) is untouched.
   */
  function rotateDayGroups() {
    if (!settingsStore.enableDayGroupSuggestions) return

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

    if (count > 0) {
      rotatedGroupsCount.value = count
      lastRotationTime.value = new Date()
      showBanner.value = true
    }
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
  /** TASK-1756 v2: lay-out constants for stacked day-group detection. */
  const GROUP_SPACING = 420 // default canvas group width (350) + gutter (~70)
  const STACKED_X_SPREAD_THRESHOLD = 200

  function rotateDayGroupPositions(): {
    moves: Array<{ nodeId: string; position: { x: number; y: number } }>
    release: () => void
  } {
    console.log('[DAY-ROTATION] Rotating day group positions...')

    // TASK-1756 v2: hold canvasSyncInProgress across the caller's applyDayGroupMoves.
    // Callers MUST invoke release() after Vue Flow has absorbed the moves (typically
    // on nextTick). Without this, syncStoreToCanvas can flush between the store
    // write and updateNode() and revert positions via BUG-1504 preservation.
    canvasSyncInProgress.value = true
    let released = false
    const release = () => {
      if (released) return
      released = true
      canvasSyncInProgress.value = false
    }

    const groups = canvasStore.groups
    const moves: Array<{ nodeId: string; position: { x: number; y: number } }> = []

    // 1. Collect day-of-week groups with their dayIndex and visual position
    const dayGroups: Array<{ group: (typeof groups)[number]; dayIndex: number; visualPos: { x: number; y: number } }> = []
    for (const group of groups) {
      const keyword = detectPowerKeyword(group.name)
      if (keyword?.category !== 'day_of_week') continue
      const dayIndex = parseInt(keyword.value, 10)
      if (isNaN(dayIndex) || dayIndex < 0 || dayIndex > 6) continue
      if (!group.position) continue

      // Use Vue Flow position (what user sees) if available, else store position
      const vfPos = options.getNodePosition?.(`section-${group.id}`)
      const visualPos = vfPos ?? { x: group.position.x, y: group.position.y }
      dayGroups.push({ group, dayIndex, visualPos })
    }

    // Need at least 2 groups to rotate
    if (dayGroups.length < 2) {
      release()
      return { moves, release }
    }

    // DEBUG: Log collected groups and their positions
    console.log('[DAY-ROTATION] Day groups:', dayGroups.map(dg => ({
      name: dg.group.name, dayIndex: dg.dayIndex,
      visualPos: dg.visualPos,
      storePos: { x: dg.group.position!.x, y: dg.group.position!.y },
      vfFound: !!options.getNodePosition?.(`section-${dg.group.id}`)
    })))

    // 2. Build ordered slot list.
    //    TASK-1756 v2: if groups are stacked / tightly clustered (xSpread below
    //    threshold), synthesise a canonical row at fixed spacing instead of
    //    reusing the degenerate slot list. Otherwise preserve the user's
    //    layout and just sort their existing positions by X.
    const xs = dayGroups.map((dg) => dg.visualPos.x)
    const ys = dayGroups.map((dg) => dg.visualPos.y)
    const xSpread = Math.max(...xs) - Math.min(...xs)
    const stacked = xSpread < STACKED_X_SPREAD_THRESHOLD

    const slots = stacked
      ? dayGroups.map((_, i) => ({
          x: Math.min(...xs) + i * GROUP_SPACING,
          y: Math.min(...ys),
        }))
      : dayGroups
          .map((dg) => ({ x: dg.visualPos.x, y: dg.visualPos.y }))
          .sort((a, b) => a.x - b.x)

    // 3. Sort groups so the nearest upcoming day comes first.
    //    If "Today" and/or "Tomorrow" smart-groups exist on the canvas,
    //    day-of-week groups should start from the day AFTER tomorrow
    //    (those slots are already covered by the smart-groups).
    //    Normalize by weekStartsOn so Sunday lands at END when week starts Monday.
    const today = new Date().getDay() // 0=Sun … 6=Sat
    const weekStart = settingsStore.weekStartsOn // 0=Sun, 1=Mon

    // Check if Today/Tomorrow smart-groups exist — if so, offset by 2 days
    const hasSmartToday = groups.some((g) => {
      const kw = detectPowerKeyword(g.name)
      return kw?.category === 'date' && (kw.keyword === 'today' || kw.keyword === 'tomorrow')
    })
    const startFrom = hasSmartToday ? (today + 2) % 7 : today
    console.log('[DAY-ROTATION] today:', today, 'weekStart:', weekStart, 'startFrom:', startFrom, 'hasSmartToday:', hasSmartToday, 'stacked:', stacked, 'xSpread:', Math.round(xSpread))

    dayGroups.sort((a, b) => {
      const aNorm = (a.dayIndex - weekStart + 7) % 7
      const bNorm = (b.dayIndex - weekStart + 7) % 7
      const startNorm = (startFrom - weekStart + 7) % 7
      const aDist = (aNorm - startNorm + 7) % 7
      const bDist = (bNorm - startNorm + 7) % 7
      return aDist - bDist
    })

    console.log('[DAY-ROTATION] Sorted order:', dayGroups.map(dg => dg.group.name))
    console.log('[DAY-ROTATION] Slots:', slots)

    // 4. Apply position deltas — update store AND collect Vue Flow moves
    try {
      for (let i = 0; i < dayGroups.length; i++) {
        const { group, visualPos } = dayGroups[i]
        const targetSlot = slots[i]

        // Delta based on visual position (what user sees), not store
        const deltaX = targetSlot.x - visualPos.x
        const deltaY = targetSlot.y - visualPos.y

        // Skip if already in correct position
        if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) continue

        // Update store for persistence (preserve width/height from store)
        const storePos = group.position!
        canvasStore.updateGroup(group.id, {
          position: {
            ...storePos,
            x: targetSlot.x,
            y: targetSlot.y
          }
        })

        // Update PositionManager so sync pipeline reads new positions
        // (sync reads from PM first, falls back to store — PM must be current)
        positionManager.updatePosition(
          group.id,
          { x: targetSlot.x, y: targetSlot.y },
          'user-drag', // same source as drag handlers — approved geometry writer
          group.parentGroupId || null
        )

        // Collect Vue Flow move for the group node
        moves.push({
          nodeId: `section-${group.id}`,
          position: { x: targetSlot.x, y: targetSlot.y }
        })

        // Move child tasks by same delta
        const childTasks = taskStore.rawTasks.filter(
          (t) => t.parentId === group.id && t.canvasPosition
        )
        for (const task of childTasks) {
          const newX = task.canvasPosition!.x + deltaX
          const newY = task.canvasPosition!.y + deltaY
          taskStore.updateTask(
            task.id,
            { canvasPosition: { x: newX, y: newY } },
            'DRAG'
          )
          // Keep PositionManager in sync so the spatial validation in
          // useCanvasSync (BUG-1191) sees correct post-rotation positions
          // instead of orphaning the task from its parent group.
          positionManager.updatePosition(
            task.id,
            { x: newX, y: newY },
            'user-drag',
            group.id
          )
          // Task positions in Vue Flow are relative to parent, so
          // we don't need to emit Vue Flow moves for children.
        }
      }
    } catch (err) {
      release()
      throw err
    }

    return { moves, release }
  }

  function dismissBanner() {
    showBanner.value = false
  }

  // Hook into midnight transition — fires automatically at 00:00 each day
  useDateTransition({
    onDayChange: (_prev: Date, _next: Date) => {
      rotateDayGroups()
      // Auto-rotation guarded by feature flag (can be disabled if it causes issues)
      if (!settingsStore.enableDayGroupPositionRotation) return
      const { moves, release } = rotateDayGroupPositions()
      if (moves.length > 0 && options.onMoves) options.onMoves(moves)
      // TASK-1756 v2: release the sync gate only AFTER Vue Flow has absorbed
      // the moves from the onMoves callback. Otherwise the next microtask
      // can run syncStoreToCanvas before updateNode() reflects in getNodes.value.
      nextTick(release)
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
    rotateDayGroupPositions
  }
}
