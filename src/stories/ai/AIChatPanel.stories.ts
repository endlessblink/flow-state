import type { Meta, StoryObj } from '@storybook/vue3'
import AIChatPanel from '@/components/ai/AIChatPanel.vue'

const meta: Meta<typeof AIChatPanel> = {
  title: '🤖 AI/AIChatPanel',
  component: AIChatPanel,
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'AI Chat Panel with provider selection, settings, and message history. Full-featured assistant interface with voice input, tool results, and provider health checks.'
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default panel state (closed). Click the Ctrl+/ keyboard shortcut or AI icon to open.
 * In production, the panel is controlled by the useAIChat composable.
 */
export const Closed: Story = {
  render: () => ({
    components: { AIChatPanel },
    template: `
      <div style="width: 100vw; height: 100vh; background: var(--bg-primary);">
        <AIChatPanel />
        <div style="padding: var(--space-6); color: var(--text-primary);">
          <p>AI Chat Panel is currently closed.</p>
          <p style="margin-top: var(--space-2); color: var(--text-muted);">
            In the full app, press <kbd>Ctrl+/</kbd> to open it.
          </p>
        </div>
      </div>
    `
  })
}

/**
 * Documentation story explaining the panel's features and architecture.
 */
export const Documentation: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-6); max-width: 800px; color: var(--text-primary);">
        <h1 style="margin-bottom: var(--space-4);">AI Chat Panel</h1>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">Features</h2>
          <ul style="margin-left: var(--space-6); color: var(--text-secondary);">
            <li>Provider selection (Auto, Groq, OpenRouter, Local Ollama)</li>
            <li>Model selection per provider</li>
            <li>Voice input with speech recognition</li>
            <li>Message streaming with thinking indicator</li>
            <li>Tool call results with rich task cards</li>
            <li>Gamification stats integration</li>
            <li>Undo/redo for actions</li>
            <li>Three panel sizes: compact (380px), expanded (600px), fullscreen</li>
          </ul>
        </section>

        <section style="margin-bottom: var(--space-6);">
          <h2 style="margin-bottom: var(--space-2);">Architecture</h2>
          <p style="color: var(--text-secondary); margin-bottom: var(--space-2);">
            The panel uses <code>useAIChat</code> composable which manages:
          </p>
          <ul style="margin-left: var(--space-6); color: var(--text-secondary);">
            <li><strong>Message state:</strong> Handled by <code>useAIChatStore</code></li>
            <li><strong>Provider routing:</strong> <code>createAIRouter</code> with failover</li>
            <li><strong>Tool execution:</strong> Direct integration with task operations</li>
            <li><strong>Streaming:</strong> Server-sent events via AI router</li>
          </ul>
        </section>

        <section>
          <h2 style="margin-bottom: var(--space-2);">Usage</h2>
          <pre style="background: var(--surface-tertiary); padding: var(--space-3); border-radius: var(--radius-md); overflow-x: auto;"><code>// In your view component
import AIChatPanel from '@/components/ai/AIChatPanel.vue'

&lt;AIChatPanel /&gt;</code></pre>
        </section>
      </div>
    `
  })
}
