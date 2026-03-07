import type { Meta, StoryObj } from '@storybook/vue3'

const S = {
  tooltip: 'display: flex; flex-direction: column; gap: var(--space-2); min-width: 220px; background: var(--cf-dark-2, #111118); padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid rgba(0,240,255,0.2);',
  header: 'display: flex; justify-content: space-between; align-items: baseline;',
  title: 'font-weight: 700; color: #00f0ff; font-size: var(--text-sm); text-transform: uppercase; letter-spacing: 0.05em;',
  xpTotal: 'font-size: var(--text-xs); color: var(--text-muted, #666);',
  progressRow: 'display: flex; align-items: center; gap: var(--space-2);',
  track: 'flex: 1; height: 4px; background: rgba(100,100,120,0.6); border-radius: 99px; overflow: hidden;',
  fill: 'height: 100%; background: linear-gradient(90deg, rgba(0,240,255,0.8), #00f0ff); border-radius: 99px;',
  label: 'font-size: var(--text-xs); color: rgba(0,240,255,0.8); min-width: 28px; text-align: right;',
  remaining: 'font-size: var(--text-xs); color: var(--text-muted, #666);',
  recent: 'display: flex; flex-direction: column; gap: 2px; padding-top: var(--space-1); border-top: 1px solid rgba(255,255,255,0.06);',
  recentHeader: 'font-size: var(--text-xs); color: var(--text-muted, #666); margin-bottom: 2px;',
  recentEntry: 'display: flex; gap: var(--space-2); font-size: var(--text-xs);',
  recentAmount: 'color: rgba(0,240,255,0.9); font-weight: 600; min-width: 50px;',
  recentReason: 'color: var(--text-muted, #666); text-transform: capitalize;',
  narrative: 'font-size: var(--text-xs); color: rgba(0,240,255,0.6); font-style: italic; padding-top: var(--space-1); border-top: 1px solid rgba(255,255,255,0.06);',
}

const meta: Meta = {
  title: '🎮 Gamification/Tooltips/LevelTooltipContent',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Rich tooltip for LevelBadge showing level, XP progress bar, remaining XP to next level, recent XP logs, and narrative text.',
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
        <div style="${S.header}">
          <span style="${S.title}">LVL 15 NETRUNNER</span>
          <span style="${S.xpTotal}">12,450 Total XP</span>
        </div>
        <div style="${S.progressRow}">
          <div style="${S.track}"><div style="${S.fill} width: 65%;" /></div>
          <span style="${S.label}">65%</span>
        </div>
        <div style="${S.remaining}">~1,750 XP to Level 16</div>
        <div style="${S.recent}">
          <div style="${S.recentHeader}">Recent:</div>
          <div style="${S.recentEntry}">
            <span style="${S.recentAmount}">+50 XP</span>
            <span style="${S.recentReason}">Task completed</span>
          </div>
          <div style="${S.recentEntry}">
            <span style="${S.recentAmount}">+100 XP</span>
            <span style="${S.recentReason}">Challenge cleared</span>
          </div>
          <div style="${S.recentEntry}">
            <span style="${S.recentAmount}">+25 XP</span>
            <span style="${S.recentReason}">Pomodoro</span>
          </div>
        </div>
        <div style="${S.narrative}">"Your neural pathways strengthen with each engagement."</div>
      </div>
    `,
  }),
}
