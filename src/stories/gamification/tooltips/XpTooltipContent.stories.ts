import type { Meta, StoryObj } from '@storybook/vue3'

const S = {
  tooltip: 'display: flex; flex-direction: column; gap: var(--space-2); min-width: 200px; background: var(--cf-dark-2, #111118); padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid rgba(0,240,255,0.2);',
  title: 'font-weight: 700; color: #00f0ff; font-size: var(--text-sm); text-transform: uppercase; letter-spacing: 0.05em;',
  statRow: 'display: flex; justify-content: space-between; gap: var(--space-2); font-size: var(--text-xs);',
  statLabel: 'color: var(--text-muted, #666);',
  statValue: 'color: var(--text-secondary, #a0a0b0);',
  statHint: 'color: var(--text-muted, #666);',
  bonuses: 'display: flex; flex-direction: column; gap: 4px; padding-top: var(--space-1); border-top: 1px solid rgba(255,255,255,0.06);',
  bonusRow: 'display: flex; justify-content: space-between; align-items: center; font-size: var(--text-xs); color: var(--text-secondary, #a0a0b0);',
  bonusTag: 'font-size: 10px; font-weight: 700; padding: 1px 4px; border-radius: var(--radius-sm); text-transform: uppercase; letter-spacing: 0.05em;',
  narrative: 'font-size: var(--text-xs); color: rgba(0,240,255,0.6); font-style: italic; padding-top: var(--space-1); border-top: 1px solid rgba(255,255,255,0.06);',
}

const meta: Meta = {
  title: '🎮 Gamification/Tooltips/XpTooltipContent',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Rich tooltip for XpBar showing current/available XP, active multiplier badge, timer shield bonus, and narrative text.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    template: `
      <div style="${S.tooltip}">
        <div style="${S.title}">XP PROGRESS</div>
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <div style="${S.statRow}"><span style="${S.statLabel}">Current:</span><span style="${S.statValue}">3,250 / 5,000 XP</span></div>
          <div style="${S.statRow}"><span style="${S.statLabel}">Available:</span><span style="${S.statValue}">2,450 XP <span style="${S.statHint}">(spendable)</span></span></div>
        </div>
        <div style="${S.narrative}">"XP reserves nominal. Continue operations."</div>
      </div>
    `,
  }),
}

export const WithBonuses: Story = {
  render: () => ({
    template: `
      <div style="${S.tooltip}">
        <div style="${S.title}">XP PROGRESS</div>
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <div style="${S.statRow}"><span style="${S.statLabel}">Current:</span><span style="${S.statValue}">3,250 / 5,000 XP</span></div>
          <div style="${S.statRow}"><span style="${S.statLabel}">Available:</span><span style="${S.statValue}">2,450 XP <span style="${S.statHint}">(spendable)</span></span></div>
        </div>
        <div style="${S.bonuses}">
          <div style="${S.bonusRow}">
            <span>Multiplier: 1.5x</span>
            <span style="${S.bonusTag} color: #a3e635; background: rgba(163,230,53,0.12);">ACTIVE</span>
          </div>
          <div style="${S.bonusRow}">
            <span>Shield: +15% XP</span>
            <span style="${S.bonusTag} color: #00f0ff; background: rgba(0,240,255,0.12);">TIMER ON</span>
          </div>
        </div>
        <div style="${S.narrative}">"Maximum XP acquisition mode engaged."</div>
      </div>
    `,
  }),
}
