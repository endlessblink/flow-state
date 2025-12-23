import SyncStatus from '@/components/SyncStatus.vue'

const meta = {
    title: '🔄 Sync & Reliability/SyncStatus',
    component: SyncStatus,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        backgrounds: {
            default: 'dark',
            values: [
                { name: 'dark', value: '#0f172a' },
            ],
        },
        docs: {
            description: {
                component: 'Synchronization status indicator with connection monitoring, health metrics, and advanced sync controls.'
            }
        }
    },
    decorators: [
        (story: any) => ({
            components: { story },
            template: `
        <div style="padding: 100px; background: var(--app-background-gradient); min-height: 300px; display: flex; align-items: center; justify-content: center; border-radius: 12px;">
          <story />
        </div>
      `
        })
    ],
    argTypes: {
        showControls: { control: 'boolean' },
        showText: { control: 'boolean' },
        compact: { control: 'boolean' },
        showDetails: { control: 'boolean' },
        showMetrics: { control: 'boolean' },
        showQueue: { control: 'boolean' }
    }
}

export default meta

export const Default = {
    args: {
        showControls: true,
        showText: true,
        showDetails: true
    }
}

export const Compact = {
    args: {
        compact: true,
        showText: true
    }
}

export const DetailedDashboard = {
    args: {
        showControls: true,
        showText: true,
        showDetails: true,
        showMetrics: true,
        showQueue: true
    }
}
