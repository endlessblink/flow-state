import type { Meta, StoryObj } from '@storybook/vue3'
import { Crown, Shirt, Hand, Waves, Palette, Hexagon, Sparkles, Radio, Lock, Check, Zap } from 'lucide-vue-next'

const S = {
  wrap: 'width: 700px; height: 450px; background: var(--cf-dark-1, #0a0a0f); padding: var(--space-4); border-radius: var(--radius-lg); display: grid; grid-template-columns: 30% 70%; gap: var(--space-4); border: 1px solid rgba(0,240,255,0.2);',
  silhouette: 'display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-4); background: var(--cf-dark-2, #111118); border: 1px solid rgba(0,240,255,0.15); border-radius: var(--radius-md); padding: var(--space-4); position: relative;',
  silhouetteBody: 'width: 80px; height: 160px; background: linear-gradient(180deg, rgba(0,240,255,0.1), rgba(139,92,246,0.1)); border: 2px solid rgba(0,240,255,0.3); border-radius: 40px 40px 20px 20px; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;',
  slot: 'width: 36px; height: 36px; border: 2px dashed rgba(255,255,255,0.15); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; background: var(--cf-dark-3, #1a1a24); margin: var(--space-1) 0; cursor: pointer;',
  slotActive: 'width: 36px; height: 36px; border: 2px solid #00f0ff; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; background: rgba(0,240,255,0.1); margin: var(--space-1) 0; cursor: pointer; box-shadow: 0 0 8px rgba(0,240,255,0.3);',
  slotLabel: 'font-size: 8px; color: var(--text-muted, #666); letter-spacing: 0.1em; text-transform: uppercase; text-align: center;',
  tree: 'display: flex; flex-direction: column; gap: var(--space-3); overflow-y: auto;',
  branch: 'display: flex; flex-direction: column; gap: var(--space-2);',
  branchTitle: 'font-size: var(--text-xs); font-weight: 700; color: #00f0ff; letter-spacing: 0.1em; text-transform: uppercase; display: flex; align-items: center; gap: var(--space-2);',
  branchItems: 'display: flex; gap: var(--space-2); overflow-x: auto;',
  node: 'flex-shrink: 0; width: 64px; height: 80px; background: var(--cf-dark-3, #1a1a24); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--radius-sm); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-1); cursor: pointer; padding: var(--space-1);',
  nodeOwned: 'flex-shrink: 0; width: 64px; height: 80px; background: var(--cf-dark-3, #1a1a24); border: 1px solid #39ff14; border-radius: var(--radius-sm); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-1); padding: var(--space-1);',
  nodeLocked: 'flex-shrink: 0; width: 64px; height: 80px; background: var(--cf-dark-3, #1a1a24); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--radius-sm); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-1); opacity: 0.4; padding: var(--space-1);',
  nodeName: 'font-size: 8px; color: var(--text-secondary, #a0a0b0); text-align: center; line-height: 1.2;',
  nodePrice: 'font-size: 8px; color: #ffc107; font-weight: 700; display: flex; align-items: center; gap: 2px;',
  connector: 'width: 16px; height: 2px; background: rgba(0,240,255,0.2); flex-shrink: 0; align-self: center;',
  detail: 'grid-column: 1 / -1; padding: var(--space-3); background: var(--cf-dark-2, #111118); border: 1px solid rgba(0,240,255,0.3); border-radius: var(--radius-md); display: flex; align-items: center; gap: var(--space-3);',
}

const meta: Meta = {
  title: '🎮 Gamification/Cyber/CyberSkillTree',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Viewport-filling skill tree with character silhouette (4 equipment slots: Head/Body/Hands/Aura) on the left and horizontal skill branches (theme, badge, animation, sound) on the right.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { Crown, Shirt, Hand, Waves, Palette, Hexagon, Sparkles, Radio, Lock, Check, Zap },
    template: `
      <div style="${S.wrap}">
        <div style="${S.silhouette}">
          <span style="${S.slotLabel}">HEAD</span>
          <div style="${S.slotActive}"><Crown :size="16" style="color: #00f0ff;" /></div>
          <span style="${S.slotLabel}">BODY</span>
          <div style="${S.slot}"><Shirt :size="16" style="color: rgba(255,255,255,0.3);" /></div>
          <span style="${S.slotLabel}">HANDS</span>
          <div style="${S.slot}"><Hand :size="16" style="color: rgba(255,255,255,0.3);" /></div>
          <span style="${S.slotLabel}">AURA</span>
          <div style="${S.slot}"><Waves :size="16" style="color: rgba(255,255,255,0.3);" /></div>
        </div>
        <div style="${S.tree}">
          <div style="${S.branch}">
            <div style="${S.branchTitle}"><Palette :size="14" /> THEMES</div>
            <div style="${S.branchItems}">
              <div style="${S.nodeOwned}"><Palette :size="20" style="color: #39ff14;" /><span style="${S.nodeName}">Default</span><span style="font-size: 8px; color: #39ff14;"><Check :size="10" /></span></div>
              <div style="${S.connector}" />
              <div style="${S.node}"><Palette :size="20" style="color: #8b5cf6;" /><span style="${S.nodeName}">Neon</span><span style="${S.nodePrice}"><Zap :size="8" /> 500</span></div>
              <div style="${S.connector}" />
              <div style="${S.nodeLocked}"><Lock :size="20" style="color: rgba(255,255,255,0.3);" /><span style="${S.nodeName}">Void</span><span style="${S.nodeName}">Lv.20</span></div>
            </div>
          </div>
          <div style="${S.branch}">
            <div style="${S.branchTitle}"><Hexagon :size="14" /> BADGES</div>
            <div style="${S.branchItems}">
              <div style="${S.nodeOwned}"><Hexagon :size="20" style="color: #39ff14;" /><span style="${S.nodeName}">Basic</span><span style="font-size: 8px; color: #39ff14;"><Check :size="10" /></span></div>
              <div style="${S.connector}" />
              <div style="${S.node}"><Hexagon :size="20" style="color: #ffc107;" /><span style="${S.nodeName}">Gold</span><span style="${S.nodePrice}"><Zap :size="8" /> 800</span></div>
              <div style="${S.connector}" />
              <div style="${S.node}"><Hexagon :size="20" style="color: #ff006e;" /><span style="${S.nodeName}">Neon</span><span style="${S.nodePrice}"><Zap :size="8" /> 1.5k</span></div>
            </div>
          </div>
          <div style="${S.branch}">
            <div style="${S.branchTitle}"><Sparkles :size="14" /> ANIMATIONS</div>
            <div style="${S.branchItems}">
              <div style="${S.nodeOwned}"><Sparkles :size="20" style="color: #39ff14;" /><span style="${S.nodeName}">Fade</span><span style="font-size: 8px; color: #39ff14;"><Check :size="10" /></span></div>
              <div style="${S.connector}" />
              <div style="${S.node}"><Sparkles :size="20" style="color: #8b5cf6;" /><span style="${S.nodeName}">Pulse</span><span style="${S.nodePrice}"><Zap :size="8" /> 1.2k</span></div>
            </div>
          </div>
          <div style="${S.branch}">
            <div style="${S.branchTitle}"><Radio :size="14" /> SOUNDS</div>
            <div style="${S.branchItems}">
              <div style="${S.nodeLocked}"><Lock :size="20" style="color: rgba(255,255,255,0.3);" /><span style="${S.nodeName}">Synth</span><span style="${S.nodeName}">Lv.10</span></div>
              <div style="${S.connector}" />
              <div style="${S.nodeLocked}"><Lock :size="20" style="color: rgba(255,255,255,0.3);" /><span style="${S.nodeName}">Retro</span><span style="${S.nodeName}">Lv.15</span></div>
            </div>
          </div>
        </div>
      </div>
    `,
  }),
}
