import QuickTaskCreateModal from '@/components/tasks/QuickTaskCreateModal.vue'

const meta = {
  title: 'Modals/QuickTaskCreateModal',
  component: QuickTaskCreateModal,
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
