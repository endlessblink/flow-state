import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'
import { X, Zap, Monitor, ExternalLink, CheckCircle } from 'lucide-vue-next'

const S = {
  overlay: 'background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:24px;min-height:600px;border-radius:var(--radius-xl)',
  modal: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);padding:32px;max-width:480px;width:100%;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.5)',
  closeBtn: 'position:absolute;top:12px;right:12px;background:none;border:none;color:var(--text-tertiary);cursor:pointer;display:flex;align-items:center',
  dots: 'display:flex;justify-content:center;gap:6px;margin-bottom:24px',
  dot: 'width:8px;height:8px;border-radius:50%;background:var(--border-secondary)',
  dotActive: 'width:8px;height:8px;border-radius:50%;background:var(--brand-primary)',
  dotDone: 'width:8px;height:8px;border-radius:50%;background:var(--brand-primary);opacity:0.4',
  title: 'font-size:22px;font-weight:700;color:var(--text-primary);text-align:center;margin-bottom:8px',
  desc: 'font-size:14px;color:var(--text-secondary);text-align:center;margin-bottom:24px;line-height:1.5',
  providers: 'display:flex;flex-direction:column;gap:10px;margin-bottom:24px',
  providerCard: 'padding:14px 16px;background:var(--surface-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);cursor:pointer;display:flex;flex-direction:column;gap:4px;position:relative',
  providerSelected: 'padding:14px 16px;background:rgba(78,205,196,0.08);border:2px solid var(--brand-primary);border-radius:var(--radius-lg);cursor:pointer;display:flex;flex-direction:column;gap:4px;position:relative',
  badge: 'position:absolute;top:8px;right:8px;padding:2px 8px;background:rgba(78,205,196,0.15);border:1px solid rgba(78,205,196,0.4);color:var(--brand-primary);border-radius:var(--radius-sm);font-size:10px;font-weight:600',
  providerIcon: 'font-size:18px;margin-bottom:2px',
  providerName: 'font-size:14px;font-weight:600;color:var(--text-primary)',
  providerDetail: 'font-size:12px;color:var(--text-tertiary)',
  actions: 'display:flex;flex-direction:column;gap:8px;align-items:center',
  btnPrimary: 'width:100%;padding:10px;background:var(--glass-bg-soft);border:1px solid var(--brand-primary);border-radius:var(--radius-lg);color:var(--brand-primary);font-size:14px;font-weight:600;cursor:pointer;backdrop-filter:blur(8px)',
  btnGhost: 'background:none;border:none;color:var(--text-tertiary);font-size:13px;cursor:pointer',
  inputField: 'margin-bottom:16px',
  inputLabel: 'font-size:12px;color:var(--text-tertiary);margin-bottom:4px;display:block',
  input: 'width:100%;padding:10px 12px;background:var(--surface-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-md);color:var(--text-primary);font-size:14px;outline:none;font-family:monospace',
  link: 'color:var(--brand-primary);font-size:13px;text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-bottom:12px',
}

const meta: Meta = {
  title: '🤖 AI/AISetupWizard',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const Step1Provider: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.overlay }, [
      h('div', { style: S.modal }, [
        h('button', { style: S.closeBtn }, [h(X, { size: 16 })]),
        h('div', { style: S.dots }, [
          h('span', { style: S.dotActive }),
          h('span', { style: S.dot }),
          h('span', { style: S.dot }),
        ]),
        h('h2', { style: S.title }, 'Set up AI'),
        h('p', { style: S.desc }, 'FlowState uses AI for smart suggestions, task analysis, and chat. Choose how you\'d like to power it.'),
        h('div', { style: S.providers }, [
          h('div', { style: S.providerSelected }, [
            h('span', { style: S.badge }, 'Recommended'),
            h(Zap, { size: 18, color: '#4ECDC4' }),
            h('span', { style: S.providerName }, 'Groq Cloud'),
            h('span', { style: S.providerDetail }, 'Free API key, fast, high quality (Llama 3.3 70B)'),
          ]),
          h('div', { style: S.providerCard }, [
            h(Monitor, { size: 18, style: 'color:var(--text-secondary)' }),
            h('span', { style: S.providerName }, 'Ollama (Local)'),
            h('span', { style: S.providerDetail }, 'Runs on your machine, fully private, no API key needed'),
          ]),
        ]),
        h('div', { style: S.actions }, [
          h('button', { style: S.btnPrimary }, 'Continue'),
          h('button', { style: S.btnGhost }, 'Skip for now'),
        ]),
      ]),
    ])}
  }),
}

export const Step2GroqSetup: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.overlay }, [
      h('div', { style: S.modal }, [
        h('button', { style: S.closeBtn }, [h(X, { size: 16 })]),
        h('div', { style: S.dots }, [
          h('span', { style: S.dotDone }),
          h('span', { style: S.dotActive }),
          h('span', { style: S.dot }),
        ]),
        h('h2', { style: S.title }, 'Connect Groq'),
        h('p', { style: S.desc }, 'Groq offers free AI API access with generous daily limits. Create a free account and paste your API key below.'),
        h('a', { style: S.link }, [h(ExternalLink, { size: 14 }), ' Get your free Groq API key →']),
        h('div', { style: S.inputField }, [
          h('label', { style: S.inputLabel }, 'API Key'),
          h('input', { style: S.input, placeholder: 'gsk_xxxxxxxxxxxx...' }),
        ]),
        h('div', { style: S.actions }, [
          h('button', { style: S.btnPrimary }, 'Test Connection'),
          h('button', { style: S.btnGhost }, '← Back'),
        ]),
      ]),
    ])}
  }),
}

export const Step3Complete: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.overlay }, [
      h('div', { style: S.modal }, [
        h('div', { style: S.dots }, [
          h('span', { style: S.dotDone }),
          h('span', { style: S.dotDone }),
          h('span', { style: S.dotActive }),
        ]),
        h('div', { style: 'text-align:center;padding:16px 0' }, [
          h('div', { style: 'margin-bottom:16px;display:flex;justify-content:center' }, [h(CheckCircle, { size: 48, color: '#4ECDC4' })]),
          h('h2', { style: S.title }, 'All Set!'),
          h('p', { style: S.desc }, 'AI is configured and ready. You can change settings anytime in Settings > AI.'),
        ]),
        h('div', { style: S.actions }, [
          h('button', { style: S.btnPrimary }, 'Get Started'),
        ]),
      ]),
    ])}
  }),
}
