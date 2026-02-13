import type { Meta, StoryObj } from '@storybook/vue3'
import ReloadPrompt from '@/components/common/ReloadPrompt.vue'

const meta: Meta<typeof ReloadPrompt> = {
  title: '🧩 Primitives/ReloadPrompt',
  component: ReloadPrompt,
  tags: ['autodocs', 'new'],
  parameters: {
    docs: {
      description: {
        component: 'PWA service worker update notification. Shows when a new version is available or app is ready for offline use. Only appears in web builds with vite-plugin-pwa.'
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Documentation - component is dynamic based on SW state
 */
export const Documentation: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-6); max-width: 800px; color: var(--text-primary);">
        <h1 style="margin-bottom: var(--space-4);">Reload Prompt</h1>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">States</h2>
          <ul style="margin-left: var(--space-6); color: var(--text-secondary);">
            <li><strong>Update Available:</strong> Shows "Reload" button when new version detected</li>
            <li><strong>Offline Ready:</strong> Confirmation that app can work offline</li>
            <li><strong>Hidden:</strong> No updates, normal operation</li>
          </ul>
        </section>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">Behavior</h2>
          <p style="color: var(--text-secondary); margin-bottom: var(--space-2);">
            Only renders in PWA web builds. Tauri builds skip this component entirely.
          </p>
          <p style="color: var(--text-secondary);">
            Position: Fixed bottom-right corner with slide-up animation
          </p>
        </section>

        <section>
          <h2 style="margin-bottom: var(--space-2);">Implementation</h2>
          <pre style="background: var(--surface-tertiary); padding: var(--space-3); border-radius: var(--radius-md); overflow-x: auto;"><code>// Uses vite-plugin-pwa virtual module
import('virtual:pwa-register/vue').then(({ useRegisterSW }) => {
  const sw = useRegisterSW()
  // Access offlineReady, needRefresh refs
})</code></pre>
        </section>
      </div>
    `
  })
}
