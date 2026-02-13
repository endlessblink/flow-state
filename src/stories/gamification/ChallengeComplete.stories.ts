import type { Meta, StoryObj } from '@storybook/vue3'
import ChallengeComplete from '@/components/gamification/ChallengeComplete.vue'
import type { Challenge } from '@/types/challenges'

const meta = {
  component: ChallengeComplete,
  title: '🎮 Gamification/ChallengeComplete',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ChallengeComplete>

export default meta
type Story = StoryObj<typeof meta>

const mockChallenge: Challenge = {
  id: 'daily-1',
  type: 'daily',
  status: 'completed',
  title: 'Morning Sprint',
  description: 'Complete 5 tasks before noon.',
  objectiveType: 'complete_before_hour',
  objectiveTarget: 5,
  objectiveCurrent: 5,
  objectiveContext: { hour: 12 },
  difficulty: 'normal',
  rewardXp: 50,
  penaltyXp: 10,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString(),
  narrativeFlavor: 'The Grid needs swift action. Can you deliver?',
}

const mockBossChallenge: Challenge = {
  ...mockChallenge,
  id: 'boss-1',
  type: 'weekly_boss',
  title: 'CORRUPTED_TASKMASTER.EXE',
  description: 'Defeat the major threat in the Grid.',
  objectiveTarget: 50,
  objectiveCurrent: 50,
  rewardXp: 500,
  difficulty: 'boss',
  narrativeFlavor: 'The entity has been purged. Grid stability restored.',
}

// Default - Daily Challenge
export const DailyComplete: Story = {
  args: {
    challenge: mockChallenge,
    xpAwarded: 50,
    corruptionReduction: 5,
    narrative: 'Excellent work, netrunner. The Grid thanks you.',
  },
  render: (args) => ({
    components: { ChallengeComplete },
    setup() {
      return { args }
    },
    template: `
      <div style="min-height: 100vh; background: var(--app-background-gradient);">
        <ChallengeComplete v-bind="args" @close="() => console.log('Close clicked')" />
      </div>
    `,
  }),
}

// Boss Challenge Complete
export const BossComplete: Story = {
  args: {
    challenge: mockBossChallenge,
    xpAwarded: 500,
    corruptionReduction: 25,
    narrative: 'The corrupted entity has been neutralized. Grid stability restored. Outstanding performance.',
  },
  render: (args) => ({
    components: { ChallengeComplete },
    setup() {
      return { args }
    },
    template: `
      <div style="min-height: 100vh; background: var(--app-background-gradient);">
        <ChallengeComplete v-bind="args" @close="() => console.log('Close clicked')" />
      </div>
    `,
  }),
}

// Without Narrative
export const WithoutNarrative: Story = {
  args: {
    challenge: mockChallenge,
    xpAwarded: 50,
    corruptionReduction: 5,
  },
  render: (args) => ({
    components: { ChallengeComplete },
    setup() {
      return { args }
    },
    template: `
      <div style="min-height: 100vh; background: var(--app-background-gradient);">
        <ChallengeComplete v-bind="args" @close="() => {}" />
      </div>
    `,
  }),
}

// High Rewards
export const HighRewards: Story = {
  args: {
    challenge: { ...mockChallenge, title: 'Ultimate Challenge', rewardXp: 1000 },
    xpAwarded: 1000,
    corruptionReduction: 50,
    narrative: 'Legendary performance! The Grid has never seen such skill.',
  },
  render: (args) => ({
    components: { ChallengeComplete },
    setup() {
      return { args }
    },
    template: `
      <div style="min-height: 100vh; background: var(--app-background-gradient);">
        <ChallengeComplete v-bind="args" @close="() => {}" />
      </div>
    `,
  }),
}

// Usage Documentation
export const UsageDocumentation: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-10); background: var(--app-background-gradient); min-height: 100vh;">
        <h1 style="margin: 0 0 var(--space-6) 0; color: var(--text-primary); font-size: var(--text-3xl);">ChallengeComplete Component</h1>

        <div style="display: flex; flex-direction: column; gap: var(--space-6); max-width: 800px;">
          <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary);">Purpose</h3>
            <p style="margin: 0; color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.6;">
              Victory animation + rewards toast displayed when a challenge is completed. Shows XP awarded, corruption reduction, and optional ARIA narrative.
            </p>
          </div>

          <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary);">Features</h3>
            <ul style="margin: 0; padding-left: var(--space-5); color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.8;">
              <li>Fullscreen overlay with entrance/exit animations</li>
              <li>Trophy icon with bounce animation</li>
              <li>Decorative sparkles that float</li>
              <li>XP and corruption reduction display</li>
              <li>Optional ARIA narrative message</li>
              <li>Auto-closes after 5 seconds</li>
              <li>Manual close via Continue button</li>
            </ul>
          </div>

          <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary);">Props</h3>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md); font-family: monospace; font-size: var(--text-xs); color: var(--text-tertiary);">
              <pre style="margin: 0; white-space: pre-wrap;">challenge: Challenge      // Completed challenge object
xpAwarded: number        // XP amount awarded
corruptionReduction: number  // Corruption % reduced
narrative?: string       // Optional ARIA message</pre>
            </div>
          </div>

          <div style="padding: var(--space-6); background: rgba(var(--neon-cyan), 0.05); border-radius: var(--radius-lg); border: 1px solid rgba(var(--neon-cyan), 0.15);">
            <h4 style="margin: 0 0 var(--space-2) 0; color: var(--text-primary); font-size: var(--text-sm); font-weight: 600;">Usage Example</h4>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md); font-family: monospace; font-size: var(--text-xs); color: var(--text-tertiary);">
              <pre style="margin: 0; white-space: pre-wrap;">&lt;ChallengeComplete
  :challenge="completedChallenge"
  :xp-awarded="50"
  :corruption-reduction="5"
  narrative="Excellent work, netrunner!"
  @close="handleClose"
/&gt;</pre>
            </div>
          </div>

          <div style="padding: var(--space-6); background: rgba(var(--neon-magenta), 0.05); border-radius: var(--radius-lg); border: 1px solid rgba(var(--neon-magenta), 0.15);">
            <p style="margin: 0; color: var(--text-tertiary); font-size: var(--text-xs); line-height: 1.6;">
              <strong style="color: var(--text-secondary);">Animation Details:</strong> The component uses a two-stage entrance: overlay fades in, then card scales up with a staggered sparkle animation. Trophy icon has a perpetual bounce, and the card pulses with a success glow.
            </p>
          </div>
        </div>
      </div>
    `,
  }),
}
