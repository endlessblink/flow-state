import type { Meta, StoryObj } from '@storybook/vue3'
import { Trophy, ShoppingBag, ChevronRight, Sparkles, HelpCircle } from 'lucide-vue-next'

const S = {
  panel: 'width: 360px; background: var(--glass-bg-medium, #1a1a2e); border-radius: var(--radius-lg); padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-4); border: 1px solid var(--glass-border, rgba(255,255,255,0.08));',
  header: 'display: flex; justify-content: space-between; align-items: center;',
  title: 'font-size: var(--text-lg); font-weight: 700; color: var(--text-primary, #fff); display: flex; align-items: center; gap: var(--space-2);',
  levelRow: 'display: flex; align-items: center; gap: var(--space-3);',
  badge: 'width: 48px; height: 48px; background: rgba(0,240,255,0.1); border: 2px solid #00f0ff; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; font-size: var(--text-xl); font-weight: 900; color: #00f0ff;',
  levelInfo: 'flex: 1; display: flex; flex-direction: column; gap: var(--space-1);',
  levelText: 'font-size: var(--text-sm); font-weight: 600; color: var(--text-primary, #fff);',
  xpBar: 'height: 8px; background: rgba(0,0,0,0.3); border-radius: 4px; overflow: hidden;',
  xpFill: 'height: 100%; background: linear-gradient(90deg, #00f0ff, #8b5cf6); border-radius: 4px;',
  xpText: 'font-size: var(--text-xs); color: var(--text-muted, #666);',
  statsRow: 'display: flex; gap: var(--space-3);',
  stat: 'flex: 1; padding: var(--space-2); background: var(--glass-bg-soft, rgba(255,255,255,0.03)); border-radius: var(--radius-sm); text-align: center;',
  statValue: 'font-size: var(--text-lg); font-weight: 700; color: var(--text-primary, #fff);',
  statLabel: 'font-size: var(--text-xs); color: var(--text-muted, #666);',
  achieveRow: 'display: flex; gap: var(--space-2);',
  achieveBadge: 'width: 40px; height: 40px; background: var(--glass-bg-soft, rgba(255,255,255,0.03)); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center;',
  actions: 'display: flex; gap: var(--space-2);',
  actionBtn: 'flex: 1; display: flex; align-items: center; justify-content: center; gap: var(--space-2); padding: var(--space-2); background: var(--glass-bg-soft, rgba(255,255,255,0.03)); border: 1px solid var(--glass-border, rgba(255,255,255,0.08)); border-radius: var(--radius-md); color: var(--text-secondary, #a0a0b0); font-size: var(--text-sm); cursor: pointer;',
  section: 'display: flex; flex-direction: column; gap: var(--space-2);',
  sectionTitle: 'font-size: var(--text-xs); font-weight: 600; color: var(--text-muted, #666); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: space-between;',
}

const meta: Meta = {
  title: '🎮 Gamification/GamificationPanel',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Main stats overview panel showing level badge, XP bar, total/available XP, streak, recent achievements, and action buttons (Shop, Achievements, Cyberflow).',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { Trophy, ShoppingBag, ChevronRight, Sparkles, HelpCircle },
    template: `
      <div style="${S.panel}">
        <div style="${S.header}">
          <span style="${S.title}"><Sparkles :size="20" style="color: #00f0ff;" /> Gamification</span>
          <HelpCircle :size="16" style="color: var(--text-muted, #666); cursor: pointer;" />
        </div>

        <div style="${S.levelRow}">
          <div style="${S.badge}">15</div>
          <div style="${S.levelInfo}">
            <span style="${S.levelText}">Level 15 — Netrunner</span>
            <div style="${S.xpBar}"><div style="${S.xpFill} width: 65%;" /></div>
            <span style="${S.xpText}">3,250 / 5,000 XP</span>
          </div>
        </div>

        <div style="${S.statsRow}">
          <div style="${S.stat}">
            <div style="${S.statValue}">12,450</div>
            <div style="${S.statLabel}">Total XP</div>
          </div>
          <div style="${S.stat}">
            <div style="${S.statValue}">2,450</div>
            <div style="${S.statLabel}">Available</div>
          </div>
          <div style="${S.stat}">
            <div style="${S.statValue} color: #ff6b35;">14</div>
            <div style="${S.statLabel}">Streak</div>
          </div>
        </div>

        <div style="${S.section}">
          <div style="${S.sectionTitle}">
            <span>Recent Achievements</span>
            <span style="display: flex; align-items: center; gap: 2px; color: var(--brand-primary, #4ECDC4); cursor: pointer; font-size: var(--text-xs);">5/20 <ChevronRight :size="12" /></span>
          </div>
          <div style="${S.achieveRow}">
            <div style="${S.achieveBadge}"><Trophy :size="20" style="color: rgba(255,215,0,1); filter: drop-shadow(0 0 4px rgba(255,215,0,0.5));" /></div>
            <div style="${S.achieveBadge}"><Trophy :size="20" style="color: rgba(192,192,192,1); filter: drop-shadow(0 0 4px rgba(192,192,192,0.5));" /></div>
            <div style="${S.achieveBadge}"><Trophy :size="20" style="color: rgba(205,127,50,1); filter: drop-shadow(0 0 4px rgba(205,127,50,0.5));" /></div>
            <div style="${S.achieveBadge}"><Trophy :size="20" style="color: rgba(205,127,50,1);" /></div>
          </div>
        </div>

        <div style="${S.actions}">
          <button style="${S.actionBtn}"><ShoppingBag :size="16" /> Shop</button>
          <button style="${S.actionBtn}"><Trophy :size="16" /> Achievements</button>
        </div>
      </div>
    `,
  }),
}
