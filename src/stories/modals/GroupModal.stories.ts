import GroupModal from '@/components/common/GroupModal.vue'

const meta = {
  title: 'Modals/GroupModal',
  component: GroupModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  }
}

export default meta

export const Default = {
  args: {
    modelValue: true,
    initialName: 'New Group'
  }
}
