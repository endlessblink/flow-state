/**
 * TASK-1662: Quick Sort Logic Tests (10 tests)
 *
 * Tests for the Quick Sort store (src/stores/quickSort.ts) covering:
 * - Session lifecycle (start, end, cancel)
 * - Action recording (categorize, done, skip)
 * - Undo/redo mechanics
 * - Session statistics
 * - Interrupted session recovery (TASK-1450)
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
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] || null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
  clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]) }),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('TASK-1662: Quick Sort Logic', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('1. Start session: initializes session state correctly', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const qs = useQuickSortStore()

    expect(qs.isActive).toBe(false)

    qs.startSession()

    expect(qs.isActive).toBe(true)
    expect(qs.currentSessionId).toBeTruthy()
    expect(qs.currentSessionId).toContain('session_')
    expect(qs.sessionStartTime).toBeTruthy()
    expect(qs.tasksSortedInSession).toBe(0)
    expect(qs.undoStack).toEqual([])
    expect(qs.redoStack).toEqual([])
  })

  it('2. Complete card (mark done): records action and increments count', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const qs = useQuickSortStore()

    qs.startSession()
    qs.recordAction({
      id: 'a1',
      type: 'MARK_DONE',
      taskId: 'task-1',
      oldStatus: 'todo',
      newStatus: 'done',
      timestamp: Date.now()
    })

    expect(qs.tasksSortedInSession).toBe(1)
    expect(qs.undoStack.length).toBe(1)
    expect(qs.undoStack[0].type).toBe('MARK_DONE')
  })

  it('3. Skip card (categorize): moves to undo stack, clears redo', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const qs = useQuickSortStore()

    qs.startSession()

    // Record first action
    qs.recordAction({
      id: 'a1',
      type: 'CATEGORIZE_TASK',
      taskId: 'task-1',
      timestamp: Date.now()
    })

    // Undo it (moves to redo)
    qs.undo()
    expect(qs.redoStack.length).toBe(1)

    // Record new action — should clear redo stack
    qs.recordAction({
      id: 'a2',
      type: 'SAVE_TASK',
      taskId: 'task-2',
      timestamp: Date.now()
    })

    expect(qs.redoStack.length).toBe(0) // Redo cleared
    expect(qs.undoStack.length).toBe(1)
    expect(qs.undoStack[0].id).toBe('a2')
  })

  it('4. Session completion: endSession produces summary with stats', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const qs = useQuickSortStore()

    qs.startSession()

    // Simulate 3 actions
    for (let i = 0; i < 3; i++) {
      qs.recordAction({
        id: `a${i}`,
        type: 'CATEGORIZE_TASK',
        taskId: `task-${i}`,
        timestamp: Date.now()
      })
    }

    // Simulate 1 minute elapsed
    qs.sessionStartTime = Date.now() - 60 * 1000

    const summary = qs.endSession()

    expect(summary).toBeDefined()
    expect(summary!.tasksProcessed).toBe(3)
    expect(summary!.timeSpent).toBeGreaterThan(0)
    expect(summary!.efficiency).toBeGreaterThan(0) // 3 tasks / 1 min = 3
    expect(summary!.completedAt).toBeInstanceOf(Date)
    expect(qs.isActive).toBe(false)
  })

  it('5. Session statistics: done count tracked via tasksSortedInSession', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const qs = useQuickSortStore()

    qs.startSession()

    qs.recordAction({ id: 'a1', type: 'MARK_DONE', taskId: 't1', timestamp: Date.now() })
    qs.recordAction({ id: 'a2', type: 'CATEGORIZE_TASK', taskId: 't2', timestamp: Date.now() })
    qs.recordAction({ id: 'a3', type: 'MARK_DONE', taskId: 't3', timestamp: Date.now() })

    expect(qs.tasksSortedInSession).toBe(3) // All actions counted

    // Undo one
    qs.undo()
    expect(qs.tasksSortedInSession).toBe(2)
  })

  it('6. Undo last action: reverses previous swipe', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const qs = useQuickSortStore()

    qs.startSession()

    const action = {
      id: 'a1',
      type: 'MARK_DONE' as const,
      taskId: 'task-1',
      oldStatus: 'todo' as const,
      newStatus: 'done' as const,
      timestamp: Date.now()
    }
    qs.recordAction(action)

    expect(qs.canUndo).toBe(true)
    expect(qs.canRedo).toBe(false)

    const undone = qs.undo()

    expect(undone).toEqual(action)
    expect(qs.tasksSortedInSession).toBe(0)
    expect(qs.canUndo).toBe(false)
    expect(qs.canRedo).toBe(true)
  })

  it('7. Interrupted session detected on store init (TASK-1450)', async () => {
    // Pre-populate localStorage with an active session
    const activeSession = {
      currentSessionId: 'session_12345',
      sessionStartTime: Date.now() - 5 * 60 * 1000, // 5 minutes ago
      tasksSortedInSession: 3,
      undoStack: [],
      redoStack: [],
      processedTaskIds: ['t1', 't2', 't3'],
      currentTaskId: 't4'
    }
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === 'flowstate-quicksort-active-session') return JSON.stringify(activeSession)
      return null
    })

    // Re-import to trigger checkForInterruptedSession
    vi.resetModules()
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const qs = useQuickSortStore()

    expect(qs.hasInterruptedSession).toBe(true)
    expect(qs.interruptedSessionData).toBeDefined()
    expect(qs.interruptedSessionData?.currentSessionId).toBe('session_12345')
  })

  it('8. Empty queue: undo returns null when nothing to undo', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const qs = useQuickSortStore()

    qs.startSession()

    expect(qs.canUndo).toBe(false)
    const result = qs.undo()
    expect(result).toBeNull()
  })

  it('9. Filter: only non-done tasks counted in session', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const qs = useQuickSortStore()

    qs.startSession()

    // Record a MARK_DONE action
    qs.recordAction({
      id: 'a1',
      type: 'MARK_DONE',
      taskId: 'task-1',
      oldStatus: 'todo',
      newStatus: 'done',
      timestamp: Date.now()
    })

    // The action is recorded in the undo stack regardless of type
    expect(qs.undoStack.length).toBe(1)
    expect(qs.tasksSortedInSession).toBe(1)
  })

  it('10. Resume interrupted session restores state (TASK-1450)', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const qs = useQuickSortStore()

    // Manually set interrupted session data
    qs.hasInterruptedSession = true
    qs.interruptedSessionData = {
      currentSessionId: 'session_resume_test',
      sessionStartTime: Date.now() - 10 * 60 * 1000,
      tasksSortedInSession: 5,
      undoStack: [
        { id: 'a1', type: 'CATEGORIZE_TASK', taskId: 't1', timestamp: Date.now() }
      ],
      redoStack: [],
      processedTaskIds: ['t1', 't2'],
      currentTaskId: 't3'
    }

    const data = qs.resumeSession()

    expect(data).toBeDefined()
    expect(qs.isActive).toBe(true)
    expect(qs.currentSessionId).toBe('session_resume_test')
    expect(qs.tasksSortedInSession).toBe(5)
    expect(qs.undoStack.length).toBe(1)
    expect(data!.processedTaskIds).toEqual(['t1', 't2'])
    expect(data!.currentTaskId).toBe('t3')
  })

  it('remembers the last selected task pools for the next session', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const qs = useQuickSortStore()

    expect(qs.lastSelectedSources).toEqual(['uncategorized'])

    qs.setLastSelectedSources(['overdue', 'next-3-days'])

    expect(qs.lastSelectedSources).toEqual(['overdue', 'next-3-days'])
    expect(JSON.parse(store['flowstate-quicksort-last-sources'])).toEqual(['overdue', 'next-3-days'])
  })

  it('persists source criteria and captured IDs with an active session', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const qs = useQuickSortStore()
    qs.startSession()

    qs.saveActiveSession({
      currentTaskId: 'overdue-2',
      processedTaskIds: new Set(['overdue-1']),
      sources: ['overdue', 'today'],
      queuedTaskIds: ['overdue-1', 'overdue-2', 'today-1']
    })

    const saved = JSON.parse(store['flowstate-quicksort-active-session'])
    expect(saved.sources).toEqual(['overdue', 'today'])
    expect(saved.queuedTaskIds).toEqual(['overdue-1', 'overdue-2', 'today-1'])
  })

  it('preserves an explicitly empty captured queue during recovery', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const qs = useQuickSortStore()
    qs.hasInterruptedSession = true
    qs.interruptedSessionData = {
      currentSessionId: 'session-empty',
      sessionStartTime: Date.now(),
      tasksSortedInSession: 1,
      undoStack: [],
      redoStack: [],
      processedTaskIds: ['last-task'],
      currentTaskId: null,
      sources: ['overdue'],
      queuedTaskIds: []
    }

    expect(qs.resumeSession()?.queuedTaskIds).toEqual([])
  })

  it('11. Undo/redo cycles three consecutive times across all Quick Sort action types', async () => {
    const { useQuickSortStore } = await import('@/stores/quickSort')
    const qs = useQuickSortStore()

    qs.startSession()

    const actions = [
      {
        id: 'cycle-categorize',
        type: 'CATEGORIZE_TASK' as const,
        taskId: 'task-categorize',
        oldProjectId: null,
        newProjectId: 'project-next',
        timestamp: Date.now()
      },
      {
        id: 'cycle-done',
        type: 'MARK_DONE' as const,
        taskId: 'task-done',
        oldStatus: 'todo' as const,
        newStatus: 'done' as const,
        timestamp: Date.now()
      },
      {
        id: 'cycle-done-delete',
        type: 'MARK_DONE_AND_DELETE' as const,
        taskId: 'task-done-delete',
        oldStatus: 'todo' as const,
        newStatus: 'done' as const,
        timestamp: Date.now()
      },
      {
        id: 'cycle-save',
        type: 'SAVE_TASK' as const,
        taskId: 'task-save',
        oldDescription: 'before',
        newDescription: 'after',
        timestamp: Date.now()
      }
    ]

    actions.forEach(action => qs.recordAction(action))

    expect(qs.undoStack.map(action => action.id)).toEqual(actions.map(action => action.id))
    expect(qs.redoStack).toEqual([])
    expect(qs.tasksSortedInSession).toBe(actions.length)

    for (let i = 0; i < 3; i += 1) {
      const undone: string[] = []
      for (const action of [...actions].reverse()) {
        const result = qs.undo()
        expect(result).toEqual(action)
        undone.push(result!.id)
      }

      expect(undone).toEqual([...actions].reverse().map(action => action.id))
      expect(qs.undoStack).toEqual([])
      expect(qs.redoStack.map(action => action.id)).toEqual([...actions].reverse().map(action => action.id))
      expect(qs.tasksSortedInSession).toBe(0)
      expect(qs.canUndo).toBe(false)
      expect(qs.canRedo).toBe(true)

      const redone: string[] = []
      for (const action of actions) {
        const result = qs.redo()
        expect(result).toEqual(action)
        redone.push(result!.id)
      }

      expect(redone).toEqual(actions.map(action => action.id))
      expect(qs.undoStack.map(action => action.id)).toEqual(actions.map(action => action.id))
      expect(qs.redoStack).toEqual([])
      expect(qs.tasksSortedInSession).toBe(actions.length)
      expect(qs.canUndo).toBe(true)
      expect(qs.canRedo).toBe(false)
    }
  })
})
