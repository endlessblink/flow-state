import type { Meta, StoryObj } from '@storybook/vue3'

const S = {
  wrap: 'width: 400px; background: var(--cf-dark-1, #0a0a0f); padding: var(--space-6); border-radius: var(--radius-lg);',
  meter: 'display: flex; flex-direction: column; gap: var(--space-2); width: 100%;',
  header: 'display: flex; justify-content: space-between; align-items: baseline;',
  tierName: 'font-size: var(--text-meta, 11px); font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;',
  levelValue: 'font-size: var(--text-sm); color: rgba(255, 255, 255, 0.5); font-weight: 600;',
  bar: 'position: relative; height: var(--space-3, 12px); border-radius: var(--radius-md); overflow: visible; background: rgba(15,15,20,0.6); border: 1px solid rgba(255,255,255,0.1);',
  gradient: 'position: absolute; inset: 0; border-radius: var(--radius-md); background: linear-gradient(90deg, #00f0ff 0%, #39ff14 20%, #ffff00 40%, #ff8800 60%, #ff3333 80%, #cc0000 100%); opacity: 0.8;',
  indicator: 'position: absolute; top: 50%; width: 12px; height: 12px; background: #f0f0f0; border: 2px solid rgba(15,15,20,0.6); transform: translate(-50%, -50%) rotate(45deg); z-index: 3; box-shadow: 0 0 6px rgba(255,255,255,0.5);',
  labels: 'display: flex; justify-content: space-between;',
  label: 'font-size: 9px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.05em; width: 20%; text-align: center; opacity: 0.5;',
  labelActive: 'font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; width: 20%; text-align: center; opacity: 1; font-weight: 600;',
  boundary: 'position: absolute; top: 0; width: 2px; height: 100%; background: rgba(15,15,20,0.5);',
}

const tierColors = ['#00f0ff', '#39ff14', '#ffff00', '#ff8800', '#ff3333']
const tierNames = ['Clean', 'Mild', 'Moderate', 'Heavy', 'Critical']

function getTierIndex(level: number) {
  if (level < 20) return 0
  if (level < 40) return 1
  if (level < 60) return 2
  if (level < 80) return 3
  return 4
}

const meta: Meta = {
  title: '🎮 Gamification/Cyber/CorruptionMeter',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Gradient bar showing corruption level (0-100%) with diamond indicator and tier labels (Clean, Mild, Moderate, Heavy, Critical).',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

function renderMeter(level: number) {
  const tierIdx = getTierIndex(level)
  return `
    <div style="${S.wrap}">
      <div style="${S.meter}">
        <div style="${S.header}">
          <span style="${S.tierName} color: ${tierColors[tierIdx]};">${tierNames[tierIdx]}</span>
          <span style="${S.levelValue}">${level}%</span>
        </div>
        <div style="${S.bar}">
          <div style="${S.gradient}" />
          <div style="${S.boundary} left: 20%;" />
          <div style="${S.boundary} left: 40%;" />
          <div style="${S.boundary} left: 60%;" />
          <div style="${S.boundary} left: 80%;" />
          <div style="${S.indicator} left: ${level}%;" />
        </div>
        <div style="${S.labels}">
          ${tierNames.map((name, i) => `<span style="${i === tierIdx ? S.labelActive : S.label} color: ${i === tierIdx ? tierColors[i] : 'rgba(255,255,255,0.35)'};">${name}</span>`).join('')}
        </div>
      </div>
    </div>
  `
}

export const AllTiers: Story = {
  render: () => ({
    template: `
      <div style="display: flex; flex-direction: column; gap: var(--space-4);">
        ${renderMeter(8)}
        ${renderMeter(30)}
        ${renderMeter(52)}
        ${renderMeter(73)}
        ${renderMeter(92)}
      </div>
    `,
  }),
}

export const Clean: Story = {
  render: () => ({
    template: renderMeter(8),
  }),
}

export const Critical: Story = {
  render: () => ({
    template: renderMeter(95),
  }),
}
