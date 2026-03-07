import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);padding:24px;max-width:360px',
  triggerRow: 'display:flex;align-items:center;gap:12px;margin-bottom:16px',
  bellBtn: 'display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:none;border:1px solid var(--border-primary);border-radius:var(--radius-md);color:var(--text-secondary);cursor:pointer;position:relative',
  bellActive: 'display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:none;border:1px solid var(--brand-primary);border-radius:var(--radius-md);color:var(--brand-primary);cursor:pointer;position:relative',
  badge: 'position:absolute;top:-4px;right:-4px;width:16px;height:16px;border-radius:50%;background:var(--brand-primary);color:var(--bg-primary);font-size:9px;font-weight:600;display:flex;align-items:center;justify-content:center',
  label: 'font-size:13px;color:var(--text-secondary)',
  popover: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);box-shadow:0 8px 24px rgba(0,0,0,0.3);overflow:hidden;width:280px',
  popoverHeader: 'display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--border-primary)',
  popoverTitle: 'font-size:13px;font-weight:600;color:var(--text-primary)',
  closeBtn: 'background:none;border:none;color:var(--text-tertiary);font-size:12px;cursor:pointer',
  reminderItem: 'display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--border-primary)',
  reminderInfo: 'flex:1',
  reminderDatetime: 'display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text-primary)',
  reminderLabel: 'font-size:11px;color:var(--text-tertiary);margin-top:2px',
  reminderActions: 'display:flex;gap:4px',
  statusPending: 'font-size:10px;padding:1px 6px;background:rgba(78,205,196,0.1);border-radius:var(--radius-sm);color:var(--brand-primary)',
  statusFired: 'font-size:10px;padding:1px 6px;background:rgba(245,158,11,0.1);border-radius:var(--radius-sm);color:var(--color-warning)',
  statusDismissed: 'font-size:10px;padding:1px 6px;background:var(--surface-secondary);border-radius:var(--radius-sm);color:var(--text-tertiary)',
  addSection: 'padding:10px 12px',
  quickChips: 'display:flex;flex-wrap:wrap;gap:4px',
  chip: 'padding:4px 8px;background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-full);font-size:11px;color:var(--text-secondary);cursor:pointer',
}

const meta: Meta = {
  title: '🔔 Notifications/ReminderPicker',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const NoReminders: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.triggerRow }, [
        h('button', { style: S.bellBtn }, '🔔'),
        h('span', { style: S.label }, 'No reminders'),
      ]),
    ])}
  }),
}

export const WithReminders: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.triggerRow }, [
        h('button', { style: S.bellActive }, ['🔔', h('span', { style: S.badge }, '2')]),
        h('span', { style: S.label }, '2 reminders'),
      ]),
      h('div', { style: S.popover }, [
        h('div', { style: S.popoverHeader }, [
          h('span', { style: S.popoverTitle }, 'Reminders'),
          h('button', { style: S.closeBtn }, '✕'),
        ]),
        h('div', { style: S.reminderItem }, [
          h('div', { style: S.reminderInfo }, [
            h('div', { style: S.reminderDatetime }, ['🕐 Today, 3:00 PM']),
            h('div', { style: S.reminderLabel }, 'Check progress'),
          ]),
          h('span', { style: S.statusPending }, 'Pending'),
        ]),
        h('div', { style: S.reminderItem }, [
          h('div', { style: S.reminderInfo }, [
            h('div', { style: S.reminderDatetime }, ['🕐 Yesterday, 9:00 AM']),
          ]),
          h('span', { style: S.statusFired }, 'Fired'),
        ]),
        h('div', { style: S.addSection }, [
          h('div', { style: 'font-size:11px;color:var(--text-tertiary);margin-bottom:6px' }, 'Quick add:'),
          h('div', { style: S.quickChips }, [
            h('span', { style: S.chip }, 'In 30 min'),
            h('span', { style: S.chip }, 'In 1 hour'),
            h('span', { style: S.chip }, 'Tomorrow 9 AM'),
            h('span', { style: S.chip }, 'Custom...'),
          ]),
        ]),
      ]),
    ])}
  }),
}
