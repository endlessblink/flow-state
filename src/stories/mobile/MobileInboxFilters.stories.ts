import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden',
  row: 'display:flex;align-items:center;gap:var(--space-1_5);padding:var(--space-2) var(--space-3);overflow-x:auto',
  chip: 'display:flex;align-items:center;gap:var(--space-1);padding:var(--space-1) var(--space-2_5);background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-full);font-size:var(--text-xs);color:var(--text-secondary);white-space:nowrap;cursor:pointer;flex-shrink:0',
  chipActive: 'display:flex;align-items:center;gap:var(--space-1);padding:var(--space-1) var(--space-2_5);background:var(--brand-primary-subtle);border:1px solid var(--brand-primary);border-radius:var(--radius-full);font-size:var(--text-xs);color:var(--brand-primary);white-space:nowrap;cursor:pointer;flex-shrink:0',
  controlsRow: 'display:flex;align-items:center;gap:var(--space-2);padding:var(--space-1) var(--space-3) var(--space-2)',
  iconBtn: 'display:flex;align-items:center;gap:var(--space-1);padding:var(--space-1_5) var(--space-2_5);background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-md);font-size:var(--text-xs);color:var(--text-secondary);cursor:pointer',
  iconBtnActive: 'display:flex;align-items:center;gap:var(--space-1);padding:var(--space-1_5) var(--space-2_5);background:var(--brand-primary-subtle);border:1px solid var(--brand-primary);border-radius:var(--radius-md);font-size:var(--text-xs);color:var(--brand-primary);cursor:pointer',
  dropdown: 'position:relative',
  dropdownMenu: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:var(--space-1);margin-top:var(--space-1);box-shadow:0 8px 24px var(--overlay-bg)',
  dropdownItem: 'display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);font-size:var(--text-meta);color:var(--text-secondary);cursor:pointer',
  dropdownItemActive: 'display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);font-size:var(--text-meta);color:var(--brand-primary);background:var(--glass-bg-light);cursor:pointer',
  badge: 'padding:var(--space-px) var(--space-1_5);background:var(--state-active-bg);color:var(--brand-primary);border:1px solid var(--brand-primary-dim);border-radius:var(--radius-full);font-size:var(--text-xs);font-weight:600',
}

const meta: Meta = {
  title: '📱 Mobile/MobileInboxFilters',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.row }, [
        h('span', { style: S.chipActive }, ['📥 All']),
        h('span', { style: S.chip }, ['📅 Today ', h('span', { style: S.badge }, '3')]),
        h('span', { style: S.chip }, ['📅 Week ', h('span', { style: S.badge }, '8')]),
        h('span', { style: S.chip }, ['⚠️ Overdue ', h('span', { style: S.badge + ';background:var(--priority-high-bg);color:var(--color-danger);border-color:var(--priority-high-border)' }, '2')]),
      ]),
      h('div', { style: S.controlsRow }, [
        h('button', { style: S.iconBtn }, '📑 Group'),
        h('button', { style: S.iconBtn }, '↕️ Sort'),
        h('button', { style: S.iconBtnActive }, '✅ Hide Done'),
      ]),
    ])}
  }),
}

export const WithGroupDropdown: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.row }, [
        h('span', { style: S.chip }, ['📥 All']),
        h('span', { style: S.chipActive }, ['📅 Today ', h('span', { style: S.badge }, '3')]),
        h('span', { style: S.chip }, ['📅 Week']),
        h('span', { style: S.chip }, ['⚠️ Overdue']),
      ]),
      h('div', { style: S.controlsRow }, [
        h('div', { style: S.dropdown }, [
          h('button', { style: S.iconBtnActive }, '📑 Group ▾'),
          h('div', { style: S.dropdownMenu }, [
            h('div', { style: S.dropdownItem }, '📋 None'),
            h('div', { style: S.dropdownItemActive }, '📅 Due Date'),
            h('div', { style: S.dropdownItem }, '📁 Project'),
            h('div', { style: S.dropdownItem }, '🚩 Priority'),
          ]),
        ]),
        h('button', { style: S.iconBtn }, '↕️ Sort'),
        h('button', { style: S.iconBtn }, '✅ Hide Done'),
      ]),
    ])}
  }),
}

export const TodayViewFilters: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: 'padding:var(--space-2) var(--space-3);color:var(--text-tertiary);font-size:var(--text-xs);font-style:italic' }, 'Time filters hidden in Today view'),
      h('div', { style: S.controlsRow }, [
        h('button', { style: S.iconBtn }, '📑 Group'),
        h('button', { style: S.iconBtnActive }, '↕️ Sort'),
        h('button', { style: S.iconBtn }, '✅ Hide Done'),
      ]),
    ])}
  }),
}
