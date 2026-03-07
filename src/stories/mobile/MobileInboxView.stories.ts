import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);min-height:600px;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;display:flex;flex-direction:column',
  header: 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--surface-primary);border-bottom:1px solid var(--border-primary)',
  toggle: 'display:flex;background:var(--surface-secondary);border-radius:var(--radius-xl);padding:2px;gap:2px',
  toggleActive: 'padding:6px 16px;border-radius:var(--radius-lg);font-size:13px;background:var(--glass-bg-soft);color:var(--brand-primary);font-weight:600;border:none',
  toggleInactive: 'padding:6px 16px;border-radius:var(--radius-lg);font-size:13px;background:transparent;color:var(--text-tertiary);border:none',
  count: 'font-size:13px;color:var(--text-tertiary)',
  filters: 'display:flex;gap:6px;padding:8px 12px;overflow-x:auto',
  chip: 'padding:4px 10px;background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-full);font-size:12px;color:var(--text-secondary);white-space:nowrap;flex-shrink:0',
  chipActive: 'padding:4px 10px;background:rgba(78,205,196,0.1);border:1px solid var(--brand-primary);border-radius:var(--radius-full);font-size:12px;color:var(--brand-primary);white-space:nowrap;flex-shrink:0',
  hint: 'text-align:center;padding:6px;margin:4px 12px;background:var(--surface-secondary);border-radius:var(--radius-md);font-size:11px;color:var(--text-tertiary)',
  list: 'flex:1;padding:8px 12px;overflow-y:auto',
  task: 'display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface-primary);border-radius:var(--radius-lg);margin-bottom:4px',
  checkbox: 'width:18px;height:18px;border-radius:50%;border:2px solid var(--border-secondary);flex-shrink:0',
  taskTitle: 'font-size:14px;color:var(--text-primary)',
  taskMeta: 'font-size:11px;color:var(--text-tertiary);margin-top:2px',
  timerBtn: 'background:none;border:none;color:var(--text-tertiary);font-size:14px;cursor:pointer;margin-left:auto;flex-shrink:0',
  fab: 'position:absolute;bottom:24px;right:24px;width:52px;height:52px;border-radius:50%;background:var(--glass-bg-soft);border:2px solid var(--brand-primary);display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--brand-primary);cursor:pointer;box-shadow:0 4px 20px rgba(78,205,196,0.3)',
  posRel: 'position:relative;flex:1;display:flex;flex-direction:column',
}

const meta: Meta = {
  title: '📱 Mobile/MobileInboxView',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    setup() {
      const tasks = ['Design landing page', 'Review pull request', 'Fix navigation bug', 'Update API docs', 'Write unit tests']
      return () => h('div', { style: S.wrapper }, [
        h('div', { style: S.header }, [
          h('div', { style: S.toggle }, [
            h('button', { style: S.toggleActive }, 'Tasks'),
            h('button', { style: S.toggleInactive }, 'Today'),
          ]),
          h('span', { style: S.count }, `${tasks.length} tasks`),
        ]),
        h('div', { style: S.filters }, [
          h('span', { style: S.chipActive }, '📥 All'),
          h('span', { style: S.chip }, '📅 Today'),
          h('span', { style: S.chip }, '📅 Week'),
          h('span', { style: S.chip }, '⚠️ Overdue'),
        ]),
        h('div', { style: S.hint }, '← Delete  |  Edit →  (swipe tasks)'),
        h('div', { style: S.posRel }, [
          h('div', { style: S.list }, tasks.map(t =>
            h('div', { style: S.task }, [
              h('div', { style: S.checkbox }),
              h('div', { style: 'flex:1;min-width:0' }, [
                h('div', { style: S.taskTitle }, t),
                h('div', { style: S.taskMeta }, '📅 Today  🚩 medium'),
              ]),
              h('button', { style: S.timerBtn }, '▶'),
            ])
          )),
          h('div', { style: S.fab }, '+'),
        ]),
      ])
    }
  }),
}
