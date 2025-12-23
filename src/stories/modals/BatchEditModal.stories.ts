import BatchEditModal from '@/components/BatchEditModal.vue'

const meta = {
  title: 'Modals/BatchEditModal',
  component: BatchEditModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  }
}

export default meta

export const Default = {
  args: {
    modelValue: true,
    selectedTaskIds: ['1', '2']
  }
}
