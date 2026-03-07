import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;padding:12px',
  row: 'display:flex;align-items:center;gap:6px;margin-bottom:8px',
  label: 'font-size:12px;color:var(--text-tertiary);width:52px;flex-shrink:0',
  pills: 'display:flex;gap:6px;overflow-x:auto;flex:1',
  pill: 'padding:5px 12px;background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-full);font-size:12px;color:var(--text-secondary);white-space:nowrap;cursor:pointer;flex-shrink:0',
  pillActive: 'padding:5px 12px;border-radius:var(--radius-full);font-size:12px;white-space:nowrap;cursor:pointer;flex-shrink:0',
  pillHigh: 'background:rgba(239,68,68,0.1);border:1px solid var(--color-danger);color:var(--color-danger)',
  pillMed: 'background:rgba(245,158,11,0.1);border:1px solid var(--color-warning);color:var(--color-warning)',
  pillLow: 'background:rgba(78,205,196,0.1);border:1px solid var(--brand-primary);color:var(--brand-primary)',
  pillDate: 'background:rgba(78,205,196,0.1);border:1px solid var(--brand-primary);color:var(--brand-primary)',
  clearPill: 'padding:5px 8px;background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-full);font-size:12px;color:var(--text-tertiary);cursor:pointer;flex-shrink:0',
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
