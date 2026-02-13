import type { Meta, StoryObj } from '@storybook/vue3'
import CyberCharacterProfile from '@/components/gamification/cyber/CyberCharacterProfile.vue'
import { createPinia, setActivePinia } from 'pinia'

const meta = {
  title: '🎮 Gamification/Cyber/CyberCharacterProfile',
  component: CyberCharacterProfile,
  tags: ['autodocs', 'new'],
  decorators: [
    () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      return { template: '<story />' }
    },
  ],
} satisfies Meta<typeof CyberCharacterProfile>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { CyberCharacterProfile },
    template: `
      <div style="padding: var(--space-6); background: var(--cf-dark-1, #0a0a0f); max-width: 400px;">
        <CyberCharacterProfile />
      </div>
    `,
  }),
}

export const InDrawer: Story = {
  render: () => ({
    components: { CyberCharacterProfile },
    template: `
      <div style="background: var(--cf-dark-1, #0a0a0f); width: 380px; height: 600px; overflow-y: auto; padding: var(--space-6);">
        <CyberCharacterProfile />
      </div>
    `,
  }),
}
