import type { Meta, StoryObj } from '@storybook/vue3'

/**
 * CanvasSelectionBox - Drag-Select Overlay
 *
 * Selection box overlay that appears when the user drags on the canvas
 * background to select multiple nodes.
 *
 * **Styling:** Teal semi-transparent rectangle with rounded corners.
 *
 * **Note:** The real component uses absolute positioning within the canvas container.
 * This story shows a static mock.
 */
const meta: Meta = {
  title: '🎨 Canvas/CanvasSelectionBox',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `Selection box overlay for canvas drag-select.

**Behavior:** Appears when user drags on canvas background to select multiple nodes.

**Styling:** Teal semi-transparent rectangle with rounded corners.

**Note:** This story shows a static mock. The real component uses absolute positioning within the canvas container.`
      }
    }
  }
}

export default meta
type Story = StoryObj

// All styles as single-line strings — multiline breaks Storybook rendering
const S = {
  canvas: 'width:600px; height:400px; background:var(--surface-primary); border-radius:var(--radius-lg); position:relative; overflow:hidden;',
  selectionBox: 'position:absolute; border:2px solid rgba(78,205,196,0.6); background:rgba(78,205,196,0.1); border-radius:var(--radius-sm); pointer-events:none; z-index:9999;',
  node: 'position:absolute; background:var(--glass-bg-solid); border:1px solid var(--glass-border); border-radius:var(--radius-md); padding:var(--space-3); min-width:120px; backdrop-filter:blur(8px);',
  nodeTitle: 'font-size:var(--text-sm); color:var(--text-primary); font-weight:500;',
  nodeStatus: 'font-size:var(--text-xs); color:var(--text-secondary); margin-top:var(--space-1);',
}

/**
 * Default - Visible Selection
 *
 * Shows a selection box at position (100, 80) with size 200x150 on a dark canvas.
 */
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Default selection box appearance at position (100, 80) with size 200×150.'
      }
    }
  },
  render: () => ({
    setup() { return { S } },
    template: `
      <div :style="S.canvas">
        <div :style="S.selectionBox + 'left:100px;top:80px;width:200px;height:150px;'"></div>
      </div>
    `
  })
}

/**
 * Large Selection
 *
 * Selection box covering most of the canvas area.
 */
export const LargeSelection: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Large selection box (400×300) covering most of the canvas area.'
      }
    }
  },
  render: () => ({
    setup() { return { S } },
    template: `
      <div :style="S.canvas">
        <div :style="S.selectionBox + 'left:50px;top:50px;width:400px;height:300px;'"></div>
      </div>
    `
  })
}

/**
 * With Nodes - Selection in Context
 *
 * Shows a selection box overlapping canvas nodes to demonstrate how
 * drag-select looks in practice.
 */
export const WithNodes: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Selection box overlapping canvas nodes. Tasks A, B, and C fall within the selection bounds.'
      }
    }
  },
  render: () => ({
    setup() { return { S } },
    template: `
      <div :style="S.canvas">
        <div :style="S.node + 'left:80px;top:60px;'">
          <div :style="S.nodeTitle">Task A</div>
          <div :style="S.nodeStatus">In Progress</div>
        </div>
        <div :style="S.node + 'left:220px;top:100px;'">
          <div :style="S.nodeTitle">Task B</div>
          <div :style="S.nodeStatus">Todo</div>
        </div>
        <div :style="S.node + 'left:140px;top:180px;'">
          <div :style="S.nodeTitle">Task C</div>
          <div :style="S.nodeStatus">Blocked</div>
        </div>
        <div :style="S.node + 'left:350px;top:240px;'">
          <div :style="S.nodeTitle">Task D</div>
          <div :style="S.nodeStatus">Done</div>
        </div>
        <div :style="S.selectionBox + 'left:70px;top:50px;width:250px;height:200px;'"></div>
      </div>
    `
  })
}
