import type { Meta, StoryObj } from '@storybook/vue3'

const S = {
  wrap: 'width: 380px; background: var(--cf-dark-1, #0a0a0f); padding: var(--space-6); border-radius: var(--radius-lg); display: flex; flex-direction: column; gap: var(--space-5); border: 2px solid; border-image: linear-gradient(135deg, #00f0ff, #ff006e) 1;',
  identity: 'display: flex; flex-direction: column; align-items: center; gap: var(--space-3);',
  avatarFrame: 'width: 96px; height: 96px; background: var(--cf-dark-3, #1a1a24); border: 2px solid rgba(0,240,255,0.3); box-shadow: 0 0 12px rgba(0,240,255,0.15); overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 48px; clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);',
  classBadge: 'padding: var(--space-1) var(--space-4); background: var(--cf-dark-3, #1a1a24); border: 2px solid #ff006e; font-size: var(--text-xs); font-weight: 700; color: #ff006e; letter-spacing: 0.15em; text-transform: uppercase;',
  levelSection: 'display: flex; flex-direction: column; gap: var(--space-1_5);',
  levelHeader: 'display: flex; align-items: baseline; gap: var(--space-2);',
  levelLabel: 'font-size: var(--text-xs); color: #00f0ff; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.7;',
  levelNum: 'font-size: var(--text-xl); font-weight: 800; color: #00f0ff; text-shadow: 0 0 10px rgba(0,240,255,0.5); line-height: 1;',
  xpTrack: 'height: 10px; background: rgba(15,15,20,0.4); overflow: hidden; border: 1px solid rgba(0,240,255,0.3); border-radius: var(--radius-sm); padding: 2px;',
  xpFill: 'height: 100%; background: linear-gradient(90deg, #00f0ff, #8b5cf6); border-radius: 2px;',
  xpText: 'display: flex; justify-content: space-between; font-size: 9px; color: rgba(255,255,255,0.5);',
  streak: 'position: relative; display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-4); background: rgba(15,15,20,0.3); border: 1px solid rgba(255,107,53,0.15); border-radius: var(--radius-sm);',
  streakContent: 'display: flex; align-items: baseline; gap: var(--space-2);',
  streakNum: 'font-size: var(--text-lg); font-weight: 800; color: #ff6b35; text-shadow: 0 0 8px rgba(255,107,53,0.5);',
  streakLabel: 'font-size: 9px; color: rgba(255,255,255,0.4);',
  corruption: 'padding-top: var(--space-1);',
  corruptionHeader: 'display: flex; justify-content: space-between; align-items: baseline; margin-bottom: var(--space-2);',
  corruptionBar: 'position: relative; height: 12px; border-radius: var(--radius-md); background: rgba(15,15,20,0.6); border: 1px solid rgba(255,255,255,0.1);',
  corruptionGradient: 'position: absolute; inset: 0; border-radius: var(--radius-md); background: linear-gradient(90deg, #00f0ff, #39ff14, #ffff00, #ff8800, #ff3333); opacity: 0.8;',
  corruptionIndicator: 'position: absolute; top: 50%; width: 12px; height: 12px; background: #f0f0f0; border: 2px solid rgba(15,15,20,0.6); transform: translate(-50%, -50%) rotate(45deg); z-index: 3; box-shadow: 0 0 6px rgba(255,255,255,0.5);',
  radar: 'display: flex; justify-content: center; padding: var(--space-2) 0;',
  radarPlaceholder: 'width: 200px; height: 200px; border: 1px dashed rgba(0,240,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: rgba(0,240,255,0.3); font-size: var(--text-xs); text-align: center;',
}

const meta: Meta = {
  title: '🎮 Gamification/Cyber/CyberCharacterProfile',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Full character profile with avatar (DiceBear), NETRUNNER class badge, level + XP bar, streak counter with flame effects, corruption meter, and stats radar chart.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    template: `
      <div style="${S.wrap}">
        <div style="${S.identity}">
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
          <div style="${S.streakContent}">
            <span style="${S.streakNum}">14</span>
            <span style="${S.streakLabel}">days streak</span>
          </div>
        </div>
        <div style="${S.corruption}">
          <div style="${S.corruptionHeader}">
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #39ff14;">Mild</span>
            <span style="font-size: var(--text-sm); color: rgba(255,255,255,0.5); font-weight: 600;">28%</span>
          </div>
          <div style="${S.corruptionBar}">
            <div style="${S.corruptionGradient}" />
            <div style="${S.corruptionIndicator} left: 28%;" />
          </div>
        </div>
        <div style="${S.radar}">
          <div style="${S.radarPlaceholder}">Stats Radar<br/>(SVG Pentagon)</div>
        </div>
      </div>
    `,
  }),
}

export const HighLevel: Story = {
  name: 'High Level (Legendary Streak)',
  render: () => ({
    template: `
      <div style="${S.wrap}">
        <div style="${S.identity}">
          <div style="${S.avatarFrame}">🦾</div>
          <div style="${S.classBadge}">NETRUNNER</div>
        </div>
        <div style="${S.levelSection}">
          <div style="${S.levelHeader}">
            <span style="${S.levelLabel}">LEVEL</span>
            <span style="${S.levelNum}">42</span>
          </div>
          <div style="${S.xpTrack}"><div style="${S.xpFill} width: 30%;" /></div>
          <div style="${S.xpText}">
            <span>8,500 / 28,000 XP</span>
            <span style="color: rgba(139,92,246,0.5);">156,000 total</span>
          </div>
        </div>
        <div style="${S.streak} border-color: rgba(255,0,110,0.3); box-shadow: 0 0 12px rgba(255,0,110,0.15);">
          <div style="${S.streakContent}">
            <span style="font-size: var(--text-lg); font-weight: 800; background: linear-gradient(90deg, #00f0ff, #ff006e); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">120</span>
            <span style="${S.streakLabel}">days streak</span>
          </div>
        </div>
        <div style="${S.corruption}">
          <div style="${S.corruptionHeader}">
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #ff3333;">Critical</span>
            <span style="font-size: var(--text-sm); color: rgba(255,255,255,0.5); font-weight: 600;">88%</span>
          </div>
          <div style="${S.corruptionBar}">
            <div style="${S.corruptionGradient}" />
            <div style="${S.corruptionIndicator} left: 88%;" />
          </div>
        </div>
        <div style="${S.radar}">
          <div style="${S.radarPlaceholder}">Stats Radar<br/>(SVG Pentagon)</div>
        </div>
      </div>
    `,
  }),
}
