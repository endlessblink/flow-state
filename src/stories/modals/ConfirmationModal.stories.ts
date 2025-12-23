import ConfirmationModal from '@/components/ConfirmationModal.vue'

const meta = {
  title: 'Modals/ConfirmationModal',
  component: ConfirmationModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  }
}

export default meta

export const Default = {
  args: {
    show: true,
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?'
  }
}
