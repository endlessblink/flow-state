import type { Meta, StoryObj } from '@storybook/vue3'
import { Skull, Crosshair, Zap, Trophy, ShoppingBag } from 'lucide-vue-next'

const S = {
  wrap: 'width: 700px; background: var(--cf-dark-1, #0a0a0f); padding: var(--space-4); border-radius: var(--radius-lg);',
  grid: 'display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-4);',
  card: 'background: var(--cf-dark-2, #111118); padding: var(--space-4); min-height: 160px; cursor: pointer; border: 1px solid;',
  cardTitle: 'font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 var(--space-3) 0;',
  characterRow: 'display: flex; gap: var(--space-3); align-items: center;',
  avatar: 'width: 48px; height: 48px; background: var(--cf-dark-3, #1a1a24); border: 2px solid rgba(0,240,255,0.3); display: flex; align-items: center; justify-content: center; font-size: 24px; border-radius: var(--radius-sm);',
  charInfo: 'flex: 1; display: flex; flex-direction: column; gap: var(--space-1);',
  level: 'font-size: var(--text-sm); font-weight: 700; color: #00f0ff; letter-spacing: 0.08em;',
  xpBar: 'height: 6px; background: rgba(15,15,20,0.5); border-radius: 3px; overflow: hidden;',
  xpFill: 'height: 100%; background: linear-gradient(90deg, #00f0ff, #8b5cf6); border-radius: 3px;',
  xpText: 'font-size: 9px; color: rgba(255,255,255,0.5);',
  streak: 'font-size: var(--text-xs); color: #ff6b35;',
  class: 'font-size: 9px; color: #ff006e; letter-spacing: 0.15em; font-weight: 700;',
  missionCompletion: 'font-size: var(--text-2xl); font-weight: 900; color: #00f0ff; text-shadow: 0 0 12px rgba(0,240,255,0.5);',
  missionLabel: 'font-size: var(--text-xs); color: var(--text-muted, #666); letter-spacing: 0.1em;',
  bossHp: 'height: 20px; background: var(--cf-dark-3, #1a1a24); border-radius: var(--radius-sm); overflow: hidden; margin-top: var(--space-2);',
  bossHpFill: 'height: 100%; background: #39ff14; box-shadow: inset 0 0 10px rgba(255,255,255,0.2);',
  bossName: 'font-size: var(--text-sm); font-weight: 700; color: #ff006e; text-shadow: 0 0 8px #ff006e; margin-top: var(--space-2);',
  itemRow: 'display: flex; gap: var(--space-2); margin-top: var(--space-1);',
  shopItem: 'flex: 1; padding: var(--space-2); background: var(--cf-dark-3, #1a1a24); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--radius-sm); text-align: center; font-size: var(--text-xs); color: var(--text-secondary, #a0a0b0);',
  trophyCount: 'font-size: var(--text-2xl); font-weight: 900; color: #ffc107; text-shadow: 0 0 12px rgba(255,193,7,0.5);',
}

const meta: Meta = {
  title: '🎮 Gamification/Cyber/CyberDashboardHub',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '2x2 grid overview hub with CyberSummaryCards: Character (avatar+level+XP), Daily Briefing (missions), Boss Fight (HP bar), Shop (featured items), plus Achievements panel.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { Skull, Crosshair, Zap, Trophy, ShoppingBag },
    template: `
      <div style="${S.wrap}">
        <div style="${S.grid}">
          <div style="${S.card} border-color: rgba(0,240,255,0.3);">
            <h3 style="${S.cardTitle} color: #00f0ff;">CHARACTER</h3>
            <div style="${S.characterRow}">
              <div style="${S.avatar}">🧑‍💻</div>
              <div style="${S.charInfo}">
                <span style="${S.level}">LEVEL 15</span>
                <div style="${S.xpBar}"><div style="${S.xpFill} width: 65%;" /></div>
                <span style="${S.xpText}">3,250 / 5,000 XP</span>
                <span style="${S.streak}">🔥 14 day streak</span>
                <span style="${S.class}">NETRUNNER</span>
              </div>
            </div>
          </div>
          <div style="${S.card} border-color: rgba(0,240,255,0.3);">
            <h3 style="${S.cardTitle} color: #00f0ff;">DAILY BRIEFING</h3>
            <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-2);">
              <Crosshair :size="24" style="color: #00f0ff; opacity: 0.5;" />
              <span style="${S.missionCompletion}">1/3 CLEARED</span>
              <span style="${S.missionLabel}">MISSIONS TODAY</span>
            </div>
          </div>
          <div style="${S.card} border-color: rgba(255,0,110,0.3);">
            <h3 style="${S.cardTitle} color: #ff006e;">BOSS FIGHT</h3>
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <Skull :size="20" style="color: #ff006e;" />
              <span style="${S.bossName}">THE PROCRASTINATOR</span>
            </div>
            <div style="${S.bossHp}"><div style="${S.bossHpFill} width: 62%;" /></div>
            <div style="font-size: var(--text-xs); color: var(--text-muted, #666); margin-top: var(--space-1);">62% HP • 3d left</div>
          </div>
          <div style="${S.card} border-color: rgba(139,92,246,0.3);">
            <h3 style="${S.cardTitle} color: #8b5cf6;">SHOP</h3>
            <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2);">
              <Zap :size="16" style="color: #ffc107;" />
              <span style="font-size: var(--text-sm); font-weight: 700; color: #ffc107;">2,450 XP</span>
              <span style="font-size: var(--text-xs); color: var(--text-muted, #666); margin-left: auto;">available</span>
            </div>
            <div style="${S.itemRow}">
              <div style="${S.shopItem}">🎨 Neon</div>
              <div style="${S.shopItem}">✨ Pulse</div>
              <div style="${S.shopItem}">🔊 Synth</div>
            </div>
          </div>
        </div>
      </div>
    `,
  }),
}
