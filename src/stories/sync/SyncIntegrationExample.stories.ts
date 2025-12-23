import type { Meta, StoryObj } from '@storybook/vue3'
import SyncIntegrationExample from '@/components/SyncIntegrationExample.vue'

const meta = {
    component: SyncIntegrationExample,
    title: '🔄 Sync & Reliability/SyncIntegrationExample',
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component: 'End-to-end demonstration of the sync system integration, combining status indicators, controls, health metrics, and test results.'
            }
        }
    }
} satisfies Meta<typeof SyncIntegrationExample>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
    render: () => ({
        components: { SyncIntegrationExample },
        template: `
      <div style="background: var(--bg-primary); min-height: 100vh; padding: 2rem; border-radius: 12px;">
        <SyncIntegrationExample />
      </div>
    `
    })
}
