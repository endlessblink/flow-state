import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'
import { X, Zap, Monitor, ExternalLink, CheckCircle } from 'lucide-vue-next'

const S = {
  overlay: 'background:var(--overlay-bg);display:flex;align-items:center;justify-content:center;padding:var(--space-6);min-height:600px;border-radius:var(--radius-xl)',
  modal: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);padding:var(--space-8);max-width:480px;width:100%;position:relative;box-shadow:0 20px 60px var(--overlay-bg)',
  closeBtn: 'position:absolute;top:var(--space-3);right:var(--space-3);background:none;border:none;color:var(--text-tertiary);cursor:pointer;display:flex;align-items:center',
  dots: 'display:flex;justify-content:center;gap:var(--space-1_5);margin-bottom:var(--space-6)',
  dot: 'width:8px;height:8px;border-radius:50%;background:var(--border-secondary)',
  dotActive: 'width:8px;height:8px;border-radius:50%;background:var(--brand-primary)',
  dotDone: 'width:8px;height:8px;border-radius:50%;background:var(--brand-primary);opacity:0.4',
  title: 'font-size:var(--text-xl);font-weight:700;color:var(--text-primary);text-align:center;margin-bottom:var(--space-2)',
  desc: 'font-size:var(--text-sm);color:var(--text-secondary);text-align:center;margin-bottom:var(--space-6);line-height:1.5',
  providers: 'display:flex;flex-direction:column;gap:var(--space-2_5);margin-bottom:var(--space-6)',
  providerCard: 'padding:var(--space-3_5) var(--space-4);background:var(--surface-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);cursor:pointer;display:flex;flex-direction:column;gap:var(--space-1);position:relative',
  providerSelected: 'padding:var(--space-3_5) var(--space-4);background:var(--brand-primary-subtle);border:2px solid var(--brand-primary);border-radius:var(--radius-lg);cursor:pointer;display:flex;flex-direction:column;gap:var(--space-1);position:relative',
  badge: 'position:absolute;top:var(--space-2);right:var(--space-2);padding:var(--space-0_5) var(--space-2);background:var(--brand-primary-subtle);border:1px solid var(--brand-primary-dim);color:var(--brand-primary);border-radius:var(--radius-sm);font-size:var(--text-xs);font-weight:600',
  providerIcon: 'font-size:var(--text-lg);margin-bottom:var(--space-0_5)',
  providerName: 'font-size:var(--text-sm);font-weight:600;color:var(--text-primary)',
  providerDetail: 'font-size:var(--text-xs);color:var(--text-tertiary)',
  actions: 'display:flex;flex-direction:column;gap:var(--space-2);align-items:center',
  btnPrimary: 'width:100%;padding:var(--space-2_5);background:var(--glass-bg-soft);border:1px solid var(--brand-primary);border-radius:var(--radius-lg);color:var(--brand-primary);font-size:var(--text-sm);font-weight:600;cursor:pointer;backdrop-filter:blur(8px)',
  btnGhost: 'background:none;border:none;color:var(--text-tertiary);font-size:var(--text-meta);cursor:pointer',
  inputField: 'margin-bottom:var(--space-4)',
  inputLabel: 'font-size:var(--text-xs);color:var(--text-tertiary);margin-bottom:var(--space-1);display:block',
  input: 'width:100%;padding:var(--space-2_5) var(--space-3);background:var(--surface-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-md);color:var(--text-primary);font-size:var(--text-sm);outline:none;font-family:monospace',
  link: 'color:var(--brand-primary);font-size:var(--text-meta);text-decoration:none;display:inline-flex;align-items:center;gap:var(--space-1);margin-bottom:var(--space-3)',
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
            h(Zap, { size: 18, style: 'color:var(--brand-primary)' }),
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
        h('div', { style: 'text-align:center;padding:var(--space-4) 0' }, [
          h('div', { style: 'margin-bottom:var(--space-4);display:flex;justify-content:center' }, [h(CheckCircle, { size: 48, style: 'color:var(--brand-primary)' })]),
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
