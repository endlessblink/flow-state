import GroupEditModal from '@/components/canvas/GroupEditModal.vue'

const meta = {
  title: '🎨 Canvas/GroupEditModal',
  component: GroupEditModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

export const Default = {
  args: {
    isVisible: true,
    section: {
      id: 'section-1',
      name: 'Sprint Backlog',
      color: '#4ECDC4',
      layout: 'grid',
      isCollapsed: false,
      isVisible: true,
      position: { x: 0, y: 0 },
      dimensions: { width: 400, height: 300 },
      taskIds: [],
    },
  },
}
