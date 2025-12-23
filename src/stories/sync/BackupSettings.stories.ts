import BackupSettings from '@/components/SimpleBackupSettings.vue'

const meta = {
  title: '🔄 Sync & Reliability/BackupSettings',
  component: BackupSettings,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  }
}

export default meta

export const Default = {
  render: () => ({
    components: { BackupSettings },
    template: '<BackupSettings />'
  })
}
