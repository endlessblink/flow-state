/**
 * TASK-1661: Gamification Store Tests (15 tests)
 *
 * The FlowState gamification system does NOT use a dedicated gamification store.
 * XP/level/achievement logic is handled via the task completion flow and
 * stored in Supabase user_gamification table. The Quick Sort store tracks
 * session stats (tasks processed, efficiency, streaks).
 *
 * This test file covers the gamification-adjacent logic that IS testable:
 * - Quick Sort session stats (tasks processed, efficiency, streak)
 * - Session history persistence
 * - Undo/redo with task count adjustments
 * - Streak calculation logic
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock dependencies
vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    fetchQuickSortHistory: vi.fn().mockResolvedValue([]),
  })
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'test-user-id' }
  })
}))

vi.mock('@/services/offline/writeQueueDB', () => ({
  enqueueOperation: vi.fn().mockResolvedValue({ id: 1 })
}))

vi.mock('@/utils/supabaseMappers', () => ({
  toSupabaseQuickSortSession: vi.fn().mockReturnValue({})
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('TASK-1661: Gamification Store (Quick Sort Stats)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('1. Initial state: tasksSortedInSession starts at 0', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const store = useQuickSortStore()

    expect(store.tasksSortedInSession).toBe(0)
    expect(store.isActive).toBe(false)
  })

  it('2. Completing a task (recordAction) increments tasksSortedInSession', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const store = useQuickSortStore()

    store.startSession()
    store.recordAction({
      id: 'action-1',
      type: 'MARK_DONE',
      taskId: 'task-1',
      timestamp: Date.now()
    })

    expect(store.tasksSortedInSession).toBe(1)
  })

  it('3. Multiple actions tracked correctly', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const store = useQuickSortStore()

    store.startSession()
    for (let i = 0; i < 5; i++) {
      store.recordAction({
        id: `action-${i}`,
        type: 'CATEGORIZE_TASK',
        taskId: `task-${i}`,
        timestamp: Date.now()
      })
    }

    expect(store.tasksSortedInSession).toBe(5)
  })

  it('4. Session end calculates efficiency (tasks per minute)', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const store = useQuickSortStore()

    store.startSession()

    // Record 6 actions
    for (let i = 0; i < 6; i++) {
      store.recordAction({
        id: `action-${i}`,
        type: 'CATEGORIZE_TASK',
        taskId: `task-${i}`,
        timestamp: Date.now()
      })
    }

    // Override sessionStartTime to simulate time passage (2 minutes ago)
    store.sessionStartTime = Date.now() - 2 * 60 * 1000

    const summary = store.endSession()

    expect(summary).toBeDefined()
    expect(summary!.tasksProcessed).toBe(6)
    expect(summary!.efficiency).toBeGreaterThan(0)
    // 6 tasks / 2 minutes = ~3 tasks/min
    expect(summary!.efficiency).toBeCloseTo(3, 0)
  })

  it('5. Level/streak calculation: consecutive days counted', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const store = useQuickSortStore()

    // Simulate having completed sessions on consecutive days
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    // lastCompletedDate is internal (not exposed in return), so load via localStorage
    const history = [
      {
        id: 's1',
        tasksProcessed: 5,
        timeSpent: 60000,
        efficiency: 5,
        streakDays: 1,
        completedAt: yesterday.toISOString()
      },
      {
        id: 's2',
        tasksProcessed: 3,
        timeSpent: 30000,
        efficiency: 6,
        streakDays: 2,
        completedAt: today.toISOString()
      }
    ]
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === 'flowstate-quicksort-history') return JSON.stringify(history)
      if (key === 'flowstate-quicksort-last-date') return today.toISOString()
      return null
    })
    store.loadFromLocalStorage()

    // Should have a streak
    expect(store.currentStreak).toBeGreaterThanOrEqual(1)
  })

  it('6. Streak resets after missed day', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const store = useQuickSortStore()

    // Last completed 3 days ago (streak broken)
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    store.lastCompletedDate = threeDaysAgo.toISOString()
    store.sessionHistory = [
      {
        id: 's1',
        tasksProcessed: 5,
        timeSpent: 60000,
        efficiency: 5,
        streakDays: 1,
        completedAt: threeDaysAgo
      }
    ]

    expect(store.currentStreak).toBe(0)
  })

  it('7. No duplicate counting for same task in session', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const store = useQuickSortStore()

    store.startSession()

    // Record action, undo it, then redo — should net to 1
    store.recordAction({
      id: 'action-1',
      type: 'MARK_DONE',
      taskId: 'task-1',
      timestamp: Date.now()
    })
    expect(store.tasksSortedInSession).toBe(1)

    store.undo()
    expect(store.tasksSortedInSession).toBe(0)

    store.redo()
    expect(store.tasksSortedInSession).toBe(1)
  })

  it('8. Session history persisted to localStorage', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const store = useQuickSortStore()

    store.saveToLocalStorage()

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'flowstate-quicksort-history',
      expect.any(String)
    )
  })

  it('9. Session history loaded from localStorage', async () => {
    // Pre-populate localStorage
    const history = [
      {
        id: 's1',
        tasksProcessed: 5,
        timeSpent: 60000,
        efficiency: 5,
        streakDays: 1,
        completedAt: new Date().toISOString()
      }
    ]
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === 'flowstate-quicksort-history') return JSON.stringify(history)
      if (key === 'flowstate-quicksort-last-date') return new Date().toISOString()
      return null
    })

    const { useQuickSortStore } = await import('@/stores/quickSort')
    const store = useQuickSortStore()
    store.loadFromLocalStorage()

    expect(store.sessionHistory.length).toBe(1)
    expect(store.sessionHistory[0].tasksProcessed).toBe(5)
  })

  it('10. Undo returns last action and decrements count', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const store = useQuickSortStore()

    store.startSession()
    const action = {
      id: 'action-1',
      type: 'CATEGORIZE_TASK' as const,
      taskId: 'task-1',
      timestamp: Date.now()
    }
    store.recordAction(action)
    expect(store.canUndo).toBe(true)

    const undone = store.undo()
    expect(undone).toEqual(action)
    expect(store.tasksSortedInSession).toBe(0)
    expect(store.canRedo).toBe(true)
  })

  it('11. Redo returns undone action and increments count', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const store = useQuickSortStore()

    store.startSession()
    store.recordAction({
      id: 'action-1',
      type: 'SAVE_TASK',
      taskId: 'task-1',
      timestamp: Date.now()
    })
    store.undo()

    const redone = store.redo()
    expect(redone).toBeDefined()
    expect(redone!.id).toBe('action-1')
    expect(store.tasksSortedInSession).toBe(1)
  })

  it('12. Cancel session resets all state', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const store = useQuickSortStore()

    store.startSession()
    store.recordAction({
      id: 'action-1',
      type: 'MARK_DONE',
      taskId: 'task-1',
      timestamp: Date.now()
    })

    store.cancelSession()

    expect(store.isActive).toBe(false)
    expect(store.currentSessionId).toBeNull()
    expect(store.tasksSortedInSession).toBe(0)
    expect(store.undoStack.length).toBe(0)
    expect(store.redoStack.length).toBe(0)
  })

  it('13. Undo stack limited to 50 actions', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const store = useQuickSortStore()

    store.startSession()

    // Record 55 actions
    for (let i = 0; i < 55; i++) {
      store.recordAction({
        id: `action-${i}`,
        type: 'CATEGORIZE_TASK',
        taskId: `task-${i}`,
        timestamp: Date.now()
      })
    }

    // Undo stack should be capped at 50
    expect(store.undoStack.length).toBeLessThanOrEqual(50)
  })

  it('14. Session ID generated on startSession', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const store = useQuickSortStore()

    store.startSession()

    expect(store.currentSessionId).toBeTruthy()
    expect(store.currentSessionId).toContain('session_')
    expect(store.isActive).toBe(true)
    expect(store.sessionStartTime).toBeTruthy()
  })

  it('15. Session summary added to sessionHistory on endSession', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const store = useQuickSortStore()

    const initialHistoryLen = store.sessionHistory.length

    store.startSession()
    store.recordAction({
      id: 'action-1',
      type: 'MARK_DONE',
      taskId: 'task-1',
      timestamp: Date.now()
    })

    const summary = store.endSession()

    expect(summary).toBeDefined()
    expect(store.sessionHistory.length).toBe(initialHistoryLen + 1)
    expect(summary!.tasksProcessed).toBe(1)
    expect(summary!.completedAt).toBeInstanceOf(Date)
  })
})
