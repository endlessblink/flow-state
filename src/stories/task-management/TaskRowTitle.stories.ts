import type { Meta, StoryObj } from '@storybook/vue3'
import TaskRowTitle from '@/components/tasks/row/TaskRowTitle.vue'

const meta = {
  component: TaskRowTitle,
  title: '📝 Task Management/Row/TaskRowTitle',
  tags: ['autodocs', 'new'],

  args: {
    title: 'Complete project documentation',
    isCompleted: false,
    isHovered: false,
    isSelected: false,
    titleAlignmentClasses: {},
    hasSubtasks: false,
    completedSubtaskCount: 0,
    totalSubtasks: 0,
    isAllSubtasksCompleted: false,
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
        <div style="padding: var(--space-4); background: var(--glass-bg-soft); border-radius: var(--radius-lg); border: 1px solid var(--glass-border); max-width: 600px;">
          <story />
        </div>
      `,
    })
  ],
} satisfies Meta<typeof TaskRowTitle>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Completed: Story = {
  args: {
    title: 'Write API documentation',
    isCompleted: true,
  },
}

export const Hovered: Story = {
  args: {
    title: 'Refactor authentication module',
    isHovered: true,
  },
}

export const Selected: Story = {
  args: {
    title: 'Fix critical bug in payment flow',
    isSelected: true,
  },
}

export const WithSubtasks: Story = {
  args: {
    title: 'Implement new feature',
    hasSubtasks: true,
    completedSubtaskCount: 3,
    totalSubtasks: 5,
  },
}

export const AllSubtasksCompleted: Story = {
  args: {
    title: 'Setup CI/CD pipeline',
    hasSubtasks: true,
    completedSubtaskCount: 4,
    totalSubtasks: 4,
    isAllSubtasksCompleted: true,
  },
}

export const LongTitle: Story = {
  args: {
    title: 'Implement comprehensive error handling system with retry logic and fallback mechanisms across all API endpoints and services',
  },
}

export const HebrewTitle: Story = {
  args: {
    title: 'השלם את התיעוד של הפרויקט',
    titleAlignmentClasses: 'text-right',
  },
}
