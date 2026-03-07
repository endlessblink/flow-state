import type { Meta, StoryObj } from '@storybook/vue3'
import { Trophy, Rocket, Flame, Crown, Shield, Lock, CheckCircle, ChevronRight } from 'lucide-vue-next'

const S = {
  wrap: 'width: 400px; background: var(--cf-dark-2, #111118); padding: var(--space-3); border-radius: var(--radius-lg); display: flex; flex-direction: column; gap: var(--space-3); border: 1px solid rgba(0,240,255,0.3);',
  header: 'display: flex; align-items: center; gap: var(--space-2);',
  headerIcon: 'color: #ffc107; filter: drop-shadow(0 0 6px #ffc107);',
  headerText: 'font-size: var(--text-sm); font-weight: 700; color: var(--cf-cyan, #00f0ff); letter-spacing: 0.1em; flex: 1;',
  headerCount: 'font-size: var(--text-xs); color: var(--text-muted, #666); padding: 2px var(--space-2); background: rgba(255,255,255,0.05); border-radius: var(--radius-sm);',
  grid: 'display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2);',
  item: 'display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: var(--space-2); padding: var(--space-3); background: var(--cf-dark-3, #1a1a24); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--radius-sm); cursor: pointer; min-height: 120px;',
  itemLocked: 'display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: var(--space-2); padding: var(--space-3); background: var(--cf-dark-3, #1a1a24); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--radius-sm); min-height: 120px; opacity: 0.4; cursor: default;',
  iconWrap: 'position: relative; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;',
  earnedBadge: 'position: absolute; top: 0; right: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; background: var(--cf-cyan, #00f0ff); border-radius: 50%; color: #0a0a0f; box-shadow: 0 0 8px #00f0ff;',
  name: 'font-size: var(--text-xs); color: var(--text-primary, #fff); text-align: center; line-height: 1.3; max-width: 100%;',
  nameLocked: 'font-size: var(--text-xs); color: var(--text-muted, #666); text-align: center;',
  progress: 'width: 100%; height: 3px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; margin-top: auto;',
  progressFill: 'height: 100%; background: var(--cf-cyan, #00f0ff); border-radius: 2px; box-shadow: 0 0 4px #00f0ff;',
  viewAll: 'display: flex; align-items: center; justify-content: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: rgba(0,240,255,0.05); border: 1px solid rgba(0,240,255,0.3); border-radius: var(--radius-sm); color: var(--cf-cyan, #00f0ff); font-size: var(--text-xs); font-weight: 600; letter-spacing: 0.1em; cursor: pointer;',
  empty: 'display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-2); padding: var(--space-6);',
}

const meta: Meta = {
  title: '🎮 Gamification/Cyber/CyberAchievements',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Achievement gallery with 48px icons, tier-colored glows (bronze/silver/gold/platinum), progress bars, locked/earned states, and a View All button.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const WithAchievements: Story = {
  render: () => ({
    components: { Trophy, Rocket, Flame, Crown, Shield, Lock, CheckCircle, ChevronRight },
    template: `
      <div style="${S.wrap}">
        <div style="${S.header}">
          <Trophy :size="16" style="${S.headerIcon}" />
          <span style="${S.headerText}">ACHIEVEMENTS</span>
          <span style="${S.headerCount}">5/20</span>
        </div>
        <div style="${S.grid}">
          <div style="${S.item}">
            <div style="${S.iconWrap}">
              <Rocket :size="48" style="color: rgba(255,215,0,1); filter: drop-shadow(0 0 8px rgba(255,215,0,1)) drop-shadow(0 0 16px rgba(255,215,0,1));" />
              <div style="${S.earnedBadge}"><CheckCircle :size="14" /></div>
            </div>
            <span style="${S.name}">First Launch</span>
          </div>
          <div style="${S.item}">
            <div style="${S.iconWrap}">
              <Flame :size="48" style="color: rgba(192,192,192,1); filter: drop-shadow(0 0 8px rgba(192,192,192,1)) drop-shadow(0 0 16px rgba(192,192,192,1));" />
              <div style="${S.earnedBadge}"><CheckCircle :size="14" /></div>
            </div>
            <span style="${S.name}">Hot Streak</span>
          </div>
          <div style="${S.item}">
            <div style="${S.iconWrap}">
              <Crown :size="48" style="color: rgba(205,127,50,1); filter: drop-shadow(0 0 8px rgba(205,127,50,1)) drop-shadow(0 0 16px rgba(205,127,50,1));" />
              <div style="${S.earnedBadge}"><CheckCircle :size="14" /></div>
            </div>
            <span style="${S.name}">Task Master</span>
          </div>
          <div style="${S.item}">
            <div style="${S.iconWrap}">
              <Shield :size="48" style="color: var(--text-secondary, #a0a0b0);" />
            </div>
            <span style="${S.name}">Defender</span>
            <div style="${S.progress}"><div style="${S.progressFill} width: 65%;" /></div>
          </div>
          <div style="${S.item}">
            <div style="${S.iconWrap}">
              <Trophy :size="48" style="color: var(--text-secondary, #a0a0b0);" />
            </div>
            <span style="${S.name}">Champion</span>
            <div style="${S.progress}"><div style="${S.progressFill} width: 20%;" /></div>
          </div>
          <div style="${S.itemLocked}">
            <div style="${S.iconWrap}">
              <Lock :size="48" style="color: rgba(255,255,255,0.2);" />
            </div>
            <span style="${S.nameLocked}">???</span>
          </div>
        </div>
        <button style="${S.viewAll}"><span>VIEW ALL</span><ChevronRight :size="14" /></button>
      </div>
    `,
  }),
}

export const Empty: Story = {
  render: () => ({
    components: { Trophy },
    template: `
      <div style="${S.wrap}">
        <div style="${S.header}">
          <Trophy :size="16" style="${S.headerIcon}" />
          <span style="${S.headerText}">ACHIEVEMENTS</span>
          <span style="${S.headerCount}">0/20</span>
        </div>
        <div style="${S.empty}">
          <Trophy :size="32" style="color: var(--text-muted, #666); opacity: 0.3;" />
          <span style="font-size: var(--text-sm); color: var(--text-muted, #666); letter-spacing: 0.05em;">NO ACHIEVEMENTS</span>
          <span style="font-size: var(--text-xs); color: var(--text-muted, #666); opacity: 0.6; text-align: center;">Complete tasks and challenges to earn achievements</span>
        </div>
      </div>
    `,
  }),
}
