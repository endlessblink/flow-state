import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'background:var(--bg-primary);min-height:200px;position:relative;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;padding:var(--space-12)',
  banner: 'position:absolute;top:var(--space-4);left:var(--space-4);display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-3);background:var(--glass-bg-soft);border:1px solid var(--brand-primary);border-radius:var(--radius-md);backdrop-filter:blur(8px);color:var(--text-primary);font-size:var(--text-meta)',
  dismissBtn: 'display:flex;align-items:center;padding:var(--space-1);background:none;border:none;color:var(--text-secondary);cursor:pointer;border-radius:var(--radius-sm)',
  canvasPlaceholder: 'text-align:center;color:var(--text-tertiary);font-size:var(--text-meta)',
}

const meta: Meta = {
  title: '🧩 Canvas/DayRotationBanner',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const SingleGroup: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.banner }, [
        h('span', null, '☀️'),
        h('span', null, '1 group updated for today'),
        h('button', { style: S.dismissBtn }, '✕'),
      ]),
      h('div', { style: S.canvasPlaceholder }, 'Canvas area'),
    ])}
  }),
}

export const MultipleGroups: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.banner }, [
        h('span', null, '☀️'),
        h('span', null, '3 groups updated for today'),
        h('button', { style: S.dismissBtn }, '✕'),
      ]),
      h('div', { style: S.canvasPlaceholder }, 'Canvas area'),
    ])}
  }),
}
