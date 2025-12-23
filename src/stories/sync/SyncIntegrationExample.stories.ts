import SyncIntegrationExample from '@/components/SyncIntegrationExample.vue'

const meta = {
  component: SyncIntegrationExample,
  title: '🔄 Sync & Reliability/SyncIntegrationExample',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      story: {
        inline: true,
      },
      description: {
        component: 'End-to-end demonstration of the sync system integration, combining status indicators, controls, health metrics, and test results.'
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
    components: { SyncIntegrationExample },
    template: `
      <div style="background: var(--bg-primary); min-height: 400px; padding: 2rem; border-radius: 12px; transform: scale(1); overflow: hidden;">
        <SyncIntegrationExample />
      </div>
    `
  })
}
