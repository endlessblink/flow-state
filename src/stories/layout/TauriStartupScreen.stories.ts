import type { Meta, StoryObj } from '@storybook/vue3'
import TauriStartupScreen from '@/components/startup/TauriStartupScreen.vue'

const meta: Meta<typeof TauriStartupScreen> = {
  title: '🏢 Layout/TauriStartupScreen',
  component: TauriStartupScreen,
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Full-screen startup overlay for Tauri app. Manages Docker and Supabase initialization with progress tracking and error handling.'
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Documentation about startup sequence
 */
export const Documentation: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-6); max-width: 800px; color: var(--text-primary);">
        <h1 style="margin-bottom: var(--space-4);">Tauri Startup Screen</h1>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">Startup Sequence (Local Mode)</h2>
          <ol style="margin-left: var(--space-6); color: var(--text-secondary);">
            <li><strong>Checking Docker:</strong> Verify Docker Desktop is installed and running</li>
            <li><strong>Starting Docker:</strong> Launch Docker if not running</li>
            <li><strong>Waiting for Docker:</strong> Poll until Docker is ready</li>
            <li><strong>Checking Supabase:</strong> Verify Supabase CLI is installed</li>
            <li><strong>Starting Supabase:</strong> Run <code>supabase start</code> (first-time takes ~2-5 min)</li>
            <li><strong>Ready:</strong> Emit ready event, app loads</li>
          </ol>
        </section>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">Error Handling</h2>
          <p style="color: var(--text-secondary); margin-bottom: var(--space-2);">
            Contextual error messages with recovery instructions:
          </p>
          <ul style="margin-left: var(--space-6); color: var(--text-secondary);">
            <li><strong>docker_not_installed:</strong> Link to Docker Desktop download</li>
            <li><strong>supabase_not_installed:</strong> Instructions for <code>npm install -g supabase</code></li>
            <li><strong>supabase_port_conflict:</strong> Suggests running <code>supabase stop</code></li>
          </ul>
        </section>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">Current Behavior</h2>
          <p style="color: var(--text-secondary);">
            As of February 2026, Tauri ALWAYS skips this startup sequence and connects directly to VPS.
            Local Mode is deprecated. This screen is no longer shown in production.
          </p>
        </section>

        <section>
          <h2 style="margin-bottom: var(--space-2);">Graceful Shutdown</h2>
          <p style="color: var(--text-secondary);">
            When app closes, Supabase is kept running by default for quick restart.
            User can configure this in settings.
          </p>
        </section>
      </div>
    `
  })
}
