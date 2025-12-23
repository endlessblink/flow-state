import SyncHealthDashboard from '@/components/SyncHealthDashboard.vue'

const meta = {
    title: '🔄 Sync & Reliability/SyncHealthDashboard',
    component: SyncHealthDashboard,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
    }
}

export default meta

export const Default = {
    render: () => ({
        components: { SyncHealthDashboard },
        template: '<div style="max-width: 1000px; margin: 0 auto;"><SyncHealthDashboard /></div>'
    })
}
