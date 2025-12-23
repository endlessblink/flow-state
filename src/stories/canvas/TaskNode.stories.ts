import TaskNode from '@/components/canvas/TaskNode.vue'

const meta = {
  title: 'Canvas/TaskNode',
  component: TaskNode,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  }
}

export default meta

export const Default = {
  args: {
    selected: false,
    isDragging: false,
    isHovered: false,
    readOnly: false,
    showConnections: true,
  }
}
