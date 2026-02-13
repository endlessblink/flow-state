import type { Meta, StoryObj } from '@storybook/vue3'
import ChallengePips from '@/components/gamification/ChallengePips.vue'

const meta = {
  component: ChallengePips,
  title: '🎮 Gamification/ChallengePips',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ChallengePips>

export default meta
type Story = StoryObj<typeof meta>

// Note: This component reads from the challenges store, so these stories show the visual pattern
// In actual use, the pips reflect real challenge state from the store

// Default (mock visual states)
export const Default: Story = {
  render: () => ({
    components: { ChallengePips },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <h3 style="margin: 0 0 var(--space-4) 0; color: var(--text-primary); font-size: var(--text-base);">Challenge Pips</h3>
        <p style="margin: 0 0 var(--space-4) 0; color: var(--text-secondary); font-size: var(--text-sm);">Shows daily challenge completion status (store-driven)</p>
        <ChallengePips />
      </div>
    `,
  }),
}

// Visual States Documentation
export const VisualStates: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 400px;">
        <h3 style="margin: 0 0 var(--space-4) 0; color: var(--text-primary); font-size: var(--text-base);">Pip Visual States</h3>
        <p style="margin: 0 0 var(--space-6) 0; color: var(--text-secondary); font-size: var(--text-sm);">Component shows different states based on challenge completion:</p>

        <div style="display: flex; flex-direction: column; gap: var(--space-4);">
          <!-- Completed pip -->
          <div style="display: flex; align-items: center; gap: var(--space-3);">
            <span style="width: 6px; height: 6px; border-radius: var(--radius-full); background: var(--cf-lime, #a3e635); box-shadow: 0 0 4px var(--cf-lime, rgba(163, 230, 53, 0.6));"></span>
            <span style="color: var(--text-secondary); font-size: var(--text-sm);">Completed daily challenge</span>
          </div>

          <!-- Active pip -->
          <div style="display: flex; align-items: center; gap: var(--space-3);">
            <span style="width: 6px; height: 6px; border-radius: var(--radius-full); background: transparent; border: 1px solid var(--cf-cyan, rgba(0, 255, 255, 0.6));"></span>
            <span style="color: var(--text-secondary); font-size: var(--text-sm);">Active daily challenge (in progress)</span>
          </div>

          <!-- Boss pip (diamond) -->
          <div style="display: flex; align-items: center; gap: var(--space-3);">
            <span style="width: 7px; height: 7px; border-radius: 1px; transform: rotate(45deg); background: transparent; border: 1px solid var(--cf-magenta, rgba(255, 0, 255, 0.4));"></span>
            <span style="color: var(--text-secondary); font-size: var(--text-sm);">Weekly boss challenge (inactive)</span>
          </div>

          <!-- Boss pip active -->
          <div style="display: flex; align-items: center; gap: var(--space-3);">
            <span style="width: 7px; height: 7px; border-radius: 1px; transform: rotate(45deg); background: var(--cf-magenta, rgba(255, 0, 255, 0.6)); border: 1px solid var(--cf-magenta, rgba(255, 0, 255, 0.4)); box-shadow: 0 0 4px var(--cf-magenta, rgba(255, 0, 255, 0.5));"></span>
            <span style="color: var(--text-secondary); font-size: var(--text-sm);">Weekly boss challenge (active)</span>
          </div>
        </div>

        <div style="margin-top: var(--space-6); padding: var(--space-3); background: rgba(var(--neon-cyan), 0.05); border-radius: var(--radius-md); border: 1px solid rgba(var(--neon-cyan), 0.15);">
          <p style="margin: 0; color: var(--text-tertiary); font-size: var(--text-xs); line-height: 1.6;">
            <strong style="color: var(--text-secondary);">Note:</strong> ChallengePips reads from the challenges store dynamically. The actual component will show real challenge state when challenges are active.
          </p>
        </div>
      </div>
    `,
  }),
}
