import type { Meta, StoryObj } from '@storybook/vue3'

/**
 * CalendarView - Time-Block Scheduler
 *
 * Full-featured calendar with time block scheduling:
 * - Day view: 30-minute slots with drag-drop
 * - Week view: 7-day overview
 * - Month view: Monthly calendar grid
 *
 * **Features:**
 * - Drag-drop from inbox to calendar slots
 * - Resize time blocks
 * - Real-time timer growth visualization
 * - Current time indicator
 * - Quick task create via drag
 * - Context menu on events
 *
 * **Store Dependencies:**
 * - taskStore: Task data
 * - timerStore: Active timer integration
 * - uiStore: Sidebar visibility
 *
 * **Note:** CalendarView is highly complex with 30+ composables.
 * This story shows the visual layout structure.
 */
const meta: Meta = {
  title: '✨ Views/CalendarView',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `Time-block scheduler with day/week/month views.

**Key Features:**
- 30-minute time slot grid
- Drag-drop task scheduling
- Resize time blocks
- Current time indicator
- Timer growth visualization (TASK-1285)
- Unified inbox panel

**Architecture:**
- 30+ composables for calendar logic
- Real-time sync with timer store
- Complex drag-drop system
- Time slot calculations

**Note:** Full functionality requires complex store setup. This story demonstrates layout only.`
      }
    }
  }
}

export default meta
type Story = StoryObj

/**
 * Day View - Default
 *
 * Shows the day view layout with time slots.
 */
export const DayView: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Day view with 30-minute time slots and current time indicator.'
      }
    }
  },
  render: () => ({
    template: `
      <div style="
        display: flex;
        min-height: 100vh;
        background: var(--overlay-component-bg);
      ">
        <!-- Main Calendar Area -->
        <main style="
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        ">
          <!-- Calendar Header -->
          <header style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: var(--space-4) var(--space-6);
            border-bottom: 1px solid var(--border-subtle);
          ">
            <div style="display: flex; align-items: center; gap: var(--space-3);">
              <button style="
                padding: var(--space-2);
                background: var(--glass-bg-medium);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-md);
                color: var(--text-primary);
                cursor: pointer;
              ">&larr;</button>
              <h2 style="
                font-size: var(--text-xl);
                font-weight: var(--font-semibold);
                color: var(--text-primary);
                margin: 0;
              ">Today - Thursday, Feb 13</h2>
              <button style="
                padding: var(--space-2);
                background: var(--glass-bg-medium);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-md);
                color: var(--text-primary);
                cursor: pointer;
              ">&rarr;</button>
            </div>

            <div style="display: flex; gap: var(--space-2);">
              <button style="
                padding: var(--space-2) var(--space-3);
                background: var(--accent-primary);
                border: none;
                border-radius: var(--radius-md);
                color: white;
                font-size: var(--text-sm);
                font-weight: var(--font-medium);
                cursor: pointer;
              ">Today</button>
              <button style="
                padding: var(--space-2) var(--space-3);
                background: var(--glass-bg-medium);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-md);
                color: var(--text-secondary);
                cursor: pointer;
              ">Day</button>
              <button style="
                padding: var(--space-2) var(--space-3);
                background: transparent;
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-md);
                color: var(--text-secondary);
                cursor: pointer;
              ">Week</button>
              <button style="
                padding: var(--space-2) var(--space-3);
                background: transparent;
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-md);
                color: var(--text-secondary);
                cursor: pointer;
              ">Month</button>
            </div>
          </header>

          <!-- Calendar Grid -->
          <div style="
            flex: 1;
            overflow-y: auto;
            position: relative;
          ">
            <!-- Time Grid -->
            <div style="
              display: grid;
              grid-template-columns: 60px 1fr;
              gap: 0;
            ">
              <!-- Time Labels Column -->
              <div style="
                background: var(--surface-tertiary);
                border-right: 1px solid var(--border-subtle);
              ">
                <div
                  v-for="hour in 24"
                  :key="hour"
                  style="
                    height: 60px;
                    padding: var(--space-1);
                    font-size: var(--text-xs);
                    color: var(--text-muted);
                    border-bottom: 1px solid var(--glass-border-faint);
                    display: flex;
                    align-items: flex-start;
                    justify-content: flex-end;
                  "
                >
                  {{ hour }}:00
                </div>
              </div>

              <!-- Time Slots Column -->
              <div style="
                position: relative;
              ">
                <div
                  v-for="hour in 24"
                  :key="hour"
                  style="
                    height: 60px;
                    border-bottom: 1px solid var(--glass-border-faint);
                    position: relative;
                  "
                >
                  <!-- Example Task Block -->
                  <div
                    v-if="hour === 10"
                    style="
                      position: absolute;
                      top: 0;
                      left: 0;
                      right: 0;
                      height: 60px;
                      padding: var(--space-2);
                      background: var(--success-bg-light);
                      border: 1px solid var(--color-success);
                      border-radius: var(--radius-md);
                      margin: var(--space-1);
                      cursor: pointer;
                    "
                  >
                    <div style="
                      font-size: var(--text-sm);
                      font-weight: var(--font-medium);
                      color: var(--text-primary);
                    ">Team standup</div>
                    <div style="
                      font-size: var(--text-xs);
                      color: var(--text-muted);
                      margin-top: var(--space-0_5);
                    ">10:00 - 10:30</div>
                  </div>
                </div>

                <!-- Current Time Indicator -->
                <div style="
                  position: absolute;
                  top: 540px;
                  left: 0;
                  right: 0;
                  height: 2px;
                  background: var(--accent-primary);
                  z-index: 10;
                  box-shadow: 0 0 8px var(--accent-primary);
                ">
                  <div style="
                    position: absolute;
                    left: -6px;
                    top: -5px;
                    width: 12px;
                    height: 12px;
                    background: var(--accent-primary);
                    border-radius: var(--radius-full);
                  "></div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    `
  })
}
