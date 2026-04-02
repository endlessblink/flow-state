import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);min-height:450px;position:relative;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden',
  backdrop: 'position:absolute;inset:0;background:var(--overlay-bg)',
  sheet: 'position:absolute;bottom:0;left:0;right:0;background:var(--surface-primary);border-top-left-radius:var(--radius-xl);border-top-right-radius:var(--radius-xl);border-top:1px solid var(--border-primary)',
  handle: 'width:36px;height:4px;background:var(--border-secondary);border-radius:var(--radius-xs);margin:var(--space-2) auto',
  header: 'display:flex;align-items:center;justify-content:space-between;padding:var(--space-2) var(--space-4);border-bottom:1px solid var(--border-primary)',
  headerTitle: 'font-size:var(--text-base);font-weight:600;color:var(--text-primary)',
  cancelBtn: 'color:var(--text-tertiary);font-size:var(--text-sm);background:none;border:none;cursor:pointer',
  saveBtn: 'color:var(--brand-primary);font-size:var(--text-sm);font-weight:600;background:none;border:none;cursor:pointer',
  saveBtnDisabled: 'color:var(--text-tertiary);font-size:var(--text-sm);font-weight:600;background:none;border:none;opacity:0.5',
  field: 'padding:var(--space-3) var(--space-4)',
  label: 'font-size:var(--text-xs);color:var(--text-tertiary);margin-bottom:var(--space-1);text-transform:uppercase;letter-spacing:0.5px',
  input: 'width:100%;border:none;background:var(--surface-secondary);color:var(--text-primary);font-size:var(--text-base);padding:var(--space-2_5) var(--space-3);border-radius:var(--radius-md);outline:none;font-family:inherit',
  textarea: 'width:100%;border:none;background:var(--surface-secondary);color:var(--text-primary);font-size:var(--text-sm);padding:var(--space-2_5) var(--space-3);border-radius:var(--radius-md);outline:none;resize:none;min-height:60px;font-family:inherit',
  priorityRow: 'display:flex;gap:var(--space-2);padding:var(--space-3) var(--space-4)',
  pill: 'display:flex;align-items:center;gap:var(--space-1);padding:var(--space-1_5) var(--space-3_5);background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-full);font-size:var(--text-meta);color:var(--text-secondary);cursor:pointer',
  pillActive: 'display:flex;align-items:center;gap:var(--space-1);padding:var(--space-1_5) var(--space-3_5);border-radius:var(--radius-full);font-size:var(--text-meta);cursor:pointer',
}

const priorityColors: Record<string, { bg: string; border: string; text: string }> = {
  High:   { bg: 'var(--priority-high-bg)',   border: 'var(--color-danger)',   text: 'var(--color-danger)' },
  Medium: { bg: 'var(--priority-medium-bg)', border: 'var(--color-warning)',  text: 'var(--color-warning)' },
  Low:    { bg: 'var(--priority-low-bg)',    border: 'var(--brand-primary)',  text: 'var(--brand-primary)' },
  None:   { bg: 'var(--glass-bg-soft)',      border: 'var(--border-primary)', text: 'var(--text-secondary)' },
}

const priorityPill = (label: string, _color: string, active = false) => {
  const c = priorityColors[label] ?? priorityColors.None
  const activeStyle = `background:${c.bg};border:1px solid ${c.border};color:${c.text}`
  return h('span', { style: active ? S.pillActive + ';' + activeStyle : S.pill }, [`🚩 ${label}`])
}

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
            priorityPill('High', '', true),
            priorityPill('Medium', ''),
            priorityPill('Low', ''),
            priorityPill('None', ''),
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
            priorityPill('High', ''),
            priorityPill('Medium', ''),
            priorityPill('Low', ''),
            priorityPill('None', '', true),
          ]),
        ]),
      ]),
    ])}
  }),
}
