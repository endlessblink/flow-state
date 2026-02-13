import type { Meta, StoryObj } from '@storybook/vue3'
import StatsRadar from '@/components/gamification/cyber/StatsRadar.vue'

const meta = {
  title: '🎮 Gamification/Cyber/StatsRadar',
  component: StatsRadar,
  tags: ['autodocs', 'new'],
  argTypes: {
    stats: {
      control: 'object',
      description: 'Player stats object with focus, speed, consistency, depth, endurance (0-100 each)',
    },
    size: {
      control: { type: 'range', min: 100, max: 400, step: 20 },
      description: 'Size of the radar chart in pixels',
    },
  },
} satisfies Meta<typeof StatsRadar>

export default meta
type Story = StoryObj<typeof meta>

export const Balanced: Story = {
  args: {
    stats: {
      focus: 70,
      speed: 65,
      consistency: 75,
      depth: 68,
      endurance: 72,
    },
    size: 200,
  },
}

export const Beginner: Story = {
  args: {
    stats: {
      focus: 20,
      speed: 15,
      consistency: 10,
      depth: 18,
      endurance: 12,
    },
    size: 200,
  },
}

export const SpeedRunner: Story = {
  args: {
    stats: {
      focus: 40,
      speed: 95,
      consistency: 60,
      depth: 30,
      endurance: 50,
    },
    size: 200,
  },
}

export const MarathonRunner: Story = {
  args: {
    stats: {
      focus: 85,
      speed: 45,
      consistency: 90,
      depth: 88,
      endurance: 95,
    },
    size: 200,
  },
}

export const Elite: Story = {
  args: {
    stats: {
      focus: 95,
      speed: 92,
      consistency: 98,
      depth: 90,
      endurance: 94,
    },
    size: 200,
  },
}

export const SizeComparison: Story = {
  render: () => ({
    components: { StatsRadar },
    setup() {
      const stats = {
        focus: 75,
        speed: 70,
        consistency: 80,
        depth: 72,
        endurance: 78,
      }
      return { stats }
    },
    template: `
      <div style="padding: var(--space-6); background: var(--cf-dark-1, #0a0a0f); display: flex; gap: var(--space-8); align-items: center; flex-wrap: wrap;">
        <div style="text-align: center;">
          <StatsRadar :stats="stats" :size="120" />
          <div style="margin-top: var(--space-2); font-size: var(--text-xs); color: var(--text-muted);">120px (Compact)</div>
        </div>
        <div style="text-align: center;">
          <StatsRadar :stats="stats" :size="200" />
          <div style="margin-top: var(--space-2); font-size: var(--text-xs); color: var(--text-muted);">200px (Default)</div>
        </div>
        <div style="text-align: center;">
          <StatsRadar :stats="stats" :size="300" />
          <div style="margin-top: var(--space-2); font-size: var(--text-xs); color: var(--text-muted);">300px (Large)</div>
        </div>
      </div>
    `,
  }),
}
