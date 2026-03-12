import type { Meta, StoryObj } from '@storybook/vue3'
import CanvasEmptyState from '@/components/canvas/CanvasEmptyState.vue'

const meta: Meta<typeof CanvasEmptyState> = {
  title: '🎨 Canvas/CanvasEmptyState',
  component: CanvasEmptyState,
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'canvas-dark',
      values: [
        {
          name: 'canvas-dark',
          value: 'hsl(222, 47%, 9%)',
        },
        {
          name: 'canvas-mid',
          value: 'hsl(220, 40%, 13%)',
        },
      ],
    },
  },
}

export default meta
type Story = StoryObj<typeof CanvasEmptyState>

/** Full-canvas representation — matches the real CanvasView context. */
export const Default: Story = {
  render: () => ({
    components: { CanvasEmptyState },
    template: `
      <div style="
        position: relative;
        width: 100vw;
        height: 100vh;
        background: hsl(222, 47%, 9%);
        background-image: radial-gradient(
          ellipse at 40% 30%,
          rgba(78, 205, 196, 0.03) 0%,
          transparent 60%
        );
      ">
        <CanvasEmptyState />
      </div>
    `,
  }),
}

/** Interactive — click handlers log to console. */
export const Interactive: Story = {
  render: () => ({
    components: { CanvasEmptyState },
    setup() {
      const handleAddTask = () => console.log('[Story] addTask emitted')
      const handleCreateGroup = () => console.log('[Story] createGroup emitted')
      return { handleAddTask, handleCreateGroup }
    },
    template: `
      <div style="
        position: relative;
        width: 100vw;
        height: 100vh;
        background: hsl(222, 47%, 9%);
        background-image: radial-gradient(
          ellipse at 60% 70%,
          rgba(139, 92, 246, 0.04) 0%,
          transparent 55%
        ),
        radial-gradient(
          ellipse at 30% 20%,
          rgba(78, 205, 196, 0.03) 0%,
          transparent 50%
        );
      ">
        <CanvasEmptyState
          @add-task="handleAddTask"
          @create-group="handleCreateGroup"
        />
      </div>
    `,
  }),
}

/** Compact — simulate a narrower canvas panel (e.g. side-by-side layout). */
export const Compact: Story = {
  render: () => ({
    components: { CanvasEmptyState },
    template: `
      <div style="
        position: relative;
        width: 640px;
        height: 480px;
        margin: 40px auto;
        background: hsl(222, 47%, 9%);
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.06);
      ">
        <CanvasEmptyState />
      </div>
    `,
  }),
}
