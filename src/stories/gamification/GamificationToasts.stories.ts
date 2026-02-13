import type { Meta, StoryObj } from '@storybook/vue3'
import GamificationToasts from '@/components/gamification/GamificationToasts.vue'

const meta = {
  component: GamificationToasts,
  title: '🎮 Gamification/GamificationToasts',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof GamificationToasts>

export default meta
type Story = StoryObj<typeof meta>

// Documentation
export const Documentation: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-10); background: var(--app-background-gradient); min-height: 100vh;">
        <h1 style="margin: 0 0 var(--space-6) 0; color: var(--text-primary); font-size: var(--text-3xl);">GamificationToasts Component</h1>

        <div style="display: flex; flex-direction: column; gap: var(--space-6); max-width: 800px;">
          <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary);">Purpose</h3>
            <p style="margin: 0; color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.6;">
              Renders all active gamification toast notifications from the store. This is a container component that positions AchievementToast components in a fixed stack.
            </p>
          </div>

          <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary);">Features</h3>
            <ul style="margin: 0; padding-left: var(--space-5); color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.8;">
              <li>Fixed position in top-right corner</li>
              <li>Reads toasts from gamificationStore.toastQueue</li>
              <li>Filters toasts based on Cyberflow intensity setting</li>
              <li>TransitionGroup for smooth enter/leave animations</li>
              <li>Handles toast dismissal via store action</li>
              <li>Stacks toasts vertically with gap</li>
            </ul>
          </div>

          <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary);">Intensity Filtering</h3>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md);">
              <ul style="margin: 0; padding-left: var(--space-5); color: var(--text-tertiary); font-size: var(--text-sm); line-height: 1.8;">
                <li><strong style="color: var(--text-secondary);">Minimal:</strong> No toasts shown</li>
                <li><strong style="color: var(--text-secondary);">Moderate:</strong> XP, level_up, exposure toasts</li>
                <li><strong style="color: var(--text-secondary);">Intense:</strong> All toast types</li>
              </ul>
            </div>
          </div>

          <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary);">Toast Types</h3>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md);">
              <ul style="margin: 0; padding-left: var(--space-5); color: var(--text-tertiary); font-size: var(--text-sm); line-height: 1.8;">
                <li><strong style="color: rgba(var(--neon-cyan), 1);">xp:</strong> Task completion XP rewards</li>
                <li><strong style="color: rgba(var(--neon-magenta), 1);">level_up:</strong> Level increase notifications</li>
                <li><strong style="color: var(--tier-rare);">achievement:</strong> Achievement unlocks (with tier)</li>
                <li><strong style="color: var(--streak-flame-color);">streak:</strong> Streak milestones</li>
                <li><strong style="color: rgba(var(--neon-cyan), 1);">purchase:</strong> Shop item purchases</li>
                <li><strong style="color: rgba(var(--neon-cyan), 1);">exposure:</strong> Timer bonus shield status</li>
              </ul>
            </div>
          </div>

          <div style="padding: var(--space-6); background: rgba(var(--neon-cyan), 0.05); border-radius: var(--radius-lg); border: 1px solid rgba(var(--neon-cyan), 0.15);">
            <h4 style="margin: 0 0 var(--space-2) 0; color: var(--text-primary); font-size: var(--text-sm); font-weight: 600;">Usage</h4>
            <p style="margin: 0 0 var(--space-2) 0; color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.6;">
              This component is typically rendered once in the app root layout (e.g., App.vue or MainLayout.vue). It automatically displays toasts added to the gamification store's toast queue.
            </p>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md); font-family: monospace; font-size: var(--text-xs); color: var(--text-tertiary);">
              <pre style="margin: 0; white-space: pre-wrap;">&lt;GamificationToasts /&gt;</pre>
            </div>
          </div>

          <div style="padding: var(--space-6); background: rgba(var(--neon-magenta), 0.05); border-radius: var(--radius-lg); border: 1px solid rgba(var(--neon-magenta), 0.15);">
            <p style="margin: 0; color: var(--text-tertiary); font-size: var(--text-xs); line-height: 1.6;">
              <strong style="color: var(--text-secondary);">Store Integration:</strong> Toasts are added via gamificationStore.addToast(). The component listens to toastQueue reactively and renders/dismisses toasts automatically.
            </p>
          </div>
        </div>
      </div>
    `,
  }),
}
