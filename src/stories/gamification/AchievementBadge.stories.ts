import type { Meta, StoryObj } from '@storybook/vue3'
import AchievementBadge from '@/components/gamification/AchievementBadge.vue'
import type { AchievementWithProgress } from '@/types/gamification'

const meta = {
  component: AchievementBadge,
  title: '🎮 Gamification/AchievementBadge',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof AchievementBadge>

export default meta
type Story = StoryObj<typeof meta>

const mockAchievementBronze: AchievementWithProgress = {
  id: 'first_task',
  name: 'First Steps',
  description: 'Complete your first task',
  icon: 'target',
  tier: 'bronze',
  category: 'productivity',
  conditionType: 'complete_tasks',
  conditionValue: 1,
  xpReward: 50,
  isSecret: false,
  isEarned: false,
  progress: 0,
  earnedAt: null,
}

const mockAchievementSilver: AchievementWithProgress = {
  id: 'task_master',
  name: 'Task Master',
  description: 'Complete 100 tasks',
  icon: 'trophy',
  tier: 'silver',
  category: 'productivity',
  conditionType: 'complete_tasks',
  conditionValue: 100,
  xpReward: 150,
  isSecret: false,
  isEarned: false,
  progress: 45,
  earnedAt: null,
}

const mockAchievementGold: AchievementWithProgress = {
  id: 'focus_champion',
  name: 'Focus Champion',
  description: 'Complete 1000 Pomodoro sessions',
  icon: 'flame',
  tier: 'gold',
  category: 'consistency',
  conditionType: 'complete_pomodoros',
  conditionValue: 1000,
  xpReward: 300,
  isSecret: false,
  isEarned: true,
  progress: 1000,
  earnedAt: new Date(),
}

const mockAchievementPlatinum: AchievementWithProgress = {
  id: 'legend',
  name: 'Legendary',
  description: 'Maintain a 365-day streak',
  icon: 'crown',
  tier: 'platinum',
  category: 'mastery',
  conditionType: 'maintain_streak',
  conditionValue: 365,
  xpReward: 500,
  isSecret: false,
  isEarned: true,
  progress: 365,
  earnedAt: new Date(),
}

const mockAchievementSecret: AchievementWithProgress = {
  id: 'secret',
  name: 'Secret Achievement',
  description: 'Find the hidden feature',
  icon: 'star',
  tier: 'platinum',
  category: 'secret',
  conditionType: 'custom',
  conditionValue: 1,
  xpReward: 500,
  isSecret: true,
  isEarned: false,
  progress: 0,
  earnedAt: null,
}

// Default - Bronze Locked
export const BronzeLocked: Story = {
  args: {
    achievement: mockAchievementBronze,
    size: 'md',
    showProgress: true,
    showDescription: true,
  },
  render: (args) => ({
    components: { AchievementBadge },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 350px;">
        <AchievementBadge v-bind="args" />
      </div>
    `,
  }),
}

// Silver In Progress
export const SilverInProgress: Story = {
  args: {
    achievement: mockAchievementSilver,
    size: 'md',
    showProgress: true,
    showDescription: true,
  },
  render: (args) => ({
    components: { AchievementBadge },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 350px;">
        <AchievementBadge v-bind="args" />
      </div>
    `,
  }),
}

// Gold Earned
export const GoldEarned: Story = {
  args: {
    achievement: mockAchievementGold,
    size: 'md',
    showProgress: true,
    showDescription: true,
  },
  render: (args) => ({
    components: { AchievementBadge },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 350px;">
        <AchievementBadge v-bind="args" />
      </div>
    `,
  }),
}

// Platinum Earned
export const PlatinumEarned: Story = {
  args: {
    achievement: mockAchievementPlatinum,
    size: 'md',
    showProgress: true,
    showDescription: true,
  },
  render: (args) => ({
    components: { AchievementBadge },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 350px;">
        <AchievementBadge v-bind="args" />
      </div>
    `,
  }),
}

// Secret Locked
export const SecretLocked: Story = {
  args: {
    achievement: mockAchievementSecret,
    size: 'md',
    showProgress: true,
    showDescription: true,
  },
  render: (args) => ({
    components: { AchievementBadge },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 350px;">
        <AchievementBadge v-bind="args" />
      </div>
    `,
  }),
}

// All Tiers
export const AllTiers: Story = {
  render: () => ({
    components: { AchievementBadge },
    setup() {
      return { mockAchievementBronze, mockAchievementSilver, mockAchievementGold, mockAchievementPlatinum }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 400px;">
        <h3 style="margin: 0 0 var(--space-4) 0; color: var(--text-primary); font-size: var(--text-base);">Achievement Tiers</h3>
        <div style="display: flex; flex-direction: column; gap: var(--space-3);">
          <AchievementBadge :achievement="mockAchievementBronze" size="md" :show-progress="true" :show-description="true" />
          <AchievementBadge :achievement="mockAchievementSilver" size="md" :show-progress="true" :show-description="true" />
          <AchievementBadge :achievement="mockAchievementGold" size="md" :show-progress="true" :show-description="true" />
          <AchievementBadge :achievement="mockAchievementPlatinum" size="md" :show-progress="true" :show-description="true" />
        </div>
      </div>
    `,
  }),
}

// Small Size
export const SmallSize: Story = {
  args: {
    achievement: mockAchievementGold,
    size: 'sm',
    showProgress: false,
    showDescription: false,
  },
  render: (args) => ({
    components: { AchievementBadge },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-8); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <AchievementBadge v-bind="args" />
      </div>
    `,
  }),
}
