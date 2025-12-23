import { ref, onMounted } from 'vue'
import SyncAlertSystem from '@/components/SyncAlertSystem.vue'

const meta = {
    title: '🔄 Sync & Reliability/SyncAlertSystem',
    component: SyncAlertSystem,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            story: {
                inline: true,
            },
            description: {
                component: 'Overlay system for displaying critical sync errors, warnings, and informational status updates.'
            }
        }
    },
    decorators: [
        (story: any) => ({
            components: { story },
            template: `
                <div style="min-height: 1000px; width: 100%; padding: 40px; background: radial-gradient(circle at center, #3c2b5a 0%, #1a1a2e 100%); transform: scale(1); border-radius: var(--radius-xl);">
                    <div style="position: relative; height: 100%;">
                        <story />
                    </div>
                </div>
            `
        })
    ]
}

export default meta

const mockSyncManager = {
    error: ref(null),
    conflicts: ref([]),
    isOnline: ref(true),
    getSyncHealth: () => ({ lastSuccessfulSync: new Date() }),
    triggerSync: async () => { console.log('Mock sync triggered') },
    clearSyncErrors: () => { console.log('Mock errors cleared') }
}

export const Default = {
    render: () => ({
        components: { SyncAlertSystem },
        setup() {
            const alertSystemRef = ref<any>(null)

            onMounted(() => {
                if (alertSystemRef.value) {
                    alertSystemRef.value.addAlert({
                        level: 'critical',
                        title: 'Encryption Error',
                        message: 'Failed to decrypt remote data. Please check your recovery key.',
                        category: 'security',
                        persistent: true,
                        recoveryActions: [
                            { id: 'fix', label: 'Enter Key', type: 'primary', action: () => { } }
                        ]
                    })

                    alertSystemRef.value.addAlert({
                        level: 'warning',
                        title: 'Conflicts Found',
                        message: 'There are 3 documents with conflicting changes.',
                        category: 'sync'
                    })

                    alertSystemRef.value.addAlert({
                        level: 'info',
                        title: 'Syncing',
                        message: 'Starting full background synchronization...',
                        category: 'performance'
                    })
                }
            })

            return { alertSystemRef, mockSyncManager }
        },
        template: '<SyncAlertSystem ref="alertSystemRef" :syncManager="mockSyncManager" />'
    })
}
