import type { Meta, StoryObj } from '@storybook/vue3'
import TaskEditMetadata from '@/components/tasks/edit/TaskEditMetadata.vue'
import type { Task } from '@/stores/tasks'

const meta = {
  component: TaskEditMetadata,
  title: '📝 Task Management/Edit/TaskEditMetadata',
  tags: ['autodocs', 'new'],

  args: {
    modelValue: {
      id: 'task-1',
      title: 'Sample task',
      dueDate: '2026-02-20',
      estimatedDuration: 60,
      priority: 'medium',
      status: 'planned',
    } as Task,
    currentSectionId: null,
    priorityOptions: [
      { label: 'Low', value: 'low' },
      { label: 'Medium', value: 'medium' },
      { label: 'High', value: 'high' },
    ],
    statusOptions: [
      { label: 'Planned', value: 'planned' },
      { label: 'In Progress', value: 'in_progress' },
      { label: 'Done', value: 'done' },
      { label: 'Backlog', value: 'backlog' },
    ],
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
    (story: any) => ({
      components: { story },
      template: `
        <div style="padding: var(--space-6); background: var(--glass-bg-soft); border-radius: var(--radius-xl); border: 1px solid var(--glass-border); max-width: 800px;">
          <story />
        </div>
      `,
    })
  ],
} satisfies Meta<typeof TaskEditMetadata>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const HighPriority: Story = {
  args: {
    modelValue: {
      id: 'task-2',
      title: 'Urgent bug fix',
      dueDate: '2026-02-15',
      estimatedDuration: 120,
      priority: 'high',
      status: 'in_progress',
    } as Task,
  },
}

export const LowPriority: Story = {
  args: {
    modelValue: {
      id: 'task-3',
      title: 'Nice-to-have feature',
      dueDate: '2026-03-01',
      estimatedDuration: 30,
      priority: 'low',
      status: 'backlog',
    } as Task,
  },
}

export const Done: Story = {
  args: {
    modelValue: {
      id: 'task-4',
      title: 'Completed task',
      dueDate: '2026-02-10',
      estimatedDuration: 90,
      priority: 'medium',
      status: 'done',
    } as Task,
  },
}

export const NoDueDate: Story = {
  args: {
    modelValue: {
      id: 'task-5',
      title: 'Task without due date',
      dueDate: undefined,
      estimatedDuration: 45,
      priority: 'medium',
      status: 'planned',
    } as Task,
  },
}

export const LongDuration: Story = {
  args: {
    modelValue: {
      id: 'task-6',
      title: 'Major refactoring',
      dueDate: '2026-02-28',
      estimatedDuration: 480,
      priority: 'high',
      status: 'planned',
    } as Task,
  },
}
