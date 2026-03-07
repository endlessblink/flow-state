import type { Meta, StoryObj } from '@storybook/vue3'
import { Target } from 'lucide-vue-next'

const S = {
  card: 'display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-4); background: var(--surface-primary); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); width: 360px;',
  header: 'display: flex; align-items: center; gap: var(--space-2);',
  icon: 'color: var(--brand-primary); flex-shrink: 0;',
  title: 'font-size: 0.9375rem; font-weight: 600; color: var(--text-primary); margin: 0;',
  challenge: 'display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-md);',
  challengeIcon: 'font-size: 1.2rem; flex-shrink: 0;',
  challengeInfo: 'flex: 1; display: flex; flex-direction: column; gap: var(--space-0_5);',
  challengeName: 'font-size: 0.8rem; font-weight: 500; color: var(--text-primary);',
  challengeProgress: 'font-size: 0.7rem; color: var(--text-muted);',
  progressBar: 'height: 4px; background: var(--glass-border); border-radius: 2px; overflow: hidden; margin-top: var(--space-1);',
  progressFill: 'height: 100%; background: var(--brand-primary); border-radius: 2px;',
  xpBadge: 'font-size: 0.65rem; color: var(--brand-primary); background: rgba(78, 205, 196, 0.1); padding: var(--space-0_5) var(--space-1_5); border-radius: var(--radius-sm); font-weight: 600; white-space: nowrap;',
  empty: 'display: flex; align-items: center; justify-content: center; padding: var(--space-4); font-size: 0.8rem; color: var(--text-muted);',
}

const meta: Meta = {
  title: '☀️ Morning Dashboard/MorningMissions',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Daily missions card showing active challenges from the gamification system with progress indicators.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const WithChallenges: Story = {
  render: () => ({
    components: { Target },
    template: `
      <div style="${S.card}">
        <div style="${S.header}">
          <Target :size="16" style="${S.icon}" />
          <h2 style="${S.title}">Daily Missions</h2>
        </div>

        <div style="${S.challenge}">
          <span style="${S.challengeIcon}">🎯</span>
          <div style="${S.challengeInfo}">
            <span style="${S.challengeName}">Complete 5 tasks</span>
            <span style="${S.challengeProgress}">3 / 5 completed</span>
            <div style="${S.progressBar}"><div style="${S.progressFill} width: 60%;" /></div>
          </div>
          <span style="${S.xpBadge}">+50 XP</span>
        </div>

        <div style="${S.challenge}">
          <span style="${S.challengeIcon}">⚡</span>
          <div style="${S.challengeInfo}">
            <span style="${S.challengeName}">Focus for 2 hours</span>
            <span style="${S.challengeProgress}">1.5 / 2.0 hrs</span>
            <div style="${S.progressBar}"><div style="${S.progressFill} width: 75%;" /></div>
          </div>
          <span style="${S.xpBadge}">+75 XP</span>
        </div>
      </div>
    `,
  }),
}

export const Empty: Story = {
  render: () => ({
    components: { Target },
    template: `
      <div style="${S.card}">
        <div style="${S.header}">
          <Target :size="16" style="${S.icon}" />
          <h2 style="${S.title}">Daily Missions</h2>
        </div>
        <div style="${S.empty}">No missions today</div>
      </div>
    `,
  }),
}
