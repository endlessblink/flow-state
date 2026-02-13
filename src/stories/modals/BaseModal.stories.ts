import BaseModal from '@/components/base/BaseModal.vue'

const meta = {
  title: '🎯 Modals/BaseModal',
  component: BaseModal,
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
    isOpen: true,
    title: 'Sample Modal',
    description: 'This is a default modal with standard styling and functionality.'
  }
}
