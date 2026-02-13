import type { Meta, StoryObj } from '@storybook/vue3'
import AchievementToast from '@/components/gamification/AchievementToast.vue'
import type { GamificationToast } from '@/types/gamification'

const meta = {
  component: AchievementToast,
  title: '🎮 Gamification/AchievementToast',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof AchievementToast>

export default meta
type Story = StoryObj<typeof meta>

const mockToastXp: GamificationToast = {
  id: '1',
  type: 'xp',
  title: 'Task Complete',
  description: 'Morning planning',
  xpAmount: 25,
  duration: 3000,
}

const mockToastLevelUp: GamificationToast = {
  id: '2',
  type: 'level_up',
  title: 'Level Up!',
  description: 'You are now level 6',
  xpAmount: 100,
  duration: 4000,
}

const mockToastAchievement: GamificationToast = {
  id: '3',
  type: 'achievement',
  title: 'Task Master',
  description: 'Complete 100 tasks',
  tier: 'silver',
  xpAmount: 150,
  duration: 5000,
}

const mockToastStreak: GamificationToast = {
  id: '4',
  type: 'streak',
  title: '7-Day Streak!',
  description: 'Keep it up!',
  xpAmount: 50,
  duration: 3000,
}

const mockToastPurchase: GamificationToast = {
  id: '5',
  type: 'purchase',
  title: 'Theme Purchased',
  description: 'Cyberpunk Neon',
  duration: 3000,
}

const mockToastShielded: GamificationToast = {
  id: '6',
  type: 'exposure',
  title: 'SHIELDED',
  description: 'Timer bonus protected your streak',
  duration: 3000,
}

const mockToastExposed: GamificationToast = {
  id: '7',
  type: 'exposure',
  title: 'EXPOSED',
  description: 'No timer bonus today',
  duration: 3000,
}

// XP Toast
export const XpToast: Story = {
  args: {
    toast: mockToastXp,
  },
  render: (args) => ({
    components: { AchievementToast },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <AchievementToast v-bind="args" @dismiss="() => {}" />
      </div>
    `,
  }),
}

// Level Up Toast
export const LevelUpToast: Story = {
  args: {
    toast: mockToastLevelUp,
  },
  render: (args) => ({
    components: { AchievementToast },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <AchievementToast v-bind="args" @dismiss="() => {}" />
      </div>
    `,
  }),
}

// Achievement Toast (Bronze)
export const AchievementToastBronze: Story = {
  args: {
    toast: { ...mockToastAchievement, tier: 'bronze' },
  },
  render: (args) => ({
    components: { AchievementToast },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <AchievementToast v-bind="args" @dismiss="() => {}" />
      </div>
    `,
  }),
}

// Achievement Toast (Silver)
export const AchievementToastSilver: Story = {
  args: {
    toast: { ...mockToastAchievement, tier: 'silver' },
  },
  render: (args) => ({
    components: { AchievementToast },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <AchievementToast v-bind="args" @dismiss="() => {}" />
      </div>
    `,
  }),
}

// Achievement Toast (Gold)
export const AchievementToastGold: Story = {
  args: {
    toast: { ...mockToastAchievement, tier: 'gold' },
  },
  render: (args) => ({
    components: { AchievementToast },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <AchievementToast v-bind="args" @dismiss="() => {}" />
      </div>
    `,
  }),
}

// Achievement Toast (Platinum)
export const AchievementToastPlatinum: Story = {
  args: {
    toast: { ...mockToastAchievement, tier: 'platinum' },
  },
  render: (args) => ({
    components: { AchievementToast },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <AchievementToast v-bind="args" @dismiss="() => {}" />
      </div>
    `,
  }),
}

// Streak Toast
export const StreakToast: Story = {
  args: {
    toast: mockToastStreak,
  },
  render: (args) => ({
    components: { AchievementToast },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <AchievementToast v-bind="args" @dismiss="() => {}" />
      </div>
    `,
  }),
}

// Shielded Toast
export const ShieldedToast: Story = {
  args: {
    toast: mockToastShielded,
  },
  render: (args) => ({
    components: { AchievementToast },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <AchievementToast v-bind="args" @dismiss="() => {}" />
      </div>
    `,
  }),
}

// Exposed Toast
export const ExposedToast: Story = {
  args: {
    toast: mockToastExposed,
  },
  render: (args) => ({
    components: { AchievementToast },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <AchievementToast v-bind="args" @dismiss="() => {}" />
      </div>
    `,
  }),
}

// All Types
export const AllTypes: Story = {
  render: () => ({
    components: { AchievementToast },
    setup() {
      return { mockToastXp, mockToastLevelUp, mockToastAchievement, mockToastStreak, mockToastShielded }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <h3 style="margin: 0 0 var(--space-4) 0; color: var(--text-primary); font-size: var(--text-base);">Toast Notification Types</h3>
        <div style="display: flex; flex-direction: column; gap: var(--space-3);">
          <AchievementToast :toast="mockToastXp" @dismiss="() => {}" />
          <AchievementToast :toast="mockToastLevelUp" @dismiss="() => {}" />
          <AchievementToast :toast="mockToastAchievement" @dismiss="() => {}" />
          <AchievementToast :toast="mockToastStreak" @dismiss="() => {}" />
          <AchievementToast :toast="mockToastShielded" @dismiss="() => {}" />
        </div>
      </div>
    `,
  }),
}
