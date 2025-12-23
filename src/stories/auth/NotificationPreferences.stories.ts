import type { Meta, StoryObj } from '@storybook/vue3'
import NotificationPreferences from '@/components/notifications/NotificationPreferences.vue'

const meta = {
    component: NotificationPreferences,
    title: '🔐 Auth/NotificationPreferences',
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
    }
} satisfies Meta<typeof NotificationPreferences>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
    args: {
        taskId: 'mock-task-1'
    },
    render: (args: any) => ({
        components: { NotificationPreferences },
        setup() {
            return { args }
        },
        template: `
      <div style="width: 400px; padding: 24px; background: var(--bg-primary); border-radius: 12px; border: 1px solid var(--border-subtle);">
        <NotificationPreferences v-bind="args" />
      </div>
    `
    })
}
