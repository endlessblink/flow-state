/**
 * TASK-1756: Shared reactive "today" ref.
 *
 * Problem: components that show a date based on `new Date()` inside a
 * Vue `computed()` do not re-render at midnight — `Date` is not reactive,
 * so the computed stays cached on yesterday's value until something else
 * invalidates it.
 *
 * Solution: a single module-level `ref` that flips at 00:00 (local time)
 * and on tab-visibility regain. All callers get the same ref, so there is
 * only one midnight timer for the whole app regardless of how many groups
 * are on the canvas.
 *
 * Usage:
 *   const today = useCurrentDay()
 *   const suffix = computed(() => formatDayGroupSuffix(today.value))
 */

import { ref } from 'vue'

function startOfDay(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

const currentDay = ref<Date>(startOfDay(new Date()))

let initialized = false
let midnightTimer: ReturnType<typeof setTimeout> | null = null

function msUntilNextMidnight(): number {
  const now = new Date()
  const next = new Date(now)
  next.setDate(next.getDate() + 1)
  next.setHours(0, 0, 0, 0)
  // Small buffer to land just past midnight.
  return next.getTime() - now.getTime() + 100
}

function refreshIfDayChanged() {
  const fresh = startOfDay(new Date())
  if (fresh.getTime() !== currentDay.value.getTime()) {
    currentDay.value = fresh
  }
}

function scheduleNextMidnight() {
  if (midnightTimer) clearTimeout(midnightTimer)
  midnightTimer = setTimeout(() => {
    refreshIfDayChanged()
    scheduleNextMidnight()
  }, msUntilNextMidnight())
}

function ensureInitialized() {
  if (initialized) return
  initialized = true

  // Sync to real clock on first consumer — the module-level default was
  // captured at import time which may precede fake-timer test setup or an
  // HMR-delayed window.
  refreshIfDayChanged()

  if (typeof window !== 'undefined') {
    scheduleNextMidnight()
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshIfDayChanged()
    })
  }
}

/**
 * Returns a shared reactive ref containing today's date (start-of-day, local
 * time). The ref updates at midnight and on tab-visibility regain.
 */
export function useCurrentDay() {
  ensureInitialized()
  return currentDay
}

/** Test helper — forces the ref to refresh now. */
export function __forceRefreshCurrentDay() {
  refreshIfDayChanged()
}

/** Test helper — resets internal state so each test starts fresh. */
export function __resetCurrentDayForTest() {
  if (midnightTimer) {
    clearTimeout(midnightTimer)
    midnightTimer = null
  }
  initialized = false
  currentDay.value = startOfDay(new Date())
}
