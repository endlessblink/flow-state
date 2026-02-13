import type { Meta, StoryObj } from '@storybook/vue3'
import CyberBossFight from '@/components/gamification/cyber/CyberBossFight.vue'
import { createPinia, setActivePinia } from 'pinia'

const meta = {
  title: '🎮 Gamification/Cyber/CyberBossFight',
  component: CyberBossFight,
  tags: ['autodocs', 'new'],
  decorators: [
    () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      return { template: '<story />' }
    },
  ],
} satisfies Meta<typeof CyberBossFight>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { CyberBossFight },
    template: `
      <div style="padding: var(--space-6); background: var(--cf-dark-1, #0a0a0f); min-height: 500px;">
        <CyberBossFight />
      </div>
    `,
  }),
}

export const FullPanel: Story = {
  render: () => ({
    components: { CyberBossFight },
    template: `
      <div style="background: var(--cf-dark-1, #0a0a0f); height: 600px; padding: var(--space-4);">
        <CyberBossFight />
      </div>
    `,
  }),
}
