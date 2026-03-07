import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;padding:16px',
  inputCard: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:12px',
  input: 'width:100%;border:none;background:transparent;color:var(--text-primary);font-size:15px;outline:none;font-family:inherit',
  quickActions: 'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap',
  quickBtn: 'display:flex;align-items:center;gap:4px;padding:4px 10px;background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-full);font-size:12px;color:var(--text-secondary);cursor:pointer',
  quickBtnActive: 'display:flex;align-items:center;gap:4px;padding:4px 10px;background:rgba(78,205,196,0.1);border:1px solid var(--brand-primary);border-radius:var(--radius-full);font-size:12px;color:var(--brand-primary);cursor:pointer',
  addBtn: 'display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:var(--glass-bg-soft);border:1px solid var(--brand-primary);color:var(--brand-primary);font-size:18px;cursor:pointer;margin-left:auto',
  addBtnDisabled: 'display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:var(--glass-bg-soft);border:1px solid var(--border-primary);color:var(--text-tertiary);font-size:18px;opacity:0.5',
  recentSection: 'margin-top:20px',
  recentTitle: 'font-size:12px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px',
  recentItem: 'display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--surface-primary);border-radius:var(--radius-md);margin-bottom:4px',
  recentCheck: 'color:var(--brand-primary);font-size:14px',
  recentText: 'font-size:13px;color:var(--text-secondary)',
  inputRow: 'display:flex;align-items:center;gap:8px',
}

const meta: Meta = {
  title: '📱 Mobile/MobileQuickSortCapture',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const Empty: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.inputCard }, [
        h('div', { style: S.inputRow }, [
          h('input', { style: S.input, placeholder: 'What needs to be done?' }),
          h('button', { style: S.addBtnDisabled }, '+'),
        ]),
        h('div', { style: S.quickActions }, [
          h('span', { style: S.quickBtn }, '🚩 High'),
          h('span', { style: S.quickBtn }, '📅 Today'),
          h('span', { style: S.quickBtn }, '📅 Tomorrow'),
        ]),
      ]),
    ])}
  }),
}

export const WithInput: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.inputCard }, [
        h('div', { style: S.inputRow }, [
          h('input', { style: S.input, value: 'Set up CI/CD pipeline' }),
          h('button', { style: S.addBtn }, '+'),
        ]),
        h('div', { style: S.quickActions }, [
          h('span', { style: S.quickBtnActive }, '🚩 High'),
          h('span', { style: S.quickBtnActive }, '📅 Today'),
          h('span', { style: S.quickBtn }, '📅 Tomorrow'),
        ]),
      ]),
      h('div', { style: S.recentSection }, [
        h('div', { style: S.recentTitle }, 'Recently Added'),
        h('div', { style: S.recentItem }, [
          h('span', { style: S.recentCheck }, '✓'),
          h('span', { style: S.recentText }, 'Fix login redirect bug'),
        ]),
        h('div', { style: S.recentItem }, [
          h('span', { style: S.recentCheck }, '✓'),
          h('span', { style: S.recentText }, 'Update API documentation'),
        ]),
      ]),
    ])}
  }),
}
