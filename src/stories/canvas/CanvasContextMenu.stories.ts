import CanvasContextMenu from '@/components/TaskContextMenu.vue'

const meta = {
  title: '🎨 Canvas/CanvasContextMenu',
  component: CanvasContextMenu,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  }
}

export default meta

export const Default = {
  args: {
    show: true,
    x: 100,
    y: 100
  }
}
