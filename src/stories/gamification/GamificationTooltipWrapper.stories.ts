import type { Meta, StoryObj } from '@storybook/vue3'

const S = {
  wrap: 'width: 300px; background: var(--glass-bg-medium, #1a1a2e); padding: var(--space-6); border-radius: var(--radius-lg); display: flex; flex-direction: column; align-items: center; gap: var(--space-4);',
  badge: 'width: 48px; height: 48px; background: rgba(0,240,255,0.1); border: 2px solid #00f0ff; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; font-size: var(--text-xl); font-weight: 900; color: #00f0ff; cursor: pointer;',
  tooltip: 'background: var(--cf-dark-2, #111118); border: 1px solid rgba(0,240,255,0.2); border-radius: var(--radius-md); padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); min-width: 200px; box-shadow: 0 4px 16px rgba(0,0,0,0.4);',
  tooltipTitle: 'font-weight: 700; color: #00f0ff; font-size: var(--text-sm); text-transform: uppercase; letter-spacing: 0.05em;',
  tooltipRow: 'display: flex; justify-content: space-between; font-size: var(--text-xs);',
  tooltipLabel: 'color: var(--text-muted, #666);',
  tooltipValue: 'color: var(--text-secondary, #a0a0b0);',
  label: 'font-size: var(--text-xs); color: var(--text-muted, #666); text-align: center;',
}

const meta: Meta = {
  title: '🎮 Gamification/GamificationTooltipWrapper',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Lightweight hover wrapper that shows a BasePopover (tooltip variant) after 200ms delay. Force-hides when gamification panel is open. Used around LevelBadge, XpBar, StreakCounter, ChallengePips.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const HoverExample: Story = {
  render: () => ({
    template: `
      <div style="${S.wrap}">
        <div style="${S.badge}">15</div>
        <div style="${S.label}">Hover the badge above to see tooltip (simulated below)</div>
        <div style="${S.tooltip}">
          <span style="${S.tooltipTitle}">LVL 15 NETRUNNER</span>
          <div style="${S.tooltipRow}"><span style="${S.tooltipLabel}">XP:</span><span style="${S.tooltipValue}">3,250 / 5,000</span></div>
          <div style="${S.tooltipRow}"><span style="${S.tooltipLabel}">Next level:</span><span style="${S.tooltipValue}">~1,750 XP</span></div>
          <div style="font-size: var(--text-xs); color: rgba(0,240,255,0.6); font-style: italic; padding-top: var(--space-1); border-top: 1px solid rgba(255,255,255,0.06);">"Your neural pathways grow stronger."</div>
        </div>
      </div>
    `,
  }),
}
