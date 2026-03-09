import { ref, computed, onMounted, getCurrentInstance } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useGamificationStore } from '@/stores/gamification'
import { useSmartViews } from '@/composables/useSmartViews'
import type { Task } from '@/types/tasks'
import type { TimeBlock } from '@/composables/useMorningDashboard'

// ---------------------------------------------------------------------------
// localStorage key helpers
// ---------------------------------------------------------------------------

function getTodayString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dismissedKey(): string {
  return `flowstate-morning-dismissed-${getTodayString()}`
}

function completedKey(): string {
  return `flowstate-morning-ritual-${getTodayString()}`
}

const FOCUS_LIMIT_KEY = 'flowstate-morning-focus-limit'

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/** Round a time (in minutes since midnight) UP to the next 15-minute boundary. */
function roundUpTo15(minutesSinceMidnight: number): number {
  return Math.ceil(minutesSinceMidnight / 15) * 15
}

/** Parse "HH:MM" to minutes since midnight. */
function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** Format minutes since midnight as "HH:MM". */
function formatTime(minutesSinceMidnight: number): string {
  const h = Math.floor(minutesSinceMidnight / 60) % 24
  const m = minutesSinceMidnight % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Overlap detection (ported from TimeBlockPicker.vue pattern)
// ---------------------------------------------------------------------------

function blocksOverlap(a: TimeBlock, b: TimeBlock): boolean {
  if (!a.startTime || !b.startTime) return false
  const aStart = parseTime(a.startTime)
  const aEnd = aStart + a.duration
  const bStart = parseTime(b.startTime)
  const bEnd = bStart + b.duration
  return aStart < bEnd && bStart < aEnd
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export interface RitualSummary {
  taskCount: number
  totalMinutes: number
}

export function useMorningRitual() {
  const taskStore = useTaskStore()
  const gamificationStore = useGamificationStore()
  const { isTodayTask } = useSmartViews()

  // --- Core state ---
  const isRitualActive = ref(false)
  const focusIds = ref<string[]>([])
  const focusLimit = ref<number>(3)
  const timeBlocks = ref<Map<string, TimeBlock>>(new Map())
  const isTimeBlockMode = ref(false)
  const autoPlaceMode = ref(true)
  const isDismissedToday = ref(false)
  const isRitualCompleted = ref(false)
  const ritualSummary = ref<RitualSummary | null>(null)

  // ---------------------------------------------------------------------------
  // Candidate task selection
  // Mirrors the priority-tier logic from useMorningDashboard.suggestedTasks
  // but returns a Set<string> of IDs rather than sliced label objects.
  // ---------------------------------------------------------------------------
  const candidateIds = computed((): Set<string> => {
    const tasks: Task[] = taskStore._rawTasks ?? []
    const todayStr = getTodayString()

    const notDone = tasks.filter((t) => t.status !== 'done')

    // Tier 1: in progress (has progress > 0)
    const inProgress = notDone.filter((t) => t.progress > 0)
    const inProgressIds = new Set(inProgress.map((t) => t.id))

    // Tier 2: due/scheduled today
    const todayTasks = notDone.filter(
      (t) => !inProgressIds.has(t.id) && isTodayTask(t)
    )
    const todayIds = new Set(todayTasks.map((t) => t.id))

    // Tier 3: overdue (dueDate before today, not already in higher tier)
    const seenUpToOverdue = new Set([...inProgressIds, ...todayIds])
    const overdue = notDone.filter((t) => {
      if (seenUpToOverdue.has(t.id)) return false
      if (!t.dueDate) return false
      return t.dueDate.slice(0, 10) < todayStr
    })
    const overdueIds = new Set(overdue.map((t) => t.id))

    // Tier 4: high priority (no date or future date)
    const seenUpToHigh = new Set([...seenUpToOverdue, ...overdueIds])
    const highPriority = notDone.filter(
      (t) => !seenUpToHigh.has(t.id) && t.priority === 'high'
    )
    const highIds = new Set(highPriority.map((t) => t.id))

    // Tier 5: medium priority
    const seenUpToMed = new Set([...seenUpToHigh, ...highIds])
    const medPriority = notDone.filter(
      (t) => !seenUpToMed.has(t.id) && t.priority === 'medium'
    )
    const medIds = new Set(medPriority.map((t) => t.id))

    // Tier 6: recently created (fallback, limit 20 to keep set bounded)
    const seenAll = new Set([...seenUpToMed, ...medIds])
    const recent = notDone
      .filter((t) => !seenAll.has(t.id))
      .sort(
        (a, b) =>
          (b.createdAt instanceof Date ? b.createdAt.getTime() : 0) -
          (a.createdAt instanceof Date ? a.createdAt.getTime() : 0)
      )
      .slice(0, 20)

    const merged = [
      ...inProgress,
      ...todayTasks,
      ...overdue,
      ...highPriority,
      ...medPriority,
      ...recent,
    ]

    return new Set(merged.map((t) => t.id))
  })

  // ---------------------------------------------------------------------------
  // Derived task lists
  // ---------------------------------------------------------------------------

  const candidateTasks = computed((): Task[] => {
    const ids = candidateIds.value
    return (taskStore._rawTasks ?? []).filter((t) => ids.has(t.id))
  })

  // ---------------------------------------------------------------------------
  // Grouped candidates (mirrors useMorningDashboard.groupedTasks for the panel)
  // ---------------------------------------------------------------------------
  interface CandidateGroup {
    label: string
    color: string
    tasks: { id: string; title: string; priority: Task['priority']; dueDate: string; projectId: string; estimatedDuration?: number }[]
  }

  const groupedCandidates = computed((): Record<string, CandidateGroup> => {
    const tasks: Task[] = taskStore._rawTasks ?? []
    const todayStr = getTodayString()

    function toPoolTask(t: Task) {
      return {
        id: t.id,
        title: t.title,
        priority: t.priority,
        dueDate: t.dueDate ?? '',
        projectId: t.projectId ?? '',
        estimatedDuration: t.estimatedDuration,
      }
    }

    function dueDateSort(a: Task, b: Task): number {
      const aDate = a.dueDate ? a.dueDate.slice(0, 10) : '9999-99-99'
      const bDate = b.dueDate ? b.dueDate.slice(0, 10) : '9999-99-99'
      if (aDate !== bDate) return aDate < bDate ? -1 : 1
      const aUp = a.updatedAt instanceof Date ? a.updatedAt.getTime() : 0
      const bUp = b.updatedAt instanceof Date ? b.updatedAt.getTime() : 0
      return bUp - aUp
    }

    const candidateSet = candidateIds.value
    const candidateList = tasks.filter((t) => candidateSet.has(t.id))
    const seen = new Set<string>()

    // 1. Overdue
    const overdueList = candidateList
      .filter((t) => {
        if (seen.has(t.id)) return false
        if (!t.dueDate) return false
        return t.dueDate.slice(0, 10) < todayStr
      })
      .sort(dueDateSort)
    overdueList.forEach((t) => seen.add(t.id))

    // 2. Today
    const todayList = candidateList
      .filter((t) => !seen.has(t.id) && isTodayTask(t))
      .sort(dueDateSort)
    todayList.forEach((t) => seen.add(t.id))

    // 3. In progress
    const inProgressList = candidateList
      .filter((t) => !seen.has(t.id) && t.progress > 0)
      .sort(dueDateSort)
    inProgressList.forEach((t) => seen.add(t.id))

    // 4. High priority
    const highPriorityList = candidateList
      .filter((t) => !seen.has(t.id) && t.priority === 'high')
      .sort(dueDateSort)
    highPriorityList.forEach((t) => seen.add(t.id))

    // 5. Other (remaining candidates)
    const otherList = candidateList
      .filter((t) => !seen.has(t.id))
      .sort(dueDateSort)

    const groups: Record<string, CandidateGroup> = {}
    if (overdueList.length > 0) {
      groups.overdue = { label: 'Overdue', color: 'var(--color-danger)', tasks: overdueList.map(toPoolTask) }
    }
    if (todayList.length > 0) {
      groups.today = { label: 'Today', color: 'var(--brand-primary)', tasks: todayList.map(toPoolTask) }
    }
    if (inProgressList.length > 0) {
      groups.inProgress = { label: 'In Progress', color: 'var(--color-warning)', tasks: inProgressList.map(toPoolTask) }
    }
    if (highPriorityList.length > 0) {
      groups.highPriority = { label: 'High Priority', color: 'var(--text-primary)', tasks: highPriorityList.map(toPoolTask) }
    }
    if (otherList.length > 0) {
      groups.other = { label: 'Other', color: '', tasks: otherList.map(toPoolTask) }
    }

    return groups
  })

  const focusTasks = computed((): Task[] => {
    const rawTasks: Task[] = taskStore._rawTasks ?? []
    return focusIds.value
      .map((id) => rawTasks.find((t) => t.id === id))
      .filter((t): t is Task => t !== undefined)
  })

  const focusCount = computed(() => focusIds.value.length)

  const totalFocusMinutes = computed((): number => {
    let total = 0
    for (const id of focusIds.value) {
      const block = timeBlocks.value.get(id)
      if (block) {
        total += block.duration
      }
    }
    return total
  })

  // ---------------------------------------------------------------------------
  // Banner visibility
  // Shows 06:00–11:00, at least one non-done task, not dismissed, not completed.
  // ---------------------------------------------------------------------------
  const showBanner = computed((): boolean => {
    if (isDismissedToday.value || isRitualCompleted.value) return false

    const hour = new Date().getHours()
    if (hour < 6 || hour >= 23) return false // TODO: restore to >= 11 after testing

    const hasNonDone = (taskStore._rawTasks ?? []).some(
      (t) => t.status !== 'done'
    )
    return hasNonDone
  })

  // ---------------------------------------------------------------------------
  // Overlap detection (exported)
  // ---------------------------------------------------------------------------
  const hasOverlap = computed((): boolean => {
    const blocks = Array.from(timeBlocks.value.values())
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        if (blocksOverlap(blocks[i], blocks[j])) return true
      }
    }
    return false
  })

  // ---------------------------------------------------------------------------
  // Persistence: focusLimit
  // ---------------------------------------------------------------------------
  function loadFocusLimit() {
    try {
      const raw = localStorage.getItem(FOCUS_LIMIT_KEY)
      if (raw !== null) {
        const n = parseInt(raw, 10)
        if (!isNaN(n) && n >= 1) {
          focusLimit.value = n
        }
      }
    } catch {
      // storage unavailable — keep default
    }
  }

  function setFocusLimit(n: number) {
    if (n < 1) return
    focusLimit.value = n
    try {
      localStorage.setItem(FOCUS_LIMIT_KEY, String(n))
    } catch {
      // storage unavailable — silent
    }
  }

  // ---------------------------------------------------------------------------
  // Persistence: dismissed today
  // ---------------------------------------------------------------------------
  function loadDismissed() {
    try {
      isDismissedToday.value = localStorage.getItem(dismissedKey()) === 'true'
    } catch {
      isDismissedToday.value = false
    }
  }

  // ---------------------------------------------------------------------------
  // Persistence: ritual completed today
  // ---------------------------------------------------------------------------
  function loadRitualCompleted() {
    try {
      const raw = localStorage.getItem(completedKey())
      if (raw) {
        const parsed: RitualSummary = JSON.parse(raw)
        if (
          typeof parsed.taskCount === 'number' &&
          typeof parsed.totalMinutes === 'number'
        ) {
          isRitualCompleted.value = true
          ritualSummary.value = parsed
        }
      }
    } catch {
      isRitualCompleted.value = false
      ritualSummary.value = null
    }
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------
  function init() {
    loadFocusLimit()
    loadDismissed()
    loadRitualCompleted()
  }

  // Guard for calls outside a component setup context (mirrors useMorningDashboard)
  if (getCurrentInstance()) {
    onMounted(() => {
      init()
    })
  } else {
    init()
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  function openRitual() {
    isRitualActive.value = true
  }

  function closeRitual() {
    isRitualActive.value = false
  }

  function dismissBanner() {
    isDismissedToday.value = true
    try {
      localStorage.setItem(dismissedKey(), 'true')
    } catch {
      // storage unavailable — silent
    }
  }

  /**
   * Toggle a task in/out of the focus list.
   * Returns false if the limit would be exceeded (caller can show feedback).
   */
  function toggleFocus(taskId: string): boolean {
    const idx = focusIds.value.indexOf(taskId)
    if (idx !== -1) {
      // Remove from focus
      focusIds.value = focusIds.value.filter((id) => id !== taskId)
      timeBlocks.value.delete(taskId)
      return true
    }

    // Add — check limit
    if (focusIds.value.length >= focusLimit.value) {
      return false
    }

    focusIds.value = [...focusIds.value, taskId]
    return true
  }

  function goToTimeBlocks() {
    isTimeBlockMode.value = true
  }

  function goBackToPick() {
    isTimeBlockMode.value = false
  }

  /**
   * Auto-place time blocks for all focus tasks.
   * Starts from current time rounded up to next 15-min boundary,
   * places tasks sequentially using each task's estimatedDuration (default 60 min).
   */
  function autoPlaceTasks() {
    const now = new Date()
    let cursor = roundUpTo15(now.getHours() * 60 + now.getMinutes())

    const rawTasks: Task[] = taskStore._rawTasks ?? []
    const newBlocks = new Map<string, TimeBlock>(timeBlocks.value)

    for (const id of focusIds.value) {
      const task = rawTasks.find((t) => t.id === id)
      const duration = task?.estimatedDuration ?? 60

      newBlocks.set(id, {
        startTime: formatTime(cursor),
        duration,
      })

      cursor += duration
      // Round up to next 15-min slot for the next task
      cursor = roundUpTo15(cursor)
    }

    timeBlocks.value = newBlocks
  }

  function updateTimeBlock(taskId: string, block: TimeBlock) {
    const updated = new Map(timeBlocks.value)
    updated.set(taskId, { ...block })
    timeBlocks.value = updated
  }

  /**
   * Finalize the ritual:
   * - Set dueDate = today on each focus task
   * - Create TaskInstance for tasks that have a time block with a startTime
   * - Award 25 XP
   * - Persist completion summary
   * - Close the overlay
   */
  async function startRitual() {
    const todayStr = getTodayString()
    let completedCount = 0
    let totalMinutes = 0

    for (const taskId of focusIds.value) {
      try {
        // Set dueDate = today
        await taskStore.updateTask(taskId, { dueDate: todayStr })

        const block = timeBlocks.value.get(taskId)
        if (block?.startTime) {
          await taskStore.createTaskInstance(taskId, {
            scheduledDate: todayStr,
            scheduledTime: block.startTime,
            duration: block.duration,
            status: 'scheduled',
            isRecurring: false,
          })
          totalMinutes += block.duration
        }

        completedCount++
      } catch {
        // Task may have been deleted concurrently — not fatal, continue with others
      }
    }

    // Award XP for committing to the morning ritual
    await gamificationStore.awardXp(25, 'morning_commitment')

    // Persist completion
    const summary: RitualSummary = {
      taskCount: completedCount,
      totalMinutes,
    }
    try {
      localStorage.setItem(completedKey(), JSON.stringify(summary))
    } catch {
      // storage unavailable — silent
    }

    isRitualCompleted.value = true
    ritualSummary.value = summary

    closeRitual()
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  return {
    // State
    isRitualActive,
    showBanner,
    candidateIds,
    focusIds,
    focusLimit,
    timeBlocks,
    isTimeBlockMode,
    autoPlaceMode,
    isDismissedToday,
    isRitualCompleted,
    ritualSummary,
    hasOverlap,

    // Computed
    candidateTasks,
    focusTasks,
    focusCount,
    totalFocusMinutes,
    groupedCandidates,

    // Actions
    openRitual,
    closeRitual,
    dismissBanner,
    toggleFocus,
    goToTimeBlocks,
    goBackToPick,
    autoPlaceTasks,
    updateTimeBlock,
    startRitual,
    setFocusLimit,
  }
}
