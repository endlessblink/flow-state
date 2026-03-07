import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);padding:24px;max-width:700px',
  section: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:16px;margin-bottom:16px',
  sectionTitle: 'font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:12px;display:flex;align-items:center;gap:8px',
  row: 'display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-primary)',
  rowLast: 'display:flex;align-items:center;justify-content:space-between;padding:8px 0',
  rowLabel: 'flex:1',
  rowTitle: 'font-size:13px;color:var(--text-primary)',
  rowDesc: 'font-size:11px;color:var(--text-tertiary);margin-top:2px',
  toggle: 'width:40px;height:22px;border-radius:11px;position:relative;cursor:pointer;flex-shrink:0',
  toggleOn: 'background:var(--brand-primary)',
  toggleOff: 'background:var(--surface-secondary);border:1px solid var(--border-primary)',
  toggleDot: 'position:absolute;top:2px;width:18px;height:18px;border-radius:50%;background:white',
  channelRow: 'display:flex;gap:8px;margin-top:8px;margin-left:24px',
  channelChip: 'padding:4px 10px;background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-full);font-size:11px;color:var(--text-secondary)',
  channelChipActive: 'padding:4px 10px;background:rgba(78,205,196,0.1);border:1px solid var(--brand-primary);border-radius:var(--radius-full);font-size:11px;color:var(--brand-primary)',
  quietSection: 'margin-top:12px;padding:12px;background:var(--surface-secondary);border-radius:var(--radius-md)',
  quietTitle: 'font-size:12px;font-weight:500;color:var(--text-secondary);margin-bottom:8px',
  quietRow: 'display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-secondary)',
  timeInput: 'padding:4px 8px;background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;width:60px;text-align:center',
  pushBanner: 'display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(78,205,196,0.08);border:1px solid var(--brand-primary);border-radius:var(--radius-md);margin-bottom:12px',
  pushBannerText: 'font-size:12px;color:var(--brand-primary);flex:1',
  subscribeBtn: 'padding:4px 12px;background:var(--glass-bg-soft);border:1px solid var(--brand-primary);border-radius:var(--radius-md);color:var(--brand-primary);font-size:11px;cursor:pointer',
}

const toggleEl = (on: boolean) =>
  h('div', { style: S.toggle + ';' + (on ? S.toggleOn : S.toggleOff) }, [
    h('div', { style: S.toggleDot + `;left:${on ? '20px' : '2px'}` }),
  ])

const meta: Meta = {
  title: '⚙️ Settings/NotificationsSettingsTab',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.section }, [
        h('div', { style: S.sectionTitle }, ['🔔 Push Notifications']),
        h('div', { style: S.pushBanner }, [
          h('span', null, '🔔'),
          h('span', { style: S.pushBannerText }, 'Enable push notifications for reminders and timer alerts'),
          h('button', { style: S.subscribeBtn }, 'Enable'),
        ]),
        h('div', { style: S.row }, [
          h('div', { style: S.rowLabel }, [
            h('div', { style: S.rowTitle }, 'Master Toggle'),
            h('div', { style: S.rowDesc }, 'Enable all notification categories'),
          ]),
          toggleEl(true),
        ]),
      ]),
      h('div', { style: S.section }, [
        h('div', { style: S.sectionTitle }, ['📋 Categories']),
        h('div', { style: S.row }, [
          h('div', { style: S.rowLabel }, [
            h('div', { style: S.rowTitle }, 'Task Reminders'),
            h('div', { style: S.rowDesc }, 'Reminder notifications for upcoming tasks'),
          ]),
          toggleEl(true),
        ]),
        h('div', { style: S.channelRow }, [
          h('span', { style: S.channelChipActive }, '🔔 Push'),
          h('span', { style: S.channelChipActive }, '🔊 Sound'),
          h('span', { style: S.channelChip }, '📧 Email'),
        ]),
        h('div', { style: S.row }, [
          h('div', { style: S.rowLabel }, [
            h('div', { style: S.rowTitle }, 'Timer Alerts'),
            h('div', { style: S.rowDesc }, 'Pomodoro session start/end notifications'),
          ]),
          toggleEl(true),
        ]),
        h('div', { style: S.row }, [
          h('div', { style: S.rowLabel }, [
            h('div', { style: S.rowTitle }, 'Daily Summary'),
            h('div', { style: S.rowDesc }, 'Morning productivity digest'),
          ]),
          toggleEl(false),
        ]),
      ]),
      h('div', { style: S.section }, [
        h('div', { style: S.sectionTitle }, ['🌙 Quiet Hours']),
        h('div', { style: S.rowLast }, [
          h('div', { style: S.rowLabel }, [
            h('div', { style: S.rowTitle }, 'Enable Quiet Hours'),
            h('div', { style: S.rowDesc }, 'Silence notifications during specified times'),
          ]),
          toggleEl(true),
        ]),
        h('div', { style: S.quietSection }, [
          h('div', { style: S.quietRow }, [
            h('span', null, 'From'),
            h('input', { style: S.timeInput, value: '22:00' }),
            h('span', null, 'to'),
            h('input', { style: S.timeInput, value: '08:00' }),
          ]),
        ]),
      ]),
    ])}
  }),
}
