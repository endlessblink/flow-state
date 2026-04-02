import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'
import { Bell, Clock, X } from 'lucide-vue-next'

const S = {
  wrapper: 'background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);padding:var(--space-6);max-width:360px',
  triggerRow: 'display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-4)',
  bellBtn: 'display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:none;border:1px solid var(--border-primary);border-radius:var(--radius-md);color:var(--text-secondary);cursor:pointer;position:relative',
  bellActive: 'display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:none;border:1px solid var(--brand-primary);border-radius:var(--radius-md);color:var(--brand-primary);cursor:pointer;position:relative',
  badge: 'position:absolute;top:-4px;right:-4px;width:16px;height:16px;border-radius:50%;background:var(--state-active-bg);border:1px solid var(--state-hover-border);color:var(--brand-primary);font-size:var(--text-xs);font-weight:600;display:flex;align-items:center;justify-content:center',
  label: 'font-size:var(--text-sm);color:var(--text-secondary)',
  popover: 'background:var(--surface-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);box-shadow:0 8px 24px var(--overlay-bg);overflow:hidden;width:280px',
  popoverHeader: 'display:flex;align-items:center;justify-content:space-between;padding:var(--space-2_5) var(--space-3);border-bottom:1px solid var(--border-primary)',
  popoverTitle: 'font-size:var(--text-sm);font-weight:600;color:var(--text-primary)',
  closeBtn: 'background:none;border:none;color:var(--text-tertiary);cursor:pointer;display:flex;align-items:center',
  reminderItem: 'display:flex;align-items:center;justify-content:space-between;padding:var(--space-2) var(--space-3);border-bottom:1px solid var(--border-primary)',
  reminderInfo: 'flex:1',
  reminderDatetime: 'display:flex;align-items:center;gap:var(--space-1);font-size:var(--text-xs);color:var(--text-primary)',
  reminderLabel: 'font-size:var(--text-xs);color:var(--text-tertiary);margin-top:var(--space-0_5)',
  statusPending: 'font-size:var(--text-xs);padding:1px var(--space-1_5);background:var(--brand-primary-subtle);border:1px solid var(--brand-primary-subtle);border-radius:var(--radius-sm);color:var(--brand-primary)',
  statusFired: 'font-size:var(--text-xs);padding:1px var(--space-1_5);background:var(--color-warning-alpha-10);border:1px solid var(--orange-bg-light);border-radius:var(--radius-sm);color:var(--color-warning)',
  addSection: 'padding:var(--space-2_5) var(--space-3)',
  quickChips: 'display:flex;flex-wrap:wrap;gap:var(--space-1)',
  chip: 'padding:var(--space-1) var(--space-2);background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-full);font-size:var(--text-xs);color:var(--text-secondary);cursor:pointer',
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
        h('button', { style: S.bellBtn }, [h(Bell, { size: 16 })]),
        h('span', { style: S.label }, 'No reminders'),
      ]),
    ])}
  }),
}

export const WithReminders: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.triggerRow }, [
        h('button', { style: S.bellActive }, [h(Bell, { size: 16 }), h('span', { style: S.badge }, '2')]),
        h('span', { style: S.label }, '2 reminders'),
      ]),
      h('div', { style: S.popover }, [
        h('div', { style: S.popoverHeader }, [
          h('span', { style: S.popoverTitle }, 'Reminders'),
          h('button', { style: S.closeBtn }, [h(X, { size: 14 })]),
        ]),
        h('div', { style: S.reminderItem }, [
          h('div', { style: S.reminderInfo }, [
            h('div', { style: S.reminderDatetime }, [h(Clock, { size: 13 }), ' Today, 3:00 PM']),
            h('div', { style: S.reminderLabel }, 'Check progress'),
          ]),
          h('span', { style: S.statusPending }, 'Pending'),
        ]),
        h('div', { style: S.reminderItem }, [
          h('div', { style: S.reminderInfo }, [
            h('div', { style: S.reminderDatetime }, [h(Clock, { size: 13 }), ' Yesterday, 9:00 AM']),
          ]),
          h('span', { style: S.statusFired }, 'Fired'),
        ]),
        h('div', { style: S.addSection }, [
          h('div', { style: 'font-size:var(--text-xs);color:var(--text-tertiary);margin-bottom:var(--space-1_5)' }, 'Quick add:'),
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
