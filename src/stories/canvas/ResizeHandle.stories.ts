import ResizeHandle from '@/components/canvas/ResizeHandle.vue'

const meta = {
  title: '🎨 Canvas/ResizeHandle',
  component: ResizeHandle,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
}

export default meta

export const Default = {
  render: () => ({
    components: { ResizeHandle },
    template: `
      <div style="position: relative; width: 200px; height: 150px; background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); padding: var(--space-4);">
        <span style="color: var(--text-secondary); font-size: var(--text-sm);">Resizable box</span>
        <ResizeHandle direction="bottom-right" :isVisible="true" />
        <ResizeHandle direction="top-left" :isVisible="true" />
        <ResizeHandle direction="top-right" :isVisible="true" />
        <ResizeHandle direction="bottom-left" :isVisible="true" />
      </div>
    `,
  }),
}

export const SingleHandle = {
  args: {
    direction: 'se',
    isVisible: true,
    isResizing: false,
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="position: relative; width: 100px; height: 100px; background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-md);">
          <story />
        </div>
      `,
    }),
  ],
}

export const Resizing = {
  args: {
    direction: 'se',
    isVisible: true,
    isResizing: true,
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="position: relative; width: 100px; height: 100px; background: var(--glass-bg-soft); border: 1px solid var(--brand-primary); border-radius: var(--radius-md);">
          <story />
        </div>
      `,
    }),
  ],
}
