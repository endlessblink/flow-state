import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);padding:var(--space-6);max-width:700px',
  section: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4)',
  sectionTitle: 'font-size:var(--text-sm);font-weight:600;color:var(--text-primary);margin-bottom:var(--space-3);display:flex;align-items:center;gap:var(--space-2)',
  calendarItem: 'display:flex;align-items:center;gap:var(--space-3);padding:var(--space-2_5) var(--space-3);background:var(--surface-secondary);border-radius:var(--radius-md);margin-bottom:var(--space-2)',
  calDot: 'width:12px;height:12px;border-radius:var(--radius-full);flex-shrink:0',
  calInfo: 'flex:1;min-width:0',
  calName: 'font-size:var(--text-meta);font-weight:500;color:var(--text-primary)',
  calUrl: 'font-size:var(--text-xs);color:var(--text-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis',
  calActions: 'display:flex;gap:var(--space-1)',
  iconBtn: 'width:28px;height:28px;border-radius:var(--radius-sm);background:none;border:1px solid var(--border-primary);color:var(--text-tertiary);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:var(--text-xs)',
  addForm: 'border:1px dashed var(--border-secondary);border-radius:var(--radius-md);padding:var(--space-3_5);margin-top:var(--space-3)',
  addTitle: 'font-size:var(--text-xs);color:var(--text-tertiary);margin-bottom:var(--space-2)',
  formRow: 'display:flex;gap:var(--space-2);margin-bottom:var(--space-2)',
  input: 'flex:1;padding:var(--space-2) var(--space-2_5);background:var(--surface-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-md);color:var(--text-primary);font-size:var(--text-meta);outline:none',
  colorPresets: 'display:flex;gap:var(--space-1_5);margin-bottom:var(--space-2)',
  colorDot: 'width:24px;height:24px;border-radius:var(--radius-full);cursor:pointer;border:2px solid transparent',
  colorDotSelected: 'width:24px;height:24px;border-radius:var(--radius-full);cursor:pointer;border:2px solid white;box-shadow:0 0 0 1px var(--border-primary)',
  addBtn: 'padding:var(--space-1_5) var(--space-3_5);background:var(--glass-bg-soft);border:1px solid var(--brand-primary);border-radius:var(--radius-md);color:var(--brand-primary);font-size:var(--text-xs);cursor:pointer',
  syncRow: 'display:flex;align-items:center;justify-content:space-between;padding:var(--space-2) 0;border-top:1px solid var(--border-primary);margin-top:var(--space-2)',
  syncLabel: 'font-size:var(--text-meta);color:var(--text-secondary)',
  syncSelect: 'padding:var(--space-1_5) var(--space-2_5);background:var(--surface-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-md);color:var(--text-primary);font-size:var(--text-xs)',
}

const meta: Meta = {
  title: '⚙️ Settings/IntegrationsSettingsTab',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const WithCalendars: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.section }, [
        h('div', { style: S.sectionTitle }, ['📅 External Calendars']),
        h('div', { style: S.calendarItem }, [
          h('span', { style: S.calDot + ';background:#6366f1' }),
          h('div', { style: S.calInfo }, [
            h('div', { style: S.calName }, 'Work Calendar'),
            h('div', { style: S.calUrl }, 'https://calendar.google.com/ical/...'),
          ]),
          h('div', { style: S.calActions }, [
            h('button', { style: S.iconBtn }, '🔄'),
            h('button', { style: S.iconBtn }, '🗑️'),
          ]),
        ]),
        h('div', { style: S.calendarItem }, [
          h('span', { style: S.calDot + ';background:#22c55e' }),
          h('div', { style: S.calInfo }, [
            h('div', { style: S.calName }, 'Personal'),
            h('div', { style: S.calUrl }, 'https://outlook.live.com/ical/...'),
          ]),
          h('div', { style: S.calActions }, [
            h('button', { style: S.iconBtn }, '🔄'),
            h('button', { style: S.iconBtn }, '🗑️'),
          ]),
        ]),
        h('div', { style: S.addForm }, [
          h('div', { style: S.addTitle }, '+ Add Calendar'),
          h('div', { style: S.formRow }, [
            h('input', { style: S.input, placeholder: 'Calendar name' }),
          ]),
          h('div', { style: S.formRow }, [
            h('input', { style: S.input, placeholder: 'iCal URL (https://...)' }),
          ]),
          h('div', { style: S.colorPresets }, [
            h('span', { style: S.colorDotSelected + ';background:#6366f1' }),
            h('span', { style: S.colorDot + ';background:#3b82f6' }),
            h('span', { style: S.colorDot + ';background:#22c55e' }),
            h('span', { style: S.colorDot + ';background:#f97316' }),
            h('span', { style: S.colorDot + ';background:#ec4899' }),
            h('span', { style: S.colorDot + ';background:#14b8a6' }),
          ]),
          h('button', { style: S.addBtn }, '+ Add Calendar'),
        ]),
        h('div', { style: S.syncRow }, [
          h('span', { style: S.syncLabel }, 'Sync interval'),
          h('select', { style: S.syncSelect }, [
            h('option', null, '15 minutes'),
            h('option', { selected: true }, '30 minutes'),
            h('option', null, '1 hour'),
          ]),
        ]),
      ]),
    ])}
  }),
}

export const Empty: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.section }, [
        h('div', { style: S.sectionTitle }, ['📅 External Calendars']),
        h('div', { style: 'text-align:center;padding:var(--space-4);color:var(--text-tertiary);font-size:var(--text-meta)' }, 'No external calendars configured.'),
        h('div', { style: S.addForm }, [
          h('div', { style: S.addTitle }, '+ Add Calendar'),
          h('div', { style: S.formRow }, [
            h('input', { style: S.input, placeholder: 'Calendar name' }),
          ]),
          h('div', { style: S.formRow }, [
            h('input', { style: S.input, placeholder: 'iCal URL (https://...)' }),
          ]),
          h('button', { style: S.addBtn }, '+ Add Calendar'),
        ]),
      ]),
    ])}
  }),
}
