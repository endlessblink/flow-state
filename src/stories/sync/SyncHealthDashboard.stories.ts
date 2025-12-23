import SyncHealthDashboard from '@/components/SyncHealthDashboard.vue'

const meta = {
    title: '🔄 Sync & Reliability/SyncHealthDashboard',
    component: SyncHealthDashboard,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            story: {
                inline: true,
            }
        }
    },
    decorators: [
        (story: any) => ({
            components: { story },
            template: `
                <div style="min-height: 1000px; width: 100%; padding: 40px; background: radial-gradient(circle at center, #3c2b5a 0%, #1a1a2e 100%); transform: scale(1); border-radius: var(--radius-xl);">
                    <div style="position: relative; height: 100%; max-width: 1000px; margin: 0 auto;">
                        <story />
                    </div>
                </div>
            `
        })
    ]
}

export default meta

export const Default = {
    render: () => ({
        components: { SyncHealthDashboard },
        template: '<div style="max-width: 1000px; margin: 0 auto;"><SyncHealthDashboard /></div>'
    })
}
