import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'
import { X, Sun } from 'lucide-vue-next'

const S = {
  wrapper: 'background:var(--bg-primary);min-height:600px;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;display:flex;justify-content:center;padding:24px',
  content: 'width:100%;max-width:900px',
  header: 'display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px',
  greeting: 'flex:1',
  greetingText: 'font-size:28px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:8px',
  greetingSub: 'font-size:14px;color:var(--text-secondary);margin-top:4px',
  score: 'text-align:right',
  scoreValue: 'font-size:36px;font-weight:700;color:var(--brand-primary)',
  scoreLabel: 'font-size:11px;color:var(--text-tertiary);text-transform:uppercase',
  closeBtn: 'background:none;border:none;color:var(--text-tertiary);cursor:pointer;margin-left:16px;display:flex;align-items:center',
  bigThree: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);padding:20px;margin-bottom:20px',
  bigThreeTitle: 'font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:12px',
  slot: 'display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--surface-secondary);border-radius:var(--radius-lg);margin-bottom:8px',
  slotNum: 'width:24px;height:24px;border-radius:50%;background:rgba(78,205,196,0.15);border:1px solid rgba(78,205,196,0.4);color:var(--brand-primary);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0',
  slotTitle: 'font-size:14px;color:var(--text-primary)',
  slotEmpty: 'font-size:13px;color:var(--text-tertiary);font-style:italic',
  bottom: 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px',
  card: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:16px',
  cardTitle: 'font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:8px',
  cardContent: 'font-size:13px;color:var(--text-secondary)',
  capture: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:12px;display:flex;gap:8px',
  captureInput: 'flex:1;padding:8px 12px;background:var(--surface-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-md);color:var(--text-primary);font-size:13px;outline:none',
  captureBtn: 'padding:8px 14px;background:var(--glass-bg-soft);border:1px solid var(--brand-primary);border-radius:var(--radius-md);color:var(--brand-primary);font-size:13px;cursor:pointer',
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
            h('div', { style: S.greetingText }, ['Good morning! ', h(Sun, { size: 24, color: '#fbbf24' })]),
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
