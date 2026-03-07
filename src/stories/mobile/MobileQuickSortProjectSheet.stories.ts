import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);min-height:500px;position:relative;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden',
  backdrop: 'position:absolute;inset:0;background:rgba(0,0,0,0.5)',
  sheet: 'position:absolute;bottom:0;left:0;right:0;background:var(--surface-primary);border-top-left-radius:var(--radius-xl);border-top-right-radius:var(--radius-xl);border-top:1px solid var(--border-primary);max-height:70%',
  handle: 'width:36px;height:4px;background:var(--border-secondary);border-radius:2px;margin:8px auto',
  title: 'font-size:16px;font-weight:600;color:var(--text-primary);text-align:center;padding:4px 16px 12px',
  searchBox: 'margin:0 16px 12px;position:relative',
  searchInput: 'width:100%;padding:8px 12px 8px 32px;background:var(--surface-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-md);color:var(--text-primary);font-size:14px;outline:none',
  searchIcon: 'position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-tertiary);font-size:14px',
  section: 'padding:0 16px 8px',
  sectionTitle: 'font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px',
  inboxOption: 'display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface-secondary);border-radius:var(--radius-md);margin-bottom:8px;cursor:pointer',
  inboxEmoji: 'font-size:18px',
  inboxText: 'font-size:14px;color:var(--text-primary)',
  inboxHint: 'font-size:11px;color:var(--text-tertiary)',
  recentGrid: 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px',
  recentChip: 'display:flex;align-items:center;gap:4px;padding:5px 10px;background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-full);font-size:12px;color:var(--text-secondary);cursor:pointer',
  projectItem: 'display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:var(--radius-md);cursor:pointer',
  projectEmoji: 'font-size:16px',
  projectName: 'font-size:14px;color:var(--text-primary)',
  divider: 'height:1px;background:var(--border-primary);margin:8px 16px',
  scrollArea: 'overflow-y:auto;max-height:300px;padding-bottom:16px',
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
