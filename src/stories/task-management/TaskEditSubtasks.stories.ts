import type { Meta, StoryObj } from '@storybook/vue3'
import TaskEditSubtasks from '@/components/tasks/edit/TaskEditSubtasks.vue'
import type { Subtask } from '@/stores/tasks'

const meta = {
  component: TaskEditSubtasks,
  title: '📝 Task Management/Edit/TaskEditSubtasks',
  tags: ['autodocs', 'new'],

  args: {
    subtasks: [],
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
} satisfies Meta<typeof TaskEditSubtasks>

export default meta
type Story = StoryObj<typeof meta>

const sampleSubtasks: Subtask[] = [
  {
    id: 'sub-1',
    title: 'Research best practices',
    description: 'Look into industry standards and common patterns',
    isCompleted: true,
  },
  {
    id: 'sub-2',
    title: 'Create mockups',
    description: '',
    isCompleted: false,
  },
  {
    id: 'sub-3',
    title: 'Implement core functionality',
    description: 'Start with the main features',
    isCompleted: false,
  },
]

export const Empty: Story = {
  args: {
    subtasks: [],
  },
}

export const WithSubtasks: Story = {
  args: {
    subtasks: sampleSubtasks,
  },
}

export const AllCompleted: Story = {
  args: {
    subtasks: [
      { id: 'sub-1', title: 'First subtask', description: '', isCompleted: true },
      { id: 'sub-2', title: 'Second subtask', description: 'With description', isCompleted: true },
      { id: 'sub-3', title: 'Third subtask', description: '', isCompleted: true },
    ],
  },
}

export const NoneCompleted: Story = {
  args: {
    subtasks: [
      { id: 'sub-1', title: 'First subtask', description: '', isCompleted: false },
      { id: 'sub-2', title: 'Second subtask', description: '', isCompleted: false },
      { id: 'sub-3', title: 'Third subtask', description: 'Some details here', isCompleted: false },
    ],
  },
}

export const MixedProgress: Story = {
  args: {
    subtasks: [
      { id: 'sub-1', title: 'Setup environment', description: 'Install dependencies and configure tools', isCompleted: true },
      { id: 'sub-2', title: 'Write tests', description: 'Unit tests for core features', isCompleted: true },
      { id: 'sub-3', title: 'Implement feature', description: '', isCompleted: false },
      { id: 'sub-4', title: 'Code review', description: '', isCompleted: false },
      { id: 'sub-5', title: 'Deploy to staging', description: 'Test in staging environment before production', isCompleted: false },
    ],
  },
}

export const SingleSubtask: Story = {
  args: {
    subtasks: [
      { id: 'sub-1', title: 'Only one subtask', description: 'With a detailed description', isCompleted: false },
    ],
  },
}

export const HebrewSubtasks: Story = {
  args: {
    subtasks: [
      { id: 'sub-1', title: 'חקור שיטות עבודה מומלצות', description: 'בדוק סטנדרטים בתעשייה', isCompleted: true },
      { id: 'sub-2', title: 'צור דמויות', description: '', isCompleted: false },
      { id: 'sub-3', title: 'יישם פונקציונליות ליבה', description: 'התחל עם התכונות העיקריות', isCompleted: false },
    ],
  },
}
