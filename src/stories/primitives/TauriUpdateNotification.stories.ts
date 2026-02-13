import type { Meta, StoryObj } from '@storybook/vue3'
import TauriUpdateNotification from '@/components/common/TauriUpdateNotification.vue'

const meta: Meta<typeof TauriUpdateNotification> = {
  title: '🧩 Primitives/TauriUpdateNotification',
  component: TauriUpdateNotification,
  tags: ['autodocs', 'new'],
  parameters: {
    docs: {
      description: {
        component: 'Tauri in-app auto-updater notification. Checks for updates on VPS, downloads, and installs new versions. Only renders in Tauri environment.'
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Documentation about updater workflow
 */
export const Documentation: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-6); max-width: 800px; color: var(--text-primary);">
        <h1 style="margin-bottom: var(--space-4);">Tauri Update Notification</h1>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">States</h2>
          <ul style="margin-left: var(--space-6); color: var(--text-secondary);">
            <li><strong>Available:</strong> New version detected, shows "Download" button</li>
            <li><strong>Downloading:</strong> Progress bar with percentage</li>
            <li><strong>Ready:</strong> Downloaded, shows "Restart Now" button</li>
            <li><strong>Error:</strong> Failed, shows "Retry" button</li>
          </ul>
        </section>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">Auto-Update Flow</h2>
          <ol style="margin-left: var(--space-6); color: var(--text-secondary);">
            <li>App checks <code>https://in-theflow.com/updates/latest.json</code> on launch (3s delay)</li>
            <li>Compares version with current</li>
            <li>If auto-update enabled in settings, downloads automatically</li>
            <li>Verifies signature with embedded public key</li>
            <li>Shows "Restart Now" when ready</li>
          </ol>
        </section>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">Update Manifest</h2>
          <pre style="background: var(--surface-tertiary); padding: var(--space-3); border-radius: var(--radius-md); overflow-x: auto;"><code>{
  "version": "1.2.18",
  "notes": "Bug fixes and performance improvements",
  "pub_date": "2026-02-13T10:30:00Z",
  "platforms": {
    "linux-x86_64": {
      "signature": "dW50cnV...",
      "url": "https://in-theflow.com/updates/FlowState_1.2.18_amd64.AppImage.tar.gz"
    }
  }
}</code></pre>
        </section>

        <section>
          <h2 style="margin-bottom: var(--space-2);">Settings Integration</h2>
          <p style="color: var(--text-secondary);">
            Settings > About tab has:
          </p>
          <ul style="margin-left: var(--space-6); color: var(--text-secondary);">
            <li>"Check for Updates" button</li>
            <li>"Auto-update" toggle</li>
            <li>Current version display</li>
          </ul>
        </section>
      </div>
    `
  })
}
