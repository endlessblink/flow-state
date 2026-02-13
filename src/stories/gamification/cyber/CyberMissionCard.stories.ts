import type { Meta, StoryObj } from '@storybook/vue3'
import CyberMissionCard from '@/components/gamification/cyber/CyberMissionCard.vue'
import type { Challenge } from '@/types/challenges'

const meta = {
  title: '🎮 Gamification/Cyber/CyberMissionCard',
  component: CyberMissionCard,
  tags: ['autodocs', 'new'],
  argTypes: {
    isActive: {
      control: 'boolean',
      description: 'Whether this mission is currently active',
    },
  },
} satisfies Meta<typeof CyberMissionCard>

export default meta
type Story = StoryObj<typeof meta>

const createMockChallenge = (overrides?: Partial<Challenge>): Challenge => ({
  id: 'mock-challenge',
  userId: 'user',
  challengeType: 'daily',
  difficulty: 'normal',
  title: 'Daily Focus',
  description: 'Complete tasks to earn XP',
  objectiveType: 'complete_tasks',
  objectiveCurrent: 3,
  objectiveTarget: 10,
  objectiveContext: null,
  rewardXp: 150,
  status: 'active',
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  completedAt: null,
  ...overrides,
})

export const Default: Story = {
  args: {
    challenge: createMockChallenge(),
    isActive: false,
  },
  render: (args) => ({
    components: { CyberMissionCard },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-6); background: var(--cf-dark-1, #0a0a0f);">
        <CyberMissionCard v-bind="args" />
      </div>
    `,
  }),
}

export const Active: Story = {
  args: {
    challenge: createMockChallenge({
      objectiveCurrent: 7,
    }),
    isActive: true,
  },
  render: (args) => ({
    components: { CyberMissionCard },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-6); background: var(--cf-dark-1, #0a0a0f);">
        <CyberMissionCard v-bind="args" />
      </div>
    `,
  }),
}

export const HighProgress: Story = {
  args: {
    challenge: createMockChallenge({
      objectiveCurrent: 9,
      objectiveTarget: 10,
    }),
    isActive: false,
  },
  render: (args) => ({
    components: { CyberMissionCard },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-6); background: var(--cf-dark-1, #0a0a0f);">
        <CyberMissionCard v-bind="args" />
      </div>
    `,
  }),
}

export const Completed: Story = {
  args: {
    challenge: createMockChallenge({
      objectiveCurrent: 10,
      objectiveTarget: 10,
      status: 'completed',
      completedAt: new Date(),
    }),
    isActive: false,
  },
  render: (args) => ({
    components: { CyberMissionCard },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-6); background: var(--cf-dark-1, #0a0a0f);">
        <CyberMissionCard v-bind="args" />
      </div>
    `,
  }),
}

export const BossMission: Story = {
  args: {
    challenge: createMockChallenge({
      difficulty: 'boss',
      title: 'ELITE THREAT',
      rewardXp: 500,
      objectiveTarget: 25,
      objectiveCurrent: 8,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }),
    isActive: false,
  },
  render: (args) => ({
    components: { CyberMissionCard },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-6); background: var(--cf-dark-1, #0a0a0f);">
        <CyberMissionCard v-bind="args" />
      </div>
    `,
  }),
}

export const VariousDifficulties: Story = {
  render: () => ({
    components: { CyberMissionCard },
    setup() {
      const easy = createMockChallenge({
        difficulty: 'easy',
        title: 'Quick Win',
        objectiveTarget: 5,
        objectiveCurrent: 2,
        rewardXp: 50,
      })
      const normal = createMockChallenge({
        difficulty: 'normal',
        title: 'Daily Grind',
        objectiveTarget: 10,
        objectiveCurrent: 5,
        rewardXp: 150,
      })
      const hard = createMockChallenge({
        difficulty: 'hard',
        title: 'Challenge Mode',
        objectiveTarget: 20,
        objectiveCurrent: 8,
        rewardXp: 300,
      })
      return { easy, normal, hard }
    },
    template: `
      <div style="padding: var(--space-6); background: var(--cf-dark-1, #0a0a0f); display: flex; flex-direction: column; gap: var(--space-3);">
        <CyberMissionCard :challenge="easy" :isActive="false" />
        <CyberMissionCard :challenge="normal" :isActive="true" />
        <CyberMissionCard :challenge="hard" :isActive="false" />
      </div>
    `,
  }),
}
