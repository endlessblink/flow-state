import type { Meta, StoryObj } from '@storybook/vue3'
import ChallengeCard from '@/components/gamification/ChallengeCard.vue'
import type { Challenge } from '@/types/challenges'

const meta = {
  component: ChallengeCard,
  title: '🎮 Gamification/ChallengeCard',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    compact: {
      control: 'boolean',
      description: 'Compact display mode',
    },
  },
} satisfies Meta<typeof ChallengeCard>

export default meta
type Story = StoryObj<typeof meta>

const mockDailyActive: Challenge = {
  id: 'daily-1',
  type: 'daily',
  status: 'active',
  title: 'Morning Sprint',
  description: 'Complete 5 tasks before noon to prove your focus.',
  objectiveType: 'complete_before_hour',
  objectiveTarget: 5,
  objectiveCurrent: 2,
  objectiveContext: { hour: 12 },
  difficulty: 'normal',
  rewardXp: 50,
  penaltyXp: 10,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString(), // 8 hours from now
  narrativeFlavor: 'The Grid needs swift action. Can you deliver?',
}

const mockDailyNearlyComplete: Challenge = {
  ...mockDailyActive,
  id: 'daily-2',
  title: 'Pomodoro Master',
  description: 'Complete 8 Pomodoro sessions today.',
  objectiveType: 'complete_pomodoros',
  objectiveTarget: 8,
  objectiveCurrent: 7,
  rewardXp: 75,
  difficulty: 'hard',
}

const mockDailyCompleted: Challenge = {
  ...mockDailyActive,
  id: 'daily-3',
  status: 'completed',
  title: 'Task Crusher',
  description: 'Complete 3 high-priority tasks.',
  objectiveType: 'complete_high_priority',
  objectiveTarget: 3,
  objectiveCurrent: 3,
  rewardXp: 60,
  difficulty: 'easy',
}

const mockDailyFailed: Challenge = {
  ...mockDailyActive,
  id: 'daily-4',
  status: 'failed',
  title: 'Overdue Cleanup',
  description: 'Clear all overdue tasks.',
  objectiveType: 'clear_overdue',
  objectiveTarget: 5,
  objectiveCurrent: 2,
  expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
}

const mockBossActive: Challenge = {
  ...mockDailyActive,
  id: 'boss-1',
  type: 'weekly_boss',
  status: 'active',
  title: 'CORRUPTED_TASKMASTER.EXE',
  description: 'A major threat has emerged in the Grid. Defeat it by completing tasks.',
  objectiveType: 'complete_tasks',
  objectiveTarget: 50,
  objectiveCurrent: 23,
  rewardXp: 500,
  penaltyXp: 100,
  difficulty: 'boss',
  expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days
  narrativeFlavor: 'This entity feeds on unfinished work. Starve it by completing your tasks.',
  aiContext: { total_hp: 500 },
}

// Active Challenge
export const ActiveChallenge: Story = {
  args: {
    challenge: mockDailyActive,
    compact: false,
  },
  render: (args) => ({
    components: { ChallengeCard },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 450px;">
        <ChallengeCard v-bind="args" @click="() => console.log('Challenge clicked')" />
      </div>
    `,
  }),
}

// Nearly Complete
export const NearlyComplete: Story = {
  args: {
    challenge: mockDailyNearlyComplete,
    compact: false,
  },
  render: (args) => ({
    components: { ChallengeCard },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 450px;">
        <ChallengeCard v-bind="args" @click="() => {}" />
      </div>
    `,
  }),
}

// Completed
export const Completed: Story = {
  args: {
    challenge: mockDailyCompleted,
    compact: false,
  },
  render: (args) => ({
    components: { ChallengeCard },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 450px;">
        <ChallengeCard v-bind="args" @click="() => {}" />
      </div>
    `,
  }),
}

// Failed
export const Failed: Story = {
  args: {
    challenge: mockDailyFailed,
    compact: false,
  },
  render: (args) => ({
    components: { ChallengeCard },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 450px;">
        <ChallengeCard v-bind="args" @click="() => {}" />
      </div>
    `,
  }),
}

// Boss Challenge
export const BossChallenge: Story = {
  args: {
    challenge: mockBossActive,
    compact: false,
  },
  render: (args) => ({
    components: { ChallengeCard },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 450px;">
        <ChallengeCard v-bind="args" @click="() => {}" />
      </div>
    `,
  }),
}

// Compact Mode
export const CompactMode: Story = {
  args: {
    challenge: mockDailyActive,
    compact: true,
  },
  render: (args) => ({
    components: { ChallengeCard },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-8); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 400px;">
        <ChallengeCard v-bind="args" @click="() => {}" />
      </div>
    `,
  }),
}

// All States
export const AllStates: Story = {
  render: () => ({
    components: { ChallengeCard },
    setup() {
      return { mockDailyActive, mockDailyNearlyComplete, mockDailyCompleted, mockDailyFailed }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 500px;">
        <h3 style="margin: 0 0 var(--space-4) 0; color: var(--text-primary); font-size: var(--text-base);">Challenge Card States</h3>
        <div style="display: flex; flex-direction: column; gap: var(--space-3);">
          <ChallengeCard :challenge="mockDailyActive" @click="() => {}" />
          <ChallengeCard :challenge="mockDailyNearlyComplete" @click="() => {}" />
          <ChallengeCard :challenge="mockDailyCompleted" @click="() => {}" />
          <ChallengeCard :challenge="mockDailyFailed" @click="() => {}" />
        </div>
      </div>
    `,
  }),
}
