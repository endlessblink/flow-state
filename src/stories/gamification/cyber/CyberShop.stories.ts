import type { Meta, StoryObj } from '@storybook/vue3'
import CyberShop from '@/components/gamification/cyber/CyberShop.vue'
import { createPinia, setActivePinia } from 'pinia'

const meta = {
  title: '🎮 Gamification/Cyber/CyberShop',
  component: CyberShop,
  tags: ['autodocs', 'new'],
  decorators: [
    () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      return { template: '<story />' }
    },
  ],
} satisfies Meta<typeof CyberShop>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { CyberShop },
    template: `
      <div style="padding: var(--space-6); background: var(--cf-dark-1, #0a0a0f); min-height: 600px;">
        <CyberShop />
      </div>
    `,
  }),
}

export const FullPanel: Story = {
  render: () => ({
    components: { CyberShop },
    template: `
      <div style="background: var(--cf-dark-1, #0a0a0f); height: 700px; overflow-y: auto; padding: var(--space-4);">
        <CyberShop />
      </div>
    `,
  }),
}
