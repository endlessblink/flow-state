import type { Meta, StoryObj } from '@storybook/vue3'
import { Zap, Trophy, Target } from 'lucide-vue-next'

const S = {
  wrap: 'width: 300px; background: var(--cf-dark-1, #0a0a0f); padding: var(--space-4); border-radius: var(--radius-lg);',
  card: 'background: var(--cf-dark-2, #111118); padding: var(--space-4); min-height: 160px; position: relative;',
  title: 'font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 var(--space-3) 0;',
  content: 'display: flex; flex-direction: column; gap: var(--space-2);',
  statRow: 'display: flex; justify-content: space-between; align-items: center; font-size: var(--text-sm);',
  statLabel: 'color: var(--text-secondary, #a0a0b0);',
  statValue: 'font-weight: 700;',
}

const meta: Meta = {
  title: '🎮 Gamification/Cyber/CyberSummaryCard',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Augmented-ui card with tl/br corner clips, customizable accent color, and slot content. Used as container in the Cyberflow dashboard hub.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { Zap },
    template: `
      <div style="${S.wrap}">
        <div style="${S.card} border: 1px solid var(--cf-cyan, #00f0ff);">
          <h3 style="${S.title} color: var(--cf-cyan, #00f0ff);">Today's Stats</h3>
          <div style="${S.content}">
            <div style="${S.statRow}">
              <span style="${S.statLabel}">Tasks Done</span>
              <span style="${S.statValue} color: var(--cf-cyan, #00f0ff);">12</span>
            </div>
            <div style="${S.statRow}">
              <span style="${S.statLabel}">Focus Time</span>
              <span style="${S.statValue} color: var(--cf-cyan, #00f0ff);">2h 15m</span>
            </div>
            <div style="${S.statRow}">
              <span style="${S.statLabel}">XP Earned</span>
              <span style="${S.statValue} color: var(--cf-cyan, #00f0ff);">+450</span>
            </div>
          </div>
        </div>
      </div>
    `,
  }),
}

export const AccentColors: Story = {
  render: () => ({
    components: { Zap, Trophy, Target },
    template: `
      <div style="display: flex; gap: var(--space-4);">
        <div style="${S.wrap}">
          <div style="${S.card} border: 1px solid var(--cf-cyan, #00f0ff);">
            <h3 style="${S.title} color: var(--cf-cyan, #00f0ff);">Cyan Card</h3>
            <div style="${S.content}">
              <div style="display: flex; align-items: center; gap: var(--space-2); color: var(--cf-cyan, #00f0ff);">
                <Zap :size="24" />
                <span style="font-size: var(--text-2xl); font-weight: 900;">Level 15</span>
              </div>
            </div>
          </div>
        </div>
        <div style="${S.wrap}">
          <div style="${S.card} border: 1px solid #ff006e;">
            <h3 style="${S.title} color: #ff006e;">Magenta Card</h3>
            <div style="${S.content}">
              <div style="display: flex; align-items: center; gap: var(--space-2); color: #ff006e;">
                <Trophy :size="24" />
                <span style="font-size: var(--text-2xl); font-weight: 900;">8 / 20</span>
              </div>
            </div>
          </div>
        </div>
        <div style="${S.wrap}">
          <div style="${S.card} border: 1px solid #39ff14;">
            <h3 style="${S.title} color: #39ff14;">Lime Card</h3>
            <div style="${S.content}">
              <div style="display: flex; align-items: center; gap: var(--space-2); color: #39ff14;">
                <Target :size="24" />
                <span style="font-size: var(--text-2xl); font-weight: 900;">3 Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
  }),
}
