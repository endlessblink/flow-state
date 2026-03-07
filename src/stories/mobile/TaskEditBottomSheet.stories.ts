import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);min-height:450px;position:relative;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden',
  backdrop: 'position:absolute;inset:0;background:rgba(0,0,0,0.5)',
  sheet: 'position:absolute;bottom:0;left:0;right:0;background:var(--surface-primary);border-top-left-radius:var(--radius-xl);border-top-right-radius:var(--radius-xl);border-top:1px solid var(--border-primary)',
  handle: 'width:36px;height:4px;background:var(--border-secondary);border-radius:2px;margin:8px auto',
  header: 'display:flex;align-items:center;justify-content:space-between;padding:8px 16px;border-bottom:1px solid var(--border-primary)',
  headerTitle: 'font-size:16px;font-weight:600;color:var(--text-primary)',
  cancelBtn: 'color:var(--text-tertiary);font-size:14px;background:none;border:none;cursor:pointer',
  saveBtn: 'color:var(--brand-primary);font-size:14px;font-weight:600;background:none;border:none;cursor:pointer',
  saveBtnDisabled: 'color:var(--text-tertiary);font-size:14px;font-weight:600;background:none;border:none;opacity:0.5',
  field: 'padding:12px 16px',
  label: 'font-size:12px;color:var(--text-tertiary);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px',
  input: 'width:100%;border:none;background:var(--surface-secondary);color:var(--text-primary);font-size:15px;padding:10px 12px;border-radius:var(--radius-md);outline:none;font-family:inherit',
  textarea: 'width:100%;border:none;background:var(--surface-secondary);color:var(--text-primary);font-size:14px;padding:10px 12px;border-radius:var(--radius-md);outline:none;resize:none;min-height:60px;font-family:inherit',
  priorityRow: 'display:flex;gap:8px;padding:12px 16px',
  pill: 'display:flex;align-items:center;gap:4px;padding:6px 14px;background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-full);font-size:13px;color:var(--text-secondary);cursor:pointer',
  pillActive: 'display:flex;align-items:center;gap:4px;padding:6px 14px;border-radius:var(--radius-full);font-size:13px;cursor:pointer',
}

const priorityPill = (label: string, color: string, active = false) =>
  h('span', { style: active ? S.pillActive + `;background:${color}20;border:1px solid ${color};color:${color}` : S.pill }, [`🚩 ${label}`])

const meta: Meta = {
  title: '📱 Mobile/TaskEditBottomSheet',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.backdrop }),
      h('div', { style: S.sheet }, [
        h('div', { style: 'text-align:center' }, [h('div', { style: S.handle })]),
        h('div', { style: S.header }, [
          h('button', { style: S.cancelBtn }, 'Cancel'),
          h('span', { style: S.headerTitle }, 'Edit Task'),
          h('button', { style: S.saveBtn }, 'Save'),
        ]),
        h('div', { style: S.field }, [
          h('div', { style: S.label }, 'Title'),
          h('input', { style: S.input, value: 'Design landing page mockups' }),
        ]),
        h('div', { style: S.field }, [
          h('div', { style: S.label }, 'Description'),
          h('textarea', { style: S.textarea, value: 'Create high-fidelity mockups for the new landing page', rows: 3 }),
        ]),
        h('div', null, [
          h('div', { style: S.field }, [h('div', { style: S.label }, 'Priority')]),
          h('div', { style: S.priorityRow }, [
            priorityPill('High', '#ef4444', true),
            priorityPill('Medium', '#f59e0b'),
            priorityPill('Low', '#4ECDC4'),
            priorityPill('None', '#888'),
          ]),
        ]),
      ]),
    ])}
  }),
}

export const NoChanges: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.backdrop }),
      h('div', { style: S.sheet }, [
        h('div', { style: 'text-align:center' }, [h('div', { style: S.handle })]),
        h('div', { style: S.header }, [
          h('button', { style: S.cancelBtn }, 'Cancel'),
          h('span', { style: S.headerTitle }, 'Edit Task'),
          h('button', { style: S.saveBtnDisabled }, 'Save'),
        ]),
        h('div', { style: S.field }, [
          h('div', { style: S.label }, 'Title'),
          h('input', { style: S.input, value: 'Review API documentation' }),
        ]),
        h('div', { style: S.field }, [
          h('div', { style: S.label }, 'Description'),
          h('textarea', { style: S.textarea, placeholder: 'Add notes here...', rows: 3 }),
        ]),
        h('div', null, [
          h('div', { style: S.field }, [h('div', { style: S.label }, 'Priority')]),
          h('div', { style: S.priorityRow }, [
            priorityPill('High', '#ef4444'),
            priorityPill('Medium', '#f59e0b'),
            priorityPill('Low', '#4ECDC4'),
            priorityPill('None', '#888', true),
          ]),
        ]),
      ]),
    ])}
  }),
}
