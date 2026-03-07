import type { Meta, StoryObj } from '@storybook/vue3'
import { X, Trophy, Target, Flame, Compass, Lock, Award } from 'lucide-vue-next'

const S = {
  modal: 'width: 550px; background: var(--glass-bg-medium, #1a1a2e); border-radius: var(--radius-lg); border: 1px solid var(--glass-border, rgba(255,255,255,0.08)); overflow: hidden;',
  header: 'display: flex; align-items: center; justify-content: space-between; padding: var(--space-4) var(--space-6); border-bottom: 1px solid var(--glass-border, rgba(255,255,255,0.08));',
  title: 'font-size: var(--text-lg); font-weight: 700; color: var(--text-primary, #fff); display: flex; align-items: center; gap: var(--space-2);',
  count: 'font-size: var(--text-sm); color: var(--text-muted, #666); font-weight: 400;',
  closeBtn: 'background: transparent; border: none; color: var(--text-muted, #666); cursor: pointer; padding: var(--space-1);',
  categories: 'display: flex; gap: var(--space-1); padding: var(--space-3) var(--space-6); border-bottom: 1px solid var(--glass-border, rgba(255,255,255,0.08)); flex-wrap: wrap;',
  catBtn: 'display: flex; align-items: center; gap: var(--space-1); padding: var(--space-1_5) var(--space-3); background: transparent; border: 1px solid var(--glass-border, rgba(255,255,255,0.08)); border-radius: var(--radius-sm); color: var(--text-secondary, #a0a0b0); font-size: var(--text-xs); cursor: pointer;',
  catBtnActive: 'display: flex; align-items: center; gap: var(--space-1); padding: var(--space-1_5) var(--space-3); background: rgba(78,205,196,0.08); border: 1px solid var(--brand-primary, #4ECDC4); border-radius: var(--radius-sm); color: var(--brand-primary, #4ECDC4); font-size: var(--text-xs); cursor: pointer;',
  grid: 'display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); padding: var(--space-4) var(--space-6); max-height: 400px; overflow-y: auto;',
  item: 'display: flex; flex-direction: column; align-items: center; gap: var(--space-2); padding: var(--space-3); background: var(--glass-bg-soft, rgba(255,255,255,0.03)); border: 1px solid var(--glass-border, rgba(255,255,255,0.08)); border-radius: var(--radius-md); text-align: center; min-height: 120px;',
  itemEarned: 'display: flex; flex-direction: column; align-items: center; gap: var(--space-2); padding: var(--space-3); background: var(--glass-bg-soft, rgba(255,255,255,0.03)); border: 1px solid rgba(255,215,0,0.2); border-radius: var(--radius-md); text-align: center; min-height: 120px;',
  itemLocked: 'display: flex; flex-direction: column; align-items: center; gap: var(--space-2); padding: var(--space-3); background: var(--glass-bg-soft, rgba(255,255,255,0.03)); border: 1px solid var(--glass-border, rgba(255,255,255,0.08)); border-radius: var(--radius-md); text-align: center; min-height: 120px; opacity: 0.4;',
  name: 'font-size: var(--text-xs); font-weight: 600; color: var(--text-primary, #fff); line-height: 1.3;',
  tier: 'font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600;',
  progress: 'width: 100%; height: 3px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; margin-top: auto;',
  progressFill: 'height: 100%; background: var(--brand-primary, #4ECDC4); border-radius: 2px;',
}

const meta: Meta = {
  title: '🎮 Gamification/AchievementsModal',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Full achievements modal with category filtering (All, Productivity, Consistency, Mastery, Exploration, Secret), tier-sorted grid (platinum>gold>silver>bronze), progress bars.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { X, Trophy, Target, Flame, Compass, Lock, Award },
    template: `
      <div style="${S.modal}">
        <div style="${S.header}">
          <span style="${S.title}"><Trophy :size="20" style="color: #ffd700;" /> Achievements <span style="${S.count}">5 / 20</span></span>
          <button style="${S.closeBtn}"><X :size="20" /></button>
        </div>
        <div style="${S.categories}">
          <button style="${S.catBtnActive}"><Trophy :size="12" /> All</button>
          <button style="${S.catBtn}"><Target :size="12" /> Productivity</button>
          <button style="${S.catBtn}"><Flame :size="12" /> Consistency</button>
          <button style="${S.catBtn}"><Trophy :size="12" /> Mastery</button>
          <button style="${S.catBtn}"><Compass :size="12" /> Exploration</button>
          <button style="${S.catBtn}"><Lock :size="12" /> Secret</button>
        </div>
        <div style="${S.grid}">
          <div style="${S.itemEarned}">
            <Trophy :size="36" style="color: rgba(255,215,0,1); filter: drop-shadow(0 0 6px rgba(255,215,0,0.8));" />
            <span style="${S.name}">First Launch</span>
            <span style="${S.tier} color: #ffd700;">GOLD</span>
          </div>
          <div style="${S.itemEarned}">
            <Flame :size="36" style="color: rgba(192,192,192,1); filter: drop-shadow(0 0 6px rgba(192,192,192,0.8));" />
            <span style="${S.name}">Hot Streak</span>
            <span style="${S.tier} color: #c0c0c0;">SILVER</span>
          </div>
          <div style="${S.itemEarned}">
            <Award :size="36" style="color: rgba(205,127,50,1); filter: drop-shadow(0 0 6px rgba(205,127,50,0.8));" />
            <span style="${S.name}">Task Master</span>
            <span style="${S.tier} color: #cd7f32;">BRONZE</span>
          </div>
          <div style="${S.item}">
            <Target :size="36" style="color: var(--text-secondary, #a0a0b0);" />
            <span style="${S.name}">Sharpshooter</span>
            <div style="${S.progress}"><div style="${S.progressFill} width: 65%;" /></div>
          </div>
          <div style="${S.item}">
            <Compass :size="36" style="color: var(--text-secondary, #a0a0b0);" />
            <span style="${S.name}">Explorer</span>
            <div style="${S.progress}"><div style="${S.progressFill} width: 30%;" /></div>
          </div>
          <div style="${S.itemLocked}">
            <Lock :size="36" style="color: rgba(255,255,255,0.2);" />
            <span style="${S.name}">???</span>
          </div>
        </div>
      </div>
    `,
  }),
}
