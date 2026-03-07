import type { Meta, StoryObj } from '@storybook/vue3'
import { Palette, Hexagon, Sparkles, Radio, Lock, Check, ShoppingBag, ChevronRight, Zap } from 'lucide-vue-next'

const S = {
  wrap: 'width: 400px; background: var(--cf-dark-2, #111118); padding: var(--space-3); border-radius: var(--radius-lg); display: flex; flex-direction: column; gap: var(--space-3); border: 1px solid rgba(139,92,246,0.3);',
  header: 'display: flex; align-items: center; gap: var(--space-2);',
  headerIcon: 'color: #8b5cf6; filter: drop-shadow(0 0 6px #8b5cf6);',
  headerText: 'font-size: var(--text-sm); font-weight: 700; color: #8b5cf6; letter-spacing: 0.1em; flex: 1;',
  xpBadge: 'display: flex; align-items: center; gap: var(--space-1); font-size: var(--text-xs); font-weight: 700; color: #ffc107; padding: 2px var(--space-2); background: rgba(255,193,7,0.08); border: 1px solid rgba(255,193,7,0.3); border-radius: var(--radius-sm);',
  grid: 'display: flex; flex-direction: column; gap: var(--space-2);',
  item: 'display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); background: var(--cf-dark-3, #1a1a24); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--radius-sm); cursor: pointer;',
  itemOwned: 'display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); background: var(--cf-dark-3, #1a1a24); border: 1px solid rgba(57,255,20,0.3); border-radius: var(--radius-sm); opacity: 0.7;',
  itemLocked: 'display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); background: var(--cf-dark-3, #1a1a24); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--radius-sm); opacity: 0.4;',
  itemIcon: 'flex-shrink: 0; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.3); border-radius: var(--radius-sm);',
  itemInfo: 'flex: 1; display: flex; flex-direction: column; gap: 2px;',
  itemName: 'font-size: var(--text-sm); font-weight: 700; color: var(--text-primary, #fff);',
  itemCategory: 'font-size: 9px; color: var(--text-muted, #666); text-transform: uppercase; letter-spacing: 0.1em;',
  itemPrice: 'display: flex; align-items: center; gap: var(--space-1); font-size: var(--text-xs); font-weight: 700; color: #ffc107;',
  itemStatus: 'font-size: var(--text-xs); font-weight: 700;',
  viewAll: 'display: flex; align-items: center; justify-content: center; gap: var(--space-2); padding: var(--space-2); background: rgba(139,92,246,0.05); border: 1px solid rgba(139,92,246,0.3); border-radius: var(--radius-sm); color: #8b5cf6; font-size: var(--text-xs); font-weight: 600; letter-spacing: 0.1em; cursor: pointer;',
}

const meta: Meta = {
  title: '🎮 Gamification/Cyber/CyberShop',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Shop catalog with icon-dominant item cards, rarity glow borders, XP balance, purchase states (available/owned/locked). Categories: theme, badge_style, animation, sound.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { Palette, Hexagon, Sparkles, Radio, Lock, Check, ShoppingBag, ChevronRight, Zap },
    template: `
      <div style="${S.wrap}">
        <div style="${S.header}">
          <ShoppingBag :size="16" style="${S.headerIcon}" />
          <span style="${S.headerText}">SHOP</span>
          <div style="${S.xpBadge}"><Zap :size="12" /> 2,450 XP</div>
        </div>
        <div style="${S.grid}">
          <div style="${S.item}">
            <div style="${S.itemIcon}"><Palette :size="24" style="color: #8b5cf6;" /></div>
            <div style="${S.itemInfo}">
              <span style="${S.itemName}">Neon Midnight</span>
              <span style="${S.itemCategory}">Theme</span>
            </div>
            <div style="${S.itemPrice}"><Zap :size="12" /> 500</div>
          </div>
          <div style="${S.itemOwned}">
            <div style="${S.itemIcon} border-color: rgba(57,255,20,0.3);"><Hexagon :size="24" style="color: #39ff14;" /></div>
            <div style="${S.itemInfo}">
              <span style="${S.itemName}">Cyber Badge</span>
              <span style="${S.itemCategory}">Badge Style</span>
            </div>
            <span style="${S.itemStatus} color: #39ff14;"><Check :size="14" /> OWNED</span>
          </div>
          <div style="${S.item}">
            <div style="${S.itemIcon}"><Sparkles :size="24" style="color: #8b5cf6;" /></div>
            <div style="${S.itemInfo}">
              <span style="${S.itemName}">Pulse Effect</span>
              <span style="${S.itemCategory}">Animation</span>
            </div>
            <div style="${S.itemPrice}"><Zap :size="12" /> 1,200</div>
          </div>
          <div style="${S.itemLocked}">
            <div style="${S.itemIcon}"><Lock :size="24" style="color: rgba(255,255,255,0.3);" /></div>
            <div style="${S.itemInfo}">
              <span style="${S.itemName}">Synth Wave</span>
              <span style="${S.itemCategory}">Sound • Level 20</span>
            </div>
            <span style="${S.itemStatus} color: var(--text-muted, #666);"><Lock :size="12" /> LVL 20</span>
          </div>
        </div>
        <button style="${S.viewAll}"><span>VIEW ALL</span><ChevronRight :size="14" /></button>
      </div>
    `,
  }),
}
