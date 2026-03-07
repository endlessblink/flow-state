import type { Meta, StoryObj } from '@storybook/vue3'
import { Skull, Trophy, Clock, Zap, Target, AlertTriangle } from 'lucide-vue-next'

const S = {
  wrap: 'width: 500px; background: var(--cf-dark-2, #111118); padding: var(--space-4); border-radius: var(--radius-lg); display: flex; flex-direction: column; gap: var(--space-3); position: relative; overflow: hidden; border: 2px solid; border-image: linear-gradient(135deg, #ff006e, #ff6b35) 1;',
  bossName: 'font-size: var(--text-xl); font-weight: 900; color: #ff006e; text-transform: uppercase; letter-spacing: 0.1em; text-shadow: 0 0 16px #ff006e; margin: 0; text-align: center; display: flex; align-items: center; justify-content: center; gap: var(--space-2);',
  difficulty: 'display: flex; align-items: center; justify-content: center; gap: var(--space-2); font-size: var(--text-xs); color: var(--text-muted, #666); text-transform: uppercase; letter-spacing: 0.15em;',
  hpBar: 'position: relative; height: 50px; border: 2px solid rgba(255,255,255,0.08); overflow: hidden; background: var(--cf-dark-3, #1a1a24); border-radius: var(--radius-md); box-shadow: 0 4px 12px rgba(0,0,0,0.4);',
  hpBg: 'position: absolute; inset: 0; background: repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 2px, transparent 2px, transparent 4px);',
  hpFill: 'position: absolute; top: 0; left: 0; height: 100%; box-shadow: inset 0 0 20px rgba(255,255,255,0.2);',
  hpText: 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: var(--text-sm); font-weight: 700; color: #fff; text-shadow: 0 0 4px rgba(0,0,0,0.8); z-index: 3;',
  phaseMarker: 'position: absolute; top: 0; width: 2px; height: 100%; background: rgba(255,255,255,0.4); z-index: 2;',
  metaRow: 'display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);',
  phaseDots: 'display: flex; align-items: center; gap: var(--space-2);',
  phaseLabel: 'font-size: var(--text-xs); color: var(--text-muted, #666); text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700;',
  phaseDot: 'width: 12px; height: 12px; border-radius: 50%; background: var(--cf-dark-3, #1a1a24); border: 2px solid rgba(255,255,255,0.08);',
  phaseDotActive: 'width: 12px; height: 12px; border-radius: 50%; background: #ff006e; border: 2px solid #ff006e; box-shadow: 0 0 10px #ff006e;',
  damage: 'display: flex; align-items: baseline; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: rgba(255,107,53,0.08); border: 2px solid #ff6b35; border-radius: var(--radius-md); box-shadow: 0 0 12px rgba(255,107,53,0.2);',
  damageLabel: 'font-size: var(--text-xs); color: var(--text-secondary, #a0a0b0); letter-spacing: 0.1em; font-weight: 700;',
  damageValue: 'font-size: var(--text-lg); font-weight: 900; color: #ff6b35; text-shadow: 0 0 12px #ff6b35; line-height: 1;',
  status: 'font-size: var(--text-sm); color: var(--text-secondary, #a0a0b0); text-transform: uppercase; letter-spacing: 0.05em; text-align: center; padding: var(--space-2) 0;',
  infoRow: 'display: flex; align-items: center; gap: var(--space-3);',
  infoBadge: 'flex: 1; display: flex; align-items: center; justify-content: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: var(--cf-dark-3, #1a1a24); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-md); font-size: var(--text-xs); font-weight: 600; color: var(--text-secondary, #a0a0b0);',
  objective: 'display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-3); background: rgba(57,255,20,0.03); border: 2px solid #39ff14; border-radius: var(--radius-md);',
  objHeader: 'display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-xs); color: #39ff14; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700;',
  objText: 'font-size: var(--text-sm); color: var(--text-primary, #fff); line-height: 1.4;',
  objProgress: 'position: relative; height: 8px; background: var(--cf-dark-3, #1a1a24); border-radius: var(--radius-sm); overflow: hidden;',
  objFill: 'position: absolute; top: 0; left: 0; height: 100%; background: linear-gradient(90deg, #39ff14, #00f0ff); box-shadow: 0 0 8px #39ff14;',
  objCount: 'font-size: var(--text-xs); color: var(--text-muted, #666); text-align: right;',
  noBoss: 'display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-3); padding: var(--space-8);',
  noBossText: 'font-size: var(--text-lg); font-weight: 700; color: var(--cf-cyan, #00f0ff); text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.5;',
  overlay: 'position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(6px); z-index: 10;',
  overlayText: 'font-size: var(--text-3xl); font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em;',
}

const meta: Meta = {
  title: '🎮 Gamification/Cyber/CyberBossFight',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Weekly boss fight panel with dramatic HP bar (phase markers at 33%/66%), damage counter, phase dots, time/reward badges, objective section. States: active, defeated, failed, no boss.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const ActiveBoss: Story = {
  render: () => ({
    components: { Skull, Clock, Zap, Target },
    template: `
      <div style="${S.wrap}">
        <h3 style="${S.bossName}"><Skull :size="28" style="filter: drop-shadow(0 0 12px #ff006e);" /> THE PROCRASTINATOR</h3>
        <div style="${S.difficulty}">
          <span style="opacity: 0.7;">DIFFICULTY:</span>
          <span style="color: #ff006e; font-weight: 700; text-shadow: 0 0 8px #ff006e;">BOSS</span>
        </div>
        <div style="${S.hpBar}">
          <div style="${S.hpBg}" />
          <div style="${S.hpFill} width: 62%; background: #39ff14;" />
          <div style="${S.phaseMarker} left: 66%;" />
          <div style="${S.phaseMarker} left: 33%;" />
          <div style="${S.hpText}">62% HP</div>
        </div>
        <div style="${S.metaRow}">
          <div style="${S.phaseDots}">
            <span style="${S.phaseLabel}">PHASE</span>
            <div style="${S.phaseDotActive}" />
            <div style="${S.phaseDot}" />
            <div style="${S.phaseDot}" />
          </div>
          <div style="${S.damage}">
            <span style="${S.damageLabel}">DMG:</span>
            <span style="${S.damageValue}">8/20</span>
          </div>
        </div>
        <div style="${S.status}">Target integrity holding</div>
        <div style="${S.infoRow}">
          <div style="${S.infoBadge}"><Clock :size="16" /> 3d 14h LEFT</div>
          <div style="${S.infoBadge} border-color: #39ff14; color: #39ff14;"><Zap :size="16" /> +500 XP REWARD</div>
        </div>
        <div style="${S.objective}">
          <div style="${S.objHeader}"><Target :size="16" /> OBJECTIVE:</div>
          <div style="${S.objText}">Complete 20 tasks this week</div>
          <div style="${S.objProgress}"><div style="${S.objFill} width: 40%;" /></div>
          <div style="${S.objCount}">8/20 tasks</div>
        </div>
      </div>
    `,
  }),
}

export const LowHP: Story = {
  name: 'Boss Low HP (Phase 3)',
  render: () => ({
    components: { Skull, Clock, Zap, Target },
    template: `
      <div style="${S.wrap}">
        <h3 style="${S.bossName}"><Skull :size="28" /> DEADLINE DEMON</h3>
        <div style="${S.difficulty}">
          <span style="opacity: 0.7;">DIFFICULTY:</span>
          <span style="color: #ff006e; font-weight: 700;">BOSS</span>
        </div>
        <div style="${S.hpBar}">
          <div style="${S.hpBg}" />
          <div style="${S.hpFill} width: 18%; background: #ff006e;" />
          <div style="${S.phaseMarker} left: 66%;" />
          <div style="${S.phaseMarker} left: 33%;" />
          <div style="${S.hpText}">18% HP</div>
        </div>
        <div style="${S.metaRow}">
          <div style="${S.phaseDots}">
            <span style="${S.phaseLabel}">PHASE</span>
            <div style="${S.phaseDotActive}" />
            <div style="${S.phaseDotActive}" />
            <div style="${S.phaseDotActive}" />
          </div>
          <div style="${S.damage}">
            <span style="${S.damageLabel}">DMG:</span>
            <span style="${S.damageValue}">16/20</span>
          </div>
        </div>
        <div style="${S.status}">CRITICAL DAMAGE — Exercise caution</div>
        <div style="${S.infoRow}">
          <div style="${S.infoBadge} background: rgba(251,191,36,0.08); border-color: rgba(251,191,36,0.4); color: #fbbf24;"><Clock :size="16" /> 6h LEFT</div>
          <div style="${S.infoBadge} border-color: #39ff14; color: #39ff14;"><Zap :size="16" /> +500 XP REWARD</div>
        </div>
        <div style="${S.objective}">
          <div style="${S.objHeader}"><Target :size="16" /> OBJECTIVE:</div>
          <div style="${S.objText}">Complete 20 tasks this week</div>
          <div style="${S.objProgress}"><div style="${S.objFill} width: 80%;" /></div>
          <div style="${S.objCount}">16/20 tasks</div>
        </div>
      </div>
    `,
  }),
}

export const Defeated: Story = {
  render: () => ({
    components: { Trophy },
    template: `
      <div style="${S.wrap} min-height: 300px;">
        <h3 style="${S.bossName} color: #39ff14; text-shadow: 0 0 16px #39ff14;">
          <Trophy :size="28" style="filter: drop-shadow(0 0 12px #39ff14);" /> THE PROCRASTINATOR
        </h3>
        <div style="${S.overlay} background: radial-gradient(circle, rgba(57,255,20,0.15) 0%, rgba(0,0,0,0.9) 100%);">
          <div style="${S.overlayText} color: #39ff14; text-shadow: 0 0 10px #39ff14, 0 0 20px #39ff14, 0 0 30px #39ff14;">TERMINATED</div>
        </div>
      </div>
    `,
  }),
}

export const NoBoss: Story = {
  render: () => ({
    components: { Skull },
    template: `
      <div style="${S.wrap} min-height: 250px; border-image: none; border-color: rgba(0,240,255,0.2);">
        <div style="${S.noBoss}">
          <Skull :size="64" style="color: var(--text-muted, #666); opacity: 0.3;" />
          <div style="${S.noBossText}">NO ACTIVE THREAT</div>
          <div style="font-size: var(--text-xs); color: var(--text-muted, #666);">> SYSTEMS NOMINAL_</div>
        </div>
      </div>
    `,
  }),
}
