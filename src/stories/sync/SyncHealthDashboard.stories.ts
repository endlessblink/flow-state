import type { Meta, StoryObj } from '@storybook/vue3'
import SyncHealthDashboard from '@/components/SyncHealthDashboard.vue'

const meta = {
    component: SyncHealthDashboard,
    title: '🔄 Sync & Reliability/SyncHealthDashboard',
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component: 'Comprehensive sync health monitoring dashboard with real-time stats, network performance, and error logging.'
            }
        }
    }
} satisfies Meta<typeof SyncHealthDashboard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
    render: () => ({
        components: { SyncHealthDashboard },
        template: '<div style="max-width: 1000px; margin: 0 auto;"><SyncHealthDashboard /></div>'
    })
}

export const Minimized: Story = {
    render: () => ({
        components: { SyncHealthDashboard },
        template: '<div style="max-width: 400px; margin: 0 auto;"><SyncHealthDashboard minimized /></div>'
    })
}
