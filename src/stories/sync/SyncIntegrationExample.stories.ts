import SyncIntegrationExample from '@/components/SyncIntegrationExample.vue'

const meta = {
    title: 'PLACEHOLDER',
  component: SyncIntegrationExample,
    title: '🔄 Sync & Reliability/SyncIntegrationExample',
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                title: 'PLACEHOLDER',
  component: 'End-to-end demonstration of the sync system integration, combining status indicators, controls, health metrics, and test results.'
            }
        }
    }
}

export default meta

export const Default = {
    render: () => ({
        components: { SyncIntegrationExample },
        template: `
      <div style="background: var(--bg-primary); min-height: 100vh; padding: 2rem; border-radius: 12px;">
        <SyncIntegrationExample />
      </div>
    `
    })
}
