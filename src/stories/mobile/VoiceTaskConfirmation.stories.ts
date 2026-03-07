import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto',
  modal: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);padding:20px;box-shadow:0 20px 60px rgba(0,0,0,0.5)',
  header: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px',
  headerLeft: 'display:flex;align-items:center;gap:8px;color:var(--brand-primary);font-size:16px;font-weight:600',
  closeBtn: 'background:none;border:none;color:var(--text-tertiary);font-size:18px;cursor:pointer',
  field: 'margin-bottom:12px',
  label: 'font-size:12px;color:var(--text-tertiary);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px',
  textarea: 'width:100%;border:1px solid var(--border-primary);background:var(--surface-secondary);color:var(--text-primary);font-size:14px;padding:10px 12px;border-radius:var(--radius-md);outline:none;resize:none;font-family:inherit',
  reRecordBtn: 'display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-md);color:var(--text-secondary);font-size:12px;cursor:pointer;margin-top:8px',
  reRecordActive: 'display:flex;align-items:center;gap:6px;padding:6px 12px;background:rgba(239,68,68,0.15);border:1px solid var(--color-danger);border-radius:var(--radius-md);color:var(--color-danger);font-size:12px;cursor:pointer;margin-top:8px',
  priorityRow: 'display:flex;gap:8px;margin-top:4px',
  pill: 'padding:6px 14px;background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-full);font-size:12px;color:var(--text-secondary);cursor:pointer',
  pillActive: 'padding:6px 14px;border-radius:var(--radius-full);font-size:12px;cursor:pointer;border:1px solid var(--color-danger);color:var(--color-danger);background:rgba(239,68,68,0.1)',
  actions: 'display:flex;gap:8px;margin-top:16px',
  cancelBtn: 'flex:1;padding:10px;background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-lg);color:var(--text-secondary);font-size:14px;cursor:pointer',
  confirmBtn: 'flex:1;padding:10px;background:var(--glass-bg-soft);border:1px solid var(--brand-primary);border-radius:var(--radius-lg);color:var(--brand-primary);font-size:14px;font-weight:600;cursor:pointer',
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
