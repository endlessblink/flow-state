import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import XpBar from '@/components/gamification/XpBar.vue'

const meta = {
  component: XpBar,
  title: '🎮 Gamification/XpBar',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    showLabel: {
      control: 'boolean',
      description: 'Show XP text label above bar',
    },
    compact: {
      control: 'boolean',
      description: 'Compact horizontal layout',
    },
    animated: {
      control: 'boolean',
      description: 'Enable glow animation',
    },
  },
} satisfies Meta<typeof XpBar>

export default meta
type Story = StoryObj<typeof meta>

// Default
export const Default: Story = {
  args: {
    showLabel: true,
    compact: false,
    animated: true,
  },
  render: (args) => ({
    components: { XpBar },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 300px;">
        <XpBar v-bind="args" />
      </div>
    `,
  }),
}

// Compact Mode
export const Compact: Story = {
  args: {
    showLabel: true,
    compact: true,
    animated: true,
  },
  render: (args) => ({
    components: { XpBar },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 200px;">
        <XpBar v-bind="args" />
      </div>
    `,
  }),
}

// Without Label
export const WithoutLabel: Story = {
  args: {
    showLabel: false,
    compact: false,
    animated: true,
  },
  render: (args) => ({
    components: { XpBar },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 300px;">
        <XpBar v-bind="args" />
      </div>
    `,
  }),
}

// XP Gain Animation
export const XpGainAnimation: Story = {
  render: () => ({
    components: { XpBar },
    setup() {
      const xpEvent = ref<any>(undefined)
      let eventId = 0

      const triggerXpGain = () => {
        eventId++
        xpEvent.value = {
          id: `xp-${eventId}`,
          type: 'xp_gain',
          amount: Math.floor(Math.random() * 50) + 10,
        }
      }

      return { xpEvent, triggerXpGain }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 350px;">
        <h3 style="margin: 0 0 var(--space-4) 0; color: var(--text-primary); font-size: var(--text-base);">XP Gain Animation</h3>
        <XpBar :xp-event="xpEvent" :animated="true" />
        <button
          @click="triggerXpGain"
          style="margin-top: var(--space-4); padding: var(--space-2) var(--space-3); background: rgba(var(--neon-cyan), 0.15); border: 1px solid rgba(var(--neon-cyan), 0.4); border-radius: var(--radius-md); color: rgba(var(--neon-cyan), 1); cursor: pointer;"
        >
          Trigger XP Gain
        </button>
      </div>
    `,
  }),
}
