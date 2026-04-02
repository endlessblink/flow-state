import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;padding:var(--space-4)',
  inputCard: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:var(--space-3)',
  input: 'width:100%;border:none;background:transparent;color:var(--text-primary);font-size:var(--text-base);outline:none;font-family:inherit',
  quickActions: 'display:flex;gap:var(--space-2);margin-top:var(--space-2_5);flex-wrap:wrap',
  quickBtn: 'display:flex;align-items:center;gap:var(--space-1);padding:var(--space-1) var(--space-2_5);background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-full);font-size:var(--text-xs);color:var(--text-secondary);cursor:pointer',
  quickBtnActive: 'display:flex;align-items:center;gap:var(--space-1);padding:var(--space-1) var(--space-2_5);background:var(--brand-primary-subtle);border:1px solid var(--brand-primary);border-radius:var(--radius-full);font-size:var(--text-xs);color:var(--brand-primary);cursor:pointer',
  addBtn: 'display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:var(--glass-bg-soft);border:1px solid var(--brand-primary);color:var(--brand-primary);font-size:var(--text-lg);cursor:pointer;margin-left:auto',
  addBtnDisabled: 'display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:var(--glass-bg-soft);border:1px solid var(--border-primary);color:var(--text-tertiary);font-size:var(--text-lg);opacity:0.5',
  recentSection: 'margin-top:var(--space-5)',
  recentTitle: 'font-size:var(--text-xs);color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:var(--space-2)',
  recentItem: 'display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-3);background:var(--surface-primary);border-radius:var(--radius-md);margin-bottom:var(--space-1)',
  recentCheck: 'color:var(--brand-primary);font-size:var(--text-sm)',
  recentText: 'font-size:var(--text-meta);color:var(--text-secondary)',
  inputRow: 'display:flex;align-items:center;gap:var(--space-2)',
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
