import type { Meta, StoryObj } from '@storybook/vue3'
import CorruptionMeter from '@/components/gamification/cyber/CorruptionMeter.vue'

const meta = {
  title: '🎮 Gamification/Cyber/CorruptionMeter',
  component: CorruptionMeter,
  tags: ['autodocs', 'new'],
  argTypes: {
    level: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
      description: 'Corruption level percentage (0-100)',
    },
    tier: {
      control: 'text',
      description: 'Corruption tier name',
    },
  },
} satisfies Meta<typeof CorruptionMeter>

export default meta
type Story = StoryObj<typeof meta>

export const Clean: Story = {
  args: {
    level: 10,
    tier: 'Clean',
  },
}

export const Mild: Story = {
  args: {
    level: 30,
    tier: 'Mild',
  },
}

export const Moderate: Story = {
  args: {
    level: 50,
    tier: 'Moderate',
  },
}

export const Heavy: Story = {
  args: {
    level: 70,
    tier: 'Heavy',
  },
}

export const Critical: Story = {
  args: {
    level: 95,
    tier: 'Critical',
  },
}

export const Interactive: Story = {
  args: {
    level: 50,
    tier: 'Moderate',
  },
  render: (args) => ({
    components: { CorruptionMeter },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-6); background: var(--cf-dark-1, #0a0a0f); min-height: 200px;">
        <CorruptionMeter v-bind="args" />
        <div style="margin-top: var(--space-4); font-family: var(--font-cyber-data); font-size: var(--text-xs); color: var(--text-muted);">
          Drag the slider in Controls to see the meter update
        </div>
      </div>
    `,
  }),
}
