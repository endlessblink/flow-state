import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);min-height:500px;position:relative;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden',
  backdrop: 'position:absolute;inset:0;background:var(--overlay-bg)',
  sheet: 'position:absolute;bottom:0;left:0;right:0;background:var(--surface-primary);border-top-left-radius:var(--radius-xl);border-top-right-radius:var(--radius-xl);border-top:1px solid var(--border-primary);max-height:70%',
  handle: 'width:36px;height:4px;background:var(--border-secondary);border-radius:var(--radius-xs);margin:var(--space-2) auto',
  title: 'font-size:var(--text-base);font-weight:600;color:var(--text-primary);text-align:center;padding:var(--space-1) var(--space-4) var(--space-3)',
  searchBox: 'margin:0 var(--space-4) var(--space-3);position:relative',
  searchInput: 'width:100%;padding:var(--space-2) var(--space-3) var(--space-2) 32px;background:var(--surface-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-md);color:var(--text-primary);font-size:var(--text-sm);outline:none',
  searchIcon: 'position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-tertiary);font-size:var(--text-sm)',
  section: 'padding:0 var(--space-4) var(--space-2)',
  sectionTitle: 'font-size:var(--text-xs);color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:var(--space-2)',
  inboxOption: 'display:flex;align-items:center;gap:var(--space-2_5);padding:var(--space-2_5) var(--space-3);background:var(--surface-secondary);border-radius:var(--radius-md);margin-bottom:var(--space-2);cursor:pointer',
  inboxEmoji: 'font-size:var(--text-lg)',
  inboxText: 'font-size:var(--text-sm);color:var(--text-primary)',
  inboxHint: 'font-size:var(--text-xs);color:var(--text-tertiary)',
  recentGrid: 'display:flex;flex-wrap:wrap;gap:var(--space-1_5);margin-bottom:var(--space-3)',
  recentChip: 'display:flex;align-items:center;gap:var(--space-1);padding:var(--space-1) var(--space-2_5);background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-full);font-size:var(--text-xs);color:var(--text-secondary);cursor:pointer',
  projectItem: 'display:flex;align-items:center;gap:var(--space-2_5);padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);cursor:pointer',
  projectEmoji: 'font-size:var(--text-base)',
  projectName: 'font-size:var(--text-sm);color:var(--text-primary)',
  divider: 'height:1px;background:var(--border-primary);margin:var(--space-2) var(--space-4)',
  scrollArea: 'overflow-y:auto;max-height:300px;padding-bottom:var(--space-4)',
}

const meta: Meta = {
  title: '📱 Mobile/MobileQuickSortProjectSheet',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.backdrop }),
      h('div', { style: S.sheet }, [
        h('div', { style: 'text-align:center' }, [h('div', { style: S.handle })]),
        h('div', { style: S.title }, 'Where does this belong?'),
        h('div', { style: S.searchBox }, [
          h('span', { style: S.searchIcon }, '🔍'),
          h('input', { style: S.searchInput, placeholder: 'Search projects...' }),
        ]),
        h('div', { style: S.scrollArea }, [
          h('div', { style: S.section }, [
            h('div', { style: S.inboxOption }, [
              h('span', { style: S.inboxEmoji }, '📥'),
              h('div', null, [
                h('div', { style: S.inboxText }, 'Keep in Inbox'),
                h('div', { style: S.inboxHint }, 'Sort later'),
              ]),
            ]),
          ]),
          h('div', { style: S.section }, [
            h('div', { style: S.sectionTitle }, 'Recent'),
            h('div', { style: S.recentGrid }, [
              h('span', { style: S.recentChip }, '🎨 Design'),
              h('span', { style: S.recentChip }, '⚙️ Backend'),
              h('span', { style: S.recentChip }, '📱 Mobile'),
            ]),
          ]),
          h('div', { style: S.divider }),
          h('div', { style: S.section }, [
            h('div', { style: S.sectionTitle }, 'All Projects'),
            h('div', { style: S.projectItem }, [
              h('span', { style: S.projectEmoji }, '🎨'),
              h('span', { style: S.projectName }, 'Design'),
            ]),
            h('div', { style: S.projectItem + ';padding-left:32px' }, [
              h('span', { style: S.projectEmoji }, '🖌️'),
              h('span', { style: S.projectName }, 'UI Components'),
            ]),
            h('div', { style: S.projectItem }, [
              h('span', { style: S.projectEmoji }, '⚙️'),
              h('span', { style: S.projectName }, 'Backend'),
            ]),
            h('div', { style: S.projectItem }, [
              h('span', { style: S.projectEmoji }, '📱'),
              h('span', { style: S.projectName }, 'Mobile'),
            ]),
            h('div', { style: S.projectItem }, [
              h('span', { style: S.projectEmoji }, '📝'),
              h('span', { style: S.projectName }, 'Documentation'),
            ]),
          ]),
        ]),
      ]),
    ])}
  }),
}
