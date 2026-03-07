import type { Meta, StoryObj } from '@storybook/vue3'
import { X } from 'lucide-vue-next'

const S = {
  scene: 'width: 800px; height: 500px; background: var(--cf-dark-1, #0a0a0f); border-radius: var(--radius-lg); position: relative; overflow: hidden; display: flex;',
  backdrop: 'position: absolute; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 1;',
  panel: 'position: absolute; right: 0; top: 0; width: 380px; height: 100%; background: var(--cf-dark-1, #0a0a0f); display: flex; flex-direction: column; overflow: hidden; border-left: 2px solid; border-image: linear-gradient(180deg, #00f0ff, #ff006e) 1; box-shadow: -4px 0 24px rgba(0,0,0,0.5); z-index: 2;',
  header: 'display: flex; align-items: center; justify-content: space-between; padding: var(--space-4) var(--space-6); background: var(--cf-dark-2, #111118); border-bottom: 1px solid rgba(0,240,255,0.15); flex-shrink: 0;',
  title: 'font-size: var(--text-lg); font-weight: 700; color: var(--cf-cyan, #00f0ff); letter-spacing: 0.1em; text-transform: uppercase; margin: 0; text-shadow: 0 0 8px rgba(0,240,255,0.4);',
  closeBtn: 'display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: transparent; border: 1px solid rgba(0,240,255,0.15); border-radius: var(--radius-sm); color: var(--text-secondary, #a0a0b0); cursor: pointer;',
  body: 'flex: 1; overflow-y: auto; padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-5);',
  avatarFrame: 'width: 96px; height: 96px; background: var(--cf-dark-3, #1a1a24); border: 2px solid rgba(0,240,255,0.3); margin: 0 auto; display: flex; align-items: center; justify-content: center; font-size: 48px; clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);',
  classBadge: 'margin: 0 auto; padding: var(--space-1) var(--space-4); background: var(--cf-dark-3, #1a1a24); border: 2px solid #ff006e; font-size: var(--text-xs); font-weight: 700; color: #ff006e; letter-spacing: 0.15em; text-transform: uppercase; text-align: center;',
  levelSection: 'display: flex; flex-direction: column; gap: var(--space-1_5);',
  levelHeader: 'display: flex; align-items: baseline; gap: var(--space-2);',
  levelLabel: 'font-size: var(--text-xs); color: var(--cf-cyan, #00f0ff); letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.7;',
  levelNum: 'font-size: var(--text-xl); font-weight: 800; color: var(--cf-cyan, #00f0ff); text-shadow: 0 0 10px rgba(0,240,255,0.5); line-height: 1;',
  xpTrack: 'height: 10px; background: rgba(15,15,20,0.4); overflow: hidden; border: 1px solid rgba(0,240,255,0.3); border-radius: var(--radius-sm);',
  xpFill: 'height: 100%; background: linear-gradient(90deg, #00f0ff, #8b5cf6);',
  xpText: 'display: flex; justify-content: space-between; font-size: 9px; color: rgba(255,255,255,0.5);',
  streak: 'display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-4); background: rgba(15,15,20,0.3); border: 1px solid rgba(255,107,53,0.15); border-radius: var(--radius-sm);',
  streakNum: 'font-size: var(--text-lg); font-weight: 800; color: #ff6b35; text-shadow: 0 0 8px rgba(255,107,53,0.5);',
  streakLabel: 'font-size: 9px; color: rgba(255,255,255,0.4);',
}

const meta: Meta = {
  title: '🎮 Gamification/Cyber/CyberCharacterDrawer',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Right-side slide-out drawer containing the full CyberCharacterProfile. Opens with backdrop blur, closes on backdrop click or Escape. Gradient border (cyan to magenta).',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Open: Story = {
  render: () => ({
    components: { X },
    template: `
      <div style="${S.scene}">
        <div style="${S.backdrop}" />
        <div style="${S.panel}">
          <div style="${S.header}">
            <h2 style="${S.title}">OPERATIVE PROFILE</h2>
            <button style="${S.closeBtn}"><X :size="20" /></button>
          </div>
          <div style="${S.body}">
            <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-3);">
              <div style="${S.avatarFrame}">🧑‍💻</div>
              <div style="${S.classBadge}">NETRUNNER</div>
            </div>
            <div style="${S.levelSection}">
              <div style="${S.levelHeader}">
                <span style="${S.levelLabel}">LEVEL</span>
                <span style="${S.levelNum}">15</span>
              </div>
              <div style="${S.xpTrack}"><div style="${S.xpFill} width: 65%;" /></div>
              <div style="${S.xpText}">
                <span>3,250 / 5,000 XP</span>
                <span style="color: rgba(139,92,246,0.5);">12,450 total</span>
              </div>
            </div>
            <div style="${S.streak}">
              <div style="display: flex; align-items: baseline; gap: var(--space-2);">
                <span style="${S.streakNum}">14</span>
                <span style="${S.streakLabel}">days streak</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
  }),
}
