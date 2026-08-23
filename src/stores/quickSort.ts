import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import { useAuthStore } from '@/stores/auth'
import { enqueueOperation } from '@/services/offline/writeQueueDB'
import { toSupabaseQuickSortSession } from '@/utils/supabaseMappers'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import {
  DEFAULT_QUICK_SORT_SOURCES,
  normalizeQuickSortSources,
  type QuickSortSource
} from '@/utils/quickSortTaskFilters'

export interface CategoryAction {
  id: string
  type: 'CATEGORIZE_TASK' | 'MARK_DONE' | 'MARK_DONE_AND_DELETE' | 'SAVE_TASK'
  taskId: string
  oldProjectId?: string | null
  newProjectId?: string
  oldDueDate?: string
  newDueDate?: string
  oldPriority?: 'low' | 'medium' | 'high' | undefined
  newPriority?: 'low' | 'medium' | 'high' | undefined
  oldStatus?: 'todo' | 'done'
  newStatus?: 'todo' | 'done'
  deletedTask?: import('./tasks').Task // Store full task data for undo of deleted tasks
  oldDescription?: string
  newDescription?: string
  /** False for edits such as postpone that keep the current task open. */
  advancesTask?: boolean
  timestamp: number
}

export interface SessionSummary {
  id: string
  tasksProcessed: number
  timeSpent: number // milliseconds
  efficiency: number // tasks per minute
  streakDays: number
  completedAt: Date
}

// TASK-1450: Active session state for crash recovery
const ACTIVE_SESSION_KEY = 'flowstate-quicksort-active-session'
const ACTIVE_SESSION_MAX_AGE = 24 * 60 * 60 * 1000 // 24h staleness limit

export interface ActiveSessionData {
  currentSessionId: string
  sessionStartTime: number
  tasksSortedInSession: number
  undoStack: CategoryAction[]
  redoStack: CategoryAction[]
  processedTaskIds: string[]
  currentTaskId: string | null
  sources?: QuickSortSource[]
  queuedTaskIds?: string[]
}

export const useQuickSortStore = defineStore('quickSort', () => {
  // State
  const isActive = ref(false)
  const currentSessionId = ref<string | null>(null)
  const undoStack = ref<CategoryAction[]>([])
  const redoStack = ref<CategoryAction[]>([])
  const sessionHistory = ref<SessionSummary[]>([])
  const sessionStartTime = ref<number | null>(null)
  const tasksSortedInSession = ref(0)
  const lastCompletedDate = ref<string | null>(null)
  const lastSelectedSources = ref<QuickSortSource[]>(loadLastSelectedSources())

  // TASK-1450: Interrupted session recovery
  const hasInterruptedSession = ref(false)
  const interruptedSessionData = ref<ActiveSessionData | null>(null)

  // Getters
  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  const currentStreak = computed(() => {
    if (!lastCompletedDate.value) return 0

    const today = new Date().toDateString()
    const lastDate = new Date(lastCompletedDate.value).toDateString()

    // Check if streak is active (completed today or yesterday)
    const daysDiff = Math.floor(
      (new Date(today).getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysDiff > 1) return 0 // Streak broken

    // Count consecutive days in history
    let streak = 0
    const sortedHistory = [...sessionHistory.value].sort(
      (a, b) => b.completedAt.getTime() - a.completedAt.getTime()
    )

    const currentDate = new Date()
    for (const session of sortedHistory) {
      const sessionDate = new Date(session.completedAt).toDateString()
      const expectedDate = new Date(currentDate).toDateString()

      if (sessionDate === expectedDate) {
        streak++
        currentDate.setDate(currentDate.getDate() - 1)
      } else {
        break
      }
    }

    return streak
  })

  // Actions
  function startSession() {
    isActive.value = true
    currentSessionId.value = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    sessionStartTime.value = Date.now()
    tasksSortedInSession.value = 0
    undoStack.value = []
    redoStack.value = []
  }

  function previewSessionSummary(): SessionSummary | undefined {
    if (!currentSessionId.value || !sessionStartTime.value) return

    const timeSpent = Date.now() - sessionStartTime.value
    const efficiency = tasksSortedInSession.value / (timeSpent / 60000) // tasks per minute

    return {
      id: currentSessionId.value,
      tasksProcessed: tasksSortedInSession.value,
      timeSpent,
      efficiency,
      streakDays: currentStreak.value + 1, // Include current session
      completedAt: new Date()
    }
  }

  function endSession() {
    const summary = previewSessionSummary()
    if (!summary) return

    sessionHistory.value.push(summary)
    lastCompletedDate.value = new Date().toISOString()

    // Persist to Supabase via sync queue
    saveToDatabase(summary)

    isActive.value = false
    currentSessionId.value = null
    sessionStartTime.value = null
    tasksSortedInSession.value = 0
    undoStack.value = []
    redoStack.value = []

    // TASK-1450: Clear active session — it's complete now
    clearActiveSession()

    return summary
  }

  function recordAction(action: CategoryAction) {
    undoStack.value.push(action)
    redoStack.value = [] // Clear redo stack on new action
    if (action.advancesTask !== false) tasksSortedInSession.value++

    // Limit undo stack to 50 actions to prevent memory issues
    if (undoStack.value.length > 50) {
      undoStack.value.shift()
    }
  }

  function undo(): CategoryAction | null {
    const action = undoStack.value.pop()
    if (action) {
      redoStack.value.push(action)
      if (action.advancesTask !== false) {
        tasksSortedInSession.value = Math.max(0, tasksSortedInSession.value - 1)
      }
      return action
    }
    return null
  }

  function redo(): CategoryAction | null {
    const action = redoStack.value.pop()
    if (action) {
      undoStack.value.push(action)
      if (action.advancesTask !== false) tasksSortedInSession.value++
      return action
    }
    return null
  }

  function cancelSession() {
    isActive.value = false
    currentSessionId.value = null
    sessionStartTime.value = null
    tasksSortedInSession.value = 0
    undoStack.value = []
    redoStack.value = []

    // TASK-1450: Clear active session — cancelled
    clearActiveSession()
  }

  function loadLastSelectedSources(): QuickSortSource[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.QUICKSORT_LAST_SOURCES)
      return stored ? normalizeQuickSortSources(JSON.parse(stored)) : [...DEFAULT_QUICK_SORT_SOURCES]
    } catch {
      return [...DEFAULT_QUICK_SORT_SOURCES]
    }
  }

  function setLastSelectedSources(sources: readonly QuickSortSource[]) {
    lastSelectedSources.value = normalizeQuickSortSources(sources)
    localStorage.setItem(STORAGE_KEYS.QUICKSORT_LAST_SOURCES, JSON.stringify(lastSelectedSources.value))
  }

  // Use Supabase for cross-device sync
  const supabaseDb = useSupabaseDatabase()
  const authStore = useAuthStore()

  // TASK-1450: Save via offline sync queue (survives browser close, auto-retries with backoff)
  async function saveToDatabase(newSession?: SessionSummary) {
    // Always save to localStorage first (fast, reliable)
    saveToLocalStorage()

    // Then enqueue for Supabase sync via offline queue (survives browser close, auto-retries)
    if (authStore.user?.id && newSession) {
      try {
        const payload = toSupabaseQuickSortSession(newSession, authStore.user.id)
        await enqueueOperation({
          entityType: 'quick_sort_session',
          operation: 'create',
          entityId: newSession.id,
          payload: payload as unknown as Record<string, unknown>,
          userId: authStore.user.id
        })
        console.log('[QUICK-SORT] Session enqueued for sync')
      } catch (error) {
        console.warn('[QUICK-SORT] Failed to enqueue session for sync:', error)
      }
    }
  }

  async function loadFromDatabase() {
    // Load from localStorage first (always available, instant)
    loadFromLocalStorage()

    // Then try Supabase for cross-device updates (only if authenticated)
    if (!authStore.user?.id) {
      console.log('[QUICK-SORT] Loaded from localStorage (not authenticated)')
      return
    }

    try {
      const history = await supabaseDb.fetchQuickSortHistory()
      if (history && history.length > 0) {
        // Merge with localStorage data - Supabase is source of truth for synced sessions
        sessionHistory.value = history as SessionSummary[]

        // Update lastCompletedDate from most recent session
        const sorted = [...history].sort(
          (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
        )
        if (sorted.length > 0) {
          lastCompletedDate.value = sorted[0].completedAt instanceof Date
            ? sorted[0].completedAt.toISOString()
            : sorted[0].completedAt as string
        }

        // Update localStorage with synced data
        saveToLocalStorage()
        console.log('[QUICK-SORT] Data loaded from Supabase')
      }
    } catch (error) {
      console.warn('Failed to load Quick Sort data from Supabase (localStorage already loaded):', error)
    }
  }

  // Legacy localStorage functions (for fallback/migration)
  function saveToLocalStorage() {
    try {
      // Cap session history to prevent unbounded localStorage growth
      if (sessionHistory.value.length > 200) {
        sessionHistory.value = sessionHistory.value.slice(-200)
      }
      localStorage.setItem('flowstate-quicksort-history', JSON.stringify(sessionHistory.value))
      localStorage.setItem('flowstate-quicksort-last-date', lastCompletedDate.value || '')
    } catch (error) {
      console.error('Failed to save Quick Sort data to localStorage:', error)
    }
  }

  function loadFromLocalStorage() {
    try {
      const historyData = localStorage.getItem('flowstate-quicksort-history')
      if (historyData) {
        const parsed = JSON.parse(historyData)
        // Convert date strings back to Date objects
        interface ParsedSession {
          completedAt: string
          [key: string]: unknown
        }
        sessionHistory.value = parsed.map((s: ParsedSession) => ({
          ...s,
          completedAt: new Date(s.completedAt)
        })) as SessionSummary[]
      }

      const lastDate = localStorage.getItem('flowstate-quicksort-last-date')
      if (lastDate) {
        lastCompletedDate.value = lastDate
      }
    } catch (error) {
      console.error('Failed to load Quick Sort data from localStorage:', error)
    }
  }

  // TASK-1450: Active session persistence for crash recovery
  function saveActiveSession(composableState: {
    currentTaskId: string | null
    processedTaskIds: Set<string>
    sources: QuickSortSource[]
    queuedTaskIds: string[]
  }) {
    if (!isActive.value || !currentSessionId.value || !sessionStartTime.value) {
      localStorage.removeItem(ACTIVE_SESSION_KEY)
      return
    }
    try {
      const data: ActiveSessionData = {
        currentSessionId: currentSessionId.value,
        sessionStartTime: sessionStartTime.value,
        tasksSortedInSession: tasksSortedInSession.value,
        undoStack: undoStack.value,
        redoStack: redoStack.value,
        processedTaskIds: [...composableState.processedTaskIds],
        currentTaskId: composableState.currentTaskId,
        sources: composableState.sources,
        queuedTaskIds: composableState.queuedTaskIds
      }
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(data))
    } catch (error) {
      console.warn('[QUICK-SORT] Failed to persist active session:', error)
    }
  }

  function clearActiveSession() {
    localStorage.removeItem(ACTIVE_SESSION_KEY)
    hasInterruptedSession.value = false
    interruptedSessionData.value = null
  }

  function clearAll() {
    if (quickSortSaveTimer) {
      clearTimeout(quickSortSaveTimer)
      quickSortSaveTimer = null
    }
    isActive.value = false
    currentSessionId.value = null
    sessionStartTime.value = null
    tasksSortedInSession.value = 0
    undoStack.value = []
    redoStack.value = []
    sessionHistory.value = []
    lastCompletedDate.value = null
    clearActiveSession()
    localStorage.removeItem(STORAGE_KEYS.QUICKSORT_HISTORY)
    localStorage.removeItem(STORAGE_KEYS.QUICKSORT_LAST_DATE)
  }

  function checkForInterruptedSession() {
    try {
      const raw = localStorage.getItem(ACTIVE_SESSION_KEY)
      if (!raw) return

      const data = JSON.parse(raw) as ActiveSessionData
      // Discard if older than 24h
      if (Date.now() - data.sessionStartTime > ACTIVE_SESSION_MAX_AGE) {
        localStorage.removeItem(ACTIVE_SESSION_KEY)
        return
      }
      hasInterruptedSession.value = true
      interruptedSessionData.value = data
    } catch {
      localStorage.removeItem(ACTIVE_SESSION_KEY)
    }
  }

  function resumeSession(): ActiveSessionData | null {
    const data = interruptedSessionData.value
    if (!data) return null

    // Restore store state
    isActive.value = true
    currentSessionId.value = data.currentSessionId
    sessionStartTime.value = data.sessionStartTime
    tasksSortedInSession.value = data.tasksSortedInSession
    undoStack.value = data.undoStack
    redoStack.value = data.redoStack

    hasInterruptedSession.value = false
    interruptedSessionData.value = null

    // Return full data so composable can restore currentTaskId + processedTaskIds
    return data
  }

  function dismissInterruptedSession() {
    clearActiveSession()
  }

  // Auto-save to localStorage when data changes (Supabase saves happen in endSession)
  let quickSortSaveTimer: ReturnType<typeof setTimeout> | null = null
  watch([sessionHistory, lastCompletedDate], () => {
    if (quickSortSaveTimer) clearTimeout(quickSortSaveTimer)
    quickSortSaveTimer = setTimeout(() => {
      saveToLocalStorage()
    }, 500) // 500ms debounce
  }, { deep: true })

  // Load data on store creation (async)
  loadFromDatabase()
  // TASK-1450: Check for interrupted session on init
  checkForInterruptedSession()

  return {
    // State
    isActive,
    currentSessionId,
    undoStack,
    redoStack,
    sessionHistory,
    sessionStartTime,
    tasksSortedInSession,
    lastSelectedSources,

    // TASK-1450: Session recovery
    hasInterruptedSession,
    interruptedSessionData,

    // Getters
    canUndo,
    canRedo,
    currentStreak,

    // Actions
    startSession,
    endSession,
    previewSessionSummary,
    recordAction,
    undo,
    redo,
    cancelSession,
    clearAll,
    setLastSelectedSources,
    saveToLocalStorage,
    loadFromLocalStorage,

    // TASK-1450: Session recovery actions
    saveActiveSession,
    clearActiveSession,
    resumeSession,
    dismissInterruptedSession
  }
})
