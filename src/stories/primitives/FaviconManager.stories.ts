import type { Meta, StoryObj } from '@storybook/vue3'
import FaviconManager from '@/components/common/FaviconManager.vue'

const meta: Meta<typeof FaviconManager> = {
  title: '🧩 Primitives/FaviconManager',
  component: FaviconManager,
  tags: ['autodocs', 'new'],
  parameters: {
    docs: {
      description: {
        component: 'Invisible utility component that dynamically updates the browser favicon based on timer status. Renders nothing visible - purely functional.'
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Documentation story - component is invisible
 */
export const Documentation: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-6); max-width: 800px; color: var(--text-primary);">
        <h1 style="margin-bottom: var(--space-4);">Favicon Manager</h1>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">Purpose</h2>
          <p style="color: var(--text-secondary); margin-bottom: var(--space-2);">
            This component is invisible and purely functional. It updates the browser favicon dynamically based on:
          </p>
          <ul style="margin-left: var(--space-6); color: var(--text-secondary);">
            <li>Timer status (work, break, inactive)</li>
            <li>Timer progress percentage</li>
            <li>Tab visibility (performance optimization)</li>
          </ul>
        </section>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">How It Works</h2>
          <ol style="margin-left: var(--space-6); color: var(--text-secondary);">
            <li>Watches timer store for status changes</li>
            <li>Generates a favicon with progress ring using Canvas API</li>
            <li>Updates favicon icon with emoji (🍅 for work, 🧎 for break)</li>
            <li>Only updates when tab is visible (performance)</li>
            <li>Restores original favicon on unmount</li>
          </ol>
        </section>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">Configuration</h2>
          <pre style="background: var(--surface-tertiary); padding: var(--space-3); border-radius: var(--radius-md); overflow-x: auto;"><code>&lt;FaviconManager
  :config="{
    size: 32,
    workColor: '#ef4444',
    breakColor: '#22c55e',
    lineWidth: 3
  }"
/&gt;</code></pre>
        </section>

        <section>
          <h2 style="margin-bottom: var(--space-2);">Usage</h2>
          <p style="color: var(--text-secondary);">
            Place once in your App.vue or main layout. No visual output.
          </p>
        </section>
      </div>
    `
  })
}
