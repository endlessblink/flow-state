import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useDatabase, DB_KEYS } from '@/composables/useDatabase'

export interface CategoryAction {
  id: string
  type: 'CATEGORIZE_TASK' | 'MARK_DONE' | 'MARK_DONE_AND_DELETE'
  taskId: string
  oldProjectId?: string | null
  newProjectId?: string
  oldStatus?: 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold'
  newStatus?: 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold'
  deletedTask?: import('./tasks').Task // Store full task data for undo of deleted tasks
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

  function endSession() {
    if (!currentSessionId.value || !sessionStartTime.value) return

    const timeSpent = Date.now() - sessionStartTime.value
    const efficiency = tasksSortedInSession.value / (timeSpent / 60000) // tasks per minute

    const summary: SessionSummary = {
      id: currentSessionId.value,
      tasksProcessed: tasksSortedInSession.value,
      timeSpent,
      efficiency,
      streakDays: currentStreak.value + 1, // Include current session
      completedAt: new Date()
    }

    sessionHistory.value.push(summary)
    lastCompletedDate.value = new Date().toISOString()

    // BUG-025: Persist to PouchDB (auto-save watcher handles this, but explicit call for immediate save)
    saveToDatabase()

    isActive.value = false
    currentSessionId.value = null
    sessionStartTime.value = null
    tasksSortedInSession.value = 0
    undoStack.value = []
    redoStack.value = []

    return summary
  }

  function recordAction(action: CategoryAction) {
    undoStack.value.push(action)
    redoStack.value = [] // Clear redo stack on new action
    tasksSortedInSession.value++

    // Limit undo stack to 50 actions to prevent memory issues
    if (undoStack.value.length > 50) {
      undoStack.value.shift()
    }
  }

  function undo(): CategoryAction | null {
    const action = undoStack.value.pop()
    if (action) {
      redoStack.value.push(action)
      tasksSortedInSession.value = Math.max(0, tasksSortedInSession.value - 1)
      return action
    }
    return null
  }

  function redo(): CategoryAction | null {
    const action = redoStack.value.pop()
    if (action) {
      undoStack.value.push(action)
      tasksSortedInSession.value++
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
  }

  // BUG-025 P4: Use PouchDB for cross-device sync instead of localStorage
  const db = useDatabase()

  async function saveToDatabase() {
    // Always save to localStorage first (fast, reliable)
    saveToLocalStorage()
    // Then try PouchDB for cross-device sync
    if (db.isReady?.value) {
      try {
        await db.save(DB_KEYS.QUICK_SORT_SESSIONS, {
          history: sessionHistory.value,
          lastCompletedDate: lastCompletedDate.value
        })
        console.log('📊 [BUG-025] Quick Sort data saved to PouchDB')
      } catch (error) {
        console.warn('Failed to save Quick Sort data to PouchDB (localStorage already saved):', error)
      }
    }
  }

  async function loadFromDatabase() {
    // Load from localStorage first (always available)
    loadFromLocalStorage()
    // Then try PouchDB for cross-device updates
    if (!db.isReady?.value) {
      console.log('📊 [BUG-025] Quick Sort loaded from localStorage (DB not ready)')
      return
    }
    try {
      interface QuickSortData {
        history?: Array<{ completedAt: string; [key: string]: unknown }>
        lastCompletedDate?: string | null
      }
      const saved = await db.load<QuickSortData>(DB_KEYS.QUICK_SORT_SESSIONS)
      if (saved) {
        if (saved.history && Array.isArray(saved.history)) {
          sessionHistory.value = saved.history.map((s) => ({
            ...s,
            completedAt: new Date(s.completedAt)
          })) as SessionSummary[]
        }
        if (saved.lastCompletedDate) {
          lastCompletedDate.value = saved.lastCompletedDate
        }
        console.log('📊 [BUG-025] Quick Sort data loaded from PouchDB')
      }
    } catch (error) {
      console.warn('Failed to load Quick Sort data from PouchDB (localStorage already loaded):', error)
    }
  }

  // Legacy localStorage functions (for fallback/migration)
  function saveToLocalStorage() {
    try {
      localStorage.setItem('quickSort_sessionHistory', JSON.stringify(sessionHistory.value))
      localStorage.setItem('quickSort_lastCompletedDate', lastCompletedDate.value || '')
    } catch (error) {
      console.error('Failed to save Quick Sort data to localStorage:', error)
    }
  }

  function loadFromLocalStorage() {
    try {
      const historyData = localStorage.getItem('quickSort_sessionHistory')
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

      const lastDate = localStorage.getItem('quickSort_lastCompletedDate')
      if (lastDate) {
        lastCompletedDate.value = lastDate
      }
    } catch (error) {
      console.error('Failed to load Quick Sort data from localStorage:', error)
    }
  }

  // BUG-025: Auto-save when data changes
  let quickSortSaveTimer: ReturnType<typeof setTimeout> | null = null
  watch([sessionHistory, lastCompletedDate], () => {
    if (quickSortSaveTimer) clearTimeout(quickSortSaveTimer)
    quickSortSaveTimer = setTimeout(() => {
      saveToDatabase()
    }, 500) // 500ms debounce
  }, { deep: true })

  // Load data on store creation (async)
  loadFromDatabase()

  return {
    // State
    isActive,
    currentSessionId,
    undoStack,
    redoStack,
    sessionHistory,
    sessionStartTime,
    tasksSortedInSession,

    // Getters
    canUndo,
    canRedo,
    currentStreak,

    // Actions
    startSession,
    endSession,
    recordAction,
    undo,
    redo,
    cancelSession,
    saveToLocalStorage,
    loadFromLocalStorage
  }
})
