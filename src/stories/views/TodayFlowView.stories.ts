import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'background:var(--bg-primary);min-height:600px;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;display:flex;flex-direction:column;align-items:center;padding:var(--space-8) var(--space-6)',
  ribbon: 'width:100%;max-width:600px;display:flex;gap:var(--space-1);margin-bottom:var(--space-8)',
  ribbonSeg: 'flex:1;height:4px;border-radius:var(--radius-xs)',
  activeCard: 'width:100%;max-width:500px;background:var(--surface-primary);border:2px solid var(--brand-primary);border-radius:var(--radius-xl);padding:var(--space-6);margin-bottom:var(--space-4);box-shadow:var(--glass-glow)',
  activeLabel: 'font-size:var(--text-xs);color:var(--brand-primary);text-transform:uppercase;letter-spacing:1px;margin-bottom:var(--space-2)',
  activeTitle: 'font-size:var(--text-xl);font-weight:700;color:var(--text-primary);margin-bottom:var(--space-4)',
  activeActions: 'display:flex;gap:var(--space-3)',
  btn: 'padding:var(--space-2) var(--space-5);background:var(--glass-bg-soft);border:1px solid var(--brand-primary);border-radius:var(--radius-lg);color:var(--brand-primary);font-size:var(--text-meta);cursor:pointer;backdrop-filter:blur(8px)',
  btnDone: 'padding:var(--space-2) var(--space-5);background:var(--glass-bg-soft);border:1px solid var(--color-success);border-radius:var(--radius-lg);color:var(--color-success);font-size:var(--text-meta);cursor:pointer',
  queueCard: 'width:100%;max-width:500px;background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:var(--space-3_5) var(--space-4_5);margin-bottom:var(--space-2);display:flex;align-items:center;justify-content:space-between;opacity:0.7',
  queueTitle: 'font-size:var(--text-base);color:var(--text-secondary)',
  queueBadge: 'font-size:var(--text-xs);padding:var(--space-0_5) var(--space-2);border-radius:var(--radius-full);background:var(--surface-secondary);color:var(--text-tertiary)',
  doneCard: 'width:100%;max-width:500px;background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:var(--space-3_5) var(--space-4_5);margin-bottom:var(--space-2);display:flex;align-items:center;gap:var(--space-2);opacity:0.5',
  doneCheck: 'color:var(--brand-primary);font-size:var(--text-base)',
  doneTitle: 'font-size:var(--text-base);color:var(--text-tertiary);text-decoration:line-through',
  link: 'margin-top:var(--space-4);font-size:var(--text-meta);color:var(--brand-primary);text-decoration:none',
  celebrationWrapper: 'text-align:center;padding:var(--space-12)',
  celebrationIcon: 'font-size:64px;margin-bottom:var(--space-4)',
  celebrationTitle: 'font-size:var(--text-3xl);font-weight:700;color:var(--text-primary);margin-bottom:var(--space-2)',
  celebrationSub: 'font-size:var(--text-sm);color:var(--text-secondary)',
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
