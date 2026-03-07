import type { Meta, StoryObj } from '@storybook/vue3'

const S = {
  bar: 'display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); backdrop-filter: blur(12px); width: 400px;',
  badge: 'display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: linear-gradient(135deg, var(--brand-primary), rgba(78, 205, 196, 0.5)); border-radius: 50%; font-size: 0.7rem; font-weight: 700; color: var(--text-primary);',
  xpWrap: 'flex: 1; min-width: 0;',
  xpLabel: 'display: flex; justify-content: space-between; font-size: 0.65rem; color: var(--text-muted); margin-bottom: var(--space-1);',
  xpTrack: 'height: 6px; background: var(--glass-border); border-radius: 3px; overflow: hidden;',
  xpFill: 'height: 100%; background: var(--brand-primary); border-radius: 3px; transition: width 0.5s ease;',
  streak: 'display: flex; align-items: center; gap: var(--space-1); font-size: 0.75rem; color: var(--text-secondary); white-space: nowrap;',
  streakIcon: 'color: var(--color-warning);',
}

const meta: Meta = {
  title: '☀️ Morning Dashboard/MorningScore',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Compact gamification score bar showing LevelBadge, XpBar, and StreakCounter in a single row.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <div style="${S.bar}">
          <div style="${S.badge}">7</div>
          <div style="${S.xpWrap}">
            <div style="${S.xpLabel}">
              <span>450 / 800 XP</span>
              <span>Level 7</span>
            </div>
            <div style="${S.xpTrack}">
              <div style="${S.xpFill} width: 56%;" />
            </div>
          </div>
          <div style="${S.streak}">
            <span style="${S.streakIcon}">🔥</span>
            <span>12</span>
          </div>
        </div>
      </div>
    `,
  }),
}

export const HighLevel: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <div style="${S.bar}">
          <div style="${S.badge}">25</div>
          <div style="${S.xpWrap}">
            <div style="${S.xpLabel}">
              <span>1,890 / 2,000 XP</span>
              <span>Level 25</span>
            </div>
            <div style="${S.xpTrack}">
              <div style="${S.xpFill} width: 95%;" />
            </div>
          </div>
          <div style="${S.streak}">
            <span style="${S.streakIcon}">🔥</span>
            <span>45</span>
          </div>
        </div>
      </div>
    `,
  }),
}
