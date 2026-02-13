import type { Meta, StoryObj } from '@storybook/vue3'
import SyncStatusIndicator from '@/components/sync/SyncStatusIndicator.vue'

const meta: Meta<typeof SyncStatusIndicator> = {
  title: '🏢 Layout/SyncStatusIndicator',
  component: SyncStatusIndicator,
  tags: ['autodocs', 'new'],
  parameters: {
    docs: {
      description: {
        component: 'Offline sync status indicator with cloud icon, badge count, and error popover. Shows sync state, pending operations, and allows retry/clear.'
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Documentation about sync states
 */
export const Documentation: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-6); max-width: 800px; color: var(--text-primary);">
        <h1 style="margin-bottom: var(--space-4);">Sync Status Indicator</h1>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">States</h2>
          <ul style="margin-left: var(--space-6); color: var(--text-secondary);">
            <li><strong>Synced (CloudCheck):</strong> Green - all operations synced</li>
            <li><strong>Syncing (CloudUpload):</strong> Blue spinning - operations in progress</li>
            <li><strong>Pending (CloudCog):</strong> Amber badge - operations queued</li>
            <li><strong>Error (CloudOff):</strong> Red badge - operations failed, click to see popover</li>
            <li><strong>Offline (WifiOff):</strong> Gray - no network connection</li>
          </ul>
        </section>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">Badge</h2>
          <p style="color: var(--text-secondary); margin-bottom: var(--space-2);">
            Shows count of pending or failed operations:
          </p>
          <ul style="margin-left: var(--space-6); color: var(--text-secondary);">
            <li>Pending: Amber badge with count (e.g., "3")</li>
            <li>Error: Red badge with count (e.g., "2")</li>
            <li>Maxes at "9+" for counts above 9</li>
          </ul>
        </section>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">Interactions</h2>
          <ul style="margin-left: var(--space-6); color: var(--text-secondary);">
            <li>Click when <strong>pending</strong>: Force sync immediately</li>
            <li>Click when <strong>error</strong>: Open error popover with details</li>
            <li>Hover: Show tooltip with last sync time</li>
          </ul>
        </section>

        <section>
          <h2 style="margin-bottom: var(--space-2);">Error Popover</h2>
          <p style="color: var(--text-secondary);">
            Displays:
          </p>
          <ul style="margin-left: var(--space-6); color: var(--text-secondary);">
            <li>List of failed operations (entity type, operation, error message)</li>
            <li>"Retry" button for retryable errors</li>
            <li>"Clear All" button to dismiss permanently</li>
            <li>Permanent errors (corrupted data) shown with dashed border</li>
          </ul>
        </section>
      </div>
    `
  })
}
