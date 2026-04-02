import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'
import { X, Sun } from 'lucide-vue-next'

const S = {
  wrapper: 'background:var(--bg-primary);min-height:600px;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;display:flex;justify-content:center;padding:var(--space-6)',
  content: 'width:100%;max-width:900px',
  header: 'display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-6)',
  greeting: 'flex:1',
  greetingText: 'font-size:var(--text-3xl);font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:var(--space-2)',
  greetingSub: 'font-size:var(--text-sm);color:var(--text-secondary);margin-top:var(--space-1)',
  score: 'text-align:right',
  scoreValue: 'font-size:var(--text-4xl);font-weight:700;color:var(--brand-primary)',
  scoreLabel: 'font-size:var(--text-xs);color:var(--text-tertiary);text-transform:uppercase',
  closeBtn: 'background:none;border:none;color:var(--text-tertiary);cursor:pointer;margin-left:var(--space-4);display:flex;align-items:center',
  bigThree: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);padding:var(--space-5);margin-bottom:var(--space-5)',
  bigThreeTitle: 'font-size:var(--text-sm);font-weight:600;color:var(--text-primary);margin-bottom:var(--space-3)',
  slot: 'display:flex;align-items:center;gap:var(--space-3);padding:var(--space-2_5) var(--space-3);background:var(--surface-secondary);border-radius:var(--radius-lg);margin-bottom:var(--space-2)',
  slotNum: 'width:24px;height:24px;border-radius:50%;background:var(--brand-primary-subtle);border:1px solid var(--brand-primary-dim);color:var(--brand-primary);display:flex;align-items:center;justify-content:center;font-size:var(--text-xs);font-weight:700;flex-shrink:0',
  slotTitle: 'font-size:var(--text-sm);color:var(--text-primary)',
  slotEmpty: 'font-size:var(--text-meta);color:var(--text-tertiary);font-style:italic',
  bottom: 'display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);margin-bottom:var(--space-5)',
  card: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:var(--space-4)',
  cardTitle: 'font-size:var(--text-meta);font-weight:600;color:var(--text-primary);margin-bottom:var(--space-2)',
  cardContent: 'font-size:var(--text-meta);color:var(--text-secondary)',
  capture: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:var(--space-3);display:flex;gap:var(--space-2)',
  captureInput: 'flex:1;padding:var(--space-2) var(--space-3);background:var(--surface-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-md);color:var(--text-primary);font-size:var(--text-meta);outline:none',
  captureBtn: 'padding:var(--space-2) var(--space-3_5);background:var(--glass-bg-soft);border:1px solid var(--brand-primary);border-radius:var(--radius-md);color:var(--brand-primary);font-size:var(--text-meta);cursor:pointer',
}

const meta: Meta = {
  title: '🖥️ Views/MorningDashboardView',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.content }, [
        h('div', { style: S.header }, [
          h('div', { style: S.greeting }, [
            h('div', { style: S.greetingText }, ['Good morning! ', h(Sun, { size: 24, style: 'color:var(--color-break)' })]),
            h('div', { style: S.greetingSub }, "Friday, March 7 — Let's make today count."),
          ]),
          h('div', { style: S.score }, [
            h('div', { style: S.scoreValue }, '72'),
            h('div', { style: S.scoreLabel }, 'Morning Score'),
          ]),
          h('button', { style: S.closeBtn }, [h(X, { size: 20 })]),
        ]),
        h('div', { style: S.bigThree }, [
          h('div', { style: S.bigThreeTitle }, "Today's Big 3"),
          h('div', { style: S.slot }, [
            h('span', { style: S.slotNum }, '1'),
            h('span', { style: S.slotTitle }, 'Design landing page mockups'),
          ]),
          h('div', { style: S.slot }, [
            h('span', { style: S.slotNum }, '2'),
            h('span', { style: S.slotTitle }, 'Fix navigation bug'),
          ]),
          h('div', { style: S.slot }, [
            h('span', { style: S.slotNum }, '3'),
            h('span', { style: S.slotEmpty }, 'Drop a task here...'),
          ]),
        ]),
        h('div', { style: S.bottom }, [
          h('div', { style: S.card }, [
            h('div', { style: S.cardTitle }, 'Daily Missions'),
            h('div', { style: S.cardContent }, '2 of 5 missions completed'),
          ]),
          h('div', { style: S.card }, [
            h('div', { style: S.cardTitle }, 'News & Updates'),
            h('div', { style: S.cardContent }, 'Streak: 5 days! Keep it up.'),
          ]),
        ]),
        h('div', { style: S.capture }, [
          h('input', { style: S.captureInput, placeholder: 'Quick capture a thought...' }),
          h('button', { style: S.captureBtn }, '+ Add'),
        ]),
      ]),
    ])}
  }),
}
