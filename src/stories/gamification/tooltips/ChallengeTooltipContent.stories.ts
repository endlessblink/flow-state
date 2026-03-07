import type { Meta, StoryObj } from '@storybook/vue3'

const S = {
  tooltip: 'display: flex; flex-direction: column; gap: var(--space-2); min-width: 220px; background: var(--cf-dark-2, #111118); padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid rgba(0,240,255,0.2);',
  title: 'font-weight: 700; color: #00f0ff; font-size: var(--text-sm); text-transform: uppercase; letter-spacing: 0.05em;',
  list: 'display: flex; flex-direction: column; gap: 3px;',
  entry: 'display: flex; align-items: center; gap: var(--space-1); font-size: var(--text-xs); color: var(--text-secondary, #a0a0b0);',
  entryDone: 'display: flex; align-items: center; gap: var(--space-1); font-size: var(--text-xs); color: #a3e635;',
  marker: 'font-size: 10px; min-width: 12px;',
  name: 'flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
  progress: 'color: var(--text-muted, #666); white-space: nowrap;',
  boss: 'padding-top: var(--space-1); border-top: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center; font-size: var(--text-xs);',
  bossLabel: 'color: #ff006e; font-weight: 700; letter-spacing: 0.03em;',
  bossHp: 'color: #ff006e; font-weight: 600;',
  narrative: 'font-size: var(--text-xs); color: rgba(0,240,255,0.6); font-style: italic; padding-top: var(--space-1); border-top: 1px solid rgba(255,255,255,0.06);',
}

const meta: Meta = {
  title: '🎮 Gamification/Tooltips/ChallengeTooltipContent',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Rich tooltip for ChallengePips showing daily mission list with completion status, boss HP, and narrative text.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const WithMissionsAndBoss: Story = {
  render: () => ({
    template: `
      <div style="${S.tooltip}">
        <div style="${S.title}">DAILY MISSIONS: 1/3 Complete</div>
        <div style="${S.list}">
          <div style="${S.entryDone}">
            <span style="${S.marker}">&#10003;</span>
            <span style="${S.name}">Complete 3 tasks</span>
          </div>
          <div style="${S.entry}">
            <span style="${S.marker}">&#9679;</span>
            <span style="${S.name}">Do 2 pomodoros</span>
            <span style="${S.progress}">(1/2)</span>
          </div>
          <div style="${S.entry}">
            <span style="${S.marker}">&#9679;</span>
            <span style="${S.name}">Clear urgent tasks</span>
            <span style="${S.progress}">(0/3)</span>
          </div>
        </div>
        <div style="${S.boss}">
          <span style="${S.bossLabel}">BOSS: THE PROCRASTINATOR</span>
          <span style="${S.bossHp}">[HP: 62%]</span>
        </div>
        <div style="${S.narrative}">"The network stirs. Your missions await, operative."</div>
      </div>
    `,
  }),
}

export const AllComplete: Story = {
  render: () => ({
    template: `
      <div style="${S.tooltip}">
        <div style="${S.title}">DAILY MISSIONS: 3/3 Complete</div>
        <div style="${S.list}">
          <div style="${S.entryDone}"><span style="${S.marker}">&#10003;</span><span style="${S.name}">Complete 3 tasks</span></div>
          <div style="${S.entryDone}"><span style="${S.marker}">&#10003;</span><span style="${S.name}">Do 2 pomodoros</span></div>
          <div style="${S.entryDone}"><span style="${S.marker}">&#10003;</span><span style="${S.name}">Clear urgent tasks</span></div>
        </div>
        <div style="${S.narrative}">"All objectives neutralized. Impressive work, operative."</div>
      </div>
    `,
  }),
}
