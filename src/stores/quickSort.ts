import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import { useAuthStore } from '@/stores/auth'

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
  oldStatus?: 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold'
  newStatus?: 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold'
  deletedTask?: import('./tasks').Task // Store full task data for undo of deleted tasks
  oldDescription?: string
  newDescription?: string
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

    // Persist to Supabase (pass the new session for immediate save)
    saveToDatabase(summary)

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

  // Use Supabase for cross-device sync
  const supabaseDb = useSupabaseDatabase()
  const authStore = useAuthStore()

  async function saveToDatabase(newSession?: SessionSummary) {
    // Always save to localStorage first (fast, reliable)
    saveToLocalStorage()

    // Then try Supabase for cross-device sync (only if authenticated)
    if (authStore.user?.id && newSession) {
      try {
        await supabaseDb.saveQuickSortSession(newSession)
        console.log('📊 Quick Sort session saved to Supabase')
      } catch (error) {
        console.warn('Failed to save Quick Sort session to Supabase (localStorage already saved):', error)
      }
    }
  }

  async function loadFromDatabase() {
    // Load from localStorage first (always available, instant)
    loadFromLocalStorage()

    // Then try Supabase for cross-device updates (only if authenticated)
    if (!authStore.user?.id) {
      console.log('📊 Quick Sort loaded from localStorage (not authenticated)')
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
        console.log('📊 Quick Sort data loaded from Supabase')
      }
    } catch (error) {
      console.warn('Failed to load Quick Sort data from Supabase (localStorage already loaded):', error)
    }
  }

  // Legacy localStorage functions (for fallback/migration)
  function saveToLocalStorage() {
    try {
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
