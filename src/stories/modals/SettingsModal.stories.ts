import SettingsModal from '@/components/SettingsModal.vue'

const meta = {
  title: 'Modals/SettingsModal',
  component: SettingsModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  }
}

export default meta

export const Default = {
  render: () => ({
    components: { SettingsModal },
    template: '<SettingsModal :is-open="true" />'
  })
}
