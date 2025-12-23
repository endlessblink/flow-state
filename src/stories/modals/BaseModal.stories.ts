import BaseModal from '@/components/base/BaseModal.vue'

const meta = {
  title: 'Modals/BaseModal',
  component: BaseModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  }
}

export default meta

export const Default = {
  args: {
    isOpen: true,
    title: 'Sample Modal',
    description: 'This is a default modal with standard styling and functionality.'
  }
}
