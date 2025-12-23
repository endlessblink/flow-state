import TaskNode from '@/components/canvas/TaskNode.vue'

const meta = {
  title: 'Canvas/TaskNode',
  component: TaskNode,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="padding: 100px; background: var(--app-background-gradient); border-radius: 12px;">
          <story />
        </div>
      `
    })
  ],
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
