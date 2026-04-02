import type { Meta, StoryObj } from '@storybook/vue3'
import { Calendar, List, Inbox, Zap } from 'lucide-vue-next'

const S = {
  sidebar: 'width: 260px; background: var(--glass-bg-medium); border-radius: var(--radius-lg); padding: var(--space-2) 0;',
  grid: 'display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-2); padding: var(--space-4);',
  divider: 'height: 1px; background: var(--glass-border); margin: var(--space-1) var(--space-4); opacity: 0.3;',
  item: 'display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--text-xs); font-weight: var(--font-medium); color: var(--text-secondary); cursor: pointer; border: 1px solid transparent; transition: all 0.15s ease;',
  itemActive: 'display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--text-xs); font-weight: var(--font-medium); color: var(--brand-primary); cursor: pointer; border: 1px solid var(--brand-primary); background: var(--brand-bg-dim);',
  count: 'margin-inline-start: auto; font-size: var(--text-xs); color: var(--text-muted); background: var(--glass-bg-soft); padding: 0 var(--space-1_5); border-radius: var(--radius-sm); min-width: 18px; text-align: center;',
  quickSort: 'display: flex; align-items: center; justify-content: center; gap: var(--space-2); width: calc(100% - 32px); margin: 0 16px var(--space-4) 16px; padding: var(--space-2); background: var(--glass-bg-soft); color: var(--brand-primary); border: 1px solid var(--brand-primary); border-radius: var(--radius-md); font-size: var(--text-xs); font-weight: var(--font-semibold); cursor: pointer; backdrop-filter: blur(8px);',
}

const meta: Meta = {
  title: '🏢 Layout/Sidebar/SidebarSmartViews',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Smart view filter grid showing Today, This Week, All Active, and Inbox filters with task counts and drag-drop date assignment.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { Calendar, List, Inbox, Zap },
    template: `
      <div style="${S.sidebar}">
        <div style="${S.grid}">
          <div style="${S.itemActive}">
            <Calendar :size="14" />
            Today
            <span style="${S.count}">5</span>
          </div>
          <div style="${S.item}">
            <Calendar :size="14" />
            This Week
            <span style="${S.count}">12</span>
          </div>
        </div>
        <div style="${S.divider}" />
        <div style="${S.grid}">
          <div style="${S.item}">
            <List :size="14" />
            All Active
            <span style="${S.count}">24</span>
          </div>
          <div style="${S.item}">
            <Inbox :size="14" />
            Inbox
            <span style="${S.count}">3</span>
          </div>
        </div>
      </div>
    `,
  }),
}

export const WithQuickSort: Story = {
  name: 'Inbox Active (Quick Sort visible)',
  render: () => ({
    components: { Calendar, List, Inbox, Zap },
    template: `
      <div style="${S.sidebar}">
        <div style="${S.grid}">
          <div style="${S.item}">
            <Calendar :size="14" />
            Today
            <span style="${S.count}">5</span>
          </div>
          <div style="${S.item}">
            <Calendar :size="14" />
            This Week
            <span style="${S.count}">12</span>
          </div>
        </div>
        <div style="${S.divider}" />
        <div style="${S.grid}">
          <div style="${S.item}">
            <List :size="14" />
            All Active
            <span style="${S.count}">24</span>
          </div>
          <div style="${S.itemActive}">
            <Inbox :size="14" />
            Inbox
            <span style="${S.count}">8</span>
          </div>
        </div>
        <button style="${S.quickSort}">
          <Zap :size="16" />
          <span>Categorize Inbox (8)</span>
        </button>
      </div>
    `,
  }),
}
