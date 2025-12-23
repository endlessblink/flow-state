import SearchModal from '@/components/SearchModal.vue'

const meta = {
  title: 'Modals/SearchModal',
  component: SearchModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  }
}

export default meta

export const Default = {
  args: {
    isOpen: true
  }
}
