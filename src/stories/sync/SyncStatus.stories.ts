import type { Meta, StoryObj } from '@storybook/vue3'
import SyncStatus from '@/components/SyncStatus.vue'

const meta = {
    component: SyncStatus,
    title: '🔄 Sync & Reliability/SyncStatus',
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component: 'Synchronization status indicator with connection monitoring, health metrics, and advanced sync controls.'
            }
        }
    },
    argTypes: {
        showControls: { control: 'boolean' },
        showText: { control: 'boolean' },
        compact: { control: 'boolean' },
        showDetails: { control: 'boolean' },
        showMetrics: { control: 'boolean' },
        showQueue: { control: 'boolean' }
    }
} satisfies Meta<typeof SyncStatus>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
    args: {
        showControls: true,
        showText: true,
        showDetails: true
    }
}

export const Compact: Story = {
    args: {
        compact: true,
        showText: true
    }
}

export const Syncing: Story = {
    args: {
        showControls: true,
        showText: true
    },
    // We cannot easily trigger the internal sync state without deeper mocking,
    // but we can demonstrate the UI components
}

export const DetailedDashboard: Story = {
    args: {
        showControls: true,
        showText: true,
        showDetails: true,
        showMetrics: true,
        showQueue: true
    }
}
