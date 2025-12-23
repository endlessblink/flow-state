import SettingsModal from '@/components/SettingsModal.vue'

const meta = {
  title: 'Modals/SettingsModal',
  component: SettingsModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="min-height: 100vh; width: 100%; display: flex; align-items: center; justify-content: center; background: var(--app-background-gradient);">
          <story />
        </div>
      `
    })
  ],
}

export default meta

export const Default = {
  render: () => ({
    components: { SettingsModal },
    template: '<SettingsModal :is-open="true" />'
  })
}
