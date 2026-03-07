import type { Meta, StoryObj } from '@storybook/vue3'
import { Zap, Trophy, TrendingUp, X } from 'lucide-vue-next'

const S = {
  container: 'display: flex; flex-direction: column; gap: var(--space-2); width: 320px;',
  toast: 'display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); background: var(--glass-bg-medium, #1a1a2e); border-radius: var(--radius-md); border: 1px solid; backdrop-filter: blur(12px); position: relative;',
  iconWrap: 'width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); flex-shrink: 0;',
  content: 'flex: 1; display: flex; flex-direction: column; gap: 2px;',
  title: 'font-size: var(--text-sm); font-weight: 700;',
  desc: 'font-size: var(--text-xs); color: var(--text-muted, #666);',
  close: 'position: absolute; top: var(--space-2); right: var(--space-2); background: transparent; border: none; color: var(--text-muted, #666); cursor: pointer; padding: 2px;',
}

const meta: Meta = {
  title: '🎮 Gamification/GamificationToasts',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Fixed toast container (top-right) for gamification notifications: XP earned, level up, achievement unlocked. Auto-dismiss with transition animations.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const AllTypes: Story = {
  render: () => ({
    components: { Zap, Trophy, TrendingUp, X },
    template: `
      <div style="${S.container}">
        <div style="${S.toast} border-color: rgba(0,240,255,0.3);">
          <div style="${S.iconWrap} background: rgba(0,240,255,0.1);"><Zap :size="20" style="color: #00f0ff;" /></div>
          <div style="${S.content}">
            <span style="${S.title} color: #00f0ff;">+50 XP</span>
            <span style="${S.desc}">Task completed</span>
          </div>
          <button style="${S.close}"><X :size="14" /></button>
        </div>
        <div style="${S.toast} border-color: rgba(139,92,246,0.3); box-shadow: 0 0 16px rgba(139,92,246,0.15);">
          <div style="${S.iconWrap} background: rgba(139,92,246,0.1);"><TrendingUp :size="20" style="color: #8b5cf6;" /></div>
          <div style="${S.content}">
            <span style="${S.title} color: #8b5cf6;">Level Up!</span>
            <span style="${S.desc}">You reached Level 16</span>
          </div>
          <button style="${S.close}"><X :size="14" /></button>
        </div>
        <div style="${S.toast} border-color: rgba(255,215,0,0.3); box-shadow: 0 0 16px rgba(255,215,0,0.15);">
          <div style="${S.iconWrap} background: rgba(255,215,0,0.1);"><Trophy :size="20" style="color: #ffd700;" /></div>
          <div style="${S.content}">
            <span style="${S.title} color: #ffd700;">Achievement Unlocked!</span>
            <span style="${S.desc}">First Launch — Complete your first task</span>
          </div>
          <button style="${S.close}"><X :size="14" /></button>
        </div>
      </div>
    `,
  }),
}
