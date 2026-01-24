
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TaskRow from '@/components/tasks/TaskRow.vue'

// Mock sub-components
vi.mock('@/components/tasks/DoneToggle.vue', () => ({
  default: { template: '<div class="done-toggle" />' }
}))
vi.mock('@/components/common/CustomSelect.vue', () => ({
  default: { template: '<div class="custom-select" />' }
}))
vi.mock('@/components/tasks/row/TaskRowProject.vue', () => ({
  default: { template: '<div class="task-row-project" />' }
}))
vi.mock('@/components/tasks/row/TaskRowDueDate.vue', () => ({
  default: { template: '<div class="task-row-due-date" />' }
}))
vi.mock('lucide-vue-next', () => ({
  Play: { template: '<svg class="play-icon" />' },
  Edit: { template: '<svg class="edit-icon" />' }
}))

// Mock Stores
vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => ({
    getProjectVisual: () => ({ type: 'emoji', content: '📝' }),
    getProjectDisplayName: () => 'Test Project'
  })
}))

vi.mock('@/stores/timer', () => ({
  useTimerStore: () => ({
    isTimerActive: false,
    currentTaskId: null
  })
}))

describe('TaskRow.vue Accessibility', () => {
  const mockTask = {
    id: '123',
    title: 'Test Task',
    status: 'planned',
    priority: 'high',
    projectId: 'proj1',
    tags: ['urgent'],
    createdAt: new Date(),
    updatedAt: new Date()
  }

  it('buttons should have aria-label', () => {
    const wrapper = mount(TaskRow, {
      props: {
        task: mockTask,
        density: 'comfortable',
        rowIndex: 0
      }
    })

    // Find the action buttons
    const playButton = wrapper.find('.task-row__action-btn[title="Start Timer"]')
    const editButton = wrapper.find('.task-row__action-btn[title="Edit Task"]')

    expect(playButton.exists()).toBe(true)
    expect(editButton.exists()).toBe(true)

    // Check for aria-label
    expect(playButton.attributes('aria-label')).toBeDefined()
    expect(playButton.attributes('aria-label')).toContain('Start timer for Test Task')

    expect(editButton.attributes('aria-label')).toBeDefined()
    expect(editButton.attributes('aria-label')).toContain('Edit task Test Task')
  })
})
