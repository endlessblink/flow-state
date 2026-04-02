import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;padding:var(--space-3)',
  row: 'display:flex;align-items:center;gap:var(--space-1_5);margin-bottom:var(--space-2)',
  label: 'font-size:var(--text-xs);color:var(--text-tertiary);width:52px;flex-shrink:0',
  pills: 'display:flex;gap:var(--space-1_5);overflow-x:auto;flex:1',
  pill: 'padding:var(--space-1) var(--space-3);background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-full);font-size:var(--text-xs);color:var(--text-secondary);white-space:nowrap;cursor:pointer;flex-shrink:0',
  pillActive: 'padding:var(--space-1) var(--space-3);border-radius:var(--radius-full);font-size:var(--text-xs);white-space:nowrap;cursor:pointer;flex-shrink:0',
  pillHigh: 'background:var(--priority-high-bg);border:1px solid var(--color-danger);color:var(--color-danger)',
  pillMed: 'background:var(--priority-medium-bg);border:1px solid var(--color-warning);color:var(--color-warning)',
  pillLow: 'background:var(--priority-low-bg);border:1px solid var(--brand-primary);color:var(--brand-primary)',
  pillDate: 'background:var(--brand-primary-subtle);border:1px solid var(--brand-primary);color:var(--brand-primary)',
  clearPill: 'padding:var(--space-1) var(--space-2);background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-full);font-size:var(--text-xs);color:var(--text-tertiary);cursor:pointer;flex-shrink:0',
}

const meta: Meta = {
  title: '📱 Mobile/MobileQuickSortFilters',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const NoneSelected: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.row }, [
        h('span', { style: S.label }, 'Priority'),
        h('div', { style: S.pills }, [
          h('span', { style: S.pill }, 'Low'),
          h('span', { style: S.pill }, 'Med'),
          h('span', { style: S.pill }, 'High'),
        ]),
      ]),
      h('div', { style: S.row }, [
        h('span', { style: S.label }, 'Due'),
        h('div', { style: S.pills }, [
          h('span', { style: S.pill }, '☀️ Today'),
          h('span', { style: S.pill }, '🌅 Tmrw'),
          h('span', { style: S.pill }, '📅 +3d'),
          h('span', { style: S.pill }, '🏖️ Wknd'),
          h('span', { style: S.pill }, '📆 +1wk'),
          h('span', { style: S.pill }, '🗓️ +1mo'),
        ]),
      ]),
    ])}
  }),
}

export const WithSelections: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.row }, [
        h('span', { style: S.label }, 'Priority'),
        h('div', { style: S.pills }, [
          h('span', { style: S.pill }, 'Low'),
          h('span', { style: S.pill }, 'Med'),
          h('span', { style: S.pillActive + ';' + S.pillHigh }, 'High'),
        ]),
      ]),
      h('div', { style: S.row }, [
        h('span', { style: S.label }, 'Due'),
        h('div', { style: S.pills }, [
          h('span', { style: S.pillActive + ';' + S.pillDate }, '☀️ Today'),
          h('span', { style: S.pill }, '🌅 Tmrw'),
          h('span', { style: S.pill }, '📅 +3d'),
          h('span', { style: S.pill }, '🏖️ Wknd'),
          h('span', { style: S.pill }, '📆 +1wk'),
          h('span', { style: S.pill }, '🗓️ +1mo'),
          h('span', { style: S.clearPill }, '✕'),
        ]),
      ]),
    ])}
  }),
}
