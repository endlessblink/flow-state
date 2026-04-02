import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'background:var(--bg-primary);min-height:600px;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden',
  header: 'display:flex;align-items:center;justify-content:space-between;padding:var(--space-4);border-bottom:1px solid var(--border-primary)',
  title: 'font-size:var(--text-lg);font-weight:600;color:var(--text-primary)',
  backBtn: 'padding:var(--space-1_5) var(--space-3_5);background:var(--glass-bg-soft);border:1px solid var(--border-primary);border-radius:var(--radius-md);color:var(--text-secondary);font-size:var(--text-meta);cursor:pointer',
  calendar: 'padding:var(--space-4)',
  timeGrid: 'display:flex;flex-direction:column;gap:0',
  timeRow: 'display:flex;min-height:48px;border-bottom:1px solid var(--border-primary)',
  timeLabel: 'width:60px;font-size:var(--text-xs);color:var(--text-tertiary);padding:var(--space-1) var(--space-2);flex-shrink:0;text-align:right',
  timeSlot: 'flex:1;position:relative',
  event: 'position:absolute;left:var(--space-1);right:var(--space-1);border-radius:var(--radius-md);padding:var(--space-1) var(--space-2);font-size:var(--text-xs);cursor:pointer',
  eventTask: 'background:var(--brand-primary-subtle);border-left:3px solid var(--brand-primary);color:var(--text-primary)',
  eventRecurring: 'background:var(--calendar-creating-bg);border-left:3px solid var(--color-focus);color:var(--text-primary)',
}

const meta: Meta = {
  title: '🖥️ Views/CalendarViewVueCal',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const DayView: Story = {
  render: () => ({
    setup() {
      const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00']
      return () => h('div', { style: S.wrapper }, [
        h('div', { style: S.header }, [
          h('h2', { style: S.title }, 'Vue-Cal Test Calendar'),
          h('button', { style: S.backBtn }, 'Back to Custom Calendar'),
        ]),
        h('div', { style: S.calendar }, [
          h('div', { style: S.timeGrid }, hours.map((hour, i) =>
            h('div', { style: S.timeRow }, [
              h('div', { style: S.timeLabel }, hour),
              h('div', { style: S.timeSlot }, [
                i === 1 ? h('div', { style: S.event + ';' + S.eventTask + ';top:0;height:90px' }, 'Design landing page') : null,
                i === 3 ? h('div', { style: S.event + ';' + S.eventRecurring + ';top:0;height:45px' }, 'Daily standup 🔄') : null,
                i === 5 ? h('div', { style: S.event + ';' + S.eventTask + ';top:0;height:135px' }, 'Code review session') : null,
              ]),
            ])
          )),
        ]),
      ])
    }
  }),
}
