import type { Meta, StoryObj } from '@storybook/vue3'
import IOSInstallPrompt from '@/components/common/IOSInstallPrompt.vue'

const meta: Meta<typeof IOSInstallPrompt> = {
  title: '🧩 Primitives/IOSInstallPrompt',
  component: IOSInstallPrompt,
  tags: ['autodocs', 'new'],
  parameters: {
    docs: {
      description: {
        component: 'PWA installation prompt for iOS devices. Shows instructions to add FlowState to home screen. Only appears on iOS Safari when not already installed.'
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Install prompt visible (as it would appear on iOS)
 */
export const Visible: Story = {
  render: () => ({
    components: { IOSInstallPrompt },
    template: `
      <div style="width: 100vw; height: 100vh; background: var(--bg-primary); position: relative;">
        <IOSInstallPrompt />
        <div style="padding: var(--space-6); color: var(--text-primary);">
          <p>iOS install prompt appears at bottom center on iOS Safari.</p>
        </div>
      </div>
    `
  })
}

/**
 * Documentation about detection logic
 */
export const Documentation: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-6); max-width: 800px; color: var(--text-primary);">
        <h1 style="margin-bottom: var(--space-4);">iOS Install Prompt</h1>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">Detection Logic</h2>
          <p style="color: var(--text-secondary); margin-bottom: var(--space-2);">
            The prompt only shows when ALL conditions are met:
          </p>
          <ul style="margin-left: var(--space-6); color: var(--text-secondary);">
            <li>Device is iOS (iPad, iPhone, iPod)</li>
            <li>Not already installed (not in standalone mode)</li>
            <li>User has not dismissed it before (localStorage check)</li>
          </ul>
        </section>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">Dismissal</h2>
          <p style="color: var(--text-secondary);">
            When dismissed, the prompt won't show again. This is stored in localStorage:
            <code style="background: var(--surface-tertiary); padding: var(--space-0_5) var(--space-1); border-radius: var(--radius-sm);">
              flowstate-ios-install-prompt-dismissed
            </code>
          </p>
        </section>

        <section>
          <h2 style="margin-bottom: var(--space-2);">Instructions Shown</h2>
          <ol style="margin-left: var(--space-6); color: var(--text-secondary);">
            <li>Tap the Share button (in Safari toolbar)</li>
            <li>Select "Add to Home Screen"</li>
          </ol>
        </section>
      </div>
    `
  })
}
