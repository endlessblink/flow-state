import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import StreakCounter from '@/components/gamification/StreakCounter.vue'

const meta = {
  component: StreakCounter,
  title: '🎮 Gamification/StreakCounter',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    showFreezes: {
      control: 'boolean',
      description: 'Show streak freeze count',
    },
    compact: {
      control: 'boolean',
      description: 'Compact mode',
    },
  },
} satisfies Meta<typeof StreakCounter>

export default meta
type Story = StoryObj<typeof meta>

// Default
export const Default: Story = {
  args: {
    showFreezes: true,
    compact: false,
  },
  render: (args) => ({
    components: { StreakCounter },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <StreakCounter v-bind="args" />
      </div>
    `,
  }),
}

// Compact Mode
export const Compact: Story = {
  args: {
    showFreezes: false,
    compact: true,
  },
  render: (args) => ({
    components: { StreakCounter },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <StreakCounter v-bind="args" />
      </div>
    `,
  }),
}

// Without Freezes
export const WithoutFreezes: Story = {
  args: {
    showFreezes: false,
    compact: false,
  },
  render: (args) => ({
    components: { StreakCounter },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-8); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <StreakCounter v-bind="args" />
      </div>
    `,
  }),
}

// Shield Animation
export const ShieldAnimation: Story = {
  render: () => ({
    components: { StreakCounter },
    setup() {
      const shieldEvent = ref<any>(undefined)
      let eventId = 0

      const triggerShield = () => {
        eventId++
        shieldEvent.value = {
          id: `shield-${eventId}`,
          type: 'shielded',
        }
      }

      return { shieldEvent, triggerShield }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <h3 style="margin: 0 0 var(--space-4) 0; color: var(--text-primary); font-size: var(--text-base);">Shield Flash Animation</h3>
        <StreakCounter :shield-event="shieldEvent" :show-freezes="true" />
        <button
          @click="triggerShield"
          style="margin-top: var(--space-4); padding: var(--space-2) var(--space-3); background: rgba(var(--neon-cyan), 0.15); border: 1px solid rgba(var(--neon-cyan), 0.4); border-radius: var(--radius-md); color: rgba(var(--neon-cyan), 1); cursor: pointer;"
        >
          Trigger Shield Flash
        </button>
      </div>
    `,
  }),
}
