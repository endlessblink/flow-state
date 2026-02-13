import type { Meta, StoryObj } from '@storybook/vue3'
import CyberSummaryCard from '@/components/gamification/cyber/CyberSummaryCard.vue'
import { Target, Zap, Trophy } from 'lucide-vue-next'

const meta = {
  title: '🎮 Gamification/Cyber/CyberSummaryCard',
  component: CyberSummaryCard,
  tags: ['autodocs', 'new'],
  argTypes: {
    title: {
      control: 'text',
      description: 'Card title',
    },
    accentColor: {
      control: 'color',
      description: 'Border accent color',
    },
    clickable: {
      control: 'boolean',
      description: 'Enable click interaction',
    },
  },
} satisfies Meta<typeof CyberSummaryCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: 'SYSTEM STATUS',
    accentColor: 'var(--cf-cyan)',
    clickable: false,
  },
  render: (args) => ({
    components: { CyberSummaryCard },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-6); background: var(--cf-dark-1, #0a0a0f);">
        <CyberSummaryCard v-bind="args">
          <div style="font-family: var(--font-cyber-data); font-size: var(--text-lg); color: var(--text-primary);">
            OPERATIONAL
          </div>
          <div style="font-size: var(--text-xs); color: var(--text-muted); margin-top: var(--space-2);">
            All systems nominal
          </div>
        </CyberSummaryCard>
      </div>
    `,
  }),
}

export const WithStats: Story = {
  args: {
    title: 'PERFORMANCE',
    accentColor: 'var(--cf-lime, #39ff14)',
    clickable: false,
  },
  render: (args) => ({
    components: { CyberSummaryCard, Target },
    setup() {
      return { args, Target }
    },
    template: `
      <div style="padding: var(--space-6); background: var(--cf-dark-1, #0a0a0f);">
        <CyberSummaryCard v-bind="args">
          <div style="display: flex; align-items: center; gap: var(--space-3);">
            <Target :size="32" style="color: var(--cf-lime);" />
            <div>
              <div style="font-family: var(--font-cyber-title); font-size: var(--text-2xl); color: var(--text-primary);">
                87%
              </div>
              <div style="font-size: var(--text-xs); color: var(--text-muted);">
                Target accuracy
              </div>
            </div>
          </div>
        </CyberSummaryCard>
      </div>
    `,
  }),
}

export const Clickable: Story = {
  args: {
    title: 'MISSIONS',
    accentColor: 'var(--cf-magenta, #ff006e)',
    clickable: true,
  },
  render: (args) => ({
    components: { CyberSummaryCard, Zap },
    setup() {
      const handleClick = () => {
        alert('Card clicked!')
      }
      return { args, Zap, handleClick }
    },
    template: `
      <div style="padding: var(--space-6); background: var(--cf-dark-1, #0a0a0f);">
        <CyberSummaryCard v-bind="args" @click="handleClick">
          <div style="display: flex; flex-direction: column; gap: var(--space-2);">
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <Zap :size="20" style="color: var(--cf-magenta);" />
              <span style="font-family: var(--font-cyber-data); font-size: var(--text-lg); color: var(--text-primary);">
                3 Active
              </span>
            </div>
            <div style="font-size: var(--text-xs); color: var(--text-muted);">
              Click to view details
            </div>
          </div>
        </CyberSummaryCard>
      </div>
    `,
  }),
}

export const Grid: Story = {
  render: () => ({
    components: { CyberSummaryCard, Trophy, Target, Zap },
    setup() {
      return { Trophy, Target, Zap }
    },
    template: `
      <div style="padding: var(--space-6); background: var(--cf-dark-1, #0a0a0f);">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4);">
          <CyberSummaryCard title="ACHIEVEMENTS" accent-color="var(--cf-gold, #ffd700)">
            <div style="display: flex; align-items: center; gap: var(--space-3);">
              <Trophy :size="32" style="color: var(--cf-gold);" />
              <div>
                <div style="font-family: var(--font-cyber-title); font-size: var(--text-2xl); color: var(--text-primary);">12</div>
                <div style="font-size: var(--text-xs); color: var(--text-muted);">Unlocked</div>
              </div>
            </div>
          </CyberSummaryCard>

          <CyberSummaryCard title="ACCURACY" accent-color="var(--cf-cyan, #00f0ff)">
            <div style="display: flex; align-items: center; gap: var(--space-3);">
              <Target :size="32" style="color: var(--cf-cyan);" />
              <div>
                <div style="font-family: var(--font-cyber-title); font-size: var(--text-2xl); color: var(--text-primary);">94%</div>
                <div style="font-size: var(--text-xs); color: var(--text-muted);">Hit rate</div>
              </div>
            </div>
          </CyberSummaryCard>

          <CyberSummaryCard title="POWER" accent-color="var(--cf-magenta, #ff006e)">
            <div style="display: flex; align-items: center; gap: var(--space-3);">
              <Zap :size="32" style="color: var(--cf-magenta);" />
              <div>
                <div style="font-family: var(--font-cyber-title); font-size: var(--text-2xl); color: var(--text-primary);">2.5x</div>
                <div style="font-size: var(--text-xs); color: var(--text-muted);">Multiplier</div>
              </div>
            </div>
          </CyberSummaryCard>
        </div>
      </div>
    `,
  }),
}
