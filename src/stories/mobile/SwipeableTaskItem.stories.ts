import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'
import { Pencil, Trash2, Check, Calendar } from 'lucide-vue-next'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;padding:var(--space-2)',
  container: 'position:relative;overflow:hidden;border-radius:var(--radius-lg);margin-bottom:var(--space-2)',
  actionLeft: 'position:absolute;left:0;top:0;bottom:0;width:80px;display:flex;align-items:center;justify-content:center;gap:var(--space-1_5);background:var(--brand-primary-subtle);color:var(--brand-primary);font-size:var(--text-meta);font-weight:500',
  actionRight: 'position:absolute;right:0;top:0;bottom:0;width:80px;display:flex;align-items:center;justify-content:center;gap:var(--space-1_5);background:var(--priority-high-bg);color:var(--color-danger);font-size:var(--text-meta);font-weight:500',
  content: 'position:relative;background:var(--surface-primary);padding:var(--space-3) var(--space-4);display:flex;align-items:center;gap:var(--space-3);z-index:1',
  contentSwiped: 'position:relative;background:var(--surface-primary);padding:var(--space-3) var(--space-4);display:flex;align-items:center;gap:var(--space-3);z-index:1;transform:translateX(80px);filter:blur(1px);transition:transform 0.3s',
  contentSwipedLeft: 'position:relative;background:var(--surface-primary);padding:var(--space-3) var(--space-4);display:flex;align-items:center;gap:var(--space-3);z-index:1;transform:translateX(-80px);filter:blur(1px);transition:transform 0.3s',
  checkbox: 'width:20px;height:20px;border-radius:50%;border:2px solid var(--border-subtle);flex-shrink:0',
  checkboxDone: 'width:20px;height:20px;border-radius:50%;border:2px solid var(--brand-primary);background:var(--brand-primary-subtle);flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--brand-primary)',
  title: 'color:var(--text-primary);font-size:var(--text-sm)',
  titleDone: 'color:var(--text-tertiary);font-size:var(--text-sm);text-decoration:line-through',
  meta: 'font-size:var(--text-xs);color:var(--text-tertiary);display:flex;align-items:center;gap:var(--space-2);margin-top:var(--space-0_5)',
  priorityHigh: 'font-size:var(--text-xs);font-weight:700;padding:var(--space-px) var(--space-1_5);border-radius:var(--radius-sm);text-transform:uppercase;letter-spacing:0.05em;background:var(--priority-high-bg);color:var(--color-priority-high)',
  priorityMedium: 'font-size:var(--text-xs);font-weight:700;padding:var(--space-px) var(--space-1_5);border-radius:var(--radius-sm);text-transform:uppercase;letter-spacing:0.05em;background:var(--priority-medium-bg);color:var(--color-priority-medium)',
  priorityLow: 'font-size:var(--text-xs);font-weight:700;padding:var(--space-px) var(--space-1_5);border-radius:var(--radius-sm);text-transform:uppercase;letter-spacing:0.05em;background:var(--priority-low-bg);color:var(--color-priority-low)',
  dueDate: 'display:inline-flex;align-items:center;gap:3px;color:var(--text-secondary);font-size:var(--text-xs)',
  hint: 'text-align:center;padding:var(--space-2);color:var(--text-tertiary);font-size:var(--text-xs);background:var(--surface-secondary);border-radius:var(--radius-md);margin-bottom:var(--space-2)',
}

const priorityStyle = (p: string) => p === 'high' ? S.priorityHigh : p === 'medium' ? S.priorityMedium : S.priorityLow

const taskItem = (title: string, done = false, priority = '', due = '') =>
  h('div', { style: S.container }, [
    h('div', { style: S.actionLeft }, [h(Pencil, { size: 20 })]),
    h('div', { style: S.actionRight }, [h(Trash2, { size: 20 })]),
    h('div', { style: S.content }, [
      h('div', { style: done ? S.checkboxDone : S.checkbox }, done ? [h(Check, { size: 14 })] : null),
      h('div', null, [
        h('div', { style: 'display:flex;align-items:flex-start;gap:var(--space-2)' }, [
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
            h('div', { style: 'display:flex;align-items:flex-start;gap:var(--space-2)' }, [
              h('span', { style: S.title }, 'Swiped left to delete'),
              h('span', { style: S.priorityHigh }, 'high'),
            ]),
          ]),
        ]),
      ]),
    ])}
  }),
}
