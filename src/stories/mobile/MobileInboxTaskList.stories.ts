import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;padding:var(--space-2)',
  groupHeader: 'display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-3);margin-top:var(--space-2)',
  groupDot: 'width:8px;height:8px;border-radius:50%',
  groupTitle: 'font-size:var(--text-meta);font-weight:600;color:var(--text-secondary)',
  groupCount: 'padding:var(--space-px) var(--space-1_5);background:var(--surface-secondary);border-radius:var(--radius-full);font-size:var(--text-xs);color:var(--text-tertiary)',
  task: 'display:flex;align-items:center;gap:var(--space-2_5);padding:var(--space-2_5) var(--space-3);background:var(--surface-primary);border-radius:var(--radius-lg);margin-bottom:var(--space-1)',
  taskTimer: 'display:flex;align-items:center;gap:var(--space-2_5);padding:var(--space-2_5) var(--space-3);background:var(--surface-primary);border-radius:var(--radius-lg);margin-bottom:var(--space-1);border:1px solid var(--status-in-progress-border);box-shadow:0 0 12px var(--status-in-progress-bg)',
  checkbox: 'width:18px;height:18px;border-radius:50%;border:2px solid var(--border-secondary);flex-shrink:0',
  checkboxDone: 'width:18px;height:18px;border-radius:50%;border:2px solid var(--brand-primary);background:var(--brand-primary);flex-shrink:0;display:flex;align-items:center;justify-content:center;color:white;font-size:var(--text-xs)',
  taskContent: 'flex:1;min-width:0',
  taskTitle: 'font-size:var(--text-sm);color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis',
  taskTitleDone: 'font-size:var(--text-sm);color:var(--text-tertiary);text-decoration:line-through;white-space:nowrap;overflow:hidden;text-overflow:ellipsis',
  taskMeta: 'display:flex;align-items:center;gap:var(--space-2);margin-top:var(--space-0_5)',
  metaItem: 'font-size:var(--text-xs);color:var(--text-tertiary);display:flex;align-items:center;gap:3px',
  metaOverdue: 'font-size:var(--text-xs);color:var(--color-danger);display:flex;align-items:center;gap:3px',
  priorityDot: 'width:6px;height:6px;border-radius:50%',
  timerBtn: 'background:none;border:none;color:var(--text-tertiary);font-size:var(--text-base);cursor:pointer;flex-shrink:0',
  projectBadge: 'font-size:var(--text-xs);padding:var(--space-px) var(--space-1_5);background:var(--surface-secondary);border-radius:var(--radius-sm);color:var(--text-tertiary)',
  empty: 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:var(--space-12) var(--space-6);gap:var(--space-3)',
  emptyIcon: 'font-size:48px;opacity:0.4',
  emptyText: 'font-size:var(--text-sm);color:var(--text-tertiary)',
}

const taskItem = (title: string, opts: { done?: boolean; priority?: string; due?: string; overdue?: boolean; project?: string; timerActive?: boolean } = {}) =>
  h('div', { style: opts.timerActive ? S.taskTimer : S.task }, [
    h('div', { style: opts.done ? S.checkboxDone : S.checkbox }, opts.done ? '✓' : null),
    h('div', { style: S.taskContent }, [
      h('div', { style: opts.done ? S.taskTitleDone : S.taskTitle }, title),
      (opts.priority || opts.due || opts.project) ? h('div', { style: S.taskMeta }, [
        opts.priority ? h('span', { style: S.metaItem }, [
          h('span', { style: S.priorityDot + `;background:${opts.priority === 'high' ? 'var(--color-danger)' : opts.priority === 'medium' ? 'var(--color-warning)' : 'var(--brand-primary)'}` }),
          opts.priority,
        ]) : null,
        opts.due ? h('span', { style: opts.overdue ? S.metaOverdue : S.metaItem }, ['📅 ' + opts.due]) : null,
        opts.project ? h('span', { style: S.projectBadge }, opts.project) : null,
      ]) : null,
    ]),
    h('button', { style: S.timerBtn }, opts.timerActive ? '⏸' : '▶'),
  ])

const meta: Meta = {
  title: '📱 Mobile/MobileInboxTaskList',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const FlatList: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      taskItem('Design landing page', { priority: 'high', due: 'Today', project: '🎨 Design' }),
      taskItem('Review pull request', { priority: 'medium', due: 'Tomorrow' }),
      taskItem('Fix navigation bug', { priority: 'low', timerActive: true }),
      taskItem('Update documentation', { done: true }),
      taskItem('Write unit tests', { due: 'Mar 5', overdue: true }),
    ])}
  }),
}

export const GroupedByProject: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.groupHeader }, [
        h('span', { style: S.groupDot + ';background:var(--brand-primary)' }),
        h('span', { style: S.groupTitle }, '🎨 Design'),
        h('span', { style: S.groupCount }, '2'),
      ]),
      taskItem('Design landing page', { priority: 'high', due: 'Today' }),
      taskItem('Create icon set', { priority: 'medium' }),
      h('div', { style: S.groupHeader }, [
        h('span', { style: S.groupDot + ';background:var(--color-warning)' }),
        h('span', { style: S.groupTitle }, '⚙️ Backend'),
        h('span', { style: S.groupCount }, '3'),
      ]),
      taskItem('Fix API endpoint', { priority: 'high', due: 'Today' }),
      taskItem('Add rate limiting', { priority: 'low' }),
      taskItem('Database migration', { done: true }),
    ])}
  }),
}

export const Empty: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.empty }, [
        h('span', { style: S.emptyIcon }, '📥'),
        h('span', { style: S.emptyText }, 'No tasks yet'),
      ]),
    ])}
  }),
}
