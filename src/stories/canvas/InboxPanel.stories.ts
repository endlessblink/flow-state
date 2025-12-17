import type { Meta, StoryObj } from '@storybook/vue3'
import InboxPanel from '@/components/canvas/InboxPanel.vue'

const meta = {
  component: InboxPanel,
  title: '🧩 Components/🎨 Canvas/InboxPanel',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      story: {
        height: '600px',
      },
    },
  },
} satisfies Meta<typeof InboxPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { InboxPanel },
    template: `
      <div style="display: flex; height: 100vh; min-height: 600px; padding: 20px; background: rgba(0, 0, 0, 0.95);">
        <InboxPanel />
        <div style="flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-muted);">
          <p>Click the arrow button to expand/collapse the InboxPanel</p>
        </div>
      </div>
    `,
  }),
}

export const Expanded: Story = {
  parameters: {
    docs: {
      description: {
        story: 'InboxPanel starts collapsed by default. Click the expand button to see full functionality including quick add, brain dump mode, and time filters.',
      },
    },
  },
  render: () => ({
    components: { InboxPanel },
    template: `
      <div style="display: flex; height: 100vh; min-height: 600px; padding: 20px; background: rgba(0, 0, 0, 0.95);">
        <InboxPanel />
        <div style="flex: 1; padding: 20px;">
          <h3 style="color: var(--text-primary); margin: 0 0 16px 0;">InboxPanel Features</h3>
          <ul style="color: var(--text-secondary); line-height: 1.8;">
            <li><strong>Quick Add:</strong> Press Enter to quickly add tasks</li>
            <li><strong>Brain Dump Mode:</strong> Paste multiple tasks at once</li>
            <li><strong>Time Filters:</strong> Filter by Now, Today, Tomorrow, This Week</li>
            <li><strong>Drag & Drop:</strong> Drag tasks to the canvas</li>
            <li><strong>Context Menu:</strong> Right-click for task actions</li>
            <li><strong>Multi-select:</strong> Ctrl/Cmd+Click for batch selection</li>
          </ul>
        </div>
      </div>
    `,
  }),
}