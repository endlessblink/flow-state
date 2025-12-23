import type { Meta, StoryObj } from '@storybook/vue3'
import ProjectFilterDropdown from '@/components/ProjectFilterDropdown.vue'

const meta = {
    component: ProjectFilterDropdown,
    title: '📝 Task Management/ProjectFilterDropdown',
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
    }
} satisfies Meta<typeof ProjectFilterDropdown>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
    render: () => ({
        components: { ProjectFilterDropdown },
        template: `
      <div style="padding: 100px; min-height: 400px; display: flex; justify-content: center; background: var(--bg-primary);">
        <ProjectFilterDropdown />
      </div>
    `
    })
}
