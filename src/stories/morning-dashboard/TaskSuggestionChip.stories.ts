import type { Meta, StoryObj } from '@storybook/vue3'
import TaskSuggestionChip from '@/components/morning-dashboard/TaskSuggestionChip.vue'

const meta = {
  component: TaskSuggestionChip,
  title: '☀️ Morning Dashboard/TaskSuggestionChip',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    title: { control: 'text' },
    taskId: { control: 'text' },
  },
} satisfies Meta<typeof TaskSuggestionChip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: 'Review PR #42',
    taskId: 'task-1',
  },
  render: (args) => ({
    components: { TaskSuggestionChip },
    setup() { return { args } },
    template: `
      <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <TaskSuggestionChip v-bind="args" />
      </div>
    `,
  }),
}

export const MultipleSuggestions: Story = {
  render: () => ({
    components: { TaskSuggestionChip },
    template: `
      <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg); display: flex; flex-wrap: wrap; gap: var(--space-2); max-width: 400px;">
        <TaskSuggestionChip title="Deploy v2.0" taskId="t1" />
        <TaskSuggestionChip title="Write unit tests for auth" taskId="t2" />
        <TaskSuggestionChip title="Fix login bug" taskId="t3" />
        <TaskSuggestionChip title="A very long task title that should truncate gracefully" taskId="t4" />
        <TaskSuggestionChip title="Quick standup" taskId="t5" />
      </div>
    `,
  }),
}
