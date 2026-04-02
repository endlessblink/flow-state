import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);min-height:600px;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;display:flex;flex-direction:column',
  header: 'display:flex;align-items:center;justify-content:space-between;padding:var(--space-3) var(--space-4);background:var(--surface-primary);border-bottom:1px solid var(--border-primary)',
  headerLeft: 'display:flex;align-items:center;gap:var(--space-2)',
  headerTitle: 'font-size:var(--text-base);font-weight:600;color:var(--text-primary)',
  providerBadge: 'padding:var(--space-px) var(--space-2);background:var(--brand-primary-subtle);border:1px solid var(--brand-primary);border-radius:var(--radius-sm);font-size:var(--text-xs);color:var(--brand-primary)',
  headerActions: 'display:flex;gap:var(--space-2)',
  actionBtn: 'background:none;border:none;color:var(--text-tertiary);font-size:var(--text-lg);cursor:pointer',
  actionBtnActive: 'background:none;border:none;color:var(--brand-primary);font-size:var(--text-lg);cursor:pointer',
  settingsPanel: 'padding:var(--space-3) var(--space-4);background:var(--surface-secondary);border-bottom:1px solid var(--border-primary)',
  settingsLabel: 'font-size:var(--text-xs);color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:var(--space-1_5)',
  providerGrid: 'display:flex;gap:var(--space-1_5);margin-bottom:var(--space-3)',
  providerBtn: 'padding:var(--space-1_5) var(--space-3);background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-md);font-size:var(--text-xs);color:var(--text-secondary);cursor:pointer',
  providerBtnActive: 'padding:var(--space-1_5) var(--space-3);background:var(--brand-primary-subtle);border:1px solid var(--brand-primary);border-radius:var(--radius-md);font-size:var(--text-xs);color:var(--brand-primary);cursor:pointer',
  dirRow: 'display:flex;gap:var(--space-1_5)',
  messages: 'flex:1;padding:var(--space-4);overflow-y:auto',
  msgUser: 'margin-bottom:var(--space-3);display:flex;justify-content:flex-end',
  msgUserBubble: 'max-width:80%;padding:var(--space-2_5) var(--space-3_5);background:var(--state-active-bg);border:1px solid var(--brand-primary-dim);border-radius:var(--radius-lg) var(--radius-lg) var(--radius-xs) var(--radius-lg);font-size:var(--text-sm);color:var(--text-primary)',
  msgAI: 'margin-bottom:var(--space-3);display:flex;justify-content:flex-start',
  msgAIBubble: 'max-width:80%;padding:var(--space-2_5) var(--space-3_5);background:var(--surface-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-xs);font-size:var(--text-sm);color:var(--text-primary)',
  inputBar: 'padding:var(--space-3) var(--space-4);background:var(--surface-primary);border-top:1px solid var(--border-primary);display:flex;gap:var(--space-2)',
  chatInput: 'flex:1;padding:var(--space-2) var(--space-3);background:var(--surface-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);color:var(--text-primary);font-size:var(--text-sm);outline:none',
  sendBtn: 'width:36px;height:36px;border-radius:var(--radius-md);background:var(--glass-bg-soft);border:1px solid var(--brand-primary);color:var(--brand-primary);display:flex;align-items:center;justify-content:center;cursor:pointer',
}

const meta: Meta = {
  title: '📱 Mobile/MobileAIChatView',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.header }, [
        h('div', { style: S.headerLeft }, [
          h('span', null, '✨'),
          h('span', { style: S.headerTitle }, 'AI Chat'),
          h('span', { style: S.providerBadge }, 'Groq'),
        ]),
        h('div', { style: S.headerActions }, [
          h('button', { style: S.actionBtn }, '🗑️'),
          h('button', { style: S.actionBtn }, '⚙️'),
        ]),
      ]),
      h('div', { style: S.messages }, [
        h('div', { style: S.msgUser }, [h('div', { style: S.msgUserBubble }, 'What tasks should I focus on today?')]),
        h('div', { style: S.msgAI }, [h('div', { style: S.msgAIBubble }, 'Based on your task priorities, I\'d recommend focusing on:\n\n1. Design landing page (high priority, due today)\n2. Fix navigation bug (blocking other work)\n3. Review pull request (medium priority)')]),
        h('div', { style: S.msgUser }, [h('div', { style: S.msgUserBubble }, 'Start a timer for the first one')]),
      ]),
      h('div', { style: S.inputBar }, [
        h('input', { style: S.chatInput, placeholder: 'Ask anything...' }),
        h('button', { style: S.sendBtn }, '➤'),
      ]),
    ])}
  }),
}

export const WithSettings: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.header }, [
        h('div', { style: S.headerLeft }, [
          h('span', null, '✨'),
          h('span', { style: S.headerTitle }, 'AI Chat'),
          h('span', { style: S.providerBadge }, 'Auto'),
        ]),
        h('div', { style: S.headerActions }, [
          h('button', { style: S.actionBtnActive }, '⚙️'),
        ]),
      ]),
      h('div', { style: S.settingsPanel }, [
        h('div', { style: S.settingsLabel }, 'Provider'),
        h('div', { style: S.providerGrid }, [
          h('button', { style: S.providerBtnActive }, 'Auto'),
          h('button', { style: S.providerBtn }, 'Groq'),
          h('button', { style: S.providerBtn }, 'OpenRouter'),
          h('button', { style: S.providerBtn }, 'Local'),
        ]),
        h('div', { style: S.settingsLabel }, 'Text Direction'),
        h('div', { style: S.dirRow }, [
          h('button', { style: S.providerBtnActive }, 'Auto'),
          h('button', { style: S.providerBtn }, 'LTR'),
          h('button', { style: S.providerBtn }, 'RTL'),
        ]),
      ]),
      h('div', { style: S.messages + ';flex:1' }, [
        h('div', { style: 'text-align:center;color:var(--text-tertiary);padding:var(--space-8);font-size:var(--text-meta)' }, 'Start a conversation with AI'),
      ]),
      h('div', { style: S.inputBar }, [
        h('input', { style: S.chatInput, placeholder: 'Ask anything...' }),
        h('button', { style: S.sendBtn }, '➤'),
      ]),
    ])}
  }),
}
