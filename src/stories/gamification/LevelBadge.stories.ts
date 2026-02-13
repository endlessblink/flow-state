import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import LevelBadge from '@/components/gamification/LevelBadge.vue'

const meta = {
  component: LevelBadge,
  title: '🎮 Gamification/LevelBadge',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Badge size',
    },
    showPulse: {
      control: 'boolean',
      description: 'Show pulsing animation',
    },
  },
} satisfies Meta<typeof LevelBadge>

export default meta
type Story = StoryObj<typeof meta>

// Default
export const Default: Story = {
  args: {
    size: 'md',
    showPulse: false,
  },
  render: (args) => ({
    components: { LevelBadge },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <LevelBadge v-bind="args" />
      </div>
    `,
  }),
}

// All Sizes
export const AllSizes: Story = {
  render: () => ({
    components: { LevelBadge },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <h3 style="margin: 0 0 var(--space-4) 0; color: var(--text-primary); font-size: var(--text-base);">Level Badge Sizes</h3>
        <div style="display: flex; gap: var(--space-6); align-items: center;">
          <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-2);">
            <LevelBadge size="sm" />
            <span style="color: var(--text-muted); font-size: var(--text-xs);">Small</span>
          </div>
          <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-2);">
            <LevelBadge size="md" />
            <span style="color: var(--text-muted); font-size: var(--text-xs);">Medium</span>
          </div>
          <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-2);">
            <LevelBadge size="lg" />
            <span style="color: var(--text-muted); font-size: var(--text-xs);">Large</span>
          </div>
        </div>
      </div>
    `,
  }),
}

// With Pulse
export const WithPulse: Story = {
  args: {
    size: 'lg',
    showPulse: true,
  },
  render: (args) => ({
    components: { LevelBadge },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <LevelBadge v-bind="args" />
      </div>
    `,
  }),
}

// Level Up Animation
export const LevelUpAnimation: Story = {
  render: () => ({
    components: { LevelBadge },
    setup() {
      const levelEvent = ref<any>(undefined)
      let eventId = 0

      const triggerLevelUp = () => {
        eventId++
        levelEvent.value = {
          id: `level-${eventId}`,
          type: 'level_up',
          oldLevel: 5,
          newLevel: 6,
        }
      }

      return { levelEvent, triggerLevelUp }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <h3 style="margin: 0 0 var(--space-4) 0; color: var(--text-primary); font-size: var(--text-base);">Level Up Animation</h3>
        <LevelBadge size="lg" :level-event="levelEvent" />
        <button
          @click="triggerLevelUp"
          style="margin-top: var(--space-4); padding: var(--space-2) var(--space-3); background: rgba(var(--neon-magenta), 0.15); border: 1px solid rgba(var(--neon-magenta), 0.4); border-radius: var(--radius-md); color: rgba(var(--neon-magenta), 1); cursor: pointer;"
        >
          Trigger Level Up
        </button>
      </div>
    `,
  }),
}
