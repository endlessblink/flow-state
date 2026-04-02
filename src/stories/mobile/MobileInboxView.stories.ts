import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);min-height:600px;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;display:flex;flex-direction:column',
  header: 'display:flex;align-items:center;justify-content:space-between;padding:var(--space-3) var(--space-4);background:var(--surface-primary);border-bottom:1px solid var(--border-primary)',
  toggle: 'display:flex;background:var(--surface-secondary);border-radius:var(--radius-xl);padding:var(--space-px);gap:var(--space-px)',
  toggleActive: 'padding:var(--space-1_5) var(--space-4);border-radius:var(--radius-lg);font-size:var(--text-meta);background:var(--glass-bg-soft);color:var(--brand-primary);font-weight:600;border:none',
  toggleInactive: 'padding:var(--space-1_5) var(--space-4);border-radius:var(--radius-lg);font-size:var(--text-meta);background:transparent;color:var(--text-tertiary);border:none',
  count: 'font-size:var(--text-meta);color:var(--text-tertiary)',
  filters: 'display:flex;gap:var(--space-1_5);padding:var(--space-2) var(--space-3);overflow-x:auto',
  chip: 'padding:var(--space-1) var(--space-2_5);background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-full);font-size:var(--text-xs);color:var(--text-secondary);white-space:nowrap;flex-shrink:0',
  chipActive: 'padding:var(--space-1) var(--space-2_5);background:var(--brand-primary-subtle);border:1px solid var(--brand-primary);border-radius:var(--radius-full);font-size:var(--text-xs);color:var(--brand-primary);white-space:nowrap;flex-shrink:0',
  hint: 'text-align:center;padding:var(--space-1_5);margin:var(--space-1) var(--space-3);background:var(--surface-secondary);border-radius:var(--radius-md);font-size:var(--text-xs);color:var(--text-tertiary)',
  list: 'flex:1;padding:var(--space-2) var(--space-3);overflow-y:auto',
  task: 'display:flex;align-items:center;gap:var(--space-2_5);padding:var(--space-2_5) var(--space-3);background:var(--surface-primary);border-radius:var(--radius-lg);margin-bottom:var(--space-1)',
  checkbox: 'width:18px;height:18px;border-radius:50%;border:2px solid var(--border-secondary);flex-shrink:0',
  taskTitle: 'font-size:var(--text-sm);color:var(--text-primary)',
  taskMeta: 'font-size:var(--text-xs);color:var(--text-tertiary);margin-top:var(--space-0_5)',
  timerBtn: 'background:none;border:none;color:var(--text-tertiary);font-size:var(--text-sm);cursor:pointer;margin-left:auto;flex-shrink:0',
  fab: 'position:absolute;bottom:var(--space-6);right:var(--space-6);width:52px;height:52px;border-radius:50%;background:var(--glass-bg-soft);border:2px solid var(--brand-primary);display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--brand-primary);cursor:pointer;box-shadow:0 4px 20px var(--brand-primary-dim)',
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
