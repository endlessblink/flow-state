import type { Meta, StoryObj } from '@storybook/vue3'
import StatsRadar from '@/components/gamification/cyber/StatsRadar.vue'

const meta: Meta<typeof StatsRadar> = {
  title: '🎮 Gamification/Cyber/StatsRadar',
  component: StatsRadar,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
    docs: {
      description: {
        component: 'SVG pentagon radar chart showing 5 player stats (Focus, Speed, Consistency, Depth, Endurance) with cyan grid lines and magenta data polygon.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    stats: { focus: 75, speed: 60, consistency: 85, depth: 40, endurance: 55 },
    size: 200,
  },
}

export const MaxStats: Story = {
  args: {
    stats: { focus: 100, speed: 100, consistency: 100, depth: 100, endurance: 100 },
    size: 200,
  },
}

export const LowStats: Story = {
  args: {
    stats: { focus: 15, speed: 10, consistency: 20, depth: 5, endurance: 12 },
    size: 200,
  },
}

export const Large: Story = {
  args: {
    stats: { focus: 80, speed: 45, consistency: 90, depth: 60, endurance: 70 },
    size: 300,
  },
}
