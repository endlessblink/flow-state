import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  overlay: 'background:var(--overlay-bg);display:flex;align-items:center;justify-content:center;min-height:600px;border-radius:var(--radius-xl);padding:var(--space-6)',
  panel: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);width:100%;max-width:560px;max-height:500px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px var(--overlay-bg)',
  header: 'display:flex;align-items:center;justify-content:space-between;padding:var(--space-4) var(--space-5);border-bottom:1px solid var(--border-primary)',
  headerLeft: 'display:flex;align-items:center;gap:var(--space-2_5)',
  headerIcon: 'font-size:var(--text-xl);color:var(--text-secondary)',
  headerTitle: 'font-size:var(--text-lg);font-weight:600;color:var(--text-primary)',
  closeBtn: 'background:none;border:none;color:var(--text-tertiary);font-size:var(--text-lg);cursor:pointer',
  search: 'padding:var(--space-3) var(--space-5);border-bottom:1px solid var(--border-primary);display:flex;align-items:center;gap:var(--space-2)',
  searchIcon: 'color:var(--text-tertiary);font-size:var(--text-sm)',
  searchInput: 'flex:1;background:transparent;border:none;color:var(--text-primary);font-size:var(--text-sm);outline:none',
  content: 'flex:1;overflow-y:auto;padding:var(--space-3) var(--space-5)',
  categoryHeader: 'display:flex;align-items:center;gap:var(--space-2);margin-top:var(--space-3);margin-bottom:var(--space-2)',
  categoryIcon: 'font-size:var(--text-base);color:var(--text-tertiary)',
  categoryTitle: 'font-size:var(--text-meta);font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px',
  shortcutItem: 'display:flex;align-items:center;justify-content:space-between;padding:var(--space-1_5) 0',
  shortcutKeys: 'display:flex;gap:var(--space-1)',
  kbd: 'padding:var(--space-0_5) var(--space-2);background:var(--surface-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-sm);font-size:var(--text-xs);color:var(--text-primary);font-family:monospace;min-width:24px;text-align:center',
  shortcutDesc: 'font-size:var(--text-meta);color:var(--text-secondary)',
}

const shortcuts = [
  { category: '⌨️ General', items: [
    { keys: ['Ctrl', 'K'], desc: 'Command palette' },
    { keys: ['Ctrl', 'N'], desc: 'New task' },
    { keys: ['?'], desc: 'Show shortcuts' },
    { keys: ['Esc'], desc: 'Close panel' },
  ]},
  { category: '📋 Tasks', items: [
    { keys: ['Ctrl', 'Enter'], desc: 'Save task' },
    { keys: ['Del'], desc: 'Delete task' },
    { keys: ['Space'], desc: 'Toggle done' },
    { keys: ['E'], desc: 'Edit task' },
  ]},
  { category: '⏱️ Timer', items: [
    { keys: ['Ctrl', 'T'], desc: 'Start/pause timer' },
    { keys: ['Ctrl', 'Shift', 'T'], desc: 'Stop timer' },
  ]},
]

const meta: Meta = {
  title: '📐 Layout/KeyboardShortcutsPanel',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.overlay }, [
      h('div', { style: S.panel }, [
        h('div', { style: S.header }, [
          h('div', { style: S.headerLeft }, [
            h('span', { style: S.headerIcon }, '⌨️'),
            h('span', { style: S.headerTitle }, 'Keyboard Shortcuts'),
          ]),
          h('button', { style: S.closeBtn }, '✕'),
        ]),
        h('div', { style: S.search }, [
          h('span', { style: S.searchIcon }, '🔍'),
          h('input', { style: S.searchInput, placeholder: 'Search shortcuts...' }),
        ]),
        h('div', { style: S.content }, shortcuts.map(cat =>
          h('div', null, [
            h('div', { style: S.categoryHeader }, [
              h('span', { style: S.categoryTitle }, cat.category),
            ]),
            ...cat.items.map(s =>
              h('div', { style: S.shortcutItem }, [
                h('div', { style: S.shortcutKeys }, s.keys.map(k =>
                  h('kbd', { style: S.kbd }, k)
                )),
                h('span', { style: S.shortcutDesc }, s.desc),
              ])
            ),
          ])
        )),
      ]),
    ])}
  }),
}
