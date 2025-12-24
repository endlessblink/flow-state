import BackupSettings from '@/components/BackupSettings.vue'

const meta = {
  title: '🔄 Sync & Reliability/BackupSettings',
  component: BackupSettings,
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
          <div style="position: relative; height: 100%;">
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
    components: { BackupSettings },
    template: '<BackupSettings />'
  })
}
