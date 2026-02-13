import type { Meta, StoryObj } from '@storybook/vue3'
import GamificationPanel from '@/components/gamification/GamificationPanel.vue'

const meta = {
  component: GamificationPanel,
  title: '🎮 Gamification/GamificationPanel',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof GamificationPanel>

export default meta
type Story = StoryObj<typeof meta>

// Documentation (store-dependent component)
export const Documentation: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 700px;">
        <h1 style="margin: 0 0 var(--space-6) 0; color: var(--text-primary); font-size: var(--text-2xl);">GamificationPanel Component</h1>

        <div style="display: flex; flex-direction: column; gap: var(--space-6);">
          <div>
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--text-base);">Purpose</h3>
            <p style="margin: 0; color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.6;">
              Main stats overview panel showing XP, level, streak, recent achievements, daily challenges, and shop access. Rendered in header dropdown when clicking GamificationHUD.
            </p>
          </div>

          <div>
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--text-base);">Features</h3>
            <ul style="margin: 0; padding-left: var(--space-5); color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.8;">
              <li>Cyberflow Command Center link (nav to /cyberflow)</li>
              <li>Large level badge + total XP display</li>
              <li>Shop button with available XP counter</li>
              <li>XP progress bar (animated)</li>
              <li>Streak counter with freezes</li>
              <li>Daily challenges panel (compact mode)</li>
              <li>Recent achievements grid (4 most recent)</li>
              <li>"See All" button for achievements modal</li>
              <li>"How to Earn XP" collapsible help section</li>
            </ul>
          </div>

          <div>
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--text-base);">Events</h3>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md); font-family: monospace; font-size: var(--text-xs); color: var(--text-tertiary);">
              <pre style="margin: 0; white-space: pre-wrap;">@openAchievements  // Opens achievements modal
@openShop         // Opens shop modal
@close            // Closes panel dropdown</pre>
            </div>
          </div>

          <div>
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--text-base);">XP Earning Guide</h3>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md);">
              <ul style="margin: 0; padding-left: var(--space-5); color: var(--text-tertiary); font-size: var(--text-sm); line-height: 1.8;">
                <li><strong style="color: rgba(var(--neon-cyan), 1);">Tasks:</strong> +10 XP base, +50% high priority, +25% medium, -10% overdue</li>
                <li><strong style="color: rgba(var(--neon-cyan), 1);">Pomodoros:</strong> +25 XP, +10% per consecutive (max +50%)</li>
                <li><strong style="color: var(--streak-flame-color);">Streaks:</strong> +50 XP (7d), +150 XP (30d), +300 XP (100d), +500 XP (365d)</li>
                <li><strong style="color: var(--tier-rare);">Achievements:</strong> +50 XP (bronze), +150 XP (silver), +300 XP (gold), +500 XP (platinum)</li>
              </ul>
            </div>
          </div>

          <div>
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--text-base);">Sections</h3>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md);">
              <ol style="margin: 0; padding-left: var(--space-5); color: var(--text-tertiary); font-size: var(--text-sm); line-height: 1.8;">
                <li>Cyberflow Command Center link (top)</li>
                <li>Header with level badge + XP + shop button</li>
                <li>XP progress bar</li>
                <li>Streak counter</li>
                <li>Daily challenges panel</li>
                <li>Recent achievements (4 max)</li>
                <li>How to Earn XP (collapsible)</li>
              </ol>
            </div>
          </div>

          <div style="padding: var(--space-4); background: rgba(var(--neon-cyan), 0.05); border-radius: var(--radius-md); border: 1px solid rgba(var(--neon-cyan), 0.15);">
            <h4 style="margin: 0 0 var(--space-2) 0; color: var(--text-primary); font-size: var(--text-sm); font-weight: 600;">Usage Example</h4>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md); font-family: monospace; font-size: var(--text-xs); color: var(--text-tertiary);">
              <pre style="margin: 0; white-space: pre-wrap;">&lt;GamificationPanel
  @open-achievements="showAchievementsModal = true"
  @open-shop="showShopModal = true"
  @close="closePanel"
/&gt;</pre>
            </div>
          </div>

          <div style="padding: var(--space-4); background: rgba(var(--neon-magenta), 0.05); border-radius: var(--radius-md); border: 1px solid rgba(var(--neon-magenta), 0.15);">
            <p style="margin: 0; color: var(--text-tertiary); font-size: var(--text-xs); line-height: 1.6;">
              <strong style="color: var(--text-secondary);">Store Dependency:</strong> Reads from gamificationStore (levelInfo, totalXp, availableXp, streakInfo, earnedAchievements) and challengesStore (via DailyChallengesPanel). Navigates to /cyberflow route.
            </p>
          </div>
        </div>
      </div>
    `,
  }),
}
