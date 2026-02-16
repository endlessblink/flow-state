import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, ref } from 'vue'

/**
 * ## CalendarMonthView
 *
 * Month grid calendar displaying tasks as colored event chips within day cells.
 * Uses a 7-column (Sun-Sat) grid with 5-6 rows of days. Each day cell shows
 * its day number and a scrollable list of task events with project color stripes,
 * priority indicators, status icons, and time labels.
 *
 * Features:
 * - Drag-and-drop events between days
 * - Click day to create new task
 * - Double-click event to edit
 * - Context menu on events
 * - Status cycling on click
 * - "Today" cell highlight with red badge
 * - Other-month days dimmed
 * - Timer-active event glow
 * - Done tasks shown with grayscale + strikethrough
 *
 * **Location:** `src/components/calendar/CalendarMonthView.vue`
 */
const CalendarMonthViewMock = defineComponent({
  name: 'CalendarMonthViewMock',
  props: {
    events: {
      type: Array as () => Array<{ id: string; title: string; time: string; color: string; done?: boolean }>,
      default: () => [],
    },
    highlightToday: {
      type: Boolean,
      default: true,
    },
  },
  setup(props) {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth()

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    const firstDay = new Date(year, month, 1)
    const startOffset = firstDay.getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()

    const days = ref<Array<{ dayNumber: number; isCurrentMonth: boolean; isToday: boolean; events: typeof props.events }>>([])

    const totalCells = 42 // 6 rows * 7 columns
    const builtDays: typeof days.value = []

    // Previous month trailing days
    for (let i = startOffset - 1; i >= 0; i--) {
      builtDays.push({
        dayNumber: daysInPrevMonth - i,
        isCurrentMonth: false,
        isToday: false,
        events: [],
      })
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = props.highlightToday && d === today.getDate()
      builtDays.push({
        dayNumber: d,
        isCurrentMonth: true,
        isToday,
        events: d === today.getDate() ? props.events : (d % 5 === 0 ? props.events.slice(0, 1) : []),
      })
    }

    // Next month leading days
    let nextDay = 1
    while (builtDays.length < totalCells) {
      builtDays.push({
        dayNumber: nextDay++,
        isCurrentMonth: false,
        isToday: false,
        events: [],
      })
    }

    days.value = builtDays

    return { days, daysOfWeek }
  },
  template: `
    <div style="display: flex; flex-direction: column; height: 100%; min-height: 600px; background: var(--glass-bg-subtle);">
      <!-- Day Headers -->
      <div style="display: grid; grid-template-columns: repeat(7, 1fr); border-bottom: 1px solid var(--border-subtle); background: var(--glass-panel-bg); backdrop-filter: blur(8px);">
        <div
          v-for="day in daysOfWeek"
          :key="day"
          style="padding: var(--space-2) var(--space-3); text-align: center; font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em;"
        >
          {{ day }}
        </div>
      </div>

      <!-- Month Grid -->
      <div style="flex: 1; display: grid; grid-template-columns: repeat(7, 1fr); grid-template-rows: repeat(6, 1fr); gap: 1px; background: var(--border-faint); overflow-y: auto;">
        <div
          v-for="(day, idx) in days"
          :key="idx"
          :style="{
            background: day.isToday ? 'var(--danger-bg-subtle)' : day.isCurrentMonth ? 'var(--glass-panel-bg)' : 'var(--glass-bg-tint)',
            opacity: day.isCurrentMonth ? '1' : '0.6',
            minHeight: '90px',
            padding: 'var(--space-2)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1)',
            cursor: 'pointer',
            transition: 'background 150ms',
          }"
        >
          <!-- Day Number -->
          <div style="display: flex; justify-content: flex-end;">
            <span
              :style="{
                fontSize: 'var(--text-sm)',
                fontWeight: '600',
                color: day.isToday ? 'white' : 'var(--text-muted)',
                background: day.isToday ? 'var(--color-danger)' : 'transparent',
                width: day.isToday ? '24px' : 'auto',
                height: day.isToday ? '24px' : 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
              }"
            >
              {{ day.dayNumber }}
            </span>
          </div>

          <!-- Events -->
          <div style="display: flex; flex-direction: column; gap: 2px; flex: 1; overflow-y: auto;">
            <div
              v-for="ev in day.events"
              :key="ev.id"
              :style="{
                padding: 'var(--space-0_5) var(--space-1)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-xs)',
                color: 'white',
                backgroundColor: ev.color,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                cursor: 'grab',
                position: 'relative',
                paddingLeft: 'var(--space-2_5)',
                filter: ev.done ? 'grayscale(0.6) brightness(0.85)' : 'none',
                opacity: ev.done ? '0.65' : '1',
                textDecoration: ev.done ? 'line-through' : 'none',
              }"
            >
              <!-- Priority stripe -->
              <div style="width: 2px; height: calc(100% - 6px); border-radius: 1px; position: absolute; left: 0; top: 3px; background: var(--color-danger);"></div>
              <span style="font-weight: 700; opacity: 0.9;">{{ ev.time }}</span>
              <span style="overflow: hidden; text-overflow: ellipsis;">{{ ev.done ? '✅' : '⬜' }} {{ ev.title }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})

const meta = {
  component: CalendarMonthViewMock,
  title: '📅 Calendar/CalendarMonthView',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `Month grid calendar displaying tasks as colored event chips within day cells.

**Features:**
- 7-column (Sun–Sat) grid with 5–6 rows
- Drag-and-drop events between days
- "Today" cell highlight with red badge
- Other-month days dimmed
- Done tasks shown with grayscale + strikethrough
- Timer-active event glow`
      }
    }
  },
} satisfies Meta<typeof CalendarMonthViewMock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    events: [
      { id: '1', title: 'Team standup', time: '9:00', color: 'var(--brand-primary)' },
    ],
    highlightToday: true,
  },
}

export const WithEvents: Story = {
  args: {
    events: [
      { id: '1', title: 'Team standup', time: '9:00', color: 'var(--brand-primary)' },
      { id: '2', title: 'Design review', time: '11:00', color: 'var(--color-danger)' },
      { id: '3', title: 'Sprint planning', time: '14:00', color: 'var(--color-work)' },
      { id: '4', title: 'Code review', time: '16:30', color: 'var(--color-warning)' },
    ],
    highlightToday: true,
  },
}

export const EmptyMonth: Story = {
  args: {
    events: [],
    highlightToday: true,
  },
}

export const WithDoneTasks: Story = {
  args: {
    events: [
      { id: '1', title: 'Completed task', time: '9:00', color: 'var(--brand-primary)', done: true },
      { id: '2', title: 'Active task', time: '14:00', color: 'var(--color-work)', done: false },
    ],
    highlightToday: true,
  },
}
