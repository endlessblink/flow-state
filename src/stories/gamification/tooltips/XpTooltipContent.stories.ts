import type { Meta, StoryObj } from '@storybook/vue3'
import XpTooltipContent from '@/components/gamification/tooltips/XpTooltipContent.vue'
import { createPinia, setActivePinia } from 'pinia'

const meta = {
  title: '🎮 Gamification/Tooltips/XpTooltipContent',
  component: XpTooltipContent,
  tags: ['autodocs', 'new'],
  decorators: [
    () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      return { template: '<story />' }
    },
  ],
} satisfies Meta<typeof XpTooltipContent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { XpTooltipContent },
    setup() {
      return {}
    },
    template: `
      <div style="padding: var(--space-4); background: var(--surface-overlay, #1a1a20); border-radius: var(--radius-md); max-width: 300px;">
        <XpTooltipContent />
      </div>
    `,
  }),
}

export const DarkBackground: Story = {
  render: () => ({
    components: { XpTooltipContent },
    template: `
      <div style="padding: var(--space-8); background: var(--cf-dark-1, #0a0a0f); display: flex; justify-content: center;">
        <div style="padding: var(--space-3); background: var(--surface-overlay, #1a1a20); border-radius: var(--radius-md); border: 1px solid rgba(255, 255, 255, 0.1);">
          <XpTooltipContent />
        </div>
      </div>
    `,
  }),
}
