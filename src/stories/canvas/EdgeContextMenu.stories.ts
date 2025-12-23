import EdgeContextMenu from '@/components/canvas/EdgeContextMenu.vue'

const meta = {
  title: '🎨 Canvas/EdgeContextMenu',
  component: EdgeContextMenu,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="width: 100%; height: 400px; position: relative; background: var(--app-background-gradient); display: flex; align-items: center; justify-content: center; transform: scale(1); border-radius: var(--radius-xl); overflow: hidden;">
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
