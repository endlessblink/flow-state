import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);min-height:600px;position:relative;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;display:flex;flex-direction:column',
  pullIndicator: 'text-align:center;padding:4px;color:var(--text-tertiary);font-size:14px',
  content: 'flex:1;padding:16px;color:var(--text-secondary)',
  nav: 'display:flex;align-items:center;justify-content:space-around;background:var(--glass-bg-tint);backdrop-filter:blur(12px);border-top:1px solid var(--border-primary);padding:8px 0',
  navItem: 'display:flex;flex-direction:column;align-items:center;gap:2px;font-size:10px;color:var(--text-tertiary)',
  navItemActive: 'display:flex;flex-direction:column;align-items:center;gap:2px;font-size:10px;color:var(--brand-primary)',
  commandPanel: 'background:var(--surface-primary);border-bottom:1px solid var(--border-primary);padding:12px 16px',
  panelHandle: 'width:36px;height:4px;background:var(--border-secondary);border-radius:2px;margin:0 auto 12px',
  inputRow: 'display:flex;align-items:center;gap:8px;margin-bottom:12px',
  input: 'flex:1;padding:8px 12px;background:var(--surface-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-md);color:var(--text-primary);font-size:14px;outline:none',
  iconBtn: 'width:36px;height:36px;border-radius:var(--radius-md);background:var(--glass-bg-soft);border:1px solid var(--border-primary);display:flex;align-items:center;justify-content:center;color:var(--text-secondary);cursor:pointer',
  sendBtn: 'width:36px;height:36px;border-radius:var(--radius-md);background:var(--glass-bg-soft);border:1px solid var(--brand-primary);display:flex;align-items:center;justify-content:center;color:var(--brand-primary);cursor:pointer',
  searchRow: 'display:flex;align-items:center;gap:8px',
  searchResult: 'display:flex;align-items:center;gap:8px;padding:8px;background:var(--surface-secondary);border-radius:var(--radius-md);margin-top:8px;font-size:13px;color:var(--text-secondary);cursor:pointer',
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
          h('span', { style: 'color:var(--text-tertiary);font-size:16px' }, '🔍'),
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
