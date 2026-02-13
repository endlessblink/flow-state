import type { Meta, StoryObj } from '@storybook/vue3'
import BossFightPanel from '@/components/gamification/BossFightPanel.vue'

const meta = {
  component: BossFightPanel,
  title: '🎮 Gamification/BossFightPanel',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof BossFightPanel>

export default meta
type Story = StoryObj<typeof meta>

// Documentation (store-dependent component)
export const Documentation: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 600px;">
        <h1 style="margin: 0 0 var(--space-6) 0; color: var(--text-primary); font-size: var(--text-2xl);">BossFightPanel Component</h1>

        <div style="display: flex; flex-direction: column; gap: var(--space-6);">
          <div>
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--text-base);">Purpose</h3>
            <p style="margin: 0; color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.6;">
              Weekly boss fight display with HP bar, timer, and AI-powered generation. Boss challenges are high-stakes weekly missions with larger rewards.
            </p>
          </div>

          <div>
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--text-base);">Features</h3>
            <ul style="margin: 0; padding-left: var(--space-5); color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.8;">
              <li>Boss HP bar with color-coded states (red > orange > green)</li>
              <li>Damage dealt counter (progress × 10)</li>
              <li>Time remaining countdown</li>
              <li>Victory banner when defeated</li>
              <li>ARIA message with contextual feedback</li>
              <li>AI-powered boss generation (Mondays)</li>
              <li>Compact mode for reduced spacing</li>
              <li>Boss name with cyberpunk styling</li>
            </ul>
          </div>

          <div>
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--text-base);">Props</h3>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md); font-family: monospace; font-size: var(--text-xs); color: var(--text-tertiary);">
              <pre style="margin: 0;">compact?: boolean  // Compact display mode</pre>
            </div>
          </div>

          <div>
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--text-base);">Boss HP Calculation</h3>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md);">
              <ul style="margin: 0; padding-left: var(--space-5); color: var(--text-tertiary); font-size: var(--text-sm); line-height: 1.8;">
                <li><strong>Total HP:</strong> objectiveTarget × 10 (or from aiContext.total_hp)</li>
                <li><strong>Current HP:</strong> Total HP - (objectiveCurrent × 10)</li>
                <li><strong>Damage Dealt:</strong> objectiveCurrent × 10</li>
              </ul>
            </div>
          </div>

          <div>
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--text-base);">States</h3>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md);">
              <ul style="margin: 0; padding-left: var(--space-5); color: var(--text-tertiary); font-size: var(--text-sm); line-height: 1.8;">
                <li><strong>Active Boss:</strong> HP bar, damage stats, timer</li>
                <li><strong>Victory:</strong> Green banner with trophy icon</li>
                <li><strong>No Boss:</strong> ARIA message + optional generation button</li>
                <li><strong>Generating:</strong> Loading spinner + ARIA analyzing</li>
              </ul>
            </div>
          </div>

          <div>
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--text-base);">ARIA Messages</h3>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md);">
              <ul style="margin: 0; padding-left: var(--space-5); color: var(--text-tertiary); font-size: var(--text-sm); line-height: 1.8;">
                <li><strong>HP > 66%:</strong> "Engaging [BOSS]. Deal damage by completing tasks."</li>
                <li><strong>HP 50-66%:</strong> "Making progress. Keep the pressure on."</li>
                <li><strong>HP 25-50%:</strong> (same as above)</li>
                <li><strong>HP < 25%:</strong> "Critical damage! The boss is weakened. Finish it!"</li>
                <li><strong>Defeated:</strong> "Victory! The threat has been neutralized."</li>
              </ul>
            </div>
          </div>

          <div style="padding: var(--space-4); background: rgba(var(--neon-cyan), 0.05); border-radius: var(--radius-md); border: 1px solid rgba(var(--neon-cyan), 0.15);">
            <h4 style="margin: 0 0 var(--space-2) 0; color: var(--text-primary); font-size: var(--text-sm); font-weight: 600;">Usage Example</h4>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md); font-family: monospace; font-size: var(--text-xs); color: var(--text-tertiary);">
              <pre style="margin: 0; white-space: pre-wrap;">&lt;BossFightPanel :compact="false" /&gt;</pre>
            </div>
          </div>

          <div style="padding: var(--space-4); background: rgba(var(--neon-magenta), 0.05); border-radius: var(--radius-md); border: 1px solid rgba(var(--neon-magenta), 0.15);">
            <p style="margin: 0; color: var(--text-tertiary); font-size: var(--text-xs); line-height: 1.6;">
              <strong style="color: var(--text-secondary);">Store Dependency:</strong> Reads from challengesStore (activeBoss, isGenerating). Requires AI router for boss generation. Boss spawns on Mondays.
            </p>
          </div>
        </div>
      </div>
    `,
  }),
}
