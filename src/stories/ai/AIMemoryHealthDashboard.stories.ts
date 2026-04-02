import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'background:var(--bg-primary);min-height:600px;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;padding:var(--space-6)',
  header: 'display:flex;align-items:center;justify-content:space-between;padding:var(--space-4) var(--space-5);background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-lg);backdrop-filter:blur(8px);margin-bottom:var(--space-5)',
  headerContent: 'flex:1',
  headerTitle: 'font-size:var(--text-xl);font-weight:700;color:var(--text-primary);margin-bottom:var(--space-1)',
  headerDesc: 'font-size:var(--text-meta);color:var(--text-secondary)',
  headerActions: 'display:flex;gap:var(--space-2)',
  btnGhost: 'padding:var(--space-2) var(--space-3_5);background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-md);color:var(--text-secondary);font-size:var(--text-meta);cursor:pointer',
  btnPrimary: 'padding:var(--space-2) var(--space-3_5);background:var(--glass-bg-soft);border:1px solid var(--brand-primary);border-radius:var(--radius-md);color:var(--brand-primary);font-size:var(--text-meta);font-weight:600;cursor:pointer;backdrop-filter:blur(8px)',
  cards: 'display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-3);margin-bottom:var(--space-5)',
  card: 'background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:var(--space-4);backdrop-filter:blur(8px)',
  cardTitle: 'font-size:var(--text-xs);color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:var(--space-2)',
  cardValue: 'font-size:var(--text-4xl);font-weight:700;margin-bottom:var(--space-1)',
  cardSub: 'font-size:var(--text-xs);color:var(--text-tertiary)',
  gradeA: 'color:var(--brand-primary)',
  gradeB: 'color:var(--color-info)',
  gradeC: 'color:var(--color-warning)',
  progressBar: 'background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:var(--space-3) var(--space-4);backdrop-filter:blur(8px);margin-bottom:var(--space-5)',
  progressInfo: 'display:flex;justify-content:space-between;margin-bottom:var(--space-1_5);font-size:var(--text-xs);color:var(--text-secondary)',
  progressTrack: 'height:4px;background:var(--surface-secondary);border-radius:var(--radius-xs);overflow:hidden',
  progressFill: 'height:100%;background:var(--brand-primary);border-radius:var(--radius-xs)',
  section: 'background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-3);backdrop-filter:blur(8px)',
  sectionHeader: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-2)',
  sectionTitle: 'font-size:var(--text-sm);font-weight:600;color:var(--text-primary)',
  sectionScore: 'font-size:var(--text-meta);font-weight:600',
  sectionDesc: 'font-size:var(--text-meta);color:var(--text-secondary)',
  empty: 'background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:var(--space-8);text-align:center;backdrop-filter:blur(8px)',
  emptyText: 'font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-1)',
  emptyHint: 'font-size:var(--text-xs);color:var(--text-tertiary)',
}

const meta: Meta = {
  title: '🤖 AI/AIMemoryHealthDashboard',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const WithReport: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.header }, [
        h('div', { style: S.headerContent }, [
          h('div', { style: S.headerTitle }, 'Memory Health Assessment'),
          h('div', { style: S.headerDesc }, 'Evaluate how effectively the AI memory system captures and uses your data'),
        ]),
        h('div', { style: S.headerActions }, [
          h('button', { style: S.btnGhost }, 'Quick Check'),
          h('button', { style: S.btnPrimary }, 'Full Assessment'),
        ]),
      ]),
      h('div', { style: S.cards }, [
        h('div', { style: S.card }, [
          h('div', { style: S.cardTitle }, 'Memory Grade'),
          h('div', { style: S.cardValue + ';' + S.gradeA }, 'A'),
          h('div', { style: S.cardSub }, 'Excellent'),
        ]),
        h('div', { style: S.card }, [
          h('div', { style: S.cardTitle }, 'Overall Score'),
          h('div', { style: S.cardValue + ';' + S.gradeA }, '87'),
          h('div', { style: S.cardSub }, 'out of 100'),
        ]),
        h('div', { style: S.card }, [
          h('div', { style: S.cardTitle }, 'Sections'),
          h('div', { style: S.cardValue + ';color:var(--text-primary)' }, '6'),
          h('div', { style: S.cardSub }, 'Full assessment'),
        ]),
        h('div', { style: S.card }, [
          h('div', { style: S.cardTitle }, 'Duration'),
          h('div', { style: S.cardValue + ';color:var(--text-primary);font-size:var(--text-xl)' }, '28.4s'),
          h('div', { style: S.cardSub }, '10:30 AM'),
        ]),
      ]),
      h('div', { style: S.section }, [
        h('div', { style: S.sectionHeader }, [
          h('span', { style: S.sectionTitle }, 'Task Memory Coverage'),
          h('span', { style: S.sectionScore + ';' + S.gradeA }, '92/100'),
        ]),
        h('div', { style: S.sectionDesc }, 'Tasks are well-represented in memory with consistent metadata.'),
      ]),
      h('div', { style: S.section }, [
        h('div', { style: S.sectionHeader }, [
          h('span', { style: S.sectionTitle }, 'Context Utilization'),
          h('span', { style: S.sectionScore + ';' + S.gradeB }, '78/100'),
        ]),
        h('div', { style: S.sectionDesc }, 'AI effectively uses stored context for suggestions, with minor gaps in project-level patterns.'),
      ]),
    ])}
  }),
}

export const Empty: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.header }, [
        h('div', { style: S.headerContent }, [
          h('div', { style: S.headerTitle }, 'Memory Health Assessment'),
          h('div', { style: S.headerDesc }, 'Evaluate how effectively the AI memory system captures and uses your data'),
        ]),
        h('div', { style: S.headerActions }, [
          h('button', { style: S.btnGhost }, 'Quick Check'),
          h('button', { style: S.btnPrimary }, 'Full Assessment'),
        ]),
      ]),
      h('div', { style: S.empty }, [
        h('div', { style: S.emptyText }, 'No assessment results yet.'),
        h('div', { style: S.emptyHint }, '"Quick Check" runs heuristic tests instantly. "Full Assessment" adds LLM-as-judge context utilization tests (~30s).'),
      ]),
    ])}
  }),
}

export const Running: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.header }, [
        h('div', { style: S.headerContent }, [
          h('div', { style: S.headerTitle }, 'Memory Health Assessment'),
          h('div', { style: S.headerDesc }, 'Evaluate how effectively the AI memory system captures and uses your data'),
        ]),
        h('div', { style: S.headerActions }, [
          h('button', { style: S.btnGhost + ';opacity:0.5;pointer-events:none' }, 'Quick Check'),
          h('button', { style: S.btnPrimary + ';opacity:0.5;pointer-events:none' }, 'Running...'),
        ]),
      ]),
      h('div', { style: S.progressBar }, [
        h('div', { style: S.progressInfo }, [
          h('span', null, 'Checking task memory coverage...'),
          h('span', null, '45%'),
        ]),
        h('div', { style: S.progressTrack }, [
          h('div', { style: S.progressFill + ';width:45%' }),
        ]),
      ]),
    ])}
  }),
}
