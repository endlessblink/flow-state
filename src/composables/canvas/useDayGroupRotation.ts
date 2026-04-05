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
import { useDateTransition } from '@/composables/useDateTransition'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import { useSettingsStore } from '@/stores/settings'
import { detectPowerKeyword } from '@/composables/usePowerKeywords'
import { canvasSyncInProgress } from './useCanvasSync'

export function useDayGroupRotation() {
  const canvasStore = useCanvasStore()
  const taskStore = useTaskStore()
  const settingsStore = useSettingsStore()

  const rotatedGroupsCount = ref(0)
  const lastRotationTime = ref<Date | null>(null)
  const showBanner = ref(false)

  /**
   * Compute the next (or current) calendar date that falls on the given JS
   * day-of-week index (0 = Sunday … 6 = Saturday).
   *
   * If today IS that day, we return today (daysUntil = 0).
   * Otherwise we return the next future occurrence.
   */
  function getNextOccurrence(dayIndex: number): Date {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const currentDay = today.getDay()
    let daysUntil = dayIndex - currentDay
    if (daysUntil < 0) daysUntil += 7
    const result = new Date(today)
    result.setDate(result.getDate() + daysUntil)
    return result
  }

  /**
   * Format a Date as YYYY-MM-DD (local time).
   */
  function toDateString(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
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
  function rotateDayGroupPositions() {
    console.log('[DAY-ROTATION] Rotating day group positions...')

    const groups = canvasStore.groups

    // 1. Collect day-of-week groups with their dayIndex
    const dayGroups: Array<{ group: (typeof groups)[number]; dayIndex: number }> = []
    for (const group of groups) {
      const keyword = detectPowerKeyword(group.name)
      if (keyword?.category !== 'day_of_week') continue
      const dayIndex = parseInt(keyword.value, 10)
      if (isNaN(dayIndex) || dayIndex < 0 || dayIndex > 6) continue
      if (!group.position) continue
      dayGroups.push({ group, dayIndex })
    }

    // Need at least 2 groups to rotate
    if (dayGroups.length < 2) return

    // 2. Sort current positions by X to build ordered slot list
    const slots = dayGroups
      .map((dg) => ({ x: dg.group.position!.x, y: dg.group.position!.y }))
      .sort((a, b) => a.x - b.x)

    // 3. Sort groups so today comes first, then tomorrow, etc.
    //    Normalize by weekStartsOn so Sunday lands at END when week starts Monday.
    const today = new Date().getDay() // 0=Sun … 6=Sat
    const weekStart = settingsStore.weekStartsOn // 0=Sun, 1=Mon
    dayGroups.sort((a, b) => {
      const aNorm = (a.dayIndex - weekStart + 7) % 7
      const bNorm = (b.dayIndex - weekStart + 7) % 7
      const todayNorm = (today - weekStart + 7) % 7
      const aDist = (aNorm - todayNorm + 7) % 7
      const bDist = (bNorm - todayNorm + 7) % 7
      return aDist - bDist
    })

    // 4. Apply position deltas under sync suppression
    canvasSyncInProgress.value = true
    try {
      for (let i = 0; i < dayGroups.length; i++) {
        const { group } = dayGroups[i]
        const targetSlot = slots[i]
        const currentPos = group.position!

        const deltaX = targetSlot.x - currentPos.x
        const deltaY = targetSlot.y - currentPos.y

        // Skip if already in correct position
        if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) continue

        // Move group
        canvasStore.updateGroup(group.id, {
          position: {
            ...currentPos,
            x: targetSlot.x,
            y: targetSlot.y
          }
        })

        // Move child tasks by same delta
        const childTasks = taskStore.rawTasks.filter(
          (t) => t.parentId === group.id && t.canvasPosition
        )
        for (const task of childTasks) {
          taskStore.updateTask(
            task.id,
            {
              canvasPosition: {
                x: task.canvasPosition!.x + deltaX,
                y: task.canvasPosition!.y + deltaY
              }
            },
            'DRAG' // approved geometry write source
          )
        }
      }
    } finally {
      canvasSyncInProgress.value = false
    }
  }

  function dismissBanner() {
    showBanner.value = false
  }

  // Hook into midnight transition — fires automatically at 00:00 each day
  useDateTransition({
    onDayChange: (_prev: Date, _next: Date) => {
      rotateDayGroups()
      // Auto-rotation guarded by feature flag (can be disabled if it causes issues)
      if (settingsStore.enableDayGroupPositionRotation) {
        rotateDayGroupPositions()
      }
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
