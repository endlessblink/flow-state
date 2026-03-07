import type { Meta, StoryObj } from '@storybook/vue3'
import { Clock, ChevronRight, Zap, Coffee, Hourglass, Mountain, HelpCircle } from 'lucide-vue-next'

const S = {
  sidebar: 'width: 260px; background: var(--glass-bg-medium); border-radius: var(--radius-lg); padding: var(--space-4);',
  toggle: 'display: flex; align-items: center; gap: var(--space-2); width: 100%; padding: var(--space-2) var(--space-1); background: transparent; border: none; color: var(--text-muted); font-size: var(--text-xs); font-weight: var(--font-semibold); letter-spacing: 0.05em; cursor: pointer; text-transform: uppercase; margin-bottom: var(--space-2);',
  chevron: 'margin-inline-start: auto; opacity: 0.5; transition: transform 0.15s ease;',
  grid: 'display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-2); padding: 0 var(--space-4) var(--space-4) var(--space-4);',
  item: 'display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--text-xs); font-weight: var(--font-medium); color: var(--text-secondary); cursor: pointer; border: 1px solid transparent;',
  itemActive: 'display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--text-xs); font-weight: var(--font-medium); color: var(--brand-primary); cursor: pointer; border: 1px solid var(--brand-primary); background: rgba(78, 205, 196, 0.06);',
  count: 'margin-inline-start: auto; font-size: var(--text-xs); color: var(--text-muted); background: var(--glass-bg-soft); padding: 0 var(--space-1_5); border-radius: var(--radius-sm); min-width: 18px; text-align: center;',
}

const meta: Meta = {
  title: '🏢 Layout/Sidebar/SidebarDurationSection',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Collapsible duration filter section with Quick (<15m), Short (15-30m), Medium (30-60m), Long (>60m), and Unestimated filters.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Expanded: Story = {
  render: () => ({
    components: { Clock, ChevronRight, Zap, Coffee, Hourglass, Mountain, HelpCircle },
    template: `
      <div style="${S.sidebar}">
        <button style="${S.toggle}">
          <Clock :size="14" />
          <span>Duration</span>
          <ChevronRight :size="14" style="${S.chevron} transform: rotate(90deg);" />
        </button>
        <div style="${S.grid}">
          <div style="${S.itemActive}">
            <Zap :size="14" />
            Quick
            <span style="${S.count}">4</span>
          </div>
          <div style="${S.item}">
            <Coffee :size="14" />
            Short
            <span style="${S.count}">7</span>
          </div>
          <div style="${S.item}">
            <Hourglass :size="14" />
            Medium
            <span style="${S.count}">5</span>
          </div>
          <div style="${S.item}">
            <Mountain :size="14" />
            Long
            <span style="${S.count}">2</span>
          </div>
          <div style="${S.item}">
            <HelpCircle :size="14" />
            No Est.
            <span style="${S.count}">9</span>
          </div>
        </div>
      </div>
    `,
  }),
}

export const Collapsed: Story = {
  render: () => ({
    components: { Clock, ChevronRight },
    template: `
      <div style="${S.sidebar}">
        <button style="${S.toggle}">
          <Clock :size="14" />
          <span>Duration</span>
          <ChevronRight :size="14" style="${S.chevron}" />
        </button>
      </div>
    `,
  }),
}
