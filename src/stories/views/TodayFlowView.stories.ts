import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'background:var(--bg-primary);min-height:600px;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;display:flex;flex-direction:column;align-items:center;padding:32px 24px',
  ribbon: 'width:100%;max-width:600px;display:flex;gap:4px;margin-bottom:32px',
  ribbonSeg: 'flex:1;height:4px;border-radius:2px',
  activeCard: 'width:100%;max-width:500px;background:var(--surface-primary);border:2px solid var(--brand-primary);border-radius:var(--radius-xl);padding:24px;margin-bottom:16px;box-shadow:0 0 20px rgba(78,205,196,0.15)',
  activeLabel: 'font-size:11px;color:var(--brand-primary);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px',
  activeTitle: 'font-size:22px;font-weight:700;color:var(--text-primary);margin-bottom:16px',
  activeActions: 'display:flex;gap:12px',
  btn: 'padding:8px 20px;background:var(--glass-bg-soft);border:1px solid var(--brand-primary);border-radius:var(--radius-lg);color:var(--brand-primary);font-size:13px;cursor:pointer;backdrop-filter:blur(8px)',
  btnDone: 'padding:8px 20px;background:var(--glass-bg-soft);border:1px solid var(--color-success);border-radius:var(--radius-lg);color:var(--color-success);font-size:13px;cursor:pointer',
  queueCard: 'width:100%;max-width:500px;background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:14px 18px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;opacity:0.7',
  queueTitle: 'font-size:15px;color:var(--text-secondary)',
  queueBadge: 'font-size:11px;padding:2px 8px;border-radius:var(--radius-full);background:var(--surface-secondary);color:var(--text-tertiary)',
  doneCard: 'width:100%;max-width:500px;background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:14px 18px;margin-bottom:8px;display:flex;align-items:center;gap:8px;opacity:0.5',
  doneCheck: 'color:var(--brand-primary);font-size:16px',
  doneTitle: 'font-size:15px;color:var(--text-tertiary);text-decoration:line-through',
  link: 'margin-top:16px;font-size:13px;color:var(--brand-primary);text-decoration:none',
  celebrationWrapper: 'text-align:center;padding:48px',
  celebrationIcon: 'font-size:64px;margin-bottom:16px',
  celebrationTitle: 'font-size:28px;font-weight:700;color:var(--text-primary);margin-bottom:8px',
  celebrationSub: 'font-size:14px;color:var(--text-secondary)',
}

const meta: Meta = {
  title: '🖥️ Views/TodayFlowView',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const InProgress: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.ribbon }, [
        h('div', { style: S.ribbonSeg + ';background:var(--brand-primary)' }),
        h('div', { style: S.ribbonSeg + ';background:var(--brand-primary);opacity:0.4' }),
        h('div', { style: S.ribbonSeg + ';background:var(--surface-secondary)' }),
      ]),
      h('div', { style: S.activeCard }, [
        h('div', { style: S.activeLabel }, 'Now Focused'),
        h('div', { style: S.activeTitle }, 'Design landing page mockups'),
        h('div', { style: S.activeActions }, [
          h('button', { style: S.btn }, '▶ Start'),
          h('button', { style: S.btnDone }, '✓ Complete'),
        ]),
      ]),
      h('div', { style: S.doneCard }, [
        h('span', { style: S.doneCheck }, '✓'),
        h('span', { style: S.doneTitle }, 'Review pull request'),
      ]),
      h('div', { style: S.queueCard }, [
        h('span', { style: S.queueTitle }, 'Write unit tests'),
        h('span', { style: S.queueBadge }, 'Queued'),
      ]),
      h('a', { style: S.link }, 'View full board →'),
    ])}
  }),
}

export const AllComplete: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.ribbon }, [
        h('div', { style: S.ribbonSeg + ';background:var(--brand-primary)' }),
        h('div', { style: S.ribbonSeg + ';background:var(--brand-primary)' }),
        h('div', { style: S.ribbonSeg + ';background:var(--brand-primary)' }),
      ]),
      h('div', { style: S.celebrationWrapper }, [
        h('div', { style: S.celebrationIcon }, '🎉'),
        h('div', { style: S.celebrationTitle }, 'All tasks complete!'),
        h('div', { style: S.celebrationSub }, 'Great day! You crushed your Big 3.'),
        h('a', { style: S.link }, 'View full board →'),
      ]),
    ])}
  }),
}
