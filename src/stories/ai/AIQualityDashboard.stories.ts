import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'background:var(--bg-primary);min-height:600px;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;padding:24px',
  header: 'display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-lg);backdrop-filter:blur(8px);margin-bottom:20px',
  headerContent: 'flex:1',
  headerTitle: 'font-size:20px;font-weight:700;color:var(--text-primary);margin-bottom:4px',
  headerDesc: 'font-size:13px;color:var(--text-secondary)',
  headerActions: 'display:flex;gap:8px',
  btnGhost: 'padding:8px 14px;background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-md);color:var(--text-secondary);font-size:13px;cursor:pointer',
  btnPrimary: 'padding:8px 14px;background:var(--glass-bg-soft);border:1px solid var(--brand-primary);border-radius:var(--radius-md);color:var(--brand-primary);font-size:13px;font-weight:600;cursor:pointer;backdrop-filter:blur(8px)',
  cards: 'display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px',
  card: 'background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:16px;backdrop-filter:blur(8px)',
  cardTitle: 'font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px',
  cardValue: 'font-size:28px;font-weight:700;margin-bottom:4px',
  cardSub: 'font-size:12px;color:var(--text-tertiary)',
  resultItem: 'background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:14px 16px;margin-bottom:8px;backdrop-filter:blur(8px)',
  resultHeader: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:6px',
  resultTitle: 'font-size:14px;font-weight:600;color:var(--text-primary)',
  resultScore: 'font-size:13px;font-weight:600',
  resultCategory: 'font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px',
  resultMeta: 'display:flex;gap:12px;margin-top:6px',
  resultMetaItem: 'font-size:11px;color:var(--text-tertiary)',
  empty: 'background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:32px;text-align:center;backdrop-filter:blur(8px)',
  emptyTitle: 'font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:8px',
  emptyDesc: 'font-size:13px;color:var(--text-secondary);line-height:1.5',
}

const scoreColor = (score: number) => score >= 4 ? 'color:var(--brand-primary)' : score >= 3 ? 'color:var(--color-warning)' : 'color:var(--color-danger)'

const meta: Meta = {
  title: '🤖 AI/AIQualityDashboard',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const WithResults: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.header }, [
        h('div', { style: S.headerContent }, [
          h('div', { style: S.headerTitle }, 'AI Quality Assessment'),
          h('div', { style: S.headerDesc }, 'LLM-as-judge scoring with rule-based pre-checks (1-5 scale)'),
        ]),
        h('div', { style: S.headerActions }, [
          h('button', { style: S.btnGhost }, 'Quick (1x)'),
          h('button', { style: S.btnPrimary }, 'Run All Tests (3x)'),
        ]),
      ]),
      h('div', { style: S.cards }, [
        h('div', { style: S.card }, [
          h('div', { style: S.cardTitle }, 'Overall Grade'),
          h('div', { style: S.cardValue + ';color:var(--brand-primary)' }, 'A'),
          h('div', { style: S.cardSub }, 'Excellent'),
        ]),
        h('div', { style: S.card }, [
          h('div', { style: S.cardTitle }, 'Tests Passed'),
          h('div', { style: S.cardValue + ';color:var(--brand-primary)' }, '8 of 9'),
          h('div', { style: S.cardSub }, '89% pass rate'),
        ]),
        h('div', { style: S.card }, [
          h('div', { style: S.cardTitle }, 'Rule Checks'),
          h('div', { style: S.cardValue + ';color:var(--brand-primary)' }, '95%'),
          h('div', { style: S.cardSub }, 'pass rate'),
        ]),
        h('div', { style: S.card }, [
          h('div', { style: S.cardTitle }, 'Provider'),
          h('div', { style: S.cardValue + ';color:var(--text-primary);font-size:16px' }, 'Groq'),
          h('div', { style: S.cardSub }, '10:30 AM'),
        ]),
      ]),
      ...[
        { title: 'Task Suggestion Quality', score: 4.7, cat: 'SUGGESTIONS', rulePass: '3/3' },
        { title: 'Context Awareness', score: 4.2, cat: 'CONTEXT', rulePass: '2/2' },
        { title: 'Response Relevance', score: 3.8, cat: 'CHAT', rulePass: '2/3' },
        { title: 'Priority Inference', score: 4.5, cat: 'ANALYSIS', rulePass: '1/1' },
      ].map(r =>
        h('div', { style: S.resultItem }, [
          h('div', { style: S.resultHeader }, [
            h('span', { style: S.resultTitle }, r.title),
            h('span', { style: S.resultScore + ';' + scoreColor(r.score) }, `${r.score}/5.0`),
          ]),
          h('div', { style: S.resultCategory }, r.cat),
          h('div', { style: S.resultMeta }, [
            h('span', { style: S.resultMetaItem }, `Rule checks: ${r.rulePass}`),
            h('span', { style: S.resultMetaItem }, '3 runs averaged'),
          ]),
        ])
      ),
    ])}
  }),
}

export const Empty: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.header }, [
        h('div', { style: S.headerContent }, [
          h('div', { style: S.headerTitle }, 'AI Quality Assessment'),
          h('div', { style: S.headerDesc }, 'LLM-as-judge scoring with rule-based pre-checks (1-5 scale)'),
        ]),
        h('div', { style: S.headerActions }, [
          h('button', { style: S.btnGhost }, 'Quick (1x)'),
          h('button', { style: S.btnPrimary }, 'Run All Tests (3x)'),
        ]),
      ]),
      h('div', { style: S.empty }, [
        h('div', { style: S.emptyTitle }, 'AI Quality Assessment'),
        h('div', { style: S.emptyDesc }, 'Tests your AI assistant by sending prompts across multiple categories, then judges each response against quality rubrics using a second LLM call.'),
      ]),
    ])}
  }),
}
