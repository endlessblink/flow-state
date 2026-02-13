import type { Meta, StoryObj } from '@storybook/vue3'
import GamificationTooltipWrapper from '@/components/gamification/GamificationTooltipWrapper.vue'

const meta = {
  component: GamificationTooltipWrapper,
  title: '🎮 Gamification/GamificationTooltipWrapper',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    disabled: {
      control: 'boolean',
      description: 'Disable tooltip',
    },
    panelOpen: {
      control: 'boolean',
      description: 'Force hide when panel is open',
    },
  },
} satisfies Meta<typeof GamificationTooltipWrapper>

export default meta
type Story = StoryObj<typeof meta>

// Default
export const Default: Story = {
  args: {
    disabled: false,
    panelOpen: false,
  },
  render: (args) => ({
    components: { GamificationTooltipWrapper },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-20); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <h3 style="margin: 0 0 var(--space-4) 0; color: var(--text-primary); font-size: var(--text-base);">Hover the widget below</h3>
        <GamificationTooltipWrapper v-bind="args">
          <div style="padding: var(--space-3) var(--space-4); background: rgba(var(--neon-cyan), 0.15); border: 1px solid rgba(var(--neon-cyan), 0.4); border-radius: var(--radius-md); color: rgba(var(--neon-cyan), 1); cursor: pointer;">
            Hover me for tooltip
          </div>
          <template #tooltip>
            <div style="padding: var(--space-3); min-width: 200px;">
              <h4 style="margin: 0 0 var(--space-2) 0; color: var(--text-primary); font-size: var(--text-sm); font-weight: 600;">Tooltip Content</h4>
              <p style="margin: 0; color: var(--text-secondary); font-size: var(--text-xs); line-height: 1.5;">
                This tooltip appears after 200ms hover delay. It's used for gamification widget rich tooltips.
              </p>
            </div>
          </template>
        </GamificationTooltipWrapper>
      </div>
    `,
  }),
}

// Disabled
export const Disabled: Story = {
  args: {
    disabled: true,
    panelOpen: false,
  },
  render: (args) => ({
    components: { GamificationTooltipWrapper },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-20); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <h3 style="margin: 0 0 var(--space-4) 0; color: var(--text-primary); font-size: var(--text-base);">Tooltip Disabled</h3>
        <GamificationTooltipWrapper v-bind="args">
          <div style="padding: var(--space-3) var(--space-4); background: rgba(var(--neon-cyan), 0.15); border: 1px solid rgba(var(--neon-cyan), 0.4); border-radius: var(--radius-md); color: rgba(var(--neon-cyan), 1); opacity: 0.6;">
            Tooltip won't show
          </div>
          <template #tooltip>
            <div style="padding: var(--space-3);">
              <p style="margin: 0; color: var(--text-secondary); font-size: var(--text-xs);">This won't appear</p>
            </div>
          </template>
        </GamificationTooltipWrapper>
      </div>
    `,
  }),
}

// Panel Open (force hide)
export const PanelOpen: Story = {
  args: {
    disabled: false,
    panelOpen: true,
  },
  render: (args) => ({
    components: { GamificationTooltipWrapper },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-20); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <h3 style="margin: 0 0 var(--space-4) 0; color: var(--text-primary); font-size: var(--text-base);">Panel Open (tooltip hidden)</h3>
        <p style="margin: 0 0 var(--space-4) 0; color: var(--text-secondary); font-size: var(--text-sm);">When panelOpen is true, tooltip is force-hidden to avoid clutter.</p>
        <GamificationTooltipWrapper v-bind="args">
          <div style="padding: var(--space-3) var(--space-4); background: rgba(var(--neon-cyan), 0.15); border: 1px solid rgba(var(--neon-cyan), 0.4); border-radius: var(--radius-md); color: rgba(var(--neon-cyan), 1);">
            Tooltip hidden
          </div>
          <template #tooltip>
            <div style="padding: var(--space-3);">
              <p style="margin: 0; color: var(--text-secondary); font-size: var(--text-xs);">This won't show when panel is open</p>
            </div>
          </template>
        </GamificationTooltipWrapper>
      </div>
    `,
  }),
}

// Usage Documentation
export const UsageDocumentation: Story = {
  render: () => ({
    components: { GamificationTooltipWrapper },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 500px;">
        <h3 style="margin: 0 0 var(--space-4) 0; color: var(--text-primary); font-size: var(--text-lg);">GamificationTooltipWrapper Usage</h3>

        <div style="margin-bottom: var(--space-6);">
          <h4 style="margin: 0 0 var(--space-2) 0; color: var(--text-primary); font-size: var(--text-base); font-weight: 600;">Purpose</h4>
          <p style="margin: 0; color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.6;">
            Lightweight hover wrapper for per-widget rich tooltips in the gamification HUD. Shows BasePopover (variant="tooltip") on mouseenter with 200ms delay.
          </p>
        </div>

        <div style="margin-bottom: var(--space-6);">
          <h4 style="margin: 0 0 var(--space-2) 0; color: var(--text-primary); font-size: var(--text-base); font-weight: 600;">Features</h4>
          <ul style="margin: 0; padding-left: var(--space-5); color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.8;">
            <li>200ms hover delay before showing</li>
            <li>Force-hides when panelOpen prop is true</li>
            <li>Can be disabled with disabled prop</li>
            <li>Uses BasePopover (variant="tooltip") for consistent styling</li>
            <li>Positioned below the wrapped content</li>
          </ul>
        </div>

        <div style="margin-bottom: var(--space-6);">
          <h4 style="margin: 0 0 var(--space-2) 0; color: var(--text-primary); font-size: var(--text-base); font-weight: 600;">Example Usage</h4>
          <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md); font-family: monospace; font-size: var(--text-xs); color: var(--text-tertiary); overflow-x: auto;">
            <pre style="margin: 0; white-space: pre-wrap;">&lt;GamificationTooltipWrapper :panel-open="panelOpen"&gt;
  &lt;div class="hud-section"&gt;Level {{ level }}&lt;/div&gt;
  &lt;template #tooltip&gt;
    &lt;LevelTooltipContent /&gt;
  &lt;/template&gt;
&lt;/GamificationTooltipWrapper&gt;</pre>
          </div>
        </div>

        <div style="padding: var(--space-4); background: rgba(var(--neon-cyan), 0.05); border-radius: var(--radius-md); border: 1px solid rgba(var(--neon-cyan), 0.15);">
          <p style="margin: 0; color: var(--text-tertiary); font-size: var(--text-xs); line-height: 1.6;">
            <strong style="color: var(--text-secondary);">Note:</strong> Used in GamificationHUD.vue to wrap each stat widget (level, XP, streak, challenges). The tooltip content is passed via the #tooltip slot.
          </p>
        </div>
      </div>
    `,
  }),
}
