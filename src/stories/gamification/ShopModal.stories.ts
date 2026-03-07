import type { Meta, StoryObj } from '@storybook/vue3'
import { X, ShoppingBag, Palette, Award, Sparkles, Volume2, Check, Lock, Zap } from 'lucide-vue-next'

const S = {
  modal: 'width: 500px; background: var(--glass-bg-medium, #1a1a2e); border-radius: var(--radius-lg); border: 1px solid var(--glass-border, rgba(255,255,255,0.08)); overflow: hidden;',
  header: 'display: flex; align-items: center; justify-content: space-between; padding: var(--space-4) var(--space-6); border-bottom: 1px solid var(--glass-border, rgba(255,255,255,0.08));',
  title: 'font-size: var(--text-lg); font-weight: 700; color: var(--text-primary, #fff); display: flex; align-items: center; gap: var(--space-2);',
  balance: 'display: flex; align-items: center; gap: var(--space-1); font-size: var(--text-sm); font-weight: 700; color: #ffc107;',
  closeBtn: 'background: transparent; border: none; color: var(--text-muted, #666); cursor: pointer; padding: var(--space-1);',
  categories: 'display: flex; gap: var(--space-1); padding: var(--space-3) var(--space-6); border-bottom: 1px solid var(--glass-border, rgba(255,255,255,0.08));',
  catBtn: 'display: flex; align-items: center; gap: var(--space-1); padding: var(--space-1_5) var(--space-3); background: transparent; border: 1px solid var(--glass-border, rgba(255,255,255,0.08)); border-radius: var(--radius-sm); color: var(--text-secondary, #a0a0b0); font-size: var(--text-xs); cursor: pointer;',
  catBtnActive: 'display: flex; align-items: center; gap: var(--space-1); padding: var(--space-1_5) var(--space-3); background: rgba(78,205,196,0.08); border: 1px solid var(--brand-primary, #4ECDC4); border-radius: var(--radius-sm); color: var(--brand-primary, #4ECDC4); font-size: var(--text-xs); cursor: pointer;',
  grid: 'display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-3); padding: var(--space-4) var(--space-6); max-height: 400px; overflow-y: auto;',
  item: 'padding: var(--space-3); background: var(--glass-bg-soft, rgba(255,255,255,0.03)); border: 1px solid var(--glass-border, rgba(255,255,255,0.08)); border-radius: var(--radius-md); display: flex; flex-direction: column; gap: var(--space-2);',
  itemHeader: 'display: flex; align-items: center; gap: var(--space-2);',
  itemIcon: 'width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.3); border-radius: var(--radius-sm);',
  itemName: 'font-size: var(--text-sm); font-weight: 600; color: var(--text-primary, #fff);',
  itemDesc: 'font-size: var(--text-xs); color: var(--text-muted, #666);',
  itemFooter: 'display: flex; justify-content: space-between; align-items: center;',
  price: 'display: flex; align-items: center; gap: var(--space-1); font-size: var(--text-xs); font-weight: 700; color: #ffc107;',
  buyBtn: 'padding: var(--space-1) var(--space-3); background: var(--glass-bg-soft, rgba(255,255,255,0.03)); border: 1px solid var(--brand-primary, #4ECDC4); border-radius: var(--radius-sm); color: var(--brand-primary, #4ECDC4); font-size: var(--text-xs); font-weight: 600; cursor: pointer;',
  owned: 'display: flex; align-items: center; gap: var(--space-1); font-size: var(--text-xs); color: var(--color-success, #a3e635);',
}

const meta: Meta = {
  title: '🎮 Gamification/ShopModal',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Full-screen shop modal with category filters (All, Themes, Badges, Animations, Sounds), item grid with previews, XP prices, and purchase/owned states.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { X, ShoppingBag, Palette, Award, Sparkles, Volume2, Check, Lock, Zap },
    template: `
      <div style="${S.modal}">
        <div style="${S.header}">
          <span style="${S.title}"><ShoppingBag :size="20" /> XP Shop</span>
          <div style="display: flex; align-items: center; gap: var(--space-3);">
            <div style="${S.balance}"><Zap :size="14" /> 2,450 XP</div>
            <button style="${S.closeBtn}"><X :size="20" /></button>
          </div>
        </div>
        <div style="${S.categories}">
          <button style="${S.catBtnActive}"><ShoppingBag :size="12" /> All</button>
          <button style="${S.catBtn}"><Palette :size="12" /> Themes</button>
          <button style="${S.catBtn}"><Award :size="12" /> Badges</button>
          <button style="${S.catBtn}"><Sparkles :size="12" /> Animations</button>
          <button style="${S.catBtn}"><Volume2 :size="12" /> Sounds</button>
        </div>
        <div style="${S.grid}">
          <div style="${S.item}">
            <div style="${S.itemHeader}">
              <div style="${S.itemIcon}"><Palette :size="18" style="color: #8b5cf6;" /></div>
              <span style="${S.itemName}">Neon Midnight</span>
            </div>
            <span style="${S.itemDesc}">Dark theme with neon accents</span>
            <div style="${S.itemFooter}">
              <span style="${S.price}"><Zap :size="12" /> 500</span>
              <button style="${S.buyBtn}">Purchase</button>
            </div>
          </div>
          <div style="${S.item} border-color: rgba(163,230,53,0.2);">
            <div style="${S.itemHeader}">
              <div style="${S.itemIcon} border-color: rgba(163,230,53,0.3);"><Award :size="18" style="color: #a3e635;" /></div>
              <span style="${S.itemName}">Cyber Badge</span>
            </div>
            <span style="${S.itemDesc}">Hexagonal level badge style</span>
            <div style="${S.itemFooter}">
              <span style="${S.owned}"><Check :size="12" /> Owned</span>
            </div>
          </div>
          <div style="${S.item}">
            <div style="${S.itemHeader}">
              <div style="${S.itemIcon}"><Sparkles :size="18" style="color: #8b5cf6;" /></div>
              <span style="${S.itemName}">Pulse Effect</span>
            </div>
            <span style="${S.itemDesc}">Animated pulse on task completion</span>
            <div style="${S.itemFooter}">
              <span style="${S.price}"><Zap :size="12" /> 1,200</span>
              <button style="${S.buyBtn}">Purchase</button>
            </div>
          </div>
          <div style="${S.item} opacity: 0.5;">
            <div style="${S.itemHeader}">
              <div style="${S.itemIcon}"><Lock :size="18" style="color: rgba(255,255,255,0.3);" /></div>
              <span style="${S.itemName}">Synth Wave</span>
            </div>
            <span style="${S.itemDesc}">Requires Level 20</span>
            <div style="${S.itemFooter}">
              <span style="font-size: var(--text-xs); color: var(--text-muted, #666);"><Lock :size="12" /> Lvl 20</span>
            </div>
          </div>
        </div>
      </div>
    `,
  }),
}
