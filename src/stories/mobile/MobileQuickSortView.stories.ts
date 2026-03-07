import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);min-height:600px;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;display:flex;flex-direction:column;position:relative',
  grain: 'position:absolute;inset:0;opacity:0.03;pointer-events:none;background-image:url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
  header: 'display:flex;align-items:center;gap:8px;padding:12px 16px;z-index:1',
  headerIcon: 'color:var(--brand-primary);font-size:18px',
  headerTitle: 'font-size:16px;font-weight:600;color:var(--text-primary)',
  progressBadge: 'padding:2px 8px;background:var(--surface-secondary);border-radius:var(--radius-full);font-size:11px;color:var(--text-tertiary);margin-left:auto',
  progressBar: 'height:3px;background:var(--surface-secondary);margin:0 16px 8px;border-radius:2px;overflow:hidden;z-index:1',
  progressFill: 'height:100%;background:var(--brand-primary);border-radius:2px;width:40%;box-shadow:0 0 8px rgba(78,205,196,0.5)',
  phaseToggle: 'display:flex;gap:8px;padding:0 16px 8px;z-index:1',
  phaseBtn: 'display:flex;align-items:center;gap:4px;padding:6px 14px;background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-full);font-size:12px;color:var(--text-secondary);cursor:pointer',
  phaseBtnActive: 'display:flex;align-items:center;gap:4px;padding:6px 14px;background:rgba(78,205,196,0.1);border:1px solid var(--brand-primary);border-radius:var(--radius-full);font-size:12px;color:var(--brand-primary);cursor:pointer',
  phaseBadge: 'padding:1px 5px;background:rgba(78,205,196,0.15);color:var(--brand-primary);border:1px solid rgba(78,205,196,0.3);border-radius:var(--radius-full);font-size:10px;font-weight:600',
  contextBar: 'display:flex;gap:12px;padding:4px 16px 8px;font-size:11px;color:var(--text-tertiary);z-index:1',
  cardArea: 'flex:1;display:flex;align-items:center;justify-content:center;padding:16px;z-index:1',
  card: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);width:100%;min-height:240px;position:relative;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.3)',
  cardStrip: 'position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--color-danger)',
  cardContent: 'padding:24px 24px 24px 20px',
  cardTitle: 'font-size:18px;font-weight:600;color:var(--text-primary);margin-bottom:8px',
  cardDesc: 'font-size:13px;color:var(--text-secondary);line-height:1.5',
  filtersRow: 'padding:8px 12px;z-index:1',
  filterRow: 'display:flex;align-items:center;gap:6px;margin-bottom:6px',
  filterLabel: 'font-size:12px;color:var(--text-tertiary);width:52px;flex-shrink:0',
  filterPills: 'display:flex;gap:6px;overflow-x:auto',
  pill: 'padding:5px 12px;background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-full);font-size:12px;color:var(--text-secondary);white-space:nowrap;flex-shrink:0',
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
        h('div', { style: 'width:100%;padding:12px;background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg)' }, [
          h('input', { style: 'width:100%;border:none;background:transparent;color:var(--text-primary);font-size:15px;outline:none', placeholder: 'What needs to be done?' }),
          h('div', { style: 'display:flex;gap:8px;margin-top:10px' }, [
            h('span', { style: S.pill }, '🚩 High'),
            h('span', { style: S.pill }, '📅 Today'),
          ]),
        ]),
      ]),
    ])}
  }),
}
