import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);min-height:600px;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;display:flex;flex-direction:column;position:relative',
  grain: 'position:absolute;inset:0;opacity:0.03;pointer-events:none;background-image:url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
  header: 'display:flex;align-items:center;gap:var(--space-2);padding:var(--space-3) var(--space-4);z-index:1',
  headerIcon: 'color:var(--brand-primary);font-size:var(--text-lg)',
  headerTitle: 'font-size:var(--text-base);font-weight:600;color:var(--text-primary)',
  progressBadge: 'padding:var(--space-px) var(--space-2);background:var(--surface-secondary);border-radius:var(--radius-full);font-size:var(--text-xs);color:var(--text-tertiary);margin-left:auto',
  progressBar: 'height:3px;background:var(--surface-secondary);margin:0 var(--space-4) var(--space-2);border-radius:var(--radius-xs);overflow:hidden;z-index:1',
  progressFill: 'height:100%;background:var(--brand-primary);border-radius:var(--radius-xs);width:40%;box-shadow:0 0 8px var(--glass-glow)',
  phaseToggle: 'display:flex;gap:var(--space-2);padding:0 var(--space-4) var(--space-2);z-index:1',
  phaseBtn: 'display:flex;align-items:center;gap:var(--space-1);padding:var(--space-1_5) var(--space-3_5);background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-full);font-size:var(--text-xs);color:var(--text-secondary);cursor:pointer',
  phaseBtnActive: 'display:flex;align-items:center;gap:var(--space-1);padding:var(--space-1_5) var(--space-3_5);background:var(--brand-primary-subtle);border:1px solid var(--brand-primary);border-radius:var(--radius-full);font-size:var(--text-xs);color:var(--brand-primary);cursor:pointer',
  phaseBadge: 'padding:var(--space-px) var(--space-1);background:var(--state-active-bg);color:var(--brand-primary);border:1px solid var(--brand-primary-dim);border-radius:var(--radius-full);font-size:var(--text-xs);font-weight:600',
  contextBar: 'display:flex;gap:var(--space-3);padding:var(--space-1) var(--space-4) var(--space-2);font-size:var(--text-xs);color:var(--text-tertiary);z-index:1',
  cardArea: 'flex:1;display:flex;align-items:center;justify-content:center;padding:var(--space-4);z-index:1',
  card: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);width:100%;min-height:240px;position:relative;overflow:hidden;box-shadow:0 8px 32px var(--overlay-bg)',
  cardStrip: 'position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--color-danger)',
  cardContent: 'padding:var(--space-6) var(--space-6) var(--space-6) var(--space-5)',
  cardTitle: 'font-size:var(--text-lg);font-weight:600;color:var(--text-primary);margin-bottom:var(--space-2)',
  cardDesc: 'font-size:var(--text-meta);color:var(--text-secondary);line-height:1.5',
  filtersRow: 'padding:var(--space-2) var(--space-3);z-index:1',
  filterRow: 'display:flex;align-items:center;gap:var(--space-1_5);margin-bottom:var(--space-1_5)',
  filterLabel: 'font-size:var(--text-xs);color:var(--text-tertiary);width:52px;flex-shrink:0',
  filterPills: 'display:flex;gap:var(--space-1_5);overflow-x:auto',
  pill: 'padding:var(--space-1) var(--space-3);background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-full);font-size:var(--text-xs);color:var(--text-secondary);white-space:nowrap;flex-shrink:0',
}

const meta: Meta = {
  title: '📱 Mobile/MobileQuickSortView',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const SortPhase: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.grain }),
      h('div', { style: S.header }, [
        h('span', { style: S.headerIcon }, '⚡'),
        h('span', { style: S.headerTitle }, 'Quick Sort'),
        h('span', { style: S.progressBadge }, '4/10'),
      ]),
      h('div', { style: S.progressBar }, [h('div', { style: S.progressFill })]),
      h('div', { style: S.phaseToggle }, [
        h('button', { style: S.phaseBtnActive }, ['⚡ Sort ', h('span', { style: S.phaseBadge }, '6')]),
        h('button', { style: S.phaseBtn }, '+ Capture'),
      ]),
      h('div', { style: S.contextBar }, [
        h('span', null, '📅 Due: Today'),
        h('span', null, ['🔴 ', 'High']),
        h('span', null, '📁 🎨 Design'),
      ]),
      h('div', { style: S.cardArea }, [
        h('div', { style: S.card }, [
          h('div', { style: S.cardStrip }),
          h('div', { style: S.cardContent }, [
            h('div', { style: S.cardTitle }, 'Design mobile onboarding'),
            h('div', { style: S.cardDesc }, 'Create wireframes and mockups for the new user onboarding experience.'),
          ]),
        ]),
      ]),
      h('div', { style: S.filtersRow }, [
        h('div', { style: S.filterRow }, [
          h('span', { style: S.filterLabel }, 'Priority'),
          h('div', { style: S.filterPills }, [
            h('span', { style: S.pill }, 'Low'),
            h('span', { style: S.pill }, 'Med'),
            h('span', { style: S.pill }, 'High'),
          ]),
        ]),
        h('div', { style: S.filterRow }, [
          h('span', { style: S.filterLabel }, 'Due'),
          h('div', { style: S.filterPills }, [
            h('span', { style: S.pill }, '☀️ Today'),
            h('span', { style: S.pill }, '🌅 Tmrw'),
            h('span', { style: S.pill }, '📅 +3d'),
            h('span', { style: S.pill }, '🏖️ Wknd'),
          ]),
        ]),
      ]),
    ])}
  }),
}

export const CapturePhase: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.grain }),
      h('div', { style: S.header }, [
        h('span', { style: S.headerIcon }, '⚡'),
        h('span', { style: S.headerTitle }, 'Quick Sort'),
        h('span', { style: S.progressBadge }, '10/10'),
      ]),
      h('div', { style: S.phaseToggle }, [
        h('button', { style: S.phaseBtn }, '⚡ Sort'),
        h('button', { style: S.phaseBtnActive }, '+ Capture'),
      ]),
      h('div', { style: S.cardArea }, [
        h('div', { style: 'width:100%;padding:var(--space-3);background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg)' }, [
          h('input', { style: 'width:100%;border:none;background:transparent;color:var(--text-primary);font-size:var(--text-base);outline:none', placeholder: 'What needs to be done?' }),
          h('div', { style: 'display:flex;gap:var(--space-2);margin-top:var(--space-2_5)' }, [
            h('span', { style: S.pill }, '🚩 High'),
            h('span', { style: S.pill }, '📅 Today'),
          ]),
        ]),
      ]),
    ])}
  }),
}
