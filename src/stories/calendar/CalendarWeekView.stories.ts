import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, computed } from 'vue'

/**
 * ## CalendarWeekView
 *
 * Week view calendar with 7 day columns and hourly time slots (60px per hour).
 * Task events are positioned absolutely over the time grid, spanning their
 * scheduled duration. Features a sticky day header with day name and date,
 * time labels column on the left, and a current-time indicator.
 *
 * Features:
 * - Drag-and-drop events between days and time slots
 * - Resize events from top (start time) or bottom (end time)
 * - Event hover shows play timer, status cycle, and remove buttons
 * - Project color stripe and priority indicator on each event
 * - Current time cell highlighted with red bottom border
 * - Timer-active event glow
 * - Done tasks shown with grayscale + strikethrough
 *
 * **Location:** `src/components/calendar/CalendarWeekView.vue`
 */
const CalendarWeekViewMock = defineComponent({
  name: 'CalendarWeekViewMock',
  props: {
    events: {
      type: Array as () => Array<{
        id: string
        title: string
        dayIndex: number
        startHour: number
        duration: number
        color: string
        done?: boolean
      }>,
      default: () => [],
    },
    showCurrentTime: {
      type: Boolean,
      default: true,
    },
  },
  setup(props) {
    const today = new Date()
    const dayOfWeek = today.getDay()

    const weekDays = computed(() => {
      const names = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
      const result = []
      for (let i = 0; i < 7; i++) {
        const date = new Date(today)
        date.setDate(today.getDate() - dayOfWeek + i)
        result.push({
          name: names[i],
          date: date.getDate(),
          isToday: i === dayOfWeek,
        })
      }
      return result
    })

    const hours = Array.from({ length: 14 }, (_, i) => i + 7) // 7:00 - 20:00

    const formatHour = (h: number) => {
      if (h === 0) return '12 AM'
      if (h < 12) return `${h} AM`
      if (h === 12) return '12 PM'
      return `${h - 12} PM`
    }

    return { weekDays, hours, formatHour }
  },
  template: `
    <div style="display: flex; flex-direction: column; height: 100%; min-height: 700px; background: var(--glass-bg-subtle);">
      <!-- Week Header -->
      <div style="display: grid; grid-template-columns: 80px repeat(7, 1fr); background: var(--glass-panel-bg); backdrop-filter: blur(8px); border-bottom: 1px solid var(--border-subtle); position: sticky; top: 0; z-index: 20;">
        <!-- Time gutter -->
        <div style="padding: var(--space-2) var(--space-4);"></div>
        <!-- Day headers -->
        <div
          v-for="(day, i) in weekDays"
          :key="i"
          style="padding: var(--space-3) var(--space-2); text-align: center; border-left: 1px solid var(--border-subtle);"
        >
          <div style="font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 2px;">
            {{ day.name }}
          </div>
          <div
            :style="{
              fontSize: 'var(--text-lg)',
              fontWeight: '600',
              color: day.isToday ? 'white' : 'var(--text-primary)',
              background: day.isToday ? 'var(--color-danger)' : 'transparent',
              width: day.isToday ? '32px' : 'auto',
              height: day.isToday ? '32px' : 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
            }"
          >
            {{ day.date }}
          </div>
        </div>
      </div>

      <!-- Grid Body -->
      <div style="flex: 1; display: grid; grid-template-columns: 80px 1fr; overflow-y: auto; position: relative;">
        <!-- Time Labels -->
        <div style="background: var(--glass-bg-subtle); border-right: 1px solid var(--border-subtle);">
          <div
            v-for="hour in hours"
            :key="hour"
            style="height: 60px; display: flex; align-items: center; justify-content: flex-end; padding-right: var(--space-4); color: var(--text-muted); font-size: var(--text-xs); border-bottom: 1px solid var(--border-subtle);"
          >
            {{ formatHour(hour) }}
          </div>
        </div>

        <!-- Day Columns with Events -->
        <div style="position: relative;">
          <!-- Background grid -->
          <div style="display: grid; grid-template-columns: repeat(7, 1fr); height: 100%;">
            <div
              v-for="(day, di) in weekDays"
              :key="'col-' + di"
              style="border-left: 1px solid var(--border-subtle);"
            >
              <div
                v-for="hour in hours"
                :key="'cell-' + di + '-' + hour"
                :style="{
                  height: '60px',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: (showCurrentTime && day.isToday && hour === new Date().getHours()) ? 'var(--danger-bg-subtle)' : 'transparent',
                  boxShadow: (showCurrentTime && day.isToday && hour === new Date().getHours()) ? 'inset 0 -2px 0 var(--color-danger)' : 'none',
                }"
              ></div>
            </div>
          </div>

          <!-- Events Layer -->
          <div style="position: absolute; top: 0; left: 0; right: 0; height: 100%; pointer-events: none; display: grid; grid-template-columns: repeat(7, 1fr);">
            <div
              v-for="ev in events"
              :key="ev.id"
              :style="{
                position: 'absolute',
                top: ((ev.startHour - 7) * 60) + 'px',
                height: ev.duration + 'px',
                left: 'calc(' + (ev.dayIndex * 100 / 7) + '% + var(--space-1))',
                width: 'calc(' + (100 / 7) + '% - var(--space-2))',
                background: 'var(--surface-tertiary)',
                borderLeft: '3px solid ' + ev.color,
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-1) var(--space-2)',
                fontSize: 'var(--text-xs)',
                boxShadow: 'var(--shadow-sm)',
                pointerEvents: 'auto',
                cursor: 'grab',
                zIndex: 10,
                overflow: 'hidden',
                filter: ev.done ? 'grayscale(0.6) brightness(0.85)' : 'none',
                opacity: ev.done ? '0.65' : '1',
              }"
            >
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div :style="{ fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: ev.done ? 'line-through' : 'none', color: 'var(--text-primary)' }">
                  {{ ev.title }}
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: var(--space-1); font-size: var(--text-xs); color: var(--text-muted); white-space: nowrap; margin-top: 2px;">
                <span style="opacity: 0.8;">{{ formatHour(ev.startHour) }}</span>
                <span style="opacity: 0.5;">·</span>
                <span style="font-weight: 500;">{{ ev.duration }}min</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})

const meta = {
  component: CalendarWeekViewMock,
  title: '📅 Calendar/CalendarWeekView',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `Week view calendar with 7 day columns and hourly time slots.\n\n**Features:**\n- 7-column (Sun–Sat) grid with hourly rows\n- Drag-and-drop events between days and time slots\n- Resize events from top or bottom edge\n- Current time cell highlighted with red indicator\n- Timer-active event glow\n- Done tasks shown with grayscale + strikethrough`
      }
    }
  },
} satisfies Meta<typeof CalendarWeekViewMock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    events: [
      { id: '1', title: 'Team standup', dayIndex: 1, startHour: 9, duration: 60, color: 'var(--brand-primary)' },
    ],
    showCurrentTime: true,
  },
}

export const WithEvents: Story = {
  args: {
    events: [
      { id: '1', title: 'Team standup', dayIndex: 1, startHour: 9, duration: 30, color: 'var(--brand-primary)' },
      { id: '2', title: 'Design review', dayIndex: 1, startHour: 11, duration: 60, color: 'var(--color-danger)' },
      { id: '3', title: 'Sprint planning', dayIndex: 2, startHour: 14, duration: 90, color: 'var(--color-work)' },
      { id: '4', title: 'Code review', dayIndex: 3, startHour: 10, duration: 45, color: 'var(--color-warning)' },
      { id: '5', title: '1:1 with manager', dayIndex: 4, startHour: 15, duration: 30, color: 'var(--color-focus)' },
      { id: '6', title: 'Deep work block', dayIndex: 5, startHour: 9, duration: 120, color: 'var(--color-info)' },
    ],
    showCurrentTime: true,
  },
}

export const CurrentWeek: Story = {
  args: {
    events: [
      { id: '1', title: 'Morning routine', dayIndex: new Date().getDay(), startHour: 8, duration: 60, color: 'var(--color-work)' },
      { id: '2', title: 'Focus session', dayIndex: new Date().getDay(), startHour: 10, duration: 90, color: 'var(--brand-primary)' },
      { id: '3', title: 'Lunch break', dayIndex: new Date().getDay(), startHour: 12, duration: 60, color: 'var(--color-warning)' },
      { id: '4', title: 'Afternoon review', dayIndex: new Date().getDay(), startHour: 15, duration: 45, color: 'var(--color-danger)' },
    ],
    showCurrentTime: true,
  },
}

export const WithDoneTasks: Story = {
  args: {
    events: [
      { id: '1', title: 'Completed standup', dayIndex: 1, startHour: 9, duration: 30, color: 'var(--brand-primary)', done: true },
      { id: '2', title: 'Active design work', dayIndex: 2, startHour: 11, duration: 90, color: 'var(--color-work)', done: false },
      { id: '3', title: 'Finished code review', dayIndex: 3, startHour: 14, duration: 45, color: 'var(--color-warning)', done: true },
    ],
    showCurrentTime: true,
  },
}
