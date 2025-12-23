import type { Meta, StoryObj } from '@storybook/vue3'
import SyncAlertSystem from '@/components/SyncAlertSystem.vue'

const meta = {
    component: SyncAlertSystem,
    title: '🔄 Sync & Reliability/SyncAlertSystem',
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component: 'Overlay system for displaying critical sync errors, warnings, and informational status updates.'
            }
        }
    }
} satisfies Meta<typeof SyncAlertSystem>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
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

import { ref, onMounted } from 'vue'
