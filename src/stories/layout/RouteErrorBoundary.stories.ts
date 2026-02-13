import type { Meta, StoryObj } from '@storybook/vue3'

const meta: Meta = {
  title: '🏢 Layout/RouteErrorBoundary',
  tags: ['autodocs', 'new'],
  parameters: {
    docs: {
      description: {
        component: 'Error boundary for route-level errors. Catches navigation errors, component load failures, and displays user-friendly fallback UI.'
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Documentation about error boundary
 */
export const Documentation: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-6); max-width: 800px; color: var(--text-primary);">
        <h1 style="margin-bottom: var(--space-4);">Route Error Boundary</h1>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">Catches</h2>
          <ul style="margin-left: var(--space-6); color: var(--text-secondary);">
            <li>Component load failures (lazy imports)</li>
            <li>Router navigation errors</li>
            <li>Unhandled exceptions in route components</li>
            <li>Store initialization errors</li>
          </ul>
        </section>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">Fallback UI</h2>
          <p style="color: var(--text-secondary); margin-bottom: var(--space-2);">
            Displays:
          </p>
          <ul style="margin-left: var(--space-6); color: var(--text-secondary);">
            <li>Error icon</li>
            <li>User-friendly error message</li>
            <li>"Go Home" button to recover</li>
            <li>"Report Issue" button (optional)</li>
            <li>Technical details in collapsed section (dev mode only)</li>
          </ul>
        </section>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">Usage</h2>
          <pre style="background: var(--surface-tertiary); padding: var(--space-3); border-radius: var(--radius-md); overflow-x: auto;"><code>// In router setup
import RouteErrorBoundary from '@/components/error/RouteErrorBoundary.vue'

router.onError((error) => {
  // Error boundary will catch and display
})</code></pre>
        </section>

        <section>
          <h2 style="margin-bottom: var(--space-2);">Recovery</h2>
          <p style="color: var(--text-secondary);">
            "Go Home" button navigates to root route (/), allowing user to continue using app.
          </p>
        </section>
      </div>
    `
  })
}
