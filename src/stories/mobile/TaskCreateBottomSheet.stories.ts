import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);min-height:400px;position:relative;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden',
  backdrop: 'position:absolute;inset:0;background:rgba(0,0,0,0.5)',
  sheet: 'position:absolute;bottom:0;left:0;right:0;background:var(--surface-primary);border-top-left-radius:var(--radius-xl);border-top-right-radius:var(--radius-xl);padding:0;border-top:1px solid var(--border-primary)',
  handle: 'width:36px;height:4px;background:var(--border-secondary);border-radius:2px;margin:8px auto',
  header: 'display:flex;align-items:center;justify-content:space-between;padding:8px 16px;border-bottom:1px solid var(--border-primary)',
  headerTitle: 'font-size:16px;font-weight:600;color:var(--text-primary)',
  cancelBtn: 'color:var(--text-tertiary);font-size:14px;background:none;border:none;cursor:pointer',
  addBtn: 'color:var(--brand-primary);font-size:14px;font-weight:600;background:none;border:none;cursor:pointer',
  addBtnDisabled: 'color:var(--text-tertiary);font-size:14px;font-weight:600;background:none;border:none;opacity:0.5',
  textarea: 'width:100%;border:none;background:transparent;color:var(--text-primary);font-size:15px;padding:16px;resize:none;outline:none;min-height:80px;font-family:inherit',
  chips: 'display:flex;gap:8px;padding:8px 16px;flex-wrap:wrap',
  chip: 'display:flex;align-items:center;gap:4px;padding:4px 10px;background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-full);font-size:12px;color:var(--text-secondary);cursor:pointer',
  chipActive: 'display:flex;align-items:center;gap:4px;padding:4px 10px;background:var(--glass-bg-soft);border:1px solid var(--brand-primary);border-radius:var(--radius-full);font-size:12px;color:var(--brand-primary);cursor:pointer',
  recordingBar: 'display:flex;align-items:center;gap:8px;padding:12px 16px;background:var(--color-danger);color:white;font-size:13px',
  recordingDot: 'width:8px;height:8px;border-radius:50%;background:white;animation:pulse 1s infinite',
}

const meta: Meta = {
  title: '📱 Mobile/TaskCreateBottomSheet',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const Empty: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.backdrop }),
      h('div', { style: S.sheet }, [
        h('div', { style: 'text-align:center' }, [h('div', { style: S.handle })]),
        h('div', { style: S.header }, [
          h('button', { style: S.cancelBtn }, 'Cancel'),
          h('span', { style: S.headerTitle }, 'New Task'),
          h('button', { style: S.addBtnDisabled }, 'Add'),
        ]),
        h('textarea', { style: S.textarea, placeholder: 'What needs to be done?', rows: 3 }),
        h('div', { style: S.chips }, [
          h('span', { style: S.chip }, '📅 Today'),
          h('span', { style: S.chip }, '📅 Tomorrow'),
          h('span', { style: S.chip }, '📅 Next Week'),
        ]),
      ]),
    ])}
  }),
}

export const WithContent: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.backdrop }),
      h('div', { style: S.sheet }, [
        h('div', { style: 'text-align:center' }, [h('div', { style: S.handle })]),
        h('div', { style: S.header }, [
          h('button', { style: S.cancelBtn }, 'Cancel'),
          h('span', { style: S.headerTitle }, 'New Task'),
          h('button', { style: S.addBtn }, 'Add'),
        ]),
        h('textarea', { style: S.textarea, value: 'Design the new onboarding flow for mobile users', rows: 3 }),
        h('div', { style: S.chips }, [
          h('span', { style: S.chipActive }, '📅 Today'),
          h('span', { style: S.chip }, '📅 Tomorrow'),
          h('span', { style: S.chip }, '📅 Next Week'),
        ]),
      ]),
    ])}
  }),
}

export const Recording: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.backdrop }),
      h('div', { style: S.sheet }, [
        h('div', { style: 'text-align:center' }, [h('div', { style: S.handle })]),
        h('div', { style: S.recordingBar }, [
          h('span', { style: S.recordingDot }),
          h('span', null, '0:03 — Speak freely...'),
          h('button', { style: 'background:none;border:none;color:white;font-size:16px;margin-left:auto;cursor:pointer' }, '⏹'),
        ]),
        h('textarea', { style: S.textarea, placeholder: 'Listening...', rows: 3 }),
        h('div', { style: S.chips }, [
          h('span', { style: S.chip }, '📅 Today'),
          h('span', { style: S.chip }, '📅 Tomorrow'),
          h('span', { style: S.chip }, '📅 Next Week'),
        ]),
      ]),
    ])}
  }),
}
