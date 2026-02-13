import type { Meta, StoryObj } from '@storybook/vue3'
import TauriModeSelector from '@/components/startup/TauriModeSelector.vue'

const meta: Meta<typeof TauriModeSelector> = {
  title: '🏢 Layout/TauriModeSelector',
  component: TauriModeSelector,
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Mode selection screen for Tauri app. Allows users to choose between Cloud Mode (VPS) and Local Mode (Docker). Cloud Mode is recommended and default.'
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default mode selector with Cloud selected
 */
export const Default: Story = {
  render: () => ({
    components: { TauriModeSelector },
    template: `
      <TauriModeSelector />
    `
  })
}

/**
 * Documentation about modes
 */
export const Documentation: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-6); max-width: 800px; color: var(--text-primary);">
        <h1 style="margin-bottom: var(--space-4);">Tauri Mode Selector</h1>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">Cloud Mode (Recommended)</h2>
          <ul style="margin-left: var(--space-6); color: var(--text-secondary);">
            <li>Connects to in-theflow.com (VPS Supabase)</li>
            <li>Works immediately, no setup</li>
            <li>Sync across devices</li>
            <li>Automatic backups</li>
            <li><strong>Default choice</strong></li>
          </ul>
        </section>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">Local Mode</h2>
          <ul style="margin-left: var(--space-6); color: var(--text-secondary);">
            <li>Runs own Docker + Supabase locally</li>
            <li>Full data control</li>
            <li>Works offline</li>
            <li>Requires Docker Desktop installed</li>
            <li>Manual setup (app orchestrates it)</li>
          </ul>
        </section>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">Persistence</h2>
          <p style="color: var(--text-secondary);">
            Choice is saved to localStorage: <code style="background: var(--surface-tertiary); padding: var(--space-0_5) var(--space-1); border-radius: var(--radius-sm);">flowstate-tauri-mode</code>
          </p>
          <p style="color: var(--text-muted); margin-top: var(--space-2);">
            Can be changed later in Settings > Storage
          </p>
        </section>

        <section>
          <h2 style="margin-bottom: var(--space-2);">Current Architecture</h2>
          <p style="color: var(--text-secondary);">
            As of February 2026, Tauri ALWAYS connects to VPS. Local Mode is deprecated/unused.
          </p>
        </section>
      </div>
    `
  })
}
