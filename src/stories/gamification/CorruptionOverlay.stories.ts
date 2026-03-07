import type { Meta, StoryObj } from '@storybook/vue3'

const S = {
  scene: 'width: 500px; height: 300px; background: var(--glass-bg-medium, #1a1a2e); border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden;',
  content: 'text-align: center; color: var(--text-primary, #fff); z-index: 1;',
  title: 'font-size: var(--text-xl); font-weight: 700; margin-bottom: var(--space-2);',
  subtitle: 'font-size: var(--text-sm); color: var(--text-secondary, #a0a0b0);',
  overlay: 'position: absolute; inset: 0; pointer-events: none; z-index: 2;',
  scanlines: 'position: absolute; inset: 0; background: repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px);',
  noise: 'position: absolute; inset: 0;',
}

const meta: Meta = {
  title: '🎮 Gamification/CorruptionOverlay',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Fixed overlay applying corruption visual effects to the entire UI: desaturation filter, noise texture, scan lines, and glitch animations. Intensity scales with corruption level (0-100%).',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const LowCorruption: Story = {
  render: () => ({
    template: `
      <div style="${S.scene}">
        <div style="${S.content}">
          <div style="${S.title}">Normal UI</div>
          <div style="${S.subtitle}">Corruption: 15% — Minimal visual effects</div>
        </div>
        <div style="${S.overlay} opacity: 0.15;">
          <div style="${S.scanlines}" />
        </div>
      </div>
    `,
  }),
}

export const HighCorruption: Story = {
  render: () => ({
    template: `
      <div style="${S.scene} filter: saturate(0.6) hue-rotate(5deg);">
        <div style="${S.content}">
          <div style="${S.title}">Corrupted UI</div>
          <div style="${S.subtitle}">Corruption: 75% — Heavy desaturation + scan lines</div>
        </div>
        <div style="${S.overlay} opacity: 0.5;">
          <div style="${S.scanlines}" />
          <div style="${S.noise} background: url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%224%22 height=%224%22><rect width=%221%22 height=%221%22 fill=%22rgba(255,0,0,0.03)%22/></svg>'); opacity: 0.4;" />
        </div>
      </div>
    `,
  }),
}

export const CriticalCorruption: Story = {
  render: () => ({
    template: `
      <div style="${S.scene} filter: saturate(0.3) hue-rotate(10deg) contrast(1.1);">
        <div style="${S.content}">
          <div style="${S.title} color: #ff3333;">CRITICAL CORRUPTION</div>
          <div style="${S.subtitle}">Corruption: 95% — Maximum visual decay + glitch</div>
        </div>
        <div style="${S.overlay} opacity: 0.7;">
          <div style="${S.scanlines}" />
        </div>
      </div>
    `,
  }),
}
