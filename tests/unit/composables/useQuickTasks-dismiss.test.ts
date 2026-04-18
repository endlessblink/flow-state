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
