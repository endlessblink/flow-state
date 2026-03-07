import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);padding:24px;max-width:700px',
  section: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:16px;margin-bottom:16px',
  sectionTitle: 'font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:12px;display:flex;align-items:center;gap:8px',
  row: 'display:flex;align-items:center;justify-content:space-between;padding:8px 0',
  rowLabel: 'font-size:13px;color:var(--text-secondary)',
  providerGrid: 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px',
  providerBtn: 'padding:10px;background:var(--surface-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-md);text-align:center;cursor:pointer',
  providerBtnActive: 'padding:10px;background:rgba(78,205,196,0.08);border:2px solid var(--brand-primary);border-radius:var(--radius-md);text-align:center;cursor:pointer',
  providerIcon: 'font-size:18px;margin-bottom:4px',
  providerName: 'font-size:12px;font-weight:600;color:var(--text-primary)',
  providerDetail: 'font-size:10px;color:var(--text-tertiary)',
  select: 'width:100%;padding:8px 12px;background:var(--surface-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-md);color:var(--text-primary);font-size:13px',
  toggle: 'width:40px;height:22px;border-radius:11px;position:relative;cursor:pointer',
  toggleOn: 'background:var(--brand-primary)',
  toggleOff: 'background:var(--surface-secondary);border:1px solid var(--border-primary)',
  toggleDot: 'position:absolute;top:2px;width:18px;height:18px;border-radius:50%;background:white;transition:left 0.2s',
  usageCard: 'background:var(--surface-secondary);border-radius:var(--radius-md);padding:12px;text-align:center',
  usageValue: 'font-size:20px;font-weight:700;color:var(--brand-primary)',
  usageLabel: 'font-size:11px;color:var(--text-tertiary);margin-top:2px',
  usageGrid: 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px',
  memoryCard: 'display:flex;align-items:center;gap:12px;padding:12px;background:var(--surface-secondary);border-radius:var(--radius-md);margin-top:12px',
  memoryGrade: 'font-size:28px;font-weight:700;color:var(--brand-primary)',
  memoryInfo: 'flex:1',
  memoryLabel: 'font-size:12px;color:var(--text-secondary)',
  memoryScore: 'font-size:11px;color:var(--text-tertiary)',
  btnGhost: 'padding:6px 12px;background:none;border:1px solid var(--border-primary);border-radius:var(--radius-md);color:var(--text-secondary);font-size:12px;cursor:pointer',
  btnDanger: 'padding:6px 12px;background:none;border:1px solid var(--color-danger);border-radius:var(--radius-md);color:var(--color-danger);font-size:12px;cursor:pointer',
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
        h('div', { style: 'display:flex;gap:8px' }, [
          h('button', { style: S.btnGhost }, '🔄 Reset AI Profile'),
          h('button', { style: S.btnDanger }, '🗑️ Clear Usage Data'),
        ]),
      ]),
    ])}
  }),
}
