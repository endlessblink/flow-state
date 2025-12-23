import SimpleBackupSettings from '@/components/SimpleBackupSettings.vue'

const meta = {
  title: '🔄 Sync & Reliability/SimpleBackupSettings',
  component: SimpleBackupSettings,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  }
}

export default meta

export const Default = {
  render: () => ({
    components: { SimpleBackupSettings },
    template: '<SimpleBackupSettings />'
  })
}
