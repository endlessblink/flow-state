import type { Meta, StoryObj } from '@storybook/vue3'
import CategorySelector from '@/components/CategorySelector.vue'

const meta = {
    component: CategorySelector,
    title: '📝 Task Management/CategorySelector',
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
    }
} satisfies Meta<typeof CategorySelector>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
    render: () => ({
        components: { CategorySelector },
        template: `
      <div style="width: 600px; padding: 40px; background: var(--bg-primary); border-radius: 12px; border: 1px solid var(--border-subtle);">
        <CategorySelector />
      </div>
    `
    })
}
