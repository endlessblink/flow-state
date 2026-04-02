import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);min-height:600px;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;display:flex;flex-direction:column',
  header: 'padding:var(--space-4);background:var(--surface-primary);border-bottom:1px solid var(--border-primary)',
  dayOfWeek: 'font-size:24px;font-weight:700;color:var(--text-primary)',
  fullDate: 'font-size:var(--text-meta);color:var(--text-tertiary);margin-top:var(--space-0_5)',
  taskCount: 'font-size:var(--text-xs);color:var(--brand-primary);margin-top:var(--space-1)',
  filterBar: 'display:flex;gap:var(--space-1_5);padding:var(--space-2) var(--space-3);border-bottom:1px solid var(--border-primary)',
  filterBtn: 'display:flex;align-items:center;gap:var(--space-1);padding:var(--space-1_5) var(--space-2_5);background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-md);font-size:var(--text-xs);color:var(--text-secondary);cursor:pointer',
  filterBtnActive: 'display:flex;align-items:center;gap:var(--space-1);padding:var(--space-1_5) var(--space-2_5);background:var(--brand-primary-subtle);border:1px solid var(--brand-primary);border-radius:var(--radius-md);font-size:var(--text-xs);color:var(--brand-primary);cursor:pointer',
  dropdown: 'position:absolute;top:100%;left:0;background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:var(--space-1);box-shadow:0 8px 24px var(--overlay-bg);min-width:140px;z-index:10',
  dropdownItem: 'padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);font-size:var(--text-meta);color:var(--text-secondary);cursor:pointer',
  list: 'flex:1;padding:var(--space-2) var(--space-3);overflow-y:auto',
  task: 'display:flex;align-items:center;gap:var(--space-2_5);padding:var(--space-2_5) var(--space-3);background:var(--surface-primary);border-radius:var(--radius-lg);margin-bottom:var(--space-1)',
  checkbox: 'width:18px;height:18px;border-radius:50%;border:2px solid var(--border-secondary);flex-shrink:0',
  taskTitle: 'font-size:var(--text-sm);color:var(--text-primary)',
  taskMeta: 'font-size:var(--text-xs);color:var(--text-tertiary);margin-top:var(--space-0_5)',
  priorityDot: 'display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:var(--space-1)',
  fab: 'position:absolute;bottom:var(--space-6);right:var(--space-6);width:52px;height:52px;border-radius:50%;background:var(--glass-bg-soft);border:2px solid var(--brand-primary);display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--brand-primary);cursor:pointer;box-shadow:0 4px 20px var(--brand-primary-dim)',
  posRel: 'position:relative;flex:1;display:flex;flex-direction:column',
}

const meta: Meta = {
  title: '📱 Mobile/MobileTodayView',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    setup() {
      const tasks = [
        { title: 'Design landing page', priority: 'high', project: '🎨 Design' },
        { title: 'Review pull request', priority: 'medium', project: '⚙️ Backend' },
        { title: 'Fix navigation bug', priority: 'high', project: '📱 Mobile' },
        { title: 'Update documentation', priority: 'low', project: '📝 Docs' },
      ]
      return () => h('div', { style: S.wrapper }, [
        h('div', { style: S.header }, [
          h('div', { style: S.dayOfWeek }, 'Friday'),
          h('div', { style: S.fullDate }, 'March 7, 2026'),
          h('div', { style: S.taskCount }, `${tasks.length} tasks due today`),
        ]),
        h('div', { style: S.filterBar }, [
          h('button', { style: S.filterBtn }, '📁 All Projects ▾'),
          h('button', { style: S.filterBtn }, '🚩 Priority ▾'),
          h('button', { style: S.filterBtn }, '📑 Group ▾'),
        ]),
        h('div', { style: S.posRel }, [
          h('div', { style: S.list }, tasks.map(t =>
            h('div', { style: S.task }, [
              h('div', { style: S.checkbox }),
              h('div', { style: 'flex:1;min-width:0' }, [
                h('div', { style: S.taskTitle }, t.title),
                h('div', { style: S.taskMeta }, [
                  h('span', { style: S.priorityDot + `;background:${t.priority === 'high' ? 'var(--color-danger)' : t.priority === 'medium' ? 'var(--color-warning)' : 'var(--brand-primary)'}` }),
                  `${t.priority}  •  ${t.project}`,
                ]),
              ]),
            ])
          )),
          h('div', { style: S.fab }, '+'),
        ]),
      ])
    }
  }),
}
