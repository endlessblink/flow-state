import type { Meta, StoryObj } from '@storybook/vue3'
import TaskEditChildTasks from '@/components/tasks/edit/TaskEditChildTasks.vue'
import type { Task } from '@/stores/tasks'

const meta = {
  component: TaskEditChildTasks,
  title: '📝 Task Management/Edit/TaskEditChildTasks',
  tags: ['autodocs', 'new'],

  args: {
    childTasks: [],
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
        <div style="padding: var(--space-6); background: var(--glass-bg-soft); border-radius: var(--radius-xl); border: 1px solid var(--glass-border); max-width: 700px;">
          <story />
        </div>
      `,
    })
  ],
} satisfies Meta<typeof TaskEditChildTasks>

export default meta
type Story = StoryObj<typeof meta>

const sampleChildTasks: Partial<Task>[] = [
  {
    id: 'child-1',
    title: 'Research API documentation',
    status: 'done',
  },
  {
    id: 'child-2',
    title: 'Write implementation plan',
    status: 'in_progress',
  },
  {
    id: 'child-3',
    title: 'Code review and testing',
    status: 'planned',
  },
]

export const WithChildren: Story = {
  args: {
    childTasks: sampleChildTasks as Task[],
  },
}

export const AllCompleted: Story = {
  args: {
    childTasks: [
      { id: 'child-1', title: 'First task', status: 'done' },
      { id: 'child-2', title: 'Second task', status: 'done' },
      { id: 'child-3', title: 'Third task', status: 'done' },
    ] as Task[],
  },
}

export const MixedStatus: Story = {
  args: {
    childTasks: [
      { id: 'child-1', title: 'Design mockups', status: 'done' },
      { id: 'child-2', title: 'Implement UI components', status: 'in_progress' },
      { id: 'child-3', title: 'Write unit tests', status: 'planned' },
      { id: 'child-4', title: 'Code review', status: 'backlog' },
    ] as Task[],
  },
}

export const SingleChild: Story = {
  args: {
    childTasks: [
      { id: 'child-1', title: 'The only subtask', status: 'in_progress' },
    ] as Task[],
  },
}
