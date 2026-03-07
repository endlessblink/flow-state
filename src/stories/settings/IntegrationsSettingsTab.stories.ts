import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);padding:24px;max-width:700px',
  section: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:16px;margin-bottom:16px',
  sectionTitle: 'font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:12px;display:flex;align-items:center;gap:8px',
  calendarItem: 'display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--surface-secondary);border-radius:var(--radius-md);margin-bottom:8px',
  calDot: 'width:12px;height:12px;border-radius:50%;flex-shrink:0',
  calInfo: 'flex:1;min-width:0',
  calName: 'font-size:13px;font-weight:500;color:var(--text-primary)',
  calUrl: 'font-size:11px;color:var(--text-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis',
  calActions: 'display:flex;gap:4px',
  iconBtn: 'width:28px;height:28px;border-radius:var(--radius-sm);background:none;border:1px solid var(--border-primary);color:var(--text-tertiary);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px',
  addForm: 'border:1px dashed var(--border-secondary);border-radius:var(--radius-md);padding:14px;margin-top:12px',
  addTitle: 'font-size:12px;color:var(--text-tertiary);margin-bottom:8px',
  formRow: 'display:flex;gap:8px;margin-bottom:8px',
  input: 'flex:1;padding:8px 10px;background:var(--surface-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-md);color:var(--text-primary);font-size:13px;outline:none',
  colorPresets: 'display:flex;gap:6px;margin-bottom:8px',
  colorDot: 'width:24px;height:24px;border-radius:50%;cursor:pointer;border:2px solid transparent',
  colorDotSelected: 'width:24px;height:24px;border-radius:50%;cursor:pointer;border:2px solid white;box-shadow:0 0 0 1px var(--border-primary)',
  addBtn: 'padding:6px 14px;background:var(--glass-bg-soft);border:1px solid var(--brand-primary);border-radius:var(--radius-md);color:var(--brand-primary);font-size:12px;cursor:pointer',
  syncRow: 'display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-top:1px solid var(--border-primary);margin-top:8px',
  syncLabel: 'font-size:13px;color:var(--text-secondary)',
  syncSelect: 'padding:6px 10px;background:var(--surface-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-md);color:var(--text-primary);font-size:12px',
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
        h('div', { style: 'text-align:center;padding:16px;color:var(--text-tertiary);font-size:13px' }, 'No external calendars configured.'),
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
