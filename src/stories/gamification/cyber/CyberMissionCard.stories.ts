import type { Meta, StoryObj } from '@storybook/vue3'
import { CheckSquare, Timer, Flame, Zap } from 'lucide-vue-next'

const S = {
  wrap: 'width: 500px; background: var(--cf-dark-1, #0a0a0f); padding: var(--space-4); border-radius: var(--radius-lg);',
  card: 'display: flex; align-items: center; gap: var(--space-3); background: var(--cf-dark-3, #1a1a24); border-radius: var(--radius-md); padding: var(--space-3); min-height: 90px; cursor: pointer; position: relative; overflow: hidden;',
  iconBox: 'flex-shrink: 0; width: 54px; height: 54px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md);',
  content: 'flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--space-1);',
  objective: 'margin: 0; font-size: var(--text-base); font-weight: 700; color: var(--text-primary, #fff); letter-spacing: 0.01em; line-height: 1.3;',
  progressRow: 'display: flex; align-items: center; gap: var(--space-2);',
  progressTrack: 'flex: 1; height: 6px; background: var(--cf-dark-2, #111118); border-radius: 3px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);',
  progressFill: 'height: 100%; border-radius: 3px;',
  progressText: 'font-size: var(--text-sm); font-weight: 700; color: var(--text-secondary, #a0a0b0); min-width: 40px; text-align: right;',
  meta: 'display: flex; align-items: center; gap: var(--space-3); font-size: var(--text-xs); letter-spacing: 0.06em;',
  right: 'flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: var(--space-2);',
  xpBadge: 'display: flex; align-items: center; gap: var(--space-1); padding: var(--space-1) var(--space-2); background: var(--cf-dark-2, #111118); border: 1px solid #ffc107; border-radius: var(--radius-sm); font-size: var(--text-sm); font-weight: 700; color: #ffc107;',
  activateBtn: 'padding: var(--space-1) var(--space-3); background: var(--cf-dark-2, #111118); border-radius: var(--radius-sm); font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.08em; cursor: pointer;',
  activeIndicator: 'padding: var(--space-1) var(--space-3); border-radius: var(--radius-sm); font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.08em;',
  statusBadge: 'padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.08em;',
}

const meta: Meta = {
  title: '🎮 Gamification/Cyber/CyberMissionCard',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Interactive mission card with objective icon, progress bar, difficulty color, time remaining, XP reward, and activate/active/completed/failed states.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const EasyMission: Story = {
  render: () => ({
    components: { CheckSquare, Zap },
    template: `
      <div style="${S.wrap}">
        <div style="${S.card} border: 2px solid rgba(57,255,20,0.15);">
          <div style="${S.iconBox} background: rgba(57,255,20,0.15); border: 2px solid #39ff14;">
            <CheckSquare :size="40" style="color: #39ff14; filter: drop-shadow(0 0 6px #39ff14);" />
          </div>
          <div style="${S.content}">
            <h3 style="${S.objective}">Complete 3 tasks</h3>
            <div style="${S.progressRow}">
              <div style="${S.progressTrack}">
                <div style="${S.progressFill} width: 33%; background: linear-gradient(90deg, #39ff14, #00f0ff); box-shadow: 0 0 8px #39ff14;" />
              </div>
              <span style="${S.progressText}">1/3</span>
            </div>
            <div style="${S.meta}">
              <span style="font-weight: 700; color: #39ff14; opacity: 0.9;">EASY</span>
              <span style="color: var(--text-muted, #666); font-weight: 600;">8h left</span>
            </div>
          </div>
          <div style="${S.right}">
            <div style="${S.xpBadge}"><Zap :size="14" /> +50</div>
            <button style="${S.activateBtn} border: 1px solid #39ff14; color: #39ff14;">ACTIVATE</button>
          </div>
        </div>
      </div>
    `,
  }),
}

export const HardMissionActive: Story = {
  name: 'Hard Mission (Active)',
  render: () => ({
    components: { Flame, Zap },
    template: `
      <div style="${S.wrap}">
        <div style="${S.card} border: 2px solid #ff6b35; transform: scale(1.02); box-shadow: 0 0 24px rgba(255,107,53,0.15);">
          <div style="${S.iconBox} background: rgba(255,107,53,0.15); border: 2px solid #ff6b35; box-shadow: 0 0 24px #ff6b35;">
            <Flame :size="40" style="color: #ff6b35; filter: drop-shadow(0 0 6px #ff6b35);" />
          </div>
          <div style="${S.content}">
            <h3 style="${S.objective}">Clear 5 urgent tasks</h3>
            <div style="${S.progressRow}">
              <div style="${S.progressTrack}">
                <div style="${S.progressFill} width: 60%; background: linear-gradient(90deg, #ff6b35, #00f0ff); box-shadow: 0 0 12px #ff6b35;" />
              </div>
              <span style="${S.progressText}">3/5</span>
            </div>
            <div style="${S.meta}">
              <span style="font-weight: 700; color: #ff6b35; opacity: 0.9;">HARD</span>
              <span style="color: var(--text-muted, #666); font-weight: 600;">3h left</span>
            </div>
          </div>
          <div style="${S.right}">
            <div style="${S.xpBadge}"><Zap :size="14" /> +200</div>
            <div style="${S.activeIndicator} background: #ff6b35; border: 1px solid #ff6b35; color: var(--cf-dark-1, #0a0a0f); box-shadow: 0 0 16px #ff6b35;">ACTIVE</div>
          </div>
        </div>
      </div>
    `,
  }),
}

export const CompletedMission: Story = {
  render: () => ({
    components: { Timer, Zap },
    template: `
      <div style="${S.wrap}">
        <div style="${S.card} border: 2px solid #39ff14; opacity: 0.7; cursor: default;">
          <div style="${S.iconBox} background: rgba(57,255,20,0.15); border: 2px solid #39ff14;">
            <Timer :size="40" style="color: #39ff14; filter: drop-shadow(0 0 6px #39ff14);" />
          </div>
          <div style="${S.content}">
            <h3 style="${S.objective}">Do 4 pomodoros</h3>
            <div style="${S.progressRow}">
              <div style="${S.progressTrack}">
                <div style="${S.progressFill} width: 100%; background: linear-gradient(90deg, #39ff14, #00f0ff);" />
              </div>
              <span style="${S.progressText}">4/4</span>
            </div>
            <div style="${S.meta}">
              <span style="font-weight: 700; color: #00f0ff;">NORMAL</span>
              <span style="color: var(--text-muted, #666);">Completed</span>
            </div>
          </div>
          <div style="${S.right}">
            <div style="${S.xpBadge}"><Zap :size="14" /> +100</div>
            <div style="${S.statusBadge} background: #39ff14; color: var(--cf-dark-1, #0a0a0f); border: 1px solid #39ff14;">✓ DONE</div>
          </div>
        </div>
      </div>
    `,
  }),
}

export const FailedMission: Story = {
  render: () => ({
    components: { CheckSquare, Zap },
    template: `
      <div style="${S.wrap}">
        <div style="${S.card} border: 2px solid #ff006e; opacity: 0.5; cursor: default;">
          <div style="${S.iconBox} background: rgba(255,0,110,0.15); border: 2px solid #ff006e;">
            <CheckSquare :size="40" style="color: #ff006e;" />
          </div>
          <div style="${S.content}">
            <h3 style="${S.objective}">Complete 10 tasks</h3>
            <div style="${S.progressRow}">
              <div style="${S.progressTrack}">
                <div style="${S.progressFill} width: 30%; background: linear-gradient(90deg, #ff006e, #00f0ff);" />
              </div>
              <span style="${S.progressText}">3/10</span>
            </div>
            <div style="${S.meta}">
              <span style="font-weight: 700; color: #ff006e;">BOSS</span>
              <span style="color: var(--text-muted, #666);">Expired</span>
            </div>
          </div>
          <div style="${S.right}">
            <div style="${S.xpBadge}"><Zap :size="14" /> +500</div>
            <div style="${S.statusBadge} background: #ff006e; color: var(--cf-dark-1, #0a0a0f); border: 1px solid #ff006e;">FAILED</div>
          </div>
        </div>
      </div>
    `,
  }),
}
