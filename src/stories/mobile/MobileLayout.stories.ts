import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);min-height:600px;position:relative;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;display:flex;flex-direction:column',
  pullIndicator: 'text-align:center;padding:var(--space-1);color:var(--text-tertiary);font-size:var(--text-sm)',
  content: 'flex:1;padding:var(--space-4);color:var(--text-secondary)',
  nav: 'display:flex;align-items:center;justify-content:space-around;background:var(--glass-bg-tint);backdrop-filter:blur(12px);border-top:1px solid var(--border-primary);padding:var(--space-2) 0',
  navItem: 'display:flex;flex-direction:column;align-items:center;gap:var(--space-0_5);font-size:var(--text-xs);color:var(--text-tertiary)',
  navItemActive: 'display:flex;flex-direction:column;align-items:center;gap:var(--space-0_5);font-size:var(--text-xs);color:var(--brand-primary)',
  commandPanel: 'background:var(--surface-primary);border-bottom:1px solid var(--border-primary);padding:var(--space-3) var(--space-4)',
  panelHandle: 'width:36px;height:4px;background:var(--border-secondary);border-radius:var(--radius-xs);margin:0 auto var(--space-3)',
  inputRow: 'display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-3)',
  input: 'flex:1;padding:var(--space-2) var(--space-3);background:var(--surface-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-md);color:var(--text-primary);font-size:var(--text-sm);outline:none',
  iconBtn: 'width:36px;height:36px;border-radius:var(--radius-md);background:var(--glass-bg-soft);border:1px solid var(--border-primary);display:flex;align-items:center;justify-content:center;color:var(--text-secondary);cursor:pointer',
  sendBtn: 'width:36px;height:36px;border-radius:var(--radius-md);background:var(--glass-bg-soft);border:1px solid var(--brand-primary);display:flex;align-items:center;justify-content:center;color:var(--brand-primary);cursor:pointer',
  searchRow: 'display:flex;align-items:center;gap:var(--space-2)',
  searchResult: 'display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2);background:var(--surface-secondary);border-radius:var(--radius-md);margin-top:var(--space-2);font-size:var(--text-meta);color:var(--text-secondary);cursor:pointer',
}

const meta: Meta = {
  title: '📱 Mobile/MobileLayout',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.pullIndicator }, '⌄'),
      h('div', { style: S.content }, 'Page content goes here'),
      h('div', { style: S.nav }, [
        h('div', { style: S.navItemActive }, ['📥', 'Tasks']),
        h('div', { style: S.navItem }, ['⚡', 'Sort']),
        h('div', { style: S.navItem }, ['⏱️', 'Timer']),
        h('div', { style: S.navItem }, ['✨', 'AI']),
        h('div', { style: S.navItem }, ['☰', 'Menu']),
      ]),
    ])}
  }),
}

export const WithCommandPanel: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.commandPanel }, [
        h('div', { style: S.panelHandle }),
        h('div', { style: S.inputRow }, [
          h('input', { style: S.input, placeholder: 'Add a task...' }),
          h('button', { style: S.iconBtn }, '🎤'),
          h('button', { style: S.sendBtn }, '➤'),
        ]),
        h('div', { style: S.searchRow }, [
          h('span', { style: 'color:var(--text-tertiary);font-size:var(--text-base)' }, '🔍'),
          h('input', { style: S.input, placeholder: 'Search tasks...' }),
        ]),
        h('div', { style: S.searchResult }, '📋 Design landing page'),
        h('div', { style: S.searchResult }, '📋 Fix navigation bug'),
      ]),
      h('div', { style: S.content + ';opacity:0.3' }, 'Page content (dimmed)'),
      h('div', { style: S.nav }, [
        h('div', { style: S.navItemActive }, ['📥', 'Tasks']),
        h('div', { style: S.navItem }, ['⚡', 'Sort']),
        h('div', { style: S.navItem }, ['⏱️', 'Timer']),
        h('div', { style: S.navItem }, ['✨', 'AI']),
        h('div', { style: S.navItem }, ['☰', 'Menu']),
      ]),
    ])}
  }),
}
