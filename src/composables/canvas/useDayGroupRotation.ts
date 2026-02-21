/**
 * FEATURE-1048: Canvas Auto-Rotating Day Groups
 *
 * Watches for midnight transitions and updates dueDate on tasks inside
 * day-of-week canvas groups (Monday–Sunday) so date suffixes stay current.
 *
 * GEOMETRY INVARIANT: Only dueDate (metadata) is modified.
 * parentId / canvasPosition are NEVER touched.
 */

import { ref } from 'vue'
import { useDateTransition } from '@/composables/useDateTransition'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import { useSettingsStore } from '@/stores/settings'
import { detectPowerKeyword } from '@/composables/usePowerKeywords'

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

  function dismissBanner() {
    showBanner.value = false
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
    rotateDayGroups
  }
}
