import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden',
  row: 'display:flex;align-items:center;gap:6px;padding:8px 12px;overflow-x:auto',
  chip: 'display:flex;align-items:center;gap:4px;padding:4px 10px;background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-full);font-size:12px;color:var(--text-secondary);white-space:nowrap;cursor:pointer;flex-shrink:0',
  chipActive: 'display:flex;align-items:center;gap:4px;padding:4px 10px;background:rgba(78,205,196,0.1);border:1px solid var(--brand-primary);border-radius:var(--radius-full);font-size:12px;color:var(--brand-primary);white-space:nowrap;cursor:pointer;flex-shrink:0',
  controlsRow: 'display:flex;align-items:center;gap:8px;padding:4px 12px 8px',
  iconBtn: 'display:flex;align-items:center;gap:4px;padding:6px 10px;background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-md);font-size:12px;color:var(--text-secondary);cursor:pointer',
  iconBtnActive: 'display:flex;align-items:center;gap:4px;padding:6px 10px;background:rgba(78,205,196,0.1);border:1px solid var(--brand-primary);border-radius:var(--radius-md);font-size:12px;color:var(--brand-primary);cursor:pointer',
  dropdown: 'position:relative',
  dropdownMenu: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:4px;margin-top:4px;box-shadow:0 8px 24px rgba(0,0,0,0.3)',
  dropdownItem: 'display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:var(--radius-md);font-size:13px;color:var(--text-secondary);cursor:pointer',
  dropdownItemActive: 'display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:var(--radius-md);font-size:13px;color:var(--brand-primary);background:rgba(78,205,196,0.08);cursor:pointer',
  badge: 'padding:1px 6px;background:rgba(78,205,196,0.15);color:var(--brand-primary);border:1px solid rgba(78,205,196,0.3);border-radius:var(--radius-full);font-size:10px;font-weight:600',
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
        h('span', { style: S.chip }, ['⚠️ Overdue ', h('span', { style: S.badge + ';background:rgba(239,68,68,0.15);color:var(--color-danger);border-color:rgba(239,68,68,0.3)' }, '2')]),
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
      h('div', { style: 'padding:8px 12px;color:var(--text-tertiary);font-size:12px;font-style:italic' }, 'Time filters hidden in Today view'),
      h('div', { style: S.controlsRow }, [
        h('button', { style: S.iconBtn }, '📑 Group'),
        h('button', { style: S.iconBtnActive }, '↕️ Sort'),
        h('button', { style: S.iconBtn }, '✅ Hide Done'),
      ]),
    ])}
  }),
}
