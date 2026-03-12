import { ref, computed, watch, onMounted, getCurrentInstance } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskStore } from '@/stores/tasks'
import { useGamificationStore } from '@/stores/gamification'
import { useAuthStore } from '@/stores/auth'
import { useSmartViews } from '@/composables/useSmartViews'
import type { Task } from '@/types/tasks'

export type MorningStage = 'pick' | 'timeblock'

export interface Big3Slot {
  taskId: string | null
  title: string
  completed: boolean
}

export interface TimeBlock {
  startTime: string // HH:MM
  duration: number  // minutes
}

export interface TaskPoolGroup {
  label: string
  color: string
  tasks: { id: string; title: string; priority: Task['priority']; dueDate: string; projectId: string }[]
}

export interface NewsItem {
  title: string
  url: string
  points: number
  domain: string
}

const DAILY_QUOTES = [
  'The secret of getting ahead is getting started.',
  'Focus on being productive instead of busy.',
  "It's not about having time, it's about making time.",
  'Do the hard jobs first. The easy jobs will take care of themselves.',
  "You don't have to be great to start, but you have to start to be great.",
  'Action is the foundational key to all success.',
  'The way to get started is to quit talking and begin doing.',
  'Productivity is never an accident. It is always the result of a commitment to excellence.',
  'Either you run the day or the day runs you.',
  'Small progress is still progress.',
]

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

function getDayOfYear(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = now.getTime() - start.getTime()
  const oneDay = 1000 * 60 * 60 * 24
  return Math.floor(diff / oneDay)
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const HN_CACHE_KEY = 'flowstate-hn-cache'
const HN_CACHE_TTL = 30 * 60 * 1000 // 30 minutes

export function useMorningDashboard() {
  const router = useRouter()
  const taskStore = useTaskStore()
  const gamificationStore = useGamificationStore()
  const authStore = useAuthStore()
  const { isTodayTask } = useSmartViews()

  // --- Stage ---
  const stage = ref<MorningStage>('pick')

  // --- Expanded groups (for "Show more" in task pool) ---
  const expandedGroups = ref<Set<string>>(new Set())

  function toggleGroupExpanded(key: string) {
    const next = new Set(expandedGroups.value)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    expandedGroups.value = next
  }

  // --- Big 3 State ---
  const big3Slots = ref<Big3Slot[]>([
    { taskId: null, title: '', completed: false },
    { taskId: null, title: '', completed: false },
    { taskId: null, title: '', completed: false },
  ])

  // --- Time Blocks ---
  const timeBlocks = ref<TimeBlock[]>([
    { startTime: '', duration: 60 },
    { startTime: '', duration: 60 },
    { startTime: '', duration: 60 },
  ])

  // --- News State ---
  const newsItems = ref<NewsItem[]>([])
  const isLoadingNews = ref(false)
  const newsError = ref<string | null>(null)

  // --- Computed: Big 3 ---
  const allSlotsAssigned = computed(() =>
    big3Slots.value.every((s) => s.title.trim().length > 0)
  )

  const allSlotsCompleted = computed(() =>
    big3Slots.value.every((s) => s.completed)
  )

  // --- Computed: Greeting ---
  const greetingText = computed(() => {
    const hour = new Date().getHours()
    let period: string
    if (hour >= 5 && hour < 12) {
      period = 'morning'
    } else if (hour >= 12 && hour < 17) {
      period = 'afternoon'
    } else {
      period = 'evening'
    }
    const name =
      authStore.user?.email?.split('@')[0] ?? 'there'
    return `Good ${period}, ${name}`
  })

  const todayFormatted = computed(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  })

  const dailyQuote = computed(() => {
    const idx = getDayOfYear() % DAILY_QUOTES.length
    return DAILY_QUOTES[idx]
  })

  // --- Computed: Task Suggestions ---
  // Uses the app's smart view system for proper date normalization (ISO, instances, scheduled dates)
  const suggestedTasks = computed(() => {
    const assignedIds = new Set(
      big3Slots.value.map((s) => s.taskId).filter(Boolean)
    )

    // Use _rawTasks to bypass active view filters — morning dashboard needs ALL tasks
    const tasks = taskStore._rawTasks ?? []
    const notDone = tasks.filter(
      (t) => t.status !== 'done' && !assignedIds.has(t.id)
    )

    // Priority tiers (using app's smart view system for proper date matching):
    // 1. Tasks with progress (already started = high intent)
    const inProgress = notDone.filter((t) => t.progress > 0)
    // 2. Tasks due/scheduled today (uses isTodayTask which handles instances, normalization, etc.)
    const todayTasks = notDone.filter((t) => t.progress === 0 && isTodayTask(t))
    // 3. Overdue tasks (dueDate before today)
    const todayStr = getTodayString()
    const overdue = notDone.filter((t) => {
      if (inProgress.find(ip => ip.id === t.id) || todayTasks.find(td => td.id === t.id)) return false
      if (!t.dueDate) return false
      return t.dueDate.slice(0, 10) < todayStr
    })
    // 4. High priority without date
    const highPriority = notDone.filter((t) => {
      if (inProgress.find(ip => ip.id === t.id) || todayTasks.find(td => td.id === t.id) || overdue.find(o => o.id === t.id)) return false
      return t.priority === 'high'
    })
    // 5. Medium priority
    const medPriority = notDone.filter((t) => {
      const seenIds = new Set([...inProgress, ...todayTasks, ...overdue, ...highPriority].map(x => x.id))
      return !seenIds.has(t.id) && t.priority === 'medium'
    })
    // 6. Recently created (fallback)
    const seenAll = new Set([...inProgress, ...todayTasks, ...overdue, ...highPriority, ...medPriority].map(x => x.id))
    const recent = notDone
      .filter((t) => !seenAll.has(t.id))
      .sort((a, b) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0))

    const merged = [...inProgress, ...todayTasks, ...overdue, ...highPriority, ...medPriority, ...recent]
    return merged.slice(0, 15).map((t) => ({ id: t.id, title: t.title }))
  })

  // --- Computed: Grouped Task Pool ---
  const groupedTasks = computed((): Record<string, TaskPoolGroup> => {
    const assignedIds = new Set(
      big3Slots.value.map((s) => s.taskId).filter(Boolean)
    )

    // Use _rawTasks to bypass active view filters — morning dashboard needs ALL tasks
    const tasks = taskStore._rawTasks ?? []
    const todayStr = getTodayString()

    function toPoolTask(t: Task) {
      return {
        id: t.id,
        title: t.title,
        priority: t.priority,
        dueDate: t.dueDate ?? '',
        projectId: t.projectId ?? '',
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

    const seen = new Set<string>(assignedIds as Set<string>)

    // 1. Overdue
    const overdueList = tasks
      .filter((t) => {
        if (seen.has(t.id) || t.status === 'done') return false
        if (!t.dueDate) return false
        return t.dueDate.slice(0, 10) < todayStr
      })
      .sort(dueDateSort)
    overdueList.forEach((t) => seen.add(t.id))

    // 2. Today
    const todayList = tasks
      .filter((t) => {
        if (seen.has(t.id) || t.status === 'done') return false
        return isTodayTask(t)
      })
      .sort(dueDateSort)
    todayList.forEach((t) => seen.add(t.id))

    // 3. In progress
    const inProgressList = tasks
      .filter((t) => {
        if (seen.has(t.id) || t.status === 'done') return false
        return t.progress > 0
      })
      .sort(dueDateSort)
    inProgressList.forEach((t) => seen.add(t.id))

    // 4. High priority
    const highPriorityList = tasks
      .filter((t) => {
        if (seen.has(t.id) || t.status === 'done') return false
        return t.priority === 'high'
      })
      .sort(dueDateSort)
    highPriorityList.forEach((t) => seen.add(t.id))

    // 5. Other (remaining non-done)
    const otherList = tasks
      .filter((t) => {
        if (seen.has(t.id) || t.status === 'done') return false
        return true
      })
      .sort(dueDateSort)

    return {
      overdue: {
        label: 'Overdue',
        color: 'var(--color-danger)',
        tasks: overdueList.map(toPoolTask),
      },
      today: {
        label: 'Today',
        color: 'var(--brand-primary)',
        tasks: todayList.map(toPoolTask),
      },
      inProgress: {
        label: 'In Progress',
        color: 'var(--color-warning)',
        tasks: inProgressList.map(toPoolTask),
      },
      highPriority: {
        label: 'High Priority',
        color: 'var(--text-primary)',
        tasks: highPriorityList.map(toPoolTask),
      },
      other: {
        label: 'Other',
        color: '',
        tasks: otherList.map(toPoolTask),
      },
    }
  })

  // --- Persistence helpers ---
  function localStorageKey(): string {
    return `flowstate-big3-${getTodayString()}`
  }

  function saveToLocalStorage() {
    try {
      localStorage.setItem(
        localStorageKey(),
        JSON.stringify(big3Slots.value)
      )
    } catch {
      // storage quota or unavailable — silent
    }
  }

  function loadFromLocalStorage(): boolean {
    try {
      const raw = localStorage.getItem(localStorageKey())
      if (!raw) return false
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length === 3) {
        big3Slots.value = parsed
        return true
      }
    } catch {
      // corrupted data — start fresh
    }
    return false
  }

  // --- Big 3 Actions ---
  function assignSlot(index: number, taskId: string | null, title: string) {
    if (index < 0 || index > 2) return
    big3Slots.value[index] = { taskId, title, completed: false }
  }

  function clearSlot(index: number) {
    if (index < 0 || index > 2) return
    big3Slots.value[index] = { taskId: null, title: '', completed: false }
  }

  async function completeSlot(index: number) {
    if (index < 0 || index > 2) return
    const slot = big3Slots.value[index]
    if (!slot.title) return

    big3Slots.value[index] = { ...slot, completed: true }

    if (slot.taskId) {
      try {
        await taskStore.updateTaskWithUndo(slot.taskId, { status: 'done' })
      } catch {
        // task may have been deleted — not fatal
      }
    }
  }

  // --- News ---
  async function fetchNews() {
    // Check cache first
    try {
      const cached = localStorage.getItem(HN_CACHE_KEY)
      if (cached) {
        const { timestamp, items } = JSON.parse(cached)
        if (Date.now() - timestamp < HN_CACHE_TTL) {
          newsItems.value = items
          return
        }
      }
    } catch {
      // corrupted cache — fetch fresh
    }

    isLoadingNews.value = true
    newsError.value = null
    try {
      const res = await fetch(
        'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=7'
      )
      if (!res.ok) throw new Error(`HN API ${res.status}`)
      const json = await res.json()
      const items: NewsItem[] = (json.hits ?? []).map(
        (hit: { title?: string; url?: string; points?: number }) => ({
          title: hit.title ?? '(no title)',
          url: hit.url ?? `https://news.ycombinator.com`,
          points: hit.points ?? 0,
          domain: extractDomain(hit.url ?? ''),
        })
      )
      newsItems.value = items
      try {
        localStorage.setItem(
          HN_CACHE_KEY,
          JSON.stringify({ timestamp: Date.now(), items })
        )
      } catch {
        // storage unavailable
      }
    } catch (err) {
      newsError.value =
        err instanceof Error ? err.message : 'Failed to load news'
    } finally {
      isLoadingNews.value = false
    }
  }

  // --- Stage Navigation ---
  function goToTimeBlock() {
    if (!allSlotsAssigned.value) return
    // Pre-fill time blocks with task durations if available
    big3Slots.value.forEach((slot, i) => {
      if (slot.taskId) {
        const task = (taskStore._rawTasks ?? []).find(t => t.id === slot.taskId)
        if (task?.estimatedDuration) {
          timeBlocks.value[i] = { ...timeBlocks.value[i], duration: task.estimatedDuration }
        }
      }
    })
    stage.value = 'timeblock'
  }

  function goBackToPick() {
    stage.value = 'pick'
  }

  // --- Start My Day ---
  async function startMyDay() {
    if (!allSlotsAssigned.value) return

    const todayStr = getTodayString()

    for (let i = 0; i < big3Slots.value.length; i++) {
      const slot = big3Slots.value[i]
      if (!slot.taskId) continue

      try {
        // Set dueDate = today (instances already created during time-block placement)
        await taskStore.updateTask(slot.taskId, { dueDate: todayStr })
      } catch {
        // task may have been deleted — not fatal
      }
    }

    // Clear any smart view / duration filters so canvas shows all tasks
    taskStore.setSmartView(null)
    taskStore.setActiveDurationFilter(null)

    await gamificationStore.awardXp(25, 'morning_commitment')
    router.push('/')
  }

  // --- Initialization ---
  async function initMorningDashboard() {
    loadFromLocalStorage()
    fetchNews()
  }

  // Persist Big 3 changes automatically
  watch(
    big3Slots,
    () => {
      saveToLocalStorage()
    },
    { deep: true }
  )

  // Auto-initialize on composable creation (guard for calls outside setup)
  if (getCurrentInstance()) {
    onMounted(() => {
      initMorningDashboard()
    })
  } else {
    initMorningDashboard()
  }

  return {
    // Stage
    stage,
    goToTimeBlock,
    goBackToPick,

    // Big 3
    big3Slots,
    allSlotsAssigned,
    allSlotsCompleted,
    assignSlot,
    clearSlot,
    completeSlot,

    // Time Blocks
    timeBlocks,

    // Suggestions
    suggestedTasks,
    groupedTasks,
    expandedGroups,
    toggleGroupExpanded,

    // News
    newsItems,
    isLoadingNews,
    newsError,

    // Greeting / Date
    greetingText,
    todayFormatted,
    dailyQuote,

    // Actions
    startMyDay,
    initMorningDashboard,
  }
}
