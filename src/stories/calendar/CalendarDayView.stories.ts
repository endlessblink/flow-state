import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, computed } from 'vue'

/**
 * ## CalendarDayView
 *
 * Single-day calendar view with 30-minute time slots (30px each) and task
 * blocks positioned within them. Features a time labels column on the left,
 * current time indicator (red dot + line), drag ghost preview for inbox drops,
 * and resize handles on task blocks.
 *
 * Features:
 * - 30-minute granularity time slots
 * - Drag-and-drop tasks from inbox panel
 * - Drag ghost preview shows title + duration during drop
 * - Resize events from top (start time) or bottom (duration)
 * - Event hover shows play timer, status cycle, and remove buttons
 * - Project color stripe and priority indicator
 * - Current time red dot + line indicator
 * - Compact layout for short (<= 30min) tasks (single horizontal line)
 * - RTL text support (Hebrew/Arabic auto-detected)
 * - Timer-active amber glow pulse animation
 * - Done tasks shown with grayscale + strikethrough
 * - TransitionGroup entrance animation for task appearance
 *
 * **Location:** `src/components/calendar/CalendarDayView.vue`
 */
const CalendarDayViewMock = defineComponent({
  name: 'CalendarDayViewMock',
  props: {
    events: {
      type: Array as () => Array<{
        id: string
        title: string
        startHour: number
        startMinute: number
        duration: number
        color: string
        done?: boolean
        timerActive?: boolean
      }>,
      default: () => [],
    },
    showCurrentTime: {
      type: Boolean,
      default: true,
    },
  },
  setup() {
    const hours = Array.from({ length: 16 }, (_, i) => i + 6) // 6:00 - 21:00
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()

    const formatHour = (h: number) => {
      if (h === 0) return '12 AM'
      if (h < 12) return `${h} AM`
      if (h === 12) return '12 PM'
      return `${h - 12} PM`
    }

    const formatTime = (h: number, m: number) => {
      const period = h >= 12 ? 'PM' : 'AM'
      const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h
      return `${displayH}:${m.toString().padStart(2, '0')} ${period}`
    }

    const timeIndicatorTop = computed(() => {
      return ((currentHour - 6) * 60 + currentMinute) // 1px per minute (60px per hour / 2 slots per hour)
    })

    return { hours, formatHour, formatTime, currentHour, timeIndicatorTop }
  },
  template: `
    <div style="display: flex; flex-direction: column; height: 100%; min-height: 700px; background: var(--glass-bg-subtle);">
      <!-- Day Header -->
      <div style="padding: var(--space-3) var(--space-6); background: var(--glass-panel-bg); backdrop-filter: blur(8px); border-bottom: 1px solid var(--border-subtle); text-align: center;">
        <div style="font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em; margin-bottom: 2px;">
          {{ ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()] }}
        </div>
        <div style="font-size: var(--text-2xl); font-weight: 600; color: var(--text-primary);">
          {{ new Date().getDate() }}
        </div>
      </div>

      <!-- Grid Body -->
      <div style="flex: 1; display: grid; grid-template-columns: 80px 1fr; overflow-y: auto; position: relative;">
        <!-- Time Labels -->
        <div style="background: linear-gradient(135deg, var(--glass-bg-tint) 0%, var(--glass-bg-weak) 100%); backdrop-filter: blur(16px); border-right: 1px solid var(--glass-border-light); box-shadow: var(--shadow-xs);">
          <div
            v-for="hour in hours"
            :key="hour"
            style="height: 60px; display: flex; align-items: flex-start; justify-content: flex-end; padding-top: var(--space-1); padding-right: var(--space-3); color: var(--text-muted); font-size: var(--text-xs); font-weight: 500; border-bottom: 1px solid var(--glass-bg-tint);"
          >
            {{ formatHour(hour) }}
          </div>
        </div>

        <!-- Slots Container -->
        <div style="position: relative; background: linear-gradient(180deg, var(--glass-bg-subtle) 0%, transparent 100%); overflow-y: auto;">
          <!-- Current Time Indicator -->
          <div
            v-if="showCurrentTime"
            :style="{
              position: 'absolute',
              left: 0,
              right: 0,
              top: timeIndicatorTop + 'px',
              zIndex: 2,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
            }"
          >
            <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--color-danger); box-shadow: 0 0 4px var(--color-danger); flex-shrink: 0; margin-left: -4px;"></div>
            <div style="flex: 1; height: 2px; background: var(--color-danger); opacity: 0.7;"></div>
          </div>

          <!-- Time Slots (30min each) -->
          <div
            v-for="hour in hours"
            :key="'slots-' + hour"
          >
            <!-- First half hour -->
            <div
              :style="{
                height: '30px',
                borderBottom: '1px solid var(--glass-border-light)',
                position: 'relative',
                transition: 'background 150ms',
                background: (showCurrentTime && hour === currentHour) ? 'var(--color-danger-bg-subtle, rgba(239, 68, 68, 0.03))' : 'transparent',
              }"
            ></div>
            <!-- Second half hour -->
            <div
              :style="{
                height: '30px',
                borderBottom: '1px dashed var(--glass-border-faint)',
                position: 'relative',
                transition: 'background 150ms',
              }"
            ></div>
          </div>

          <!-- Events Layer -->
          <div
            v-for="ev in events"
            :key="ev.id"
            :style="{
              position: 'absolute',
              top: ((ev.startHour - 6) * 60 + ev.startMinute) + 'px',
              height: ev.duration + 'px',
              left: 'var(--space-1)',
              right: 'var(--space-1)',
              margin: 'var(--space-0_5) var(--space-1)',
              padding: ev.duration <= 30 ? 'var(--space-1) var(--space-2)' : 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              borderLeft: '4px solid ' + ev.color,
              background: 'var(--surface-tertiary)',
              color: 'var(--text-primary)',
              fontWeight: '500',
              boxShadow: ev.timerActive ? '0 0 12px rgba(245, 158, 11, 0.4), 0 0 4px rgba(245, 158, 11, 0.2)' : 'var(--shadow-sm)',
              cursor: 'grab',
              fontSize: 'var(--text-xs)',
              zIndex: 5,
              overflow: 'hidden',
              filter: ev.done ? 'grayscale(0.6) brightness(0.85)' : 'none',
              opacity: ev.done ? '0.65' : '1',
            }"
          >
            <!-- Priority stripe -->
            <div style="width: 2px; border-radius: 1px; height: calc(100% - 12px); position: absolute; left: 0; top: var(--space-1_5); background: var(--color-danger);"></div>

            <!-- Content -->
            <div
              v-if="ev.duration <= 30"
              style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); height: 100%;"
            >
              <div :style="{ flex: 1; minWidth: 0; fontWeight: '600'; whiteSpace: 'nowrap'; overflow: 'hidden'; textOverflow: 'ellipsis'; textDecoration: ev.done ? 'line-through' : 'none' }">
                {{ ev.title }}
              </div>
              <div style="flex-shrink: 0; font-size: var(--text-xs); color: var(--text-secondary); white-space: nowrap;">
                <span style="opacity: 0.8;">{{ formatTime(ev.startHour, ev.startMinute) }}</span>
                <span style="opacity: 0.5;"> · </span>
                <span style="font-weight: 500;">{{ ev.duration }}min</span>
              </div>
            </div>
            <div v-else style="display: flex; flex-direction: column; gap: var(--space-0_5); height: 100%; overflow: hidden;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-2);">
                <div :style="{ flex: 1; fontWeight: '600'; whiteSpace: 'nowrap'; overflow: 'hidden'; textOverflow: 'ellipsis'; textDecoration: ev.done ? 'line-through' : 'none' }">
                  {{ ev.title }}
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: var(--space-1); font-size: var(--text-xs); color: var(--text-secondary); white-space: nowrap;">
                <span style="opacity: 0.8;">{{ formatTime(ev.startHour, ev.startMinute) }}</span>
                <span style="opacity: 0.5;">·</span>
                <span style="font-weight: 500;">{{ ev.duration }}min</span>
              </div>
            </div>

            <!-- Resize handles (visual only) -->
            <div style="position: absolute; left: 0; right: 0; top: 0; height: 6px; cursor: ns-resize;"></div>
            <div style="position: absolute; left: 0; right: 0; bottom: 0; height: 6px; cursor: ns-resize;"></div>
          </div>
        </div>
      </div>
    </div>
  `,
})

const meta = {
  component: CalendarDayViewMock,
  title: '📅 Calendar/CalendarDayView',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof CalendarDayViewMock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    events: [
      { id: '1', title: 'Morning standup', startHour: 9, startMinute: 0, duration: 30, color: 'rgba(99, 102, 241, 0.85)' },
    ],
    showCurrentTime: true,
  },
}

export const BusyDay: Story = {
  args: {
    events: [
      { id: '1', title: 'Morning meditation', startHour: 7, startMinute: 0, duration: 30, color: 'rgba(168, 85, 247, 0.85)' },
      { id: '2', title: 'Team standup', startHour: 9, startMinute: 0, duration: 30, color: 'rgba(99, 102, 241, 0.85)' },
      { id: '3', title: 'Feature implementation', startHour: 9, startMinute: 30, duration: 120, color: 'rgba(34, 197, 94, 0.85)' },
      { id: '4', title: 'Lunch break', startHour: 12, startMinute: 0, duration: 60, color: 'rgba(245, 158, 11, 0.85)' },
      { id: '5', title: 'Design review', startHour: 13, startMinute: 30, duration: 60, color: 'rgba(236, 72, 153, 0.85)' },
      { id: '6', title: 'Code review', startHour: 15, startMinute: 0, duration: 45, color: 'rgba(14, 165, 233, 0.85)' },
      { id: '7', title: 'Sprint retrospective', startHour: 16, startMinute: 0, duration: 60, color: 'rgba(99, 102, 241, 0.85)' },
      { id: '8', title: 'Daily wrap-up', startHour: 17, startMinute: 30, duration: 30, color: 'rgba(168, 85, 247, 0.85)' },
    ],
    showCurrentTime: true,
  },
}

export const EmptyDay: Story = {
  args: {
    events: [],
    showCurrentTime: true,
  },
}

export const WithTimerActive: Story = {
  args: {
    events: [
      { id: '1', title: 'Focus session (timer running)', startHour: 10, startMinute: 0, duration: 90, color: 'rgba(245, 158, 11, 0.85)', timerActive: true },
      { id: '2', title: 'Upcoming meeting', startHour: 14, startMinute: 0, duration: 60, color: 'rgba(99, 102, 241, 0.85)' },
    ],
    showCurrentTime: true,
  },
}

export const WithDoneTasks: Story = {
  args: {
    events: [
      { id: '1', title: 'Completed standup', startHour: 9, startMinute: 0, duration: 30, color: 'rgba(99, 102, 241, 0.85)', done: true },
      { id: '2', title: 'Completed code review', startHour: 11, startMinute: 0, duration: 60, color: 'rgba(34, 197, 94, 0.85)', done: true },
      { id: '3', title: 'Active: sprint planning', startHour: 14, startMinute: 0, duration: 90, color: 'rgba(236, 72, 153, 0.85)' },
    ],
    showCurrentTime: true,
  },
}

export const CompactTasks: Story = {
  args: {
    events: [
      { id: '1', title: 'Quick sync', startHour: 9, startMinute: 0, duration: 15, color: 'rgba(99, 102, 241, 0.85)' },
      { id: '2', title: 'Standup', startHour: 9, startMinute: 30, duration: 15, color: 'rgba(34, 197, 94, 0.85)' },
      { id: '3', title: 'PR review', startHour: 10, startMinute: 0, duration: 30, color: 'rgba(245, 158, 11, 0.85)' },
      { id: '4', title: 'Deep work session - implementing new feature with complex requirements', startHour: 11, startMinute: 0, duration: 120, color: 'rgba(236, 72, 153, 0.85)' },
    ],
    showCurrentTime: true,
  },
}
