import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);min-height:500px;position:relative;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;display:flex;align-items:center;justify-content:center;padding:24px',
  card: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);width:100%;min-height:280px;position:relative;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.3)',
  priorityStrip: 'position:absolute;left:0;top:0;bottom:0;width:4px',
  content: 'padding:24px 24px 24px 20px',
  title: 'font-size:20px;font-weight:600;color:var(--text-primary);margin-bottom:8px;line-height:1.3',
  desc: 'font-size:14px;color:var(--text-secondary);margin-bottom:16px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden',
  meta: 'display:flex;gap:12px;flex-wrap:wrap',
  metaItem: 'display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text-tertiary)',
  indicator: 'position:absolute;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;font-weight:600',
  indicatorLeft: 'left:0;top:50%;transform:translateY(-50%);padding:12px 8px;background:rgba(239,68,68,0.2);color:var(--color-danger);border-radius:0 var(--radius-md) var(--radius-md) 0',
  indicatorRight: 'right:0;top:50%;transform:translateY(-50%);padding:12px 8px;background:rgba(78,205,196,0.2);color:var(--brand-primary);border-radius:var(--radius-md) 0 0 var(--radius-md)',
  indicatorUp: 'top:0;left:50%;transform:translateX(-50%);padding:8px 12px;background:rgba(245,158,11,0.2);color:var(--color-warning);border-radius:0 0 var(--radius-md) var(--radius-md)',
  indicatorDown: 'bottom:0;left:50%;transform:translateX(-50%);padding:8px 12px;background:rgba(148,163,184,0.2);color:var(--text-tertiary);border-radius:var(--radius-md) var(--radius-md) 0 0',
}

const meta: Meta = {
  title: '📱 Mobile/MobileQuickSortCard',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.card }, [
        h('div', { style: S.priorityStrip + ';background:var(--color-danger)' }),
        h('div', { style: S.content }, [
          h('div', { style: S.title }, 'Design the new onboarding flow'),
          h('div', { style: S.desc }, 'Create wireframes and high-fidelity mockups for the mobile onboarding experience. Include skip option and progress indicators.'),
          h('div', { style: S.meta }, [
            h('span', { style: S.metaItem }, '📅 Today'),
            h('span', { style: S.metaItem }, '🚩 High'),
          ]),
        ]),
      ]),
    ])}
  }),
}

export const WithSwipeIndicators: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.card + ';position:relative' }, [
        h('div', { style: S.priorityStrip + ';background:var(--color-warning)' }),
        h('div', { style: S.indicator + ';' + S.indicatorLeft }, ['🗑️', 'Delete']),
        h('div', { style: S.indicator + ';' + S.indicatorRight }, ['💾', 'Save']),
        h('div', { style: S.indicator + ';' + S.indicatorUp }, ['✏️', 'Edit']),
        h('div', { style: S.indicator + ';' + S.indicatorDown }, ['⏭', 'Skip']),
        h('div', { style: S.content }, [
          h('div', { style: S.title }, 'Review API documentation'),
          h('div', { style: S.desc }, 'Go through the updated API docs and verify endpoint descriptions match implementation.'),
          h('div', { style: S.meta }, [
            h('span', { style: S.metaItem }, '📅 Tomorrow'),
            h('span', { style: S.metaItem }, '🚩 Medium'),
          ]),
        ]),
      ]),
    ])}
  }),
}

export const LowPriority: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.card }, [
        h('div', { style: S.priorityStrip + ';background:var(--brand-primary)' }),
        h('div', { style: S.content }, [
          h('div', { style: S.title }, 'Update README badges'),
          h('div', { style: S.meta }, [
            h('span', { style: S.metaItem }, '🚩 Low'),
          ]),
        ]),
      ]),
    ])}
  }),
}
