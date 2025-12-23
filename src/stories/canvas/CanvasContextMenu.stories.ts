import CanvasContextMenu from '@/components/canvas/CanvasContextMenu.vue'

const meta = {
  title: '🎨 Canvas/CanvasContextMenu',
  component: CanvasContextMenu,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="width: 100vw; height: 400px; position: relative; background: var(--app-background-gradient); display: flex; align-items: center; justify-content: center;">
          <story />
        </div>
      `
    })
  ],
}

export default meta

export const Default = {
  args: {
    isVisible: true,
    x: 0,
    y: 0
  }
}
