import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);padding:var(--space-6);max-width:700px',
  section: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4)',
  sectionTitle: 'font-size:var(--text-sm);font-weight:600;color:var(--text-primary);margin-bottom:var(--space-3);display:flex;align-items:center;gap:var(--space-2)',
  row: 'display:flex;align-items:center;justify-content:space-between;padding:var(--space-2) 0',
  rowLabel: 'font-size:var(--text-meta);color:var(--text-secondary)',
  providerGrid: 'display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-2);margin-bottom:var(--space-3)',
  providerBtn: 'padding:var(--space-2_5);background:var(--surface-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-md);text-align:center;cursor:pointer',
  providerBtnActive: 'padding:var(--space-2_5);background:var(--glass-glow);border:2px solid var(--brand-primary);border-radius:var(--radius-md);text-align:center;cursor:pointer',
  providerIcon: 'font-size:var(--text-lg);margin-bottom:var(--space-1)',
  providerName: 'font-size:var(--text-xs);font-weight:600;color:var(--text-primary)',
  providerDetail: 'font-size:var(--text-xs);color:var(--text-tertiary)',
  select: 'width:100%;padding:var(--space-2) var(--space-3);background:var(--surface-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-md);color:var(--text-primary);font-size:var(--text-meta)',
  toggle: 'width:40px;height:22px;border-radius:11px;position:relative;cursor:pointer',
  toggleOn: 'background:var(--brand-primary)',
  toggleOff: 'background:var(--surface-secondary);border:1px solid var(--border-primary)',
  toggleDot: 'position:absolute;top:var(--space-0_5);width:18px;height:18px;border-radius:var(--radius-full);background:white;transition:left 0.2s',
  usageCard: 'background:var(--surface-secondary);border-radius:var(--radius-md);padding:var(--space-3);text-align:center',
  usageValue: 'font-size:var(--text-xl);font-weight:700;color:var(--brand-primary)',
  usageLabel: 'font-size:var(--text-xs);color:var(--text-tertiary);margin-top:var(--space-0_5)',
  usageGrid: 'display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-2);margin-top:var(--space-3)',
  memoryCard: 'display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3);background:var(--surface-secondary);border-radius:var(--radius-md);margin-top:var(--space-3)',
  memoryGrade: 'font-size:var(--text-3xl);font-weight:700;color:var(--brand-primary)',
  memoryInfo: 'flex:1',
  memoryLabel: 'font-size:var(--text-xs);color:var(--text-secondary)',
  memoryScore: 'font-size:var(--text-xs);color:var(--text-tertiary)',
  btnGhost: 'padding:var(--space-1_5) var(--space-3);background:none;border:1px solid var(--border-primary);border-radius:var(--radius-md);color:var(--text-secondary);font-size:var(--text-xs);cursor:pointer',
  btnDanger: 'padding:var(--space-1_5) var(--space-3);background:none;border:1px solid var(--color-danger);border-radius:var(--radius-md);color:var(--color-danger);font-size:var(--text-xs);cursor:pointer',
}

const meta: Meta = {
  title: '⚙️ Settings/AISettingsTab',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.section }, [
        h('div', { style: S.sectionTitle }, ['🤖 AI Provider']),
        h('div', { style: S.providerGrid }, [
          h('div', { style: S.providerBtnActive }, [
            h('div', { style: S.providerIcon }, '⚡'),
            h('div', { style: S.providerName }, 'Groq'),
            h('div', { style: S.providerDetail }, 'Cloud API'),
          ]),
          h('div', { style: S.providerBtn }, [
            h('div', { style: S.providerIcon }, '🌐'),
            h('div', { style: S.providerName }, 'OpenRouter'),
            h('div', { style: S.providerDetail }, 'Multi-model'),
          ]),
          h('div', { style: S.providerBtn }, [
            h('div', { style: S.providerIcon }, '🖥️'),
            h('div', { style: S.providerName }, 'Ollama'),
            h('div', { style: S.providerDetail }, 'Local'),
          ]),
        ]),
        h('div', { style: S.row }, [
          h('span', { style: S.rowLabel }, 'Model'),
          h('select', { style: S.select + ';max-width:240px' }, [
            h('option', null, 'llama-3.3-70b-versatile'),
          ]),
        ]),
      ]),
      h('div', { style: S.section }, [
        h('div', { style: S.sectionTitle }, ['💰 Usage Tracking']),
        h('div', { style: S.usageGrid }, [
          h('div', { style: S.usageCard }, [
            h('div', { style: S.usageValue }, '142'),
            h('div', { style: S.usageLabel }, 'This Week'),
          ]),
          h('div', { style: S.usageCard }, [
            h('div', { style: S.usageValue }, '523'),
            h('div', { style: S.usageLabel }, 'This Month'),
          ]),
          h('div', { style: S.usageCard }, [
            h('div', { style: S.usageValue }, '$0.00'),
            h('div', { style: S.usageLabel }, 'Est. Cost'),
          ]),
        ]),
      ]),
      h('div', { style: S.section }, [
        h('div', { style: S.sectionTitle }, ['🧠 Memory Health']),
        h('div', { style: S.memoryCard }, [
          h('span', { style: S.memoryGrade }, 'A'),
          h('div', { style: S.memoryInfo }, [
            h('div', { style: S.memoryLabel }, 'Last assessment: 87/100'),
            h('div', { style: S.memoryScore }, 'Quick check · 2 hours ago'),
          ]),
          h('button', { style: S.btnGhost }, 'Run Check'),
        ]),
      ]),
      h('div', { style: S.section }, [
        h('div', { style: S.sectionTitle }, ['🔧 Data Management']),
        h('div', { style: 'display:flex;gap:var(--space-2)' }, [
          h('button', { style: S.btnGhost }, '🔄 Reset AI Profile'),
          h('button', { style: S.btnDanger }, '🗑️ Clear Usage Data'),
        ]),
      ]),
    ])}
  }),
}
