import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface CategoryAction {
  id: string
  type: 'CATEGORIZE_TASK'
  taskId: string
  oldProjectId: string | null
  newProjectId: string
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

    let currentDate = new Date()
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

    // Persist to localStorage
    saveToLocalStorage()

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
        sessionHistory.value = parsed.map((s: any) => ({
          ...s,
          completedAt: new Date(s.completedAt)
        }))
      }

      const lastDate = localStorage.getItem('quickSort_lastCompletedDate')
      if (lastDate) {
        lastCompletedDate.value = lastDate
      }
    } catch (error) {
      console.error('Failed to load Quick Sort data from localStorage:', error)
    }
  }

  // Load data on store creation
  loadFromLocalStorage()

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
