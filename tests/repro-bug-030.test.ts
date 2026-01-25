import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTaskStore } from '../src/stores/tasks'

// Mock the Supabase database composable
vi.mock('../src/composables/useSupabaseDatabase', () => ({
    useSupabaseDatabase: () => ({
        fetchTasks: vi.fn().mockResolvedValue([]),
        saveTask: vi.fn().mockResolvedValue(undefined),
        deleteTask: vi.fn().mockResolvedValue(undefined),
        fetchProjects: vi.fn().mockResolvedValue([]),
        saveProject: vi.fn().mockResolvedValue(undefined),
        saveProjects: vi.fn().mockResolvedValue(undefined),
        fetchGroups: vi.fn().mockResolvedValue([]),
        saveGroups: vi.fn().mockResolvedValue(undefined)
    })
}))

describe('BUG-030: Uncategorized Tasks Filter', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('correctly filters tasks with uncategorized project', async () => {
        const store = useTaskStore()

        // Create test tasks using store API
        // When no projectId is provided, tasks get 'uncategorized' by default
        const task1 = await store.createTask({ title: 'Task 1 - no project' })
        const task2 = await store.createTask({ title: 'Task 2 - no project' })

        // Create a project and a task with that project
        const project = await store.createProject({ name: 'Test Project' })
        const task3 = await store.createTask({
            title: 'Task 3 - with project',
            projectId: project.id
        })

        // Set filter to uncategorized
        store.setSmartView('uncategorized')

        // Get filtered tasks
        const filteredIds = store.filteredTasks.map(t => t.id)

        // Tasks without project should be included
        expect(filteredIds).toContain(task1.id)
        expect(filteredIds).toContain(task2.id)

        // Task with project should NOT be included in uncategorized
        expect(filteredIds).not.toContain(task3.id)
    })

    it('tasks with uncategorized string projectId are filtered correctly', async () => {
        const store = useTaskStore()

        // Create a task that will have 'uncategorized' as projectId
        const task = await store.createTask({ title: 'Uncategorized Task' })

        // Verify task has 'uncategorized' projectId
        expect(task.projectId).toBe('uncategorized')

        // Set filter to uncategorized
        store.setSmartView('uncategorized')

        // This task should appear in uncategorized filter
        const filteredIds = store.filteredTasks.map(t => t.id)
        expect(filteredIds).toContain(task.id)
    })
})
