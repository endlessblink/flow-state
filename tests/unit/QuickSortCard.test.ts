import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import QuickSortCard from '../../src/components/QuickSortCard.vue';

// Mock components to avoid deep rendering issues
vi.mock('@/components/common/MarkdownRenderer.vue', () => ({
  default: { template: '<div class="markdown-renderer-stub"></div>' }
}));

// Mock Lucide icons
vi.mock('lucide-vue-next', () => ({
  Calendar: { template: '<span class="icon-stub">Calendar</span>' },
  Flag: { template: '<span class="icon-stub">Flag</span>' },
  ListTodo: { template: '<span class="icon-stub">ListTodo</span>' },
  Timer: { template: '<span class="icon-stub">Timer</span>' },
  ArrowRight: { template: '<span class="icon-stub">ArrowRight</span>' },
  ArrowLeft: { template: '<span class="icon-stub">ArrowLeft</span>' },
  CheckCircle: { template: '<span class="icon-stub">CheckCircle</span>' },
  Trash2: { template: '<span class="icon-stub">Trash2</span>' },
  Edit: { template: '<span class="icon-stub">Edit</span>' }
}));

// Mock Task Store
vi.mock('@/stores/tasks', () => ({
  useTaskStore: vi.fn(() => ({
    getProjectDisplayName: () => 'Project 1',
    getProjectVisual: () => ({ type: 'emoji', content: '🚀' })
  }))
}));

describe('QuickSortCard.vue Accessibility', () => {
  const mockTask = {
    id: '123',
    title: 'Test Task',
    projectId: 'proj1',
    description: 'A description',
    priority: 'medium',
    status: 'todo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dueDate: new Date().toISOString(),
    subtasks: [],
    completedPomodoros: 0
  };

  it('renders action buttons with correct aria-labels', () => {
    const wrapper = mount(QuickSortCard, {
      props: {
        task: mockTask
      },
      global: {
        stubs: {
          MarkdownRenderer: true
        }
      }
    });

    const markDoneBtn = wrapper.find('.mark-done-btn');
    expect(markDoneBtn.exists()).toBe(true);
    expect(markDoneBtn.attributes('aria-label')).toBe('Mark task as done (D)');

    const editBtn = wrapper.find('.edit-btn');
    expect(editBtn.exists()).toBe(true);
    expect(editBtn.attributes('aria-label')).toBe('Edit task (E)');

    const deleteBtn = wrapper.find('.delete-btn');
    expect(deleteBtn.exists()).toBe(true);
    expect(deleteBtn.attributes('aria-label')).toBe('Delete task (Del)');
  });

  it('renders date input wrapper with role button and tabindex', () => {
    const wrapper = mount(QuickSortCard, {
      props: {
        task: mockTask
      },
      global: {
        stubs: {
          MarkdownRenderer: true
        }
      }
    });

    const dateWrapper = wrapper.find('.date-input-wrapper');
    expect(dateWrapper.exists()).toBe(true);
    expect(dateWrapper.attributes('role')).toBe('button');
    expect(dateWrapper.attributes('tabindex')).toBe('0');
  });
});
