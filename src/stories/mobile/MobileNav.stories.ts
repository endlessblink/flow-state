import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'
import { Inbox, Zap, Timer, Sparkles, Menu as MenuIcon, Settings, LogIn, RefreshCw } from 'lucide-vue-next'

const S = {
  nav: 'display:flex;align-items:center;justify-content:space-around;background:var(--glass-bg-tint);backdrop-filter:blur(12px);border-top:1px solid var(--border-primary);padding:var(--space-2) 0;position:fixed;bottom:0;left:0;right:0;max-width:430px;margin:0 auto;z-index:100',
  item: 'display:flex;flex-direction:column;align-items:center;gap:var(--space-0_5);padding:var(--space-1) var(--space-3);color:var(--text-tertiary);font-size:var(--text-xs);cursor:pointer;transition:color 0.2s',
  itemActive: 'display:flex;flex-direction:column;align-items:center;gap:var(--space-0_5);padding:var(--space-1) var(--space-3);color:var(--brand-primary);font-size:var(--text-xs);cursor:pointer',
  wrapper: 'background:var(--bg-primary);min-height:200px;max-width:430px;margin:0 auto;position:relative;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden',
  menuOverlay: 'position:absolute;inset:0;background:var(--overlay-bg);backdrop-filter:blur(8px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-3);z-index:200',
  menuItem: 'display:flex;align-items:center;gap:var(--space-2);padding:var(--space-3) var(--space-6);background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-lg);color:var(--text-primary);font-size:var(--text-sm);min-width:200px;cursor:pointer',
  menuDanger: 'display:flex;align-items:center;gap:var(--space-2);padding:var(--space-3) var(--space-6);background:var(--glass-bg-soft);border:1px solid var(--color-danger);border-radius:var(--radius-lg);color:var(--color-danger);font-size:var(--text-sm);min-width:200px;cursor:pointer',
}

const navItems = [
  { label: 'Tasks', icon: Inbox, active: true },
  { label: 'Sort', icon: Zap },
  { label: 'Timer', icon: Timer },
  { label: 'AI', icon: Sparkles },
  { label: 'Menu', icon: MenuIcon },
]

const meta: Meta = {
  title: '📱 Mobile/MobileNav',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: 'padding:var(--space-4);color:var(--text-secondary);text-align:center;padding-bottom:80px' }, 'Page Content'),
      h('div', { style: S.nav }, navItems.map(item =>
        h('div', { style: item.active ? S.itemActive : S.item }, [
          h(item.icon, { size: 22, strokeWidth: 1.5 }),
          h('span', null, item.label),
        ])
      )),
    ])}
  }),
}

export const WithMenuOpen: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper + ';min-height:400px' }, [
      h('div', { style: S.menuOverlay }, [
        h('div', { style: S.menuItem }, [h(Settings, { size: 20 }), ' Settings']),
        h('div', { style: S.menuItem }, [h(LogIn, { size: 20 }), ' Sign In']),
        h('div', { style: S.menuDanger }, [h(RefreshCw, { size: 20 }), ' Clear Cache & Reload']),
      ]),
      h('div', { style: S.nav }, navItems.map(item =>
        h('div', { style: item.label === 'Menu' ? S.itemActive : S.item }, [
          h(item.icon, { size: 22, strokeWidth: 1.5 }),
          h('span', null, item.label),
        ])
      )),
    ])}
  }),
}
