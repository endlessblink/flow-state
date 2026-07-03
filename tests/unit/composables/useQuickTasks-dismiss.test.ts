/**
 * FEATURE-1774: Dismissing a task from the Frequent list must persist to
 * localStorage so the dismissal survives reloads, and the task store filter
 * must exclude dismissed IDs.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Test the localStorage read/write behavior in isolation from the full Pinia
// wiring (which drags in Supabase, timers, etc.) by round-tripping via a fresh
// module import per test.

const STORAGE_KEY = 'flowstate:dismissed-frequent'

describe('useQuickTasks — dismissFromFrequent', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        window.localStorage.clear()
        vi.resetModules()
    })

    it('persists dismissed task id to localStorage', async () => {
        vi.doMock('@/stores/auth', () => ({ useAuthStore: () => ({ isAuthenticated: true }) }))
        vi.doMock('@/stores/tasks', () => ({
            useTaskStore: () => ({
                tasks: [],
                activeStatusFilter: null,
                getProjectById: () => null,
            }),
        }))
        vi.doMock('@/stores/projects', () => ({
            useProjectStore: () => ({
                activeProjectId: null,
                isDescendantOf: () => false,
            }),
        }))
        vi.doMock('@/stores/timer', () => ({
            useTimerStore: () => ({ startTimer: async () => {} }),
        }))

        const { useQuickTasks } = await import('@/composables/useQuickTasks')
        const { dismissFromFrequent } = useQuickTasks()

        dismissFromFrequent('task-abc')
        const raw = window.localStorage.getItem(STORAGE_KEY)
        expect(raw).toBeTruthy()
        expect(JSON.parse(raw!)).toEqual(['task-abc'])
    })

    it('excludes dismissed tasks from frequentTasks', async () => {
        const tasks = [
            { id: 'a', title: 'A', status: 'todo', completedPomodoros: 3, _soft_deleted: false, projectId: null },
            { id: 'b', title: 'B', status: 'todo', completedPomodoros: 2, _soft_deleted: false, projectId: null },
            { id: 'c', title: 'C', status: 'todo', completedPomodoros: 1, _soft_deleted: false, projectId: null },
        ]

        // Pre-seed localStorage before the module is imported — the dismissals
        // are loaded at module-eval time.
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['b']))

        vi.doMock('@/stores/auth', () => ({ useAuthStore: () => ({ isAuthenticated: true }) }))
        vi.doMock('@/stores/tasks', () => ({
            useTaskStore: () => ({
                tasks,
                activeStatusFilter: null,
                getProjectById: () => null,
            }),
        }))
        vi.doMock('@/stores/projects', () => ({
            useProjectStore: () => ({
                activeProjectId: null,
                isDescendantOf: () => false,
            }),
        }))
        vi.doMock('@/stores/timer', () => ({
            useTimerStore: () => ({ startTimer: async () => {} }),
        }))

        const { useQuickTasks } = await import('@/composables/useQuickTasks')
        const { frequentTasks } = useQuickTasks()

        const ids = frequentTasks.value.map(t => t.id)
        expect(ids).toEqual(['a', 'c'])
    })

    it('restoreFrequentDismissals clears localStorage', async () => {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['x', 'y']))

        vi.doMock('@/stores/auth', () => ({ useAuthStore: () => ({ isAuthenticated: true }) }))
        vi.doMock('@/stores/tasks', () => ({
            useTaskStore: () => ({
                tasks: [],
                activeStatusFilter: null,
                getProjectById: () => null,
            }),
        }))
        vi.doMock('@/stores/projects', () => ({
            useProjectStore: () => ({
                activeProjectId: null,
                isDescendantOf: () => false,
            }),
        }))
        vi.doMock('@/stores/timer', () => ({
            useTimerStore: () => ({ startTimer: async () => {} }),
        }))

        const { useQuickTasks } = await import('@/composables/useQuickTasks')
        const { restoreFrequentDismissals } = useQuickTasks()

        restoreFrequentDismissals()
        const raw = window.localStorage.getItem(STORAGE_KEY)
        expect(raw).toBe('[]')
    })
})

describe('useQuickTasks — pinTask result contract', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        window.localStorage.clear()
        vi.resetModules()
    })

    it('reports created when pinning a new typed title', async () => {
        const createTaskWithUndo = vi.fn(async () => ({ id: 'new-task', title: 'לארגן משימות', isPinned: true }))
        const updateTaskWithUndo = vi.fn()

        vi.doMock('@/stores/auth', () => ({ useAuthStore: () => ({ isAuthenticated: true }) }))
        vi.doMock('@/stores/tasks', () => ({
            useTaskStore: () => ({
                tasks: [],
                activeStatusFilter: null,
                getProjectById: () => null,
                createTaskWithUndo,
                updateTaskWithUndo,
            }),
        }))
        vi.doMock('@/stores/projects', () => ({
            useProjectStore: () => ({
                activeProjectId: null,
                isDescendantOf: () => false,
            }),
        }))
        vi.doMock('@/stores/timer', () => ({
            useTimerStore: () => ({ startTimer: async () => {} }),
        }))

        const { useQuickTasks } = await import('@/composables/useQuickTasks')
        const { pinTask } = useQuickTasks()

        await expect(pinTask(' לארגן משימות ')).resolves.toEqual({ status: 'created' })
        expect(createTaskWithUndo).toHaveBeenCalledWith(expect.objectContaining({
            title: 'לארגן משימות',
            status: 'todo',
            isPinned: true,
        }))
        expect(updateTaskWithUndo).not.toHaveBeenCalled()
    })

    it('reports pinned-existing when typed title matches an unpinned task', async () => {
        const createTaskWithUndo = vi.fn()
        const updateTaskWithUndo = vi.fn(async () => {})
        const tasks = [
            { id: 'task-1', title: 'לארגן משימות', status: 'todo', _soft_deleted: false, isPinned: false },
        ]

        vi.doMock('@/stores/auth', () => ({ useAuthStore: () => ({ isAuthenticated: true }) }))
        vi.doMock('@/stores/tasks', () => ({
            useTaskStore: () => ({
                tasks,
                activeStatusFilter: null,
                getProjectById: () => null,
                createTaskWithUndo,
                updateTaskWithUndo,
            }),
        }))
        vi.doMock('@/stores/projects', () => ({
            useProjectStore: () => ({
                activeProjectId: null,
                isDescendantOf: () => false,
            }),
        }))
        vi.doMock('@/stores/timer', () => ({
            useTimerStore: () => ({ startTimer: async () => {} }),
        }))

        const { useQuickTasks } = await import('@/composables/useQuickTasks')
        const { pinTask } = useQuickTasks()

        await expect(pinTask('לארגן משימות')).resolves.toEqual({ status: 'pinned-existing', taskId: 'task-1' })
        expect(updateTaskWithUndo).toHaveBeenCalledWith('task-1', { isPinned: true })
        expect(createTaskWithUndo).not.toHaveBeenCalled()
    })

    it('reports already-pinned when typed title matches an existing pinned task', async () => {
        const createTaskWithUndo = vi.fn()
        const updateTaskWithUndo = vi.fn()
        const tasks = [
            { id: 'task-1', title: 'לארגן משימות', status: 'todo', _soft_deleted: false, isPinned: true },
        ]

        vi.doMock('@/stores/auth', () => ({ useAuthStore: () => ({ isAuthenticated: true }) }))
        vi.doMock('@/stores/tasks', () => ({
            useTaskStore: () => ({
                tasks,
                activeStatusFilter: null,
                getProjectById: () => null,
                createTaskWithUndo,
                updateTaskWithUndo,
            }),
        }))
        vi.doMock('@/stores/projects', () => ({
            useProjectStore: () => ({
                activeProjectId: null,
                isDescendantOf: () => false,
            }),
        }))
        vi.doMock('@/stores/timer', () => ({
            useTimerStore: () => ({ startTimer: async () => {} }),
        }))

        const { useQuickTasks } = await import('@/composables/useQuickTasks')
        const { pinTask } = useQuickTasks()

        await expect(pinTask('לארגן משימות')).resolves.toEqual({ status: 'already-pinned', taskId: 'task-1' })
        expect(updateTaskWithUndo).not.toHaveBeenCalled()
        expect(createTaskWithUndo).not.toHaveBeenCalled()
    })

    it('reports unauthenticated instead of silently no-oping', async () => {
        const createTaskWithUndo = vi.fn()
        const updateTaskWithUndo = vi.fn()

        vi.doMock('@/stores/auth', () => ({ useAuthStore: () => ({ isAuthenticated: false }) }))
        vi.doMock('@/stores/tasks', () => ({
            useTaskStore: () => ({
                tasks: [],
                activeStatusFilter: null,
                getProjectById: () => null,
                createTaskWithUndo,
                updateTaskWithUndo,
            }),
        }))
        vi.doMock('@/stores/projects', () => ({
            useProjectStore: () => ({
                activeProjectId: null,
                isDescendantOf: () => false,
            }),
        }))
        vi.doMock('@/stores/timer', () => ({
            useTimerStore: () => ({ startTimer: async () => {} }),
        }))

        const { useQuickTasks } = await import('@/composables/useQuickTasks')
        const { pinTask } = useQuickTasks()

        await expect(pinTask('לארגן משימות')).resolves.toEqual({ status: 'unauthenticated' })
        expect(updateTaskWithUndo).not.toHaveBeenCalled()
        expect(createTaskWithUndo).not.toHaveBeenCalled()
    })
})
