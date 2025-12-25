import CanvasContextMenu from '@/components/canvas/CanvasContextMenu.vue'

const meta = {
  title: '🎨 Canvas/CanvasContextMenu',
  component: CanvasContextMenu,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#0f172a' }],
    },
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="padding: 40px; background: var(--app-background-gradient); min-height: 500px; display: flex; align-items: center; justify-content: center; border-radius: 12px;">
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
    x: 200,
    y: 120
  }
}
