import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden',
  header: 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--surface-primary);border-bottom:1px solid var(--border-primary)',
  toggle: 'display:flex;background:var(--surface-secondary);border-radius:var(--radius-xl);padding:2px;gap:2px',
  toggleBtn: 'padding:6px 16px;border-radius:var(--radius-lg);font-size:13px;border:none;cursor:pointer;transition:all 0.2s',
  toggleActive: 'padding:6px 16px;border-radius:var(--radius-lg);font-size:13px;border:none;cursor:pointer;background:var(--glass-bg-soft);color:var(--brand-primary);font-weight:600',
  toggleInactive: 'padding:6px 16px;border-radius:var(--radius-lg);font-size:13px;border:none;cursor:pointer;background:transparent;color:var(--text-tertiary)',
  count: 'font-size:13px;color:var(--text-tertiary)',
  subtitle: 'font-size:12px;color:var(--text-tertiary);padding:4px 16px',
}

const meta: Meta = {
  title: '📱 Mobile/MobileInboxHeader',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const TasksView: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.header }, [
        h('div', { style: S.toggle }, [
          h('button', { style: S.toggleActive }, 'Tasks'),
          h('button', { style: S.toggleInactive }, 'Today'),
        ]),
        h('span', { style: S.count }, '12 tasks'),
      ]),
    ])}
  }),
}

export const TodayView: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.header }, [
        h('div', { style: S.toggle }, [
          h('button', { style: S.toggleInactive }, 'Tasks'),
          h('button', { style: S.toggleActive }, 'Today'),
        ]),
        h('span', { style: S.count }, '5 tasks'),
      ]),
      h('div', { style: S.subtitle }, 'Friday, March 7'),
    ])}
  }),
}
