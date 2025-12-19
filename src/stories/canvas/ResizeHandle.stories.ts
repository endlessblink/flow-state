import type { Meta, StoryObj } from '@storybook/vue3'
import ResizeHandle from '@/components/canvas/ResizeHandle.vue'

const meta = {
  component: ResizeHandle,
  title: '✨ Features/🎨 Canvas View/ResizeHandle',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `Resize handle component for canvas sections and nodes.

**When to use:**
- Section resizing on canvas view
- Node resizing interactions
- Any element that needs drag-to-resize functionality`
      }
    },
  },

  argTypes: {
    direction: {
      control: 'select',
      options: ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'se'],
      description: 'Direction/position of the resize handle',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'se' }
      }
    },
    isVisible: {
      control: 'boolean',
      description: 'Whether the handle is visible',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' }
      }
    },
    isResizing: {
      control: 'boolean',
      description: 'Whether the handle is currently being used to resize',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' }
      }
    },
  },
} satisfies Meta<typeof ResizeHandle>

export default meta
type Story = StoryObj<typeof meta>

// Default: Interactive handle with controls
export const Default: Story = {
  args: {
    direction: 'bottom-right',
    isVisible: true,
    isResizing: false,
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="padding: 60px; background: var(--surface-primary); border-radius: var(--radius-lg); min-width: 200px; min-height: 200px; display: flex; align-items: center; justify-content: center; position: relative;">
          <div style="width: 120px; height: 80px; background: var(--surface-tertiary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); position: relative; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 12px;">
            Section
            <story />
          </div>
        </div>
      `
    })
  ],
}

// All Positions: Show all handle positions side by side
export const AllPositions: Story = {
  parameters: {
    docs: {
      description: {
        story: `**Available handle positions:**

- **Edges**: top, bottom, left, right - for single-axis resizing
- **Corners**: top-left, top-right, bottom-left, bottom-right - for diagonal resizing
- **Alias**: se (southeast) - same as bottom-right`
      }
    }
  },
  render: () => ({
    components: { ResizeHandle },
    template: `
      <div style="padding: var(--space-6); background: var(--surface-primary);">
        <div style="display: grid; grid-template-columns: repeat(3, 120px); gap: var(--space-4);">
          <div style="position: relative; height: 70px; background: var(--surface-tertiary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 11px; color: var(--text-muted);">top-left</span>
            <ResizeHandle direction="top-left" :is-visible="true" />
          </div>
          <div style="position: relative; height: 70px; background: var(--surface-tertiary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 11px; color: var(--text-muted);">top</span>
            <ResizeHandle direction="top" :is-visible="true" />
          </div>
          <div style="position: relative; height: 70px; background: var(--surface-tertiary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 11px; color: var(--text-muted);">top-right</span>
            <ResizeHandle direction="top-right" :is-visible="true" />
          </div>

          <div style="position: relative; height: 70px; background: var(--surface-tertiary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 11px; color: var(--text-muted);">left</span>
            <ResizeHandle direction="left" :is-visible="true" />
          </div>
          <div style="position: relative; height: 70px; background: var(--surface-secondary); border: 1px solid var(--border-medium); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 11px; color: var(--text-secondary);">center</span>
          </div>
          <div style="position: relative; height: 70px; background: var(--surface-tertiary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 11px; color: var(--text-muted);">right</span>
            <ResizeHandle direction="right" :is-visible="true" />
          </div>

          <div style="position: relative; height: 70px; background: var(--surface-tertiary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 11px; color: var(--text-muted);">bottom-left</span>
            <ResizeHandle direction="bottom-left" :is-visible="true" />
          </div>
          <div style="position: relative; height: 70px; background: var(--surface-tertiary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 11px; color: var(--text-muted);">bottom</span>
            <ResizeHandle direction="bottom" :is-visible="true" />
          </div>
          <div style="position: relative; height: 70px; background: var(--surface-tertiary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 11px; color: var(--text-muted);">bottom-right</span>
            <ResizeHandle direction="bottom-right" :is-visible="true" />
          </div>
        </div>
      </div>
    `
  })
}

// States: Show handle states
export const States: Story = {
  parameters: {
    docs: {
      description: {
        story: `**Handle states:**

- **Hidden** (default): Opacity 0, appears on parent hover
- **Visible**: Full opacity, ready for interaction
- **Resizing**: Scaled up, brighter color, indicates active resize`
      }
    }
  },
  render: () => ({
    components: { ResizeHandle },
    template: `
      <div style="padding: var(--space-6); background: var(--surface-primary);">
        <div style="display: flex; gap: var(--space-6);">
          <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-3);">
            <div style="position: relative; width: 100px; height: 70px; background: var(--surface-tertiary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
              <ResizeHandle direction="bottom-right" :is-visible="false" />
            </div>
            <span style="font-size: 12px; color: var(--text-muted);">Hidden</span>
          </div>

          <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-3);">
            <div style="position: relative; width: 100px; height: 70px; background: var(--surface-tertiary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
              <ResizeHandle direction="bottom-right" :is-visible="true" />
            </div>
            <span style="font-size: 12px; color: var(--text-muted);">Visible</span>
          </div>

          <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-3);">
            <div style="position: relative; width: 100px; height: 70px; background: var(--surface-tertiary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
              <ResizeHandle direction="bottom-right" :is-visible="true" :is-resizing="true" />
            </div>
            <span style="font-size: 12px; color: var(--text-muted);">Resizing</span>
          </div>
        </div>
      </div>
    `
  })
}
