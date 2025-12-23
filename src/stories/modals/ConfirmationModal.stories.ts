import ConfirmationModal from '@/components/ConfirmationModal.vue'

const meta = {
  title: 'Modals/ConfirmationModal',
  component: ConfirmationModal,
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
  args: {
    show: true,
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?'
  }
}
