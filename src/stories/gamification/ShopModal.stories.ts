import type { Meta, StoryObj } from '@storybook/vue3'
import ShopModal from '@/components/gamification/ShopModal.vue'

const meta = {
  component: ShopModal,
  title: '🎮 Gamification/ShopModal',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ShopModal>

export default meta
type Story = StoryObj<typeof meta>

// Documentation (store-dependent component)
export const Documentation: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-10); background: var(--app-background-gradient); min-height: 100vh;">
        <h1 style="margin: 0 0 var(--space-6) 0; color: var(--text-primary); font-size: var(--text-3xl);">ShopModal Component</h1>

        <div style="display: flex; flex-direction: column; gap: var(--space-6); max-width: 800px;">
          <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary);">Purpose</h3>
            <p style="margin: 0; color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.6;">
              Shop modal for purchasing themes and cosmetics with XP. Displays available items, owned items, and equipped themes.
            </p>
          </div>

          <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary);">Features</h3>
            <ul style="margin: 0; padding-left: var(--space-5); color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.8;">
              <li>Category tabs (All, Themes, Badges, Animations, Sounds)</li>
              <li>Available XP balance display in header</li>
              <li>Item cards with icon, name, description, price</li>
              <li>Purchase button (disabled if insufficient XP or locked)</li>
              <li>Equip button for owned themes</li>
              <li>Owned/Equipped badges</li>
              <li>Level requirements (locked state)</li>
              <li>Theme preview on hover</li>
              <li>Auto-equip after theme purchase</li>
            </ul>
          </div>

          <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary);">Item Categories</h3>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md);">
              <ul style="margin: 0; padding-left: var(--space-5); color: var(--text-tertiary); font-size: var(--text-sm); line-height: 1.8;">
                <li><strong style="color: var(--text-secondary);">theme:</strong> UI color themes (can equip one at a time)</li>
                <li><strong style="color: var(--text-secondary);">badge_style:</strong> Level badge customization</li>
                <li><strong style="color: var(--text-secondary);">animation:</strong> XP/level-up animation effects</li>
                <li><strong style="color: var(--text-secondary);">sound:</strong> Audio effects for gamification events</li>
              </ul>
            </div>
          </div>

          <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary);">Props & Events</h3>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md); font-family: monospace; font-size: var(--text-xs); color: var(--text-tertiary);">
              <pre style="margin: 0; white-space: pre-wrap;">// Props
open: boolean  // Modal visibility

// Events
@close  // Emitted when user closes modal</pre>
            </div>
          </div>

          <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary);">Theme Preview System</h3>
            <p style="margin: 0 0 var(--space-2) 0; color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.6;">
              Hovering over a theme item applies it temporarily. Moving away cancels the preview and restores the equipped theme.
            </p>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md); font-family: monospace; font-size: var(--text-xs); color: var(--text-tertiary);">
              <pre style="margin: 0; white-space: pre-wrap;">@mouseenter="previewTheme(item)"
@mouseleave="cancelPreview"</pre>
            </div>
          </div>

          <div style="padding: var(--space-6); background: rgba(var(--neon-cyan), 0.05); border-radius: var(--radius-lg); border: 1px solid rgba(var(--neon-cyan), 0.15);">
            <h4 style="margin: 0 0 var(--space-2) 0; color: var(--text-primary); font-size: var(--text-sm); font-weight: 600;">Usage Example</h4>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md); font-family: monospace; font-size: var(--text-xs); color: var(--text-tertiary);">
              <pre style="margin: 0; white-space: pre-wrap;">&lt;ShopModal
  :open="showShop"
  @close="showShop = false"
/&gt;</pre>
            </div>
          </div>

          <div style="padding: var(--space-6); background: rgba(var(--neon-magenta), 0.05); border-radius: var(--radius-lg); border: 1px solid rgba(var(--neon-magenta), 0.15);">
            <p style="margin: 0; color: var(--text-tertiary); font-size: var(--text-xs); line-height: 1.6;">
              <strong style="color: var(--text-secondary);">Store Dependency:</strong> Reads from gamificationStore (availableXp, currentLevel, shopItemsWithOwnership, equippedTheme). Calls purchaseItem() and equipTheme() actions.
            </p>
          </div>
        </div>
      </div>
    `,
  }),
}
