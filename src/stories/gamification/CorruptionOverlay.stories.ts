import type { Meta, StoryObj } from '@storybook/vue3'
import CorruptionOverlay from '@/components/gamification/CorruptionOverlay.vue'

const meta = {
  component: CorruptionOverlay,
  title: '🎮 Gamification/CorruptionOverlay',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof CorruptionOverlay>

export default meta
type Story = StoryObj<typeof meta>

// Note: This component reads corruption level from the challenges store
// These stories demonstrate the visual effect conceptually

// Default
export const Default: Story = {
  render: () => ({
    components: { CorruptionOverlay },
    template: `
      <div style="position: relative; min-height: 500px; background: var(--app-background-gradient); padding: var(--space-10);">
        <h1 style="margin: 0 0 var(--space-4) 0; color: var(--text-primary); font-size: var(--text-3xl);">Corruption Overlay Demo</h1>
        <p style="margin: 0 0 var(--space-6) 0; color: var(--text-secondary); font-size: var(--text-base);">
          The CorruptionOverlay component applies visual decay effects to the entire UI based on corruption level from failed challenges.
        </p>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); margin-bottom: var(--space-6);">
          <div style="padding: var(--space-4); background: var(--overlay-component-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 var(--space-2) 0; color: var(--text-primary); font-size: var(--text-base);">Card 1</h3>
            <p style="margin: 0; color: var(--text-secondary); font-size: var(--text-sm);">Sample content to show corruption effects</p>
          </div>

          <div style="padding: var(--space-4); background: var(--overlay-component-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 var(--space-2) 0; color: var(--text-primary); font-size: var(--text-base);">Card 2</h3>
            <p style="margin: 0; color: var(--text-secondary); font-size: var(--text-sm);">Sample content to show corruption effects</p>
          </div>

          <div style="padding: var(--space-4); background: var(--overlay-component-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 var(--space-2) 0; color: var(--text-primary); font-size: var(--text-base);">Card 3</h3>
            <p style="margin: 0; color: var(--text-secondary); font-size: var(--text-sm);">Sample content to show corruption effects</p>
          </div>
        </div>

        <div style="padding: var(--space-4); background: rgba(var(--neon-cyan), 0.05); border-radius: var(--radius-lg); border: 1px solid rgba(var(--neon-cyan), 0.15);">
          <h4 style="margin: 0 0 var(--space-2) 0; color: var(--text-primary); font-size: var(--text-sm); font-weight: 600;">Corruption Effects</h4>
          <ul style="margin: 0; padding-left: var(--space-5); color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.8;">
            <li><strong>0-20%:</strong> None (pristine)</li>
            <li><strong>20-40%:</strong> Light desaturation + subtle noise</li>
            <li><strong>40-60%:</strong> Moderate desaturation + scan lines</li>
            <li><strong>60-80%:</strong> Heavy desaturation + vignette</li>
            <li><strong>80-100%:</strong> Critical - rust tint + glitch effects + warning pulse</li>
          </ul>
        </div>

        <CorruptionOverlay />
      </div>
    `,
  }),
}

// Documentation
export const EffectsDocumentation: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-10); background: var(--app-background-gradient); min-height: 100vh;">
        <h1 style="margin: 0 0 var(--space-6) 0; color: var(--text-primary); font-size: var(--text-3xl);">Corruption Overlay System</h1>

        <div style="display: flex; flex-direction: column; gap: var(--space-6);">
          <!-- Tier 0: Pristine -->
          <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 var(--space-2) 0; color: var(--text-primary);">Pristine (0-20%)</h3>
            <p style="margin: 0 0 var(--space-3) 0; color: var(--text-secondary); font-size: var(--text-sm);">No effects applied. UI is fully saturated and clear.</p>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md);">
              <code style="color: var(--text-tertiary); font-size: var(--text-xs);">filter: none; corruption-noise-opacity: 0;</code>
            </div>
          </div>

          <!-- Tier 1: Light -->
          <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 var(--space-2) 0; color: var(--text-primary);">Light (20-40%)</h3>
            <p style="margin: 0 0 var(--space-3) 0; color: var(--text-secondary); font-size: var(--text-sm);">Light desaturation (90%) + subtle noise overlay.</p>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md);">
              <code style="color: var(--text-tertiary); font-size: var(--text-xs);">filter: saturate(0.9); corruption-noise-opacity: 0.03;</code>
            </div>
          </div>

          <!-- Tier 2: Moderate -->
          <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 var(--space-2) 0; color: var(--text-primary);">Moderate (40-60%)</h3>
            <p style="margin: 0 0 var(--space-3) 0; color: var(--text-secondary); font-size: var(--text-sm);">Desaturation (75%) + scan lines + glitch animations begin.</p>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md);">
              <code style="color: var(--text-tertiary); font-size: var(--text-xs);">filter: saturate(0.75); corruption-scanline-opacity: 0.08; glitch-intensity: 2;</code>
            </div>
          </div>

          <!-- Tier 3: Heavy -->
          <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 var(--space-2) 0; color: var(--text-primary);">Heavy (60-80%)</h3>
            <p style="margin: 0 0 var(--space-3) 0; color: var(--text-secondary); font-size: var(--text-sm);">Heavy desaturation (55%) + vignette + rust tint + stronger glitches.</p>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md);">
              <code style="color: var(--text-tertiary); font-size: var(--text-xs);">filter: saturate(0.55); vignette: visible; glitch-intensity: 4;</code>
            </div>
          </div>

          <!-- Tier 4: Critical -->
          <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg); border: 1px solid var(--danger-border-medium);">
            <h3 style="margin: 0 0 var(--space-2) 0; color: var(--color-error-400);">Critical (80-100%)</h3>
            <p style="margin: 0 0 var(--space-3) 0; color: var(--text-secondary); font-size: var(--text-sm);">Extreme desaturation (35%) + full vignette + warning pulse at edges + moving scan line.</p>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md);">
              <code style="color: var(--text-tertiary); font-size: var(--text-xs);">filter: saturate(0.35); warning-pulse: active; glitch-intensity: 6;</code>
            </div>
          </div>
        </div>

        <div style="margin-top: var(--space-8); padding: var(--space-6); background: rgba(var(--neon-magenta), 0.05); border-radius: var(--radius-lg); border: 1px solid rgba(var(--neon-magenta), 0.15);">
          <h4 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--text-base); font-weight: 600;">How It Works</h4>
          <p style="margin: 0 0 var(--space-2) 0; color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.6;">
            The corruption level is driven by the challenges store. Failed challenges increase corruption, completed challenges reduce it. The overlay applies progressive visual effects to the entire UI via a fixed-position layer with CSS custom properties.
          </p>
          <p style="margin: 0; color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.6;">
            Effects respect <code style="color: var(--text-tertiary);">prefers-reduced-motion</code> and adjust automatically as corruption level changes.
          </p>
        </div>
      </div>
    `,
  }),
}
