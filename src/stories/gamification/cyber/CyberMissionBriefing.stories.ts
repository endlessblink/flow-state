import type { Meta, StoryObj } from '@storybook/vue3'
import { Crosshair, CheckSquare, Timer, Flame, Zap, Loader2 } from 'lucide-vue-next'

const S = {
  wrap: 'width: 500px; background: var(--cf-dark-1, #0a0a0f); padding: var(--space-4); border-radius: var(--radius-lg);',
  briefing: 'display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-1);',
  card: 'display: flex; align-items: center; gap: var(--space-3); background: var(--cf-dark-3, #1a1a24); border-radius: var(--radius-md); padding: var(--space-3); min-height: 90px; cursor: pointer; position: relative; overflow: hidden;',
  iconBox: 'flex-shrink: 0; width: 54px; height: 54px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md);',
  content: 'flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--space-1);',
  objective: 'margin: 0; font-size: var(--text-base); font-weight: 700; color: var(--text-primary, #fff);',
  progressRow: 'display: flex; align-items: center; gap: var(--space-2);',
  progressTrack: 'flex: 1; height: 6px; background: var(--cf-dark-2, #111118); border-radius: 3px; overflow: hidden;',
  progressFill: 'height: 100%; border-radius: 3px;',
  meta: 'display: flex; gap: var(--space-3); font-size: var(--text-xs);',
  right: 'flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: var(--space-2);',
  xpBadge: 'display: flex; align-items: center; gap: var(--space-1); padding: var(--space-1) var(--space-2); background: var(--cf-dark-2, #111118); border: 1px solid #ffc107; border-radius: var(--radius-sm); font-size: var(--text-sm); font-weight: 700; color: #ffc107;',
  btn: 'padding: var(--space-1) var(--space-3); background: var(--cf-dark-2, #111118); border-radius: var(--radius-sm); font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.08em; cursor: pointer;',
  empty: 'display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-3); padding: var(--space-8) var(--space-3); min-height: 200px;',
  emptyIcon: 'color: var(--cf-cyan, #00f0ff); opacity: 0.3;',
  emptyText: 'font-size: var(--text-lg); font-weight: 700; color: var(--text-muted, #666); letter-spacing: 0.05em;',
  emptyHint: 'font-size: var(--text-sm); color: var(--text-muted, #666); opacity: 0.7;',
  actionBtn: 'display: flex; align-items: center; justify-content: center; gap: var(--space-2); padding: var(--space-3) var(--space-5); background: var(--cf-dark-3, #1a1a24); border: 2px solid var(--cf-cyan, #00f0ff); border-radius: var(--radius-md); color: var(--cf-cyan, #00f0ff); font-size: var(--text-base); font-weight: 700; letter-spacing: 0.08em; cursor: pointer; margin-top: var(--space-2); box-shadow: 0 0 12px rgba(0,240,255,0.15);',
  loading: 'display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-3); padding: var(--space-8) var(--space-3); min-height: 200px;',
  loadingText: 'font-size: var(--text-base); font-weight: 600; color: var(--text-secondary, #a0a0b0); letter-spacing: 0.05em;',
}

const meta: Meta = {
  title: '🎮 Gamification/Cyber/CyberMissionBriefing',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Mission briefing panel listing active daily challenges as CyberMissionCards. Shows loading, empty (with generate button), and populated states.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const WithMissions: Story = {
  render: () => ({
    components: { CheckSquare, Timer, Flame, Zap },
    template: `
      <div style="${S.wrap}">
        <div style="${S.briefing}">
          <div style="${S.card} border: 2px solid var(--cf-cyan, #00f0ff); transform: scale(1.02); box-shadow: 0 0 24px rgba(0,240,255,0.15);">
            <div style="${S.iconBox} background: rgba(0,240,255,0.15); border: 2px solid #00f0ff; box-shadow: 0 0 24px #00f0ff;">
              <CheckSquare :size="40" style="color: #00f0ff;" />
            </div>
            <div style="${S.content}">
              <h3 style="${S.objective}">Complete 5 tasks</h3>
              <div style="${S.progressRow}">
                <div style="${S.progressTrack}"><div style="${S.progressFill} width: 40%; background: linear-gradient(90deg, #00f0ff, #00f0ff);" /></div>
                <span style="font-size: var(--text-sm); font-weight: 700; color: var(--text-secondary, #a0a0b0);">2/5</span>
              </div>
              <div style="${S.meta}">
                <span style="font-weight: 700; color: #00f0ff;">NORMAL</span>
                <span style="color: var(--text-muted, #666);">12h left</span>
              </div>
            </div>
            <div style="${S.right}">
              <div style="${S.xpBadge}"><Zap :size="14" /> +100</div>
              <div style="padding: var(--space-1) var(--space-3); background: #00f0ff; border: 1px solid #00f0ff; border-radius: var(--radius-sm); color: #0a0a0f; font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.08em; box-shadow: 0 0 16px #00f0ff;">ACTIVE</div>
            </div>
          </div>
          <div style="${S.card} border: 2px solid rgba(255,107,53,0.15); opacity: 0.6;">
            <div style="${S.iconBox} background: rgba(255,107,53,0.15); border: 2px solid #ff6b35;">
              <Flame :size="40" style="color: #ff6b35;" />
            </div>
            <div style="${S.content}">
              <h3 style="${S.objective}">Clear 3 urgent tasks</h3>
              <div style="${S.progressRow}">
                <div style="${S.progressTrack}"><div style="${S.progressFill} width: 0%; background: #ff6b35;" /></div>
                <span style="font-size: var(--text-sm); font-weight: 700; color: var(--text-secondary, #a0a0b0);">0/3</span>
              </div>
              <div style="${S.meta}">
                <span style="font-weight: 700; color: #ff6b35;">HARD</span>
                <span style="color: var(--text-muted, #666);">12h left</span>
              </div>
            </div>
            <div style="${S.right}">
              <div style="${S.xpBadge}"><Zap :size="14" /> +200</div>
              <button style="${S.btn} border: 1px solid #ff6b35; color: #ff6b35;">ACTIVATE</button>
            </div>
          </div>
        </div>
      </div>
    `,
  }),
}

export const Empty: Story = {
  render: () => ({
    components: { Crosshair },
    template: `
      <div style="${S.wrap}">
        <div style="${S.briefing}">
          <div style="${S.empty}">
            <div style="${S.emptyIcon}"><Crosshair :size="48" /></div>
            <p style="${S.emptyText}">No active missions</p>
            <p style="${S.emptyHint}">Click below to generate new missions</p>
          </div>
          <button style="${S.actionBtn}">
            <Crosshair :size="16" />
            <span>GENERATE MISSIONS</span>
          </button>
        </div>
      </div>
    `,
  }),
}

export const Loading: Story = {
  render: () => ({
    components: { Loader2 },
    template: `
      <div style="${S.wrap}">
        <div style="${S.briefing}">
          <div style="${S.loading}">
            <Loader2 :size="24" style="color: var(--cf-cyan, #00f0ff); animation: spin 1s linear infinite;" />
            <span style="${S.loadingText}">Generating missions...</span>
          </div>
        </div>
      </div>
    `,
  }),
}
