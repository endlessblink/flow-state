import GroupEditModal from '@/components/canvas/GroupEditModal.vue'

const meta = {
  title: 'Canvas/GroupEditModal',
  component: GroupEditModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="padding: 100px; background: var(--app-background-gradient); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
          <story />
        </div>
      `
    })
  ],
}

export default meta

export const Default = {
  args: {
    modelValue: true,
    initialName: 'Test Group',
    initialColor: '#4ECDC4'
  }
}
