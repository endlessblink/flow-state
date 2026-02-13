import type { Meta, StoryObj } from '@storybook/vue3'
import CyberSkillTree from '@/components/gamification/cyber/CyberSkillTree.vue'
import { createPinia, setActivePinia } from 'pinia'

const meta = {
  title: '🎮 Gamification/Cyber/CyberSkillTree',
  component: CyberSkillTree,
  tags: ['autodocs', 'new'],
  decorators: [
    () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      return { template: '<story />' }
    },
  ],
} satisfies Meta<typeof CyberSkillTree>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { CyberSkillTree },
    template: `
      <div style="padding: var(--space-6); background: var(--cf-dark-1, #0a0a0f); min-height: 600px;">
        <CyberSkillTree />
      </div>
    `,
  }),
}

export const FullPanel: Story = {
  render: () => ({
    components: { CyberSkillTree },
    template: `
      <div style="background: var(--cf-dark-1, #0a0a0f); height: 700px; overflow-y: auto; padding: var(--space-4);">
        <CyberSkillTree />
      </div>
    `,
  }),
}
