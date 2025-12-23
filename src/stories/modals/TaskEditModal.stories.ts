import TaskEditModal from '@/components/TaskEditModal.vue'

const meta = {
  title: 'Modals/TaskEditModal',
  component: TaskEditModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  }
}

export default meta

export const Default = {
  args: {
    isOpen: true,
    taskId: '1'
  }
}
