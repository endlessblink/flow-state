import type { Meta, StoryObj } from '@storybook/vue3'

const meta: Meta = {
  title: '🏢 Layout/BraveBanner',
  tags: ['autodocs', 'new'],
  parameters: {
    docs: {
      description: {
        component: 'Documentation for BraveBanner component. Shows warning about Brave browser shield blocking WebSocket connections.'
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Documentation about Brave browser compatibility
 */
export const Documentation: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-6); max-width: 800px; color: var(--text-primary);">
        <h1 style="margin-bottom: var(--space-4);">Brave Browser Banner</h1>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">Detection</h2>
          <p style="color: var(--text-secondary);">
            Banner appears only when:
          </p>
          <ul style="margin-left: var(--space-6); color: var(--text-secondary);">
            <li>Browser is Brave (checks <code>navigator.brave</code> API)</li>
            <li>User has not dismissed it before (localStorage check)</li>
          </ul>
        </section>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">Issue</h2>
          <p style="color: var(--text-secondary); margin-bottom: var(--space-2);">
            Brave's aggressive shields can block:
          </p>
          <ul style="margin-left: var(--space-6); color: var(--text-secondary);">
            <li>Supabase Realtime WebSocket connections</li>
            <li>Timer cross-device sync</li>
            <li>Real-time notifications</li>
          </ul>
        </section>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">Recommendation</h2>
          <p style="color: var(--text-secondary);">
            Banner suggests:
          </p>
          <ol style="margin-left: var(--space-6); color: var(--text-secondary);">
            <li>Click Brave icon in address bar</li>
            <li>Turn off shields for in-theflow.com</li>
            <li>OR use Chrome/Firefox for full functionality</li>
          </ol>
        </section>

        <section>
          <h2 style="margin-bottom: var(--space-2);">Dismissal</h2>
          <p style="color: var(--text-secondary);">
            When dismissed, won't show again (stored in localStorage).
          </p>
        </section>
      </div>
    `
  })
}
