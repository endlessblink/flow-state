import type { Meta, StoryObj } from '@storybook/vue3'
import { Layout, Crosshair, Skull, Zap, Trophy } from 'lucide-vue-next'

const S = {
  wrap: 'width: 600px; background: var(--cf-dark-1, #0a0a0f); padding: var(--space-4); border-radius: var(--radius-lg);',
  nav: 'display: flex; gap: var(--space-1); border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.08));',
  tab: 'display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-4); background: transparent; border: none; border-bottom: 2px solid transparent; color: var(--text-muted, #666); font-size: var(--text-sm); letter-spacing: 0.08em; cursor: pointer; font-weight: 600;',
  tabActive: 'display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-4); background: transparent; border: none; border-bottom: 2px solid var(--cf-cyan, #00f0ff); color: var(--text-primary, #fff); font-size: var(--text-sm); letter-spacing: 0.08em; cursor: pointer; font-weight: 600; box-shadow: 0 2px 8px rgba(0,240,255,0.15);',
}

const meta: Meta = {
  title: '🎮 Gamification/Cyber/CyberSectionNav',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Horizontal tab navigation for Cyberflow dashboard sections: Overview, Missions, Boss, Upgrades, Trophies. Uses lucide icons with cyber glow on active state.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const OverviewActive: Story = {
  render: () => ({
    components: { Layout, Crosshair, Skull, Zap, Trophy },
    template: `
      <div style="${S.wrap}">
        <nav style="${S.nav}">
          <button style="${S.tabActive}"><Layout :size="14" /> OVERVIEW</button>
          <button style="${S.tab}"><Crosshair :size="14" /> MISSIONS</button>
          <button style="${S.tab}"><Skull :size="14" /> BOSS</button>
          <button style="${S.tab}"><Zap :size="14" /> UPGRADES</button>
          <button style="${S.tab}"><Trophy :size="14" /> TROPHIES</button>
        </nav>
      </div>
    `,
  }),
}

export const MissionsActive: Story = {
  render: () => ({
    components: { Layout, Crosshair, Skull, Zap, Trophy },
    template: `
      <div style="${S.wrap}">
        <nav style="${S.nav}">
          <button style="${S.tab}"><Layout :size="14" /> OVERVIEW</button>
          <button style="${S.tabActive}"><Crosshair :size="14" /> MISSIONS</button>
          <button style="${S.tab}"><Skull :size="14" /> BOSS</button>
          <button style="${S.tab}"><Zap :size="14" /> UPGRADES</button>
          <button style="${S.tab}"><Trophy :size="14" /> TROPHIES</button>
        </nav>
      </div>
    `,
  }),
}
