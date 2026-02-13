import type { Meta, StoryObj } from '@storybook/vue3'
import CyberAchievements from '@/components/gamification/cyber/CyberAchievements.vue'
import { createPinia, setActivePinia } from 'pinia'

const meta = {
  title: '🎮 Gamification/Cyber/CyberAchievements',
  component: CyberAchievements,
  tags: ['autodocs', 'new'],
  argTypes: {
    showAll: {
      control: 'boolean',
      description: 'Show all achievements or just first 6',
    },
  },
  decorators: [
    () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      return { template: '<story />' }
    },
  ],
} satisfies Meta<typeof CyberAchievements>

export default meta
type Story = StoryObj<typeof meta>

export const Compact: Story = {
  args: {
    showAll: false,
  },
  render: (args) => ({
    components: { CyberAchievements },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-6); background: var(--cf-dark-1, #0a0a0f); height: 400px;">
        <CyberAchievements v-bind="args" />
      </div>
    `,
  }),
}

export const FullGrid: Story = {
  args: {
    showAll: true,
  },
  render: (args) => ({
    components: { CyberAchievements },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-6); background: var(--cf-dark-1, #0a0a0f); min-height: 600px;">
        <CyberAchievements v-bind="args" />
      </div>
    `,
  }),
}

export const InPanel: Story = {
  args: {
    showAll: false,
  },
  render: (args) => ({
    components: { CyberAchievements },
    setup() {
      return { args }
    },
    template: `
      <div style="background: var(--cf-dark-1, #0a0a0f); height: 500px; padding: var(--space-4);">
        <CyberAchievements v-bind="args" />
      </div>
    `,
  }),
}
