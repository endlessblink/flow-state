import type { Meta, StoryObj } from '@storybook/vue3'
import AchievementsModal from '@/components/gamification/AchievementsModal.vue'

const meta = {
  component: AchievementsModal,
  title: '🎮 Gamification/AchievementsModal',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof AchievementsModal>

export default meta
type Story = StoryObj<typeof meta>

// Note: This component requires gamificationStore setup
// These stories are documentation placeholders

// Documentation
export const Documentation: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-10); background: var(--app-background-gradient); min-height: 100vh;">
        <h1 style="margin: 0 0 var(--space-6) 0; color: var(--text-primary); font-size: var(--text-3xl);">AchievementsModal Component</h1>

        <div style="display: flex; flex-direction: column; gap: var(--space-6); max-width: 800px;">
          <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary);">Purpose</h3>
            <p style="margin: 0; color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.6;">
              Full achievements list modal with category filtering. Displays all achievements from the gamification store with progress tracking.
            </p>
          </div>

          <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary);">Features</h3>
            <ul style="margin: 0; padding-left: var(--space-5); color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.8;">
              <li>Category tabs (All, Productivity, Consistency, Mastery, Exploration, Secret)</li>
              <li>Earned/total counter per category</li>
              <li>Achievements sorted by earned first, then by tier</li>
              <li>Progress bars for in-progress achievements</li>
              <li>Secret achievements show ??? until unlocked</li>
              <li>Tier-based visual styling (bronze, silver, gold, platinum)</li>
              <li>Scrollable list with max-height constraint</li>
            </ul>
          </div>

          <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary);">Props</h3>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md); font-family: monospace; font-size: var(--text-xs); color: var(--text-tertiary);">
              <pre style="margin: 0; white-space: pre-wrap;">open: boolean  // Modal visibility</pre>
            </div>
          </div>

          <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary);">Events</h3>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md); font-family: monospace; font-size: var(--text-xs); color: var(--text-tertiary);">
              <pre style="margin: 0; white-space: pre-wrap;">@close  // Emitted when user closes modal</pre>
            </div>
          </div>

          <div style="padding: var(--space-6); background: rgba(var(--neon-cyan), 0.05); border-radius: var(--radius-lg); border: 1px solid rgba(var(--neon-cyan), 0.15);">
            <h4 style="margin: 0 0 var(--space-2) 0; color: var(--text-primary); font-size: var(--text-sm); font-weight: 600;">Usage Example</h4>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md); font-family: monospace; font-size: var(--text-xs); color: var(--text-tertiary);">
              <pre style="margin: 0; white-space: pre-wrap;">&lt;AchievementsModal
  :open="showAchievements"
  @close="showAchievements = false"
/&gt;</pre>
            </div>
          </div>

          <div style="padding: var(--space-6); background: rgba(var(--neon-magenta), 0.05); border-radius: var(--radius-lg); border: 1px solid rgba(var(--neon-magenta), 0.15);">
            <p style="margin: 0; color: var(--text-tertiary); font-size: var(--text-xs); line-height: 1.6;">
              <strong style="color: var(--text-secondary);">Store Dependency:</strong> This component reads from gamificationStore.achievementsWithProgress. To see it in action, it must be used within the app context with a populated store.
            </p>
          </div>
        </div>
      </div>
    `,
  }),
}
