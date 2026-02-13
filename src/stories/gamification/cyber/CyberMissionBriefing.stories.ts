import type { Meta, StoryObj } from '@storybook/vue3'
import CyberMissionBriefing from '@/components/gamification/cyber/CyberMissionBriefing.vue'
import { createPinia, setActivePinia } from 'pinia'

const meta = {
  title: '🎮 Gamification/Cyber/CyberMissionBriefing',
  component: CyberMissionBriefing,
  tags: ['autodocs', 'new'],
  decorators: [
    () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      return { template: '<story />' }
    },
  ],
} satisfies Meta<typeof CyberMissionBriefing>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { CyberMissionBriefing },
    template: `
      <div style="padding: var(--space-6); background: var(--cf-dark-1, #0a0a0f); min-height: 500px;">
        <CyberMissionBriefing />
      </div>
    `,
  }),
}

export const InPanel: Story = {
  render: () => ({
    components: { CyberMissionBriefing },
    template: `
      <div style="background: var(--cf-dark-1, #0a0a0f); height: 600px; padding: var(--space-4);">
        <CyberMissionBriefing />
      </div>
    `,
  }),
}
