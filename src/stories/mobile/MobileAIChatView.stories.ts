import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);min-height:600px;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;display:flex;flex-direction:column',
  header: 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--surface-primary);border-bottom:1px solid var(--border-primary)',
  headerLeft: 'display:flex;align-items:center;gap:8px',
  headerTitle: 'font-size:16px;font-weight:600;color:var(--text-primary)',
  providerBadge: 'padding:2px 8px;background:rgba(78,205,196,0.1);border:1px solid var(--brand-primary);border-radius:var(--radius-sm);font-size:11px;color:var(--brand-primary)',
  headerActions: 'display:flex;gap:8px',
  actionBtn: 'background:none;border:none;color:var(--text-tertiary);font-size:18px;cursor:pointer',
  actionBtnActive: 'background:none;border:none;color:var(--brand-primary);font-size:18px;cursor:pointer',
  settingsPanel: 'padding:12px 16px;background:var(--surface-secondary);border-bottom:1px solid var(--border-primary)',
  settingsLabel: 'font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px',
  providerGrid: 'display:flex;gap:6px;margin-bottom:12px',
  providerBtn: 'padding:6px 12px;background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-md);font-size:12px;color:var(--text-secondary);cursor:pointer',
  providerBtnActive: 'padding:6px 12px;background:rgba(78,205,196,0.1);border:1px solid var(--brand-primary);border-radius:var(--radius-md);font-size:12px;color:var(--brand-primary);cursor:pointer',
  dirRow: 'display:flex;gap:6px',
  messages: 'flex:1;padding:16px;overflow-y:auto',
  msgUser: 'margin-bottom:12px;display:flex;justify-content:flex-end',
  msgUserBubble: 'max-width:80%;padding:10px 14px;background:rgba(78,205,196,0.15);border:1px solid rgba(78,205,196,0.3);border-radius:var(--radius-lg) var(--radius-lg) 4px var(--radius-lg);font-size:14px;color:var(--text-primary)',
  msgAI: 'margin-bottom:12px;display:flex;justify-content:flex-start',
  msgAIBubble: 'max-width:80%;padding:10px 14px;background:var(--surface-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-lg) var(--radius-lg) var(--radius-lg) 4px;font-size:14px;color:var(--text-primary)',
  inputBar: 'padding:12px 16px;background:var(--surface-primary);border-top:1px solid var(--border-primary);display:flex;gap:8px',
  chatInput: 'flex:1;padding:8px 12px;background:var(--surface-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);color:var(--text-primary);font-size:14px;outline:none',
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
        h('div', { style: 'text-align:center;color:var(--text-tertiary);padding:32px;font-size:13px' }, 'Start a conversation with AI'),
      ]),
      h('div', { style: S.inputBar }, [
        h('input', { style: S.chatInput, placeholder: 'Ask anything...' }),
        h('button', { style: S.sendBtn }, '➤'),
      ]),
    ])}
  }),
}
