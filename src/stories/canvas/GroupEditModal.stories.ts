import GroupEditModal from '@/components/canvas/GroupEditModal.vue'

const meta = {
  title: 'Canvas/GroupEditModal',
  component: GroupEditModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  }
}

export default meta

export const Default = {
  args: {
    modelValue: true,
    initialName: 'Test Group',
    initialColor: '#4ECDC4'
  }
}
