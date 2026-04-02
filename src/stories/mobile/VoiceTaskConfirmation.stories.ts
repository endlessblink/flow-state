import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto',
  modal: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);padding:var(--space-5);box-shadow:0 20px 60px var(--overlay-bg)',
  header: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-4)',
  headerLeft: 'display:flex;align-items:center;gap:var(--space-2);color:var(--brand-primary);font-size:var(--text-base);font-weight:600',
  closeBtn: 'background:none;border:none;color:var(--text-tertiary);font-size:var(--text-lg);cursor:pointer',
  field: 'margin-bottom:var(--space-3)',
  label: 'font-size:var(--text-xs);color:var(--text-tertiary);margin-bottom:var(--space-1);text-transform:uppercase;letter-spacing:0.5px',
  textarea: 'width:100%;border:1px solid var(--border-primary);background:var(--surface-secondary);color:var(--text-primary);font-size:var(--text-sm);padding:var(--space-2_5) var(--space-3);border-radius:var(--radius-md);outline:none;resize:none;font-family:inherit',
  reRecordBtn: 'display:flex;align-items:center;gap:var(--space-1_5);padding:var(--space-1_5) var(--space-3);background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-md);color:var(--text-secondary);font-size:var(--text-xs);cursor:pointer;margin-top:var(--space-2)',
  reRecordActive: 'display:flex;align-items:center;gap:var(--space-1_5);padding:var(--space-1_5) var(--space-3);background:var(--priority-high-bg);border:1px solid var(--color-danger);border-radius:var(--radius-md);color:var(--color-danger);font-size:var(--text-xs);cursor:pointer;margin-top:var(--space-2)',
  priorityRow: 'display:flex;gap:var(--space-2);margin-top:var(--space-1)',
  pill: 'padding:var(--space-1_5) var(--space-3_5);background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-full);font-size:var(--text-xs);color:var(--text-secondary);cursor:pointer',
  pillActive: 'padding:var(--space-1_5) var(--space-3_5);border-radius:var(--radius-full);font-size:var(--text-xs);cursor:pointer;border:1px solid var(--color-danger);color:var(--color-danger);background:var(--priority-high-bg)',
  actions: 'display:flex;gap:var(--space-2);margin-top:var(--space-4)',
  cancelBtn: 'flex:1;padding:var(--space-2_5);background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-lg);color:var(--text-secondary);font-size:var(--text-sm);cursor:pointer',
  confirmBtn: 'flex:1;padding:var(--space-2_5);background:var(--glass-bg-soft);border:1px solid var(--brand-primary);border-radius:var(--radius-lg);color:var(--brand-primary);font-size:var(--text-sm);font-weight:600;cursor:pointer',
}

const meta: Meta = {
  title: '📱 Mobile/VoiceTaskConfirmation',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.modal }, [
        h('div', { style: S.header }, [
          h('div', { style: S.headerLeft }, ['✅ Confirm Task']),
          h('button', { style: S.closeBtn }, '✕'),
        ]),
        h('div', { style: S.field }, [
          h('div', { style: S.label }, 'Task Title'),
          h('textarea', { style: S.textarea, value: 'Schedule team meeting for next sprint planning', rows: 2 }),
        ]),
        h('div', { style: S.field }, [
          h('button', { style: S.reRecordBtn }, ['🎤 Re-record']),
        ]),
        h('div', { style: S.field }, [
          h('div', { style: S.label }, 'Priority'),
          h('div', { style: S.priorityRow }, [
            h('span', { style: S.pillActive }, '🚩 High'),
            h('span', { style: S.pill }, '🚩 Medium'),
            h('span', { style: S.pill }, '🚩 Low'),
          ]),
        ]),
        h('div', { style: S.actions }, [
          h('button', { style: S.cancelBtn }, 'Cancel'),
          h('button', { style: S.confirmBtn }, 'Confirm'),
        ]),
      ]),
    ])}
  }),
}

export const ReRecording: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.modal }, [
        h('div', { style: S.header }, [
          h('div', { style: S.headerLeft }, ['✅ Confirm Task']),
          h('button', { style: S.closeBtn }, '✕'),
        ]),
        h('div', { style: S.field }, [
          h('div', { style: S.label }, 'Task Title'),
          h('textarea', { style: S.textarea + ';border-color:var(--color-danger)', placeholder: 'Listening...', rows: 2 }),
        ]),
        h('div', { style: S.field }, [
          h('button', { style: S.reRecordActive }, ['🔴 Stop Recording']),
        ]),
        h('div', { style: S.field }, [
          h('div', { style: S.label }, 'Priority'),
          h('div', { style: S.priorityRow }, [
            h('span', { style: S.pill }, '🚩 High'),
            h('span', { style: S.pill }, '🚩 Medium'),
            h('span', { style: S.pill }, '🚩 Low'),
          ]),
        ]),
        h('div', { style: S.actions }, [
          h('button', { style: S.cancelBtn }, 'Cancel'),
          h('button', { style: S.confirmBtn + ';opacity:0.5;pointer-events:none' }, 'Confirm'),
        ]),
      ]),
    ])}
  }),
}
