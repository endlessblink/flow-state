import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);padding:var(--space-6);max-width:700px',
  section: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4)',
  sectionTitle: 'font-size:var(--text-sm);font-weight:600;color:var(--text-primary);margin-bottom:var(--space-3);display:flex;align-items:center;gap:var(--space-2)',
  row: 'display:flex;align-items:center;justify-content:space-between;padding:var(--space-2) 0;border-bottom:1px solid var(--border-primary)',
  rowLast: 'display:flex;align-items:center;justify-content:space-between;padding:var(--space-2) 0',
  rowLabel: 'flex:1',
  rowTitle: 'font-size:var(--text-meta);color:var(--text-primary)',
  rowDesc: 'font-size:var(--text-xs);color:var(--text-tertiary);margin-top:var(--space-0_5)',
  toggle: 'width:40px;height:22px;border-radius:11px;position:relative;cursor:pointer;flex-shrink:0',
  toggleOn: 'background:var(--brand-primary)',
  toggleOff: 'background:var(--surface-secondary);border:1px solid var(--border-primary)',
  toggleDot: 'position:absolute;top:var(--space-0_5);width:18px;height:18px;border-radius:var(--radius-full);background:white',
  channelRow: 'display:flex;gap:var(--space-2);margin-top:var(--space-2);margin-left:var(--space-6)',
  channelChip: 'padding:var(--space-1) var(--space-2_5);background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-full);font-size:var(--text-xs);color:var(--text-secondary)',
  channelChipActive: 'padding:var(--space-1) var(--space-2_5);background:var(--brand-primary-subtle);border:1px solid var(--brand-primary);border-radius:var(--radius-full);font-size:var(--text-xs);color:var(--brand-primary)',
  quietSection: 'margin-top:var(--space-3);padding:var(--space-3);background:var(--surface-secondary);border-radius:var(--radius-md)',
  quietTitle: 'font-size:var(--text-xs);font-weight:500;color:var(--text-secondary);margin-bottom:var(--space-2)',
  quietRow: 'display:flex;align-items:center;gap:var(--space-2);font-size:var(--text-xs);color:var(--text-secondary)',
  timeInput: 'padding:var(--space-1) var(--space-2);background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-sm);color:var(--text-primary);font-size:var(--text-xs);width:60px;text-align:center',
  pushBanner: 'display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2_5) var(--space-3);background:var(--glass-glow);border:1px solid var(--brand-primary);border-radius:var(--radius-md);margin-bottom:var(--space-3)',
  pushBannerText: 'font-size:var(--text-xs);color:var(--brand-primary);flex:1',
  subscribeBtn: 'padding:var(--space-1) var(--space-3);background:var(--glass-bg-soft);border:1px solid var(--brand-primary);border-radius:var(--radius-md);color:var(--brand-primary);font-size:var(--text-xs);cursor:pointer',
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
