import type { Meta, StoryObj } from '@storybook/vue3'
import FilterControls from '@/components/base/FilterControls.vue'

const meta = {
    component: FilterControls,
    title: '📝 Task Management/FilterControls',
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
    }
} satisfies Meta<typeof FilterControls>

export default meta
type Story = StoryObj<typeof meta>

const mockProjects = [
    { id: 'p1', name: 'Work', emoji: '💼', color: '#3b82f6' },
    { id: 'p2', name: 'Personal', emoji: '🏠', color: '#10b981' },
    { id: 'p3', name: 'Side Project', emoji: '🚀', color: '#8b5cf6' }
]

export const Default: Story = {
    render: () => ({
        components: { FilterControls },
        template: `
      <div style="background: var(--bg-primary); padding: 2rem; border-radius: 12px; border: 1px solid var(--border-subtle);">
        <FilterControls />
      </div>
    `
    })
}
