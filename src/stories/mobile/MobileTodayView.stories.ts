import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);min-height:600px;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;display:flex;flex-direction:column',
  header: 'padding:16px;background:var(--surface-primary);border-bottom:1px solid var(--border-primary)',
  dayOfWeek: 'font-size:24px;font-weight:700;color:var(--text-primary)',
  fullDate: 'font-size:13px;color:var(--text-tertiary);margin-top:2px',
  taskCount: 'font-size:12px;color:var(--brand-primary);margin-top:4px',
  filterBar: 'display:flex;gap:6px;padding:8px 12px;border-bottom:1px solid var(--border-primary)',
  filterBtn: 'display:flex;align-items:center;gap:4px;padding:6px 10px;background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-md);font-size:12px;color:var(--text-secondary);cursor:pointer',
  filterBtnActive: 'display:flex;align-items:center;gap:4px;padding:6px 10px;background:rgba(78,205,196,0.1);border:1px solid var(--brand-primary);border-radius:var(--radius-md);font-size:12px;color:var(--brand-primary);cursor:pointer',
  dropdown: 'position:absolute;top:100%;left:0;background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:4px;box-shadow:0 8px 24px rgba(0,0,0,0.3);min-width:140px;z-index:10',
  dropdownItem: 'padding:8px 12px;border-radius:var(--radius-md);font-size:13px;color:var(--text-secondary);cursor:pointer',
  list: 'flex:1;padding:8px 12px;overflow-y:auto',
  task: 'display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface-primary);border-radius:var(--radius-lg);margin-bottom:4px',
  checkbox: 'width:18px;height:18px;border-radius:50%;border:2px solid var(--border-secondary);flex-shrink:0',
  taskTitle: 'font-size:14px;color:var(--text-primary)',
  taskMeta: 'font-size:11px;color:var(--text-tertiary);margin-top:2px',
  priorityDot: 'display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:4px',
  fab: 'position:absolute;bottom:24px;right:24px;width:52px;height:52px;border-radius:50%;background:var(--glass-bg-soft);border:2px solid var(--brand-primary);display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--brand-primary);cursor:pointer;box-shadow:0 4px 20px rgba(78,205,196,0.3)',
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
