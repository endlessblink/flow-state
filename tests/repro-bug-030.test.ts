import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTaskStore } from '../src/stores/tasks'
import { useSmartViews } from '../src/composables/useSmartViews'

describe('BUG-030: Uncategorized Tasks Filter', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('correctly filters tasks with no project as uncategorized', async () => {
        const store = useTaskStore()

        // Create test tasks
        const tasks = [
            { id: '1', title: 'Task with null project', projectId: null },
            { id: '2', title: 'Task with undefined project', projectId: undefined },
            { id: '3', title: 'Task with empty string project', projectId: '' },
            { id: '4', title: 'Task with "uncategorized" string', projectId: 'uncategorized' },
            { id: '5', title: 'Task with valid project', projectId: 'proj-123' }
        ]

        // Mock store.tasks
        store.tasks = tasks as any

        // Set filter to uncategorized
        store.setSmartView('uncategorized')

        // DEBUG: Log the filter result
        console.log('Filtered Tasks:', store.filteredTasks.map(t => ({ id: t.id, title: t.title, projectId: t.projectId })))

        // Assertions
        const filteredIds = store.filteredTasks.map(t => t.id)

        expect(filteredIds).toContain('1') // null
        expect(filteredIds).toContain('2') // undefined
        expect(filteredIds).toContain('3') // empty string
        // "uncategorized" string might typically map to a project ID, but for this test we check if UI treats it as filterable
        // Based on AppSidebar.ts:1911, default is 'uncategorized', so it SHOULD be included if it's treated as "No Project"
    })
})
