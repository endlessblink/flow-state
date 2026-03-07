import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'
import { Pencil, Trash2, Check, Calendar } from 'lucide-vue-next'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;padding:8px',
  container: 'position:relative;overflow:hidden;border-radius:var(--radius-lg);margin-bottom:8px',
  actionLeft: 'position:absolute;left:0;top:0;bottom:0;width:80px;display:flex;align-items:center;justify-content:center;gap:6px;background:rgba(78,205,196,0.15);color:var(--brand-primary);font-size:13px;font-weight:500',
  actionRight: 'position:absolute;right:0;top:0;bottom:0;width:80px;display:flex;align-items:center;justify-content:center;gap:6px;background:rgba(239,68,68,0.15);color:var(--color-danger);font-size:13px;font-weight:500',
  content: 'position:relative;background:var(--surface-primary);padding:12px 16px;display:flex;align-items:center;gap:12px;z-index:1',
  contentSwiped: 'position:relative;background:var(--surface-primary);padding:12px 16px;display:flex;align-items:center;gap:12px;z-index:1;transform:translateX(80px);filter:blur(1px);transition:transform 0.3s',
  contentSwipedLeft: 'position:relative;background:var(--surface-primary);padding:12px 16px;display:flex;align-items:center;gap:12px;z-index:1;transform:translateX(-80px);filter:blur(1px);transition:transform 0.3s',
  checkbox: 'width:20px;height:20px;border-radius:50%;border:2px solid var(--border-subtle);flex-shrink:0',
  checkboxDone: 'width:20px;height:20px;border-radius:50%;border:2px solid var(--brand-primary);background:rgba(78,205,196,0.15);flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--brand-primary)',
  title: 'color:var(--text-primary);font-size:14px',
  titleDone: 'color:var(--text-tertiary);font-size:14px;text-decoration:line-through',
  meta: 'font-size:11px;color:var(--text-tertiary);display:flex;align-items:center;gap:8px;margin-top:2px',
  priorityHigh: 'font-size:10px;font-weight:700;padding:1px 6px;border-radius:var(--radius-sm);text-transform:uppercase;letter-spacing:0.05em;background:var(--priority-high-bg);color:var(--color-priority-high)',
  priorityMedium: 'font-size:10px;font-weight:700;padding:1px 6px;border-radius:var(--radius-sm);text-transform:uppercase;letter-spacing:0.05em;background:var(--priority-medium-bg);color:var(--color-priority-medium)',
  priorityLow: 'font-size:10px;font-weight:700;padding:1px 6px;border-radius:var(--radius-sm);text-transform:uppercase;letter-spacing:0.05em;background:var(--priority-low-bg);color:var(--color-priority-low)',
  dueDate: 'display:inline-flex;align-items:center;gap:3px;color:var(--text-secondary);font-size:11px',
  hint: 'text-align:center;padding:8px;color:var(--text-tertiary);font-size:12px;background:var(--surface-secondary);border-radius:var(--radius-md);margin-bottom:8px',
}

const priorityStyle = (p: string) => p === 'high' ? S.priorityHigh : p === 'medium' ? S.priorityMedium : S.priorityLow

const taskItem = (title: string, done = false, priority = '', due = '') =>
  h('div', { style: S.container }, [
    h('div', { style: S.actionLeft }, [h(Pencil, { size: 20 })]),
    h('div', { style: S.actionRight }, [h(Trash2, { size: 20 })]),
    h('div', { style: S.content }, [
      h('div', { style: done ? S.checkboxDone : S.checkbox }, done ? [h(Check, { size: 14 })] : null),
      h('div', null, [
        h('div', { style: 'display:flex;align-items:flex-start;gap:8px' }, [
          h('span', { style: done ? S.titleDone : S.title }, title),
          priority ? h('span', { style: priorityStyle(priority) }, priority) : null,
        ]),
        due ? h('div', { style: S.meta }, [
          h('span', { style: S.dueDate }, [h(Calendar, { size: 12 }), due]),
        ]) : null,
      ]),
    ]),
  ])

const meta: Meta = {
  title: '📱 Mobile/SwipeableTaskItem',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.hint }, '← Delete  |  Edit →'),
      taskItem('Design landing page', false, 'high', 'Today'),
      taskItem('Review pull request', false, 'medium', 'Tomorrow'),
      taskItem('Update documentation', true),
      taskItem('Fix navigation bug', false, 'low'),
    ])}
  }),
}

export const SwipedRight: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.container }, [
        h('div', { style: S.actionLeft }, [h(Pencil, { size: 20 }), ' Edit']),
        h('div', { style: S.actionRight }, [h(Trash2, { size: 20 })]),
        h('div', { style: S.contentSwiped }, [
          h('div', { style: S.checkbox }),
          h('div', null, [
            h('div', { style: S.title }, 'Swiped right to edit'),
            h('div', { style: S.meta }, [h('span', { style: S.dueDate }, [h(Calendar, { size: 12 }), 'Today'])]),
          ]),
        ]),
      ]),
    ])}
  }),
}

export const SwipedLeft: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.container }, [
        h('div', { style: S.actionLeft }, [h(Pencil, { size: 20 })]),
        h('div', { style: S.actionRight }, [h(Trash2, { size: 20 }), ' Delete']),
        h('div', { style: S.contentSwipedLeft }, [
          h('div', { style: S.checkbox }),
          h('div', null, [
            h('div', { style: 'display:flex;align-items:flex-start;gap:8px' }, [
              h('span', { style: S.title }, 'Swiped left to delete'),
              h('span', { style: S.priorityHigh }, 'high'),
            ]),
          ]),
        ]),
      ]),
    ])}
  }),
}
