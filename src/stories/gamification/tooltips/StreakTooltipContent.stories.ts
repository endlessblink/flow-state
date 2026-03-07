import type { Meta, StoryObj } from '@storybook/vue3'

const S = {
  tooltip: 'display: flex; flex-direction: column; gap: var(--space-2); min-width: 200px; background: var(--cf-dark-2, #111118); padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid rgba(255,107,53,0.2);',
  title: 'font-weight: 700; font-size: var(--text-sm); text-transform: uppercase; letter-spacing: 0.05em;',
  statRow: 'display: flex; justify-content: space-between; font-size: var(--text-xs);',
  statLabel: 'color: var(--text-muted, #666);',
  statValue: 'color: var(--text-secondary, #a0a0b0);',
  today: 'display: flex; justify-content: space-between; align-items: center; font-size: var(--text-xs); padding-top: var(--space-1); border-top: 1px solid rgba(255,255,255,0.06);',
  todayLabel: 'color: var(--text-muted, #666);',
  freezeRow: 'display: flex; justify-content: space-between; font-size: var(--text-xs);',
  narrative: 'font-size: var(--text-xs); color: rgba(0,240,255,0.6); font-style: italic; padding-top: var(--space-1); border-top: 1px solid rgba(255,255,255,0.06);',
}

const meta: Meta = {
  title: '🎮 Gamification/Tooltips/StreakTooltipContent',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Rich tooltip for StreakCounter showing streak length, personal record, today\'s status (active/at-risk/neutral), freeze count, and narrative.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const ActiveStreak: Story = {
  render: () => ({
    template: `
      <div style="${S.tooltip}">
        <div style="${S.title} color: #ff6b35;">STREAK: 14 days</div>
        <div style="${S.statRow}"><span style="${S.statLabel}">Record:</span><span style="${S.statValue}">21 days</span></div>
        <div style="${S.today}">
          <span style="${S.todayLabel}">Today:</span>
          <span style="font-weight: 600; color: #a3e635;">ACTIVE</span>
        </div>
        <div style="${S.freezeRow}"><span style="${S.statLabel}">Freezes:</span><span style="color: rgba(0,240,255,0.8);">2 remaining</span></div>
        <div style="${S.narrative}">"Your consistency burns bright, operative."</div>
      </div>
    `,
  }),
}

export const AtRisk: Story = {
  render: () => ({
    template: `
      <div style="${S.tooltip}">
        <div style="${S.title} color: #ff6b35;">STREAK: 7 days</div>
        <div style="${S.statRow}"><span style="${S.statLabel}">Record:</span><span style="${S.statValue}">21 days</span></div>
        <div style="${S.today}">
          <span style="${S.todayLabel}">Today:</span>
          <span style="font-weight: 600; color: #fbbf24;">Complete a task to continue</span>
        </div>
        <div style="${S.narrative}">"Warning: streak integrity failing. Act now."</div>
      </div>
    `,
  }),
}
