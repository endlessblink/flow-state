import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import { Flag, Calendar, ListTodo } from 'lucide-vue-next'

/**
 * BoardView - Kanban Board
 *
 * Project-based Kanban board with multiple column layouts:
 * - Priority view: High/Medium/Low columns
 * - Date view: Overdue/Today/Tomorrow/This Week columns
 * - Status view: Planned/In Progress/Done columns
 *
 * **Features:**
 * - View type switcher (priority/date/status)
 * - Density control (comfortable/compact/ultrathin)
 * - Filter controls (project, smart view, status)
 * - Hide done tasks toggle
 * - Drag-drop tasks between columns
 * - Project swimlanes
 *
 * **Store Dependencies:**
 * - taskStore: Task data
 * - timerStore: Timer integration
 * - uiStore: UI state
 * - settingsStore: Board density
 */
const meta: Meta = {
  title: '✨ Views/BoardView',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `Kanban board with project swimlanes and multiple column layouts.

**View Types:**
- Priority: High/Medium/Low columns
- Date: Overdue/Today/Tomorrow/This Week
- Status: Planned/In Progress/Done

**Key Features:**
- Drag-drop between columns
- Project swimlanes
- Density control
- Filter controls
- Task counts per column

**Note:** Full drag-drop and store interaction requires real store setup.`
      }
    }
  }
}

export default meta
type Story = StoryObj

/**
 * Priority View - Default
 *
 * Shows the priority-based column layout.
 */
export const PriorityView: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Priority view with High/Medium/Low columns organized by project swimlanes.'
      }
    }
  },
  render: () => ({
    components: { Flag, Calendar, ListTodo },
    setup() {
      const viewType = ref('priority')
      return { viewType, Flag, Calendar, ListTodo }
    },
    template: `
      <div style="
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        background: var(--app-background-gradient);
        padding: var(--space-4);
      ">
        <!-- Header -->
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-4);
        ">
          <div style="display: flex; align-items: center; gap: var(--space-3);">
            <h2 style="
              font-size: var(--text-2xl);
              font-weight: var(--font-bold);
              color: var(--text-primary);
              margin: 0;
            ">Board</h2>
            <span style="
              font-size: var(--text-sm);
              color: var(--text-muted);
            ">12 tasks</span>
          </div>

          <div style="display: flex; gap: var(--space-2);">
            <!-- View Type Switcher -->
            <button style="
              padding: var(--space-2) var(--space-3);
              background: var(--glass-bg-medium);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-md);
              color: var(--text-primary);
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: var(--space-2);
            ">
              <Flag :size="16" />
              <span>Priority</span>
            </button>
            <button style="
              padding: var(--space-2) var(--space-3);
              background: transparent;
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-md);
              color: var(--text-secondary);
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: var(--space-2);
            ">
              <Calendar :size="16" />
              <span>Due Date</span>
            </button>
            <button style="
              padding: var(--space-2) var(--space-3);
              background: transparent;
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-md);
              color: var(--text-secondary);
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: var(--space-2);
            ">
              <ListTodo :size="16" />
              <span>Status</span>
            </button>
          </div>
        </div>

        <!-- Kanban Board -->
        <div style="
          flex: 1;
          overflow-x: auto;
          overflow-y: auto;
        ">
          <!-- Project Swimlane -->
          <div style="
            margin-bottom: var(--space-6);
          ">
            <!-- Project Header -->
            <div style="
              display: flex;
              align-items: center;
              gap: var(--space-2);
              margin-bottom: var(--space-3);
              padding: var(--space-2) var(--space-3);
              background: var(--glass-bg-soft);
              border-radius: var(--radius-md);
            ">
              <span style="
                width: 8px;
                height: 8px;
                background: #3b82f6;
                border-radius: var(--radius-full);
              "></span>
              <span style="
                font-size: var(--text-base);
                font-weight: var(--font-semibold);
                color: var(--text-primary);
              ">Work</span>
              <span style="
                font-size: var(--text-xs);
                color: var(--text-muted);
              ">(5 tasks)</span>
            </div>

            <!-- Columns -->
            <div style="
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: var(--space-4);
            ">
              <!-- High Priority Column -->
              <div style="
                background: var(--glass-bg-soft);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-lg);
                padding: var(--space-3);
                min-height: 200px;
              ">
                <div style="
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  margin-bottom: var(--space-3);
                ">
                  <h3 style="
                    font-size: var(--text-sm);
                    font-weight: var(--font-semibold);
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    margin: 0;
                  ">High Priority</h3>
                  <span style="
                    font-size: var(--text-xs);
                    color: var(--text-muted);
                  ">2</span>
                </div>

                <!-- Task Card -->
                <div style="
                  padding: var(--space-3);
                  background: var(--glass-bg-medium);
                  border: 1px solid var(--color-priority-high-border-medium);
                  border-radius: var(--radius-md);
                  margin-bottom: var(--space-2);
                  cursor: pointer;
                  transition: all var(--duration-fast);
                ">
                  <div style="
                    font-size: var(--text-sm);
                    color: var(--text-primary);
                    margin-bottom: var(--space-1);
                  ">Review Q4 marketing proposal</div>
                  <div style="display: flex; gap: var(--space-2); flex-wrap: wrap;">
                    <span style="
                      padding: var(--space-0_5) var(--space-1_5);
                      background: var(--danger-bg-subtle);
                      color: var(--color-danger);
                      border-radius: var(--radius-sm);
                      font-size: var(--text-xs);
                    ">HIGH</span>
                    <span style="
                      font-size: var(--text-xs);
                      color: var(--text-muted);
                    ">Due: Feb 15</span>
                  </div>
                </div>
              </div>

              <!-- Medium Priority Column -->
              <div style="
                background: var(--glass-bg-soft);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-lg);
                padding: var(--space-3);
                min-height: 200px;
              ">
                <div style="
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  margin-bottom: var(--space-3);
                ">
                  <h3 style="
                    font-size: var(--text-sm);
                    font-weight: var(--font-semibold);
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    margin: 0;
                  ">Medium Priority</h3>
                  <span style="
                    font-size: var(--text-xs);
                    color: var(--text-muted);
                  ">2</span>
                </div>

                <div style="
                  padding: var(--space-3);
                  background: var(--glass-bg-medium);
                  border: 1px solid var(--color-priority-medium-border-medium);
                  border-radius: var(--radius-md);
                  cursor: pointer;
                ">
                  <div style="
                    font-size: var(--text-sm);
                    color: var(--text-primary);
                    margin-bottom: var(--space-1);
                  ">Update team documentation</div>
                  <div style="display: flex; gap: var(--space-2); flex-wrap: wrap;">
                    <span style="
                      padding: var(--space-0_5) var(--space-1_5);
                      background: var(--color-warning-alpha-10);
                      color: var(--color-warning);
                      border-radius: var(--radius-sm);
                      font-size: var(--text-xs);
                    ">MEDIUM</span>
                  </div>
                </div>
              </div>

              <!-- Low Priority Column -->
              <div style="
                background: var(--glass-bg-soft);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-lg);
                padding: var(--space-3);
                min-height: 200px;
              ">
                <div style="
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  margin-bottom: var(--space-3);
                ">
                  <h3 style="
                    font-size: var(--text-sm);
                    font-weight: var(--font-semibold);
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    margin: 0;
                  ">Low Priority</h3>
                  <span style="
                    font-size: var(--text-xs);
                    color: var(--text-muted);
                  ">1</span>
                </div>

                <div style="
                  padding: var(--space-3);
                  background: var(--glass-bg-medium);
                  border: 1px solid var(--color-priority-low-border-medium);
                  border-radius: var(--radius-md);
                  cursor: pointer;
                ">
                  <div style="
                    font-size: var(--text-sm);
                    color: var(--text-primary);
                    margin-bottom: var(--space-1);
                  ">Schedule client call</div>
                  <div style="display: flex; gap: var(--space-2); flex-wrap: wrap;">
                    <span style="
                      padding: var(--space-0_5) var(--space-1_5);
                      background: var(--blue-bg-light);
                      color: var(--status-planned-text);
                      border-radius: var(--radius-sm);
                      font-size: var(--text-xs);
                    ">LOW</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  })
}
