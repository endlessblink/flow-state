import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);min-height:500px;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;display:flex;align-items:center;justify-content:center',
  container: 'text-align:center;max-width:320px;padding:24px',
  icon: 'font-size:80px;margin-bottom:16px',
  title: 'font-size:28px;font-weight:700;color:var(--text-primary);margin-bottom:8px',
  subtitle: 'font-size:14px;color:var(--text-secondary);margin-bottom:32px',
  stats: 'display:flex;gap:16px;justify-content:center;margin-bottom:32px',
  stat: 'text-align:center',
  statValue: 'font-size:28px;font-weight:700;color:var(--brand-primary)',
  statLabel: 'font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;margin-top:4px',
  button: 'display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 24px;background:var(--glass-bg-soft);border:1px solid var(--brand-primary);border-radius:var(--radius-lg);color:var(--brand-primary);font-size:14px;font-weight:600;cursor:pointer;backdrop-filter:blur(8px);margin:0 auto',
}

const meta: Meta = {
  title: '📱 Mobile/MobileQuickSortComplete',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.container }, [
        h('div', { style: S.icon }, '🎉'),
        h('div', { style: S.title }, 'All Sorted!'),
        h('div', { style: S.subtitle }, "You've processed all your tasks"),
        h('div', { style: S.stats }, [
          h('div', { style: S.stat }, [
            h('div', { style: S.statValue }, '12'),
            h('div', { style: S.statLabel }, 'Tasks Processed'),
          ]),
          h('div', { style: S.stat }, [
            h('div', { style: S.statValue }, '4:32'),
            h('div', { style: S.statLabel }, 'Time Spent'),
          ]),
          h('div', { style: S.stat }, [
            h('div', { style: S.statValue }, '2.6'),
            h('div', { style: S.statLabel }, 'Tasks/Min'),
          ]),
        ]),
        h('button', { style: S.button }, ['← Go to Inbox']),
      ]),
    ])}
  }),
}

export const QuickSession: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.container }, [
        h('div', { style: S.icon }, '🎉'),
        h('div', { style: S.title }, 'All Sorted!'),
        h('div', { style: S.subtitle }, "You've processed all your tasks"),
        h('div', { style: S.stats }, [
          h('div', { style: S.stat }, [
            h('div', { style: S.statValue }, '3'),
            h('div', { style: S.statLabel }, 'Tasks Processed'),
          ]),
          h('div', { style: S.stat }, [
            h('div', { style: S.statValue }, '0:48'),
            h('div', { style: S.statLabel }, 'Time Spent'),
          ]),
          h('div', { style: S.stat }, [
            h('div', { style: S.statValue }, '3.8'),
            h('div', { style: S.statLabel }, 'Tasks/Min'),
          ]),
        ]),
        h('button', { style: S.button }, ['← Go to Inbox']),
      ]),
    ])}
  }),
}
