import type { Meta, StoryObj } from '@storybook/vue3'
import { Flame, ChevronDown, Target } from 'lucide-vue-next'

const S = {
  wrap: 'width: 500px; background: var(--glass-bg-medium, #1a1a2e); padding: var(--space-2); border-radius: var(--radius-lg);',
  hud: 'display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-4); background: var(--cf-dark-2, #111118); border: 1px solid rgba(0,240,255,0.2); border-radius: var(--radius-md); cursor: pointer;',
  level: 'display: flex; align-items: center; gap: var(--space-1);',
  levelBadge: 'width: 28px; height: 28px; background: rgba(0,240,255,0.1); border: 2px solid #00f0ff; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; font-size: var(--text-sm); font-weight: 900; color: #00f0ff;',
  xpSection: 'flex: 1; display: flex; flex-direction: column; gap: 2px;',
  xpTrack: 'height: 4px; background: rgba(15,15,20,0.5); border-radius: 2px; overflow: hidden;',
  xpFill: 'height: 100%; background: linear-gradient(90deg, #00f0ff, #8b5cf6); border-radius: 2px;',
  xpText: 'font-size: 9px; color: rgba(255,255,255,0.5); display: flex; justify-content: space-between;',
  streak: 'display: flex; align-items: center; gap: var(--space-1); font-size: var(--text-sm); font-weight: 700; color: #ff6b35;',
  pips: 'display: flex; gap: 3px;',
  pip: 'width: 6px; height: 6px; border-radius: 50%;',
  chevron: 'color: var(--text-muted, #666); opacity: 0.5;',
  mission: 'display: flex; align-items: center; gap: var(--space-1); font-size: 9px; color: rgba(0,240,255,0.6); letter-spacing: 0.05em;',
  minimal: 'display: inline-flex; align-items: center; gap: var(--space-1); font-size: var(--text-sm); font-weight: 700; color: #00f0ff; cursor: pointer;',
}

const meta: Meta = {
  title: '🎮 Gamification/GamificationHUD',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'RPG-styled header HUD adapting to intensity: minimal (text only), moderate (level+XP+streak+pips), intense (+ glow + animations + narrative).',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Moderate: Story = {
  render: () => ({
    components: { Flame, ChevronDown, Target },
    template: `
      <div style="${S.wrap}">
        <div style="${S.hud}">
          <div style="${S.level}">
            <div style="${S.levelBadge}">15</div>
          </div>
          <div style="${S.xpSection}">
            <div style="${S.xpTrack}"><div style="${S.xpFill} width: 65%;" /></div>
            <div style="${S.xpText}"><span>3,250/5,000</span></div>
          </div>
          <div style="${S.streak}"><Flame :size="14" /> 14</div>
          <div style="${S.pips}">
            <div style="${S.pip} background: #a3e635;" />
            <div style="${S.pip} background: rgba(255,255,255,0.15);" />
            <div style="${S.pip} background: rgba(255,255,255,0.15);" />
          </div>
          <ChevronDown :size="14" style="${S.chevron}" />
        </div>
      </div>
    `,
  }),
}

export const Intense: Story = {
  render: () => ({
    components: { Flame, ChevronDown, Target },
    template: `
      <div style="${S.wrap}">
        <div style="${S.hud} box-shadow: 0 0 12px rgba(0,240,255,0.15); border-color: rgba(0,240,255,0.4);">
          <div style="${S.level}">
            <div style="${S.levelBadge} box-shadow: 0 0 8px rgba(0,240,255,0.4);">15</div>
          </div>
          <div style="${S.xpSection}">
            <div style="${S.xpTrack}"><div style="${S.xpFill} width: 65%; box-shadow: 0 0 6px rgba(0,240,255,0.5);" /></div>
            <div style="${S.xpText}"><span>3,250/5,000</span></div>
          </div>
          <div style="${S.streak}"><Flame :size="14" /> 14</div>
          <div style="${S.pips}">
            <div style="${S.pip} background: #a3e635; box-shadow: 0 0 4px #a3e635;" />
            <div style="${S.pip} background: rgba(255,255,255,0.15);" />
            <div style="${S.pip} background: rgba(255,255,255,0.15);" />
          </div>
          <div style="${S.mission}"><Target :size="10" /> Complete 5 tasks</div>
          <ChevronDown :size="14" style="${S.chevron}" />
        </div>
      </div>
    `,
  }),
}

export const Minimal: Story = {
  render: () => ({
    template: `
      <div style="${S.wrap}">
        <span style="${S.minimal}">Lv.15</span>
      </div>
    `,
  }),
}
