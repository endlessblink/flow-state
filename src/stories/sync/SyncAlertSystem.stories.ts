import { ref, onMounted } from 'vue'
import SyncAlertSystem from '@/components/SyncAlertSystem.vue'

const meta = {
    title: '🔄 Sync & Reliability/SyncAlertSystem',
    component: SyncAlertSystem,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component: 'Overlay system for displaying critical sync errors, warnings, and informational status updates.'
            }
        }
    }
}

export default meta

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

            return { alertSystemRef }
        },
        template: '<SyncAlertSystem ref="alertSystemRef" />'
    })
}
