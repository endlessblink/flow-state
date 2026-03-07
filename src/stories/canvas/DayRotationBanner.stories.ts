import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'background:var(--bg-primary);min-height:200px;position:relative;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;padding:48px',
  banner: 'position:absolute;top:16px;left:16px;display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--glass-bg-soft);border:1px solid var(--brand-primary);border-radius:var(--radius-md);backdrop-filter:blur(8px);color:var(--text-primary);font-size:13px',
  dismissBtn: 'display:flex;align-items:center;padding:4px;background:none;border:none;color:var(--text-secondary);cursor:pointer;border-radius:var(--radius-sm)',
  canvasPlaceholder: 'text-align:center;color:var(--text-tertiary);font-size:13px',
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
