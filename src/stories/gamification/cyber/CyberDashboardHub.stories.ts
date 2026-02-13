import type { Meta, StoryObj } from '@storybook/vue3'
import CyberDashboardHub from '@/components/gamification/cyber/CyberDashboardHub.vue'
import { createPinia, setActivePinia } from 'pinia'

const meta = {
  title: '🎮 Gamification/Cyber/CyberDashboardHub',
  component: CyberDashboardHub,
  tags: ['autodocs', 'new'],
  decorators: [
    () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      return { template: '<story />' }
    },
  ],
} satisfies Meta<typeof CyberDashboardHub>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { CyberDashboardHub },
    template: `
      <div style="padding: var(--space-6); background: var(--cf-dark-1, #0a0a0f); min-height: 600px;">
        <CyberDashboardHub />
      </div>
    `,
  }),
}

export const FullScreen: Story = {
  render: () => ({
    components: { CyberDashboardHub },
    template: `
      <div style="background: var(--cf-dark-1, #0a0a0f); width: 100vw; height: 100vh; position: fixed; top: 0; left: 0;">
        <CyberDashboardHub />
      </div>
    `,
  }),
}
