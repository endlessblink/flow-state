import type { Meta, StoryObj } from '@storybook/vue3'
import DragHandleGhost from '@/components/tasks/drag-handle/DragHandleGhost.vue'

const meta = {
  title: '📝 Task Management/DragHandleGhost',
  component: DragHandleGhost,
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'fullscreen'
  },
  argTypes: {
    isDragging: { control: 'boolean' },
    isVisible: { control: 'boolean' },
    position: { control: 'object' }
  }
} satisfies Meta<typeof DragHandleGhost>

export default meta
type Story = StoryObj<typeof meta>

export const CenterPosition: Story = {
  args: {
    isDragging: true,
    isVisible: true,
    position: { x: 300, y: 250 }
  },
  render: (args) => ({
    components: { DragHandleGhost },
    setup() {
      return { args }
    },
    template: `
      <div style="
        min-height: 500px;
        background: var(--glass-bg-soft);
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <DragHandleGhost v-bind="args" />
        <div style="
          text-align: center;
          color: var(--text-tertiary);
          font-size: var(--text-sm);
        ">
          Ghost appears at x: {{ args.position.x }}px, y: {{ args.position.y }}px
        </div>
      </div>
    `
  })
}

export const FollowingMouse: Story = {
  args: {
    isDragging: true,
    isVisible: true,
    position: { x: 200, y: 200 }
  },
  render: (args) => ({
    components: { DragHandleGhost },
    setup() {
      const position = { x: args.position.x, y: args.position.y }

      const handleMouseMove = (event: MouseEvent) => {
        position.x = event.clientX
        position.y = event.clientY
      }

      return { args, position, handleMouseMove }
    },
    template: `
      <div
        @mousemove="handleMouseMove"
        style="
          min-height: 500px;
          background: var(--glass-bg-soft);
          position: relative;
          cursor: grabbing;
        "
      >
        <DragHandleGhost
          :is-dragging="args.isDragging"
          :is-visible="args.isVisible"
          :position="position"
        />
        <div style="
          position: absolute;
          top: var(--space-4);
          left: var(--space-4);
          color: var(--text-tertiary);
          font-size: var(--text-sm);
          background: var(--glass-bg-medium);
          padding: var(--space-3);
          border-radius: var(--radius-md);
          border: 1px solid var(--glass-border);
        ">
          Move your mouse to see the ghost follow
          <div style="margin-top: var(--space-2);">
            Position: {{ position.x }}px, {{ position.y }}px
          </div>
        </div>
      </div>
    `
  })
}

export const NotDragging: Story = {
  args: {
    isDragging: false,
    isVisible: true,
    position: { x: 300, y: 250 }
  },
  render: (args) => ({
    components: { DragHandleGhost },
    setup() {
      return { args }
    },
    template: `
      <div style="
        min-height: 500px;
        background: var(--glass-bg-soft);
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <DragHandleGhost v-bind="args" />
        <div style="
          text-align: center;
          color: var(--text-tertiary);
          font-size: var(--text-sm);
        ">
          Ghost is hidden when not dragging
        </div>
      </div>
    `
  })
}

export const MultipleGhosts: Story = {
  render: () => ({
    components: { DragHandleGhost },
    setup() {
      const ghosts = [
        { isDragging: true, isVisible: true, position: { x: 150, y: 150 } },
        { isDragging: true, isVisible: true, position: { x: 300, y: 250 } },
        { isDragging: true, isVisible: true, position: { x: 450, y: 350 } }
      ]

      return { ghosts }
    },
    template: `
      <div style="
        min-height: 500px;
        background: var(--glass-bg-soft);
        position: relative;
      ">
        <DragHandleGhost
          v-for="(ghost, index) in ghosts"
          :key="index"
          :is-dragging="ghost.isDragging"
          :is-visible="ghost.isVisible"
          :position="ghost.position"
        />
        <div style="
          position: absolute;
          top: var(--space-4);
          left: var(--space-4);
          color: var(--text-tertiary);
          font-size: var(--text-sm);
          background: var(--glass-bg-medium);
          padding: var(--space-3);
          border-radius: var(--radius-md);
          border: 1px solid var(--glass-border);
        ">
          Multiple drag ghosts shown at once
        </div>
      </div>
    `
  })
}

export const AnimationDemo: Story = {
  args: {
    isDragging: true,
    isVisible: true,
    position: { x: 100, y: 250 }
  },
  render: (args) => ({
    components: { DragHandleGhost },
    setup() {
      const position = { x: args.position.x, y: args.position.y }
      let animationId: number

      const animate = () => {
        position.x += 2
        if (position.x > 500) {
          position.x = 100
        }
        animationId = requestAnimationFrame(animate)
      }

      // Start animation
      animate()

      // Clean up on unmount
      const cleanup = () => {
        if (animationId) {
          cancelAnimationFrame(animationId)
        }
      }

      return { args, position, cleanup }
    },
    template: `
      <div style="
        min-height: 500px;
        background: var(--glass-bg-soft);
        position: relative;
      ">
        <DragHandleGhost
          :is-dragging="args.isDragging"
          :is-visible="args.isVisible"
          :position="position"
        />
        <div style="
          position: absolute;
          top: var(--space-4);
          left: var(--space-4);
          color: var(--text-tertiary);
          font-size: var(--text-sm);
          background: var(--glass-bg-medium);
          padding: var(--space-3);
          border-radius: var(--radius-md);
          border: 1px solid var(--glass-border);
        ">
          Animated ghost moving horizontally
        </div>
      </div>
    `
  })
}
