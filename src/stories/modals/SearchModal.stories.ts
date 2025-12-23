import SearchModal from '@/components/SearchModal.vue'

const meta = {
  title: 'Modals/SearchModal',
  component: SearchModal,
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
    isOpen: true
  }
}
