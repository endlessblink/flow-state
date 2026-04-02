import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden',
  header: 'display:flex;align-items:center;justify-content:space-between;padding:var(--space-3) var(--space-4);background:var(--surface-primary);border-bottom:1px solid var(--border-primary)',
  toggle: 'display:flex;background:var(--surface-secondary);border-radius:var(--radius-xl);padding:var(--space-px);gap:var(--space-px)',
  toggleBtn: 'padding:var(--space-1_5) var(--space-4);border-radius:var(--radius-lg);font-size:var(--text-meta);border:none;cursor:pointer;transition:all 0.2s',
  toggleActive: 'padding:var(--space-1_5) var(--space-4);border-radius:var(--radius-lg);font-size:var(--text-meta);border:none;cursor:pointer;background:var(--glass-bg-soft);color:var(--brand-primary);font-weight:600',
  toggleInactive: 'padding:var(--space-1_5) var(--space-4);border-radius:var(--radius-lg);font-size:var(--text-meta);border:none;cursor:pointer;background:transparent;color:var(--text-tertiary)',
  count: 'font-size:var(--text-meta);color:var(--text-tertiary)',
  subtitle: 'font-size:var(--text-xs);color:var(--text-tertiary);padding:var(--space-1) var(--space-4)',
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
