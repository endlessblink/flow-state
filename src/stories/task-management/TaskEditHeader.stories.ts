import type { Meta, StoryObj } from '@storybook/vue3'
import TaskEditHeader from '@/components/tasks/edit/TaskEditHeader.vue'
import type { Task } from '@/stores/tasks'

const meta = {
  component: TaskEditHeader,
  title: '📝 Task Management/Edit/TaskEditHeader',
  tags: ['autodocs', 'new'],

  args: {
    modelValue: {
      id: 'task-1',
      title: 'Complete project documentation',
      description: 'Write comprehensive API documentation for all endpoints',
      status: 'in_progress',
      priority: 'high',
    } as Task,
  },

  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: 'var(--bg-primary)' },
      ],
    },
  },

  decorators: [
    (story: Record<string, unknown>) => ({
      components: { story },
      template: `
        <div style="padding: var(--space-6); background: var(--glass-bg-soft); border-radius: var(--radius-xl); border: 1px solid var(--glass-border); max-width: 700px;">
          <story />
        </div>
      `,
    })
  ],
} satisfies Meta<typeof TaskEditHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const EmptyTask: Story = {
  args: {
    modelValue: {
      id: 'task-new',
      title: '',
      description: '',
      status: 'planned',
      priority: 'medium',
    } as Task,
  },
}

export const LongTitle: Story = {
  args: {
    modelValue: {
      id: 'task-2',
      title: 'Implement comprehensive error handling system with retry logic and fallback mechanisms across all API endpoints',
      description: '',
      status: 'planned',
      priority: 'medium',
    } as Task,
  },
}

export const WithRichDescription: Story = {
  args: {
    modelValue: {
      id: 'task-3',
      title: 'Refactor authentication module',
      description: '# Overview\n\nNeed to refactor the auth module to support:\n- OAuth providers\n- JWT token refresh\n- Session management\n\n## Acceptance Criteria\n1. All tests pass\n2. No breaking changes\n3. Documentation updated',
      status: 'in_progress',
      priority: 'high',
    } as Task,
  },
}

export const HebrewText: Story = {
  args: {
    modelValue: {
      id: 'task-4',
      title: 'השלם את התיעוד של הפרויקט',
      description: 'כתוב תיעוד מקיף של API עבור כל נקודות הקצה',
      status: 'planned',
      priority: 'medium',
    } as Task,
  },
}
