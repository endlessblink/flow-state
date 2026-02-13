import type { Meta, StoryObj } from '@storybook/vue3'
import DailyChallengesPanel from '@/components/gamification/DailyChallengesPanel.vue'

const meta = {
  component: DailyChallengesPanel,
  title: '🎮 Gamification/DailyChallengesPanel',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof DailyChallengesPanel>

export default meta
type Story = StoryObj<typeof meta>

// Documentation (store-dependent component)
export const Documentation: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 600px;">
        <h1 style="margin: 0 0 var(--space-6) 0; color: var(--text-primary); font-size: var(--text-2xl);">DailyChallengesPanel Component</h1>

        <div style="display: flex; flex-direction: column; gap: var(--space-6);">
          <div>
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--text-base);">Purpose</h3>
            <p style="margin: 0; color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.6;">
              Displays 3 daily missions with AI-powered generation. Shows challenge cards with progress, status, and optional ARIA messages.
            </p>
          </div>

          <div>
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--text-base);">Features</h3>
            <ul style="margin: 0; padding-left: var(--space-5); color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.8;">
              <li>Shows up to 3 active daily challenges</li>
              <li>AI-powered challenge generation button</li>
              <li>ARIA message with contextual status updates</li>
              <li>Completion counter (X/3)</li>
              <li>All complete state with celebration message</li>
              <li>Pick animation when challenge is selected</li>
              <li>Compact mode for reduced spacing</li>
              <li>Integration with AI router for gamemaster</li>
            </ul>
          </div>

          <div>
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--text-base);">Props</h3>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md); font-family: monospace; font-size: var(--text-xs); color: var(--text-tertiary);">
              <pre style="margin: 0;">compact?: boolean  // Compact display mode</pre>
            </div>
          </div>

          <div>
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--text-base);">Events</h3>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md); font-family: monospace; font-size: var(--text-xs); color: var(--text-tertiary);">
              <pre style="margin: 0;">@pickChallenge: (challenge: Challenge) => void</pre>
            </div>
          </div>

          <div>
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--text-base);">States</h3>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md);">
              <ul style="margin: 0; padding-left: var(--space-5); color: var(--text-tertiary); font-size: var(--text-sm); line-height: 1.8;">
                <li><strong>Active Challenges:</strong> Shows ChallengeCard components</li>
                <li><strong>All Complete:</strong> Celebration state with checkmark icon</li>
                <li><strong>Needs Generation:</strong> "Accept Missions" button</li>
                <li><strong>Generating:</strong> Loading spinner + ARIA analyzing message</li>
              </ul>
            </div>
          </div>

          <div style="padding: var(--space-4); background: rgba(var(--neon-cyan), 0.05); border-radius: var(--radius-md); border: 1px solid rgba(var(--neon-cyan), 0.15);">
            <h4 style="margin: 0 0 var(--space-2) 0; color: var(--text-primary); font-size: var(--text-sm); font-weight: 600;">Usage Example</h4>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md); font-family: monospace; font-size: var(--text-xs); color: var(--text-tertiary);">
              <pre style="margin: 0; white-space: pre-wrap;">&lt;DailyChallengesPanel
  :compact="true"
  @pick-challenge="handleChallengePick"
/&gt;</pre>
            </div>
          </div>

          <div style="padding: var(--space-4); background: rgba(var(--neon-magenta), 0.05); border-radius: var(--radius-md); border: 1px solid rgba(var(--neon-magenta), 0.15);">
            <p style="margin: 0; color: var(--text-tertiary); font-size: var(--text-xs); line-height: 1.6;">
              <strong style="color: var(--text-secondary);">Store Dependency:</strong> Reads from challengesStore (activeDailies, allDailiesComplete, isGenerating). Requires AI router for challenge generation.
            </p>
          </div>
        </div>
      </div>
    `,
  }),
}
