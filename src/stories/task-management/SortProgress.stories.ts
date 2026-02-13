import type { Meta, StoryObj } from '@storybook/vue3'
import SortProgress from '@/components/tasks/SortProgress.vue'

const meta = {
  component: SortProgress,
  title: '📝 Task Management/SortProgress',
  tags: ['autodocs', 'new'],

  args: {
    current: 5,
    total: 20,
    streak: 0,
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
} satisfies Meta<typeof SortProgress>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const JustStarted: Story = {
  args: {
    current: 1,
    total: 25,
    streak: 0,
  },
}

export const HalfwayThrough: Story = {
  args: {
    current: 10,
    total: 20,
    streak: 3,
  },
}

export const AlmostDone: Story = {
  args: {
    current: 18,
    total: 20,
    streak: 5,
  },
}

export const Complete: Story = {
  args: {
    current: 20,
    total: 20,
    streak: 7,
  },
}

export const WithStreak: Story = {
  args: {
    current: 12,
    total: 30,
    streak: 14,
  },
}

export const NoStreak: Story = {
  args: {
    current: 8,
    total: 15,
    streak: 0,
  },
}

export const SmallBatch: Story = {
  args: {
    current: 2,
    total: 5,
    streak: 1,
  },
}

export const LargeBatch: Story = {
  args: {
    current: 25,
    total: 100,
    streak: 10,
  },
}
