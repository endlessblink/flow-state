import type { Meta, StoryObj } from '@storybook/vue3'
import LevelTooltipContent from '@/components/gamification/tooltips/LevelTooltipContent.vue'
import { createPinia, setActivePinia } from 'pinia'

const meta = {
  title: '🎮 Gamification/Tooltips/LevelTooltipContent',
  component: LevelTooltipContent,
  tags: ['autodocs', 'new'],
  decorators: [
    () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      return { template: '<story />' }
    },
  ],
} satisfies Meta<typeof LevelTooltipContent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { LevelTooltipContent },
    template: `
      <div style="padding: var(--space-4); background: var(--surface-overlay, #1a1a20); border-radius: var(--radius-md); max-width: 300px;">
        <LevelTooltipContent />
      </div>
    `,
  }),
}

export const DarkBackground: Story = {
  render: () => ({
    components: { LevelTooltipContent },
    template: `
      <div style="padding: var(--space-8); background: var(--cf-dark-1, #0a0a0f); display: flex; justify-content: center;">
        <div style="padding: var(--space-3); background: var(--surface-overlay, #1a1a20); border-radius: var(--radius-md); border: 1px solid rgba(255, 255, 255, 0.1);">
          <LevelTooltipContent />
        </div>
      </div>
    `,
  }),
}
