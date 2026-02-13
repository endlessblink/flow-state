import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { List, Table2 } from 'lucide-vue-next'

/**
 * AllTasksView - Task Catalog with List/Table Views
 *
 * A comprehensive task catalog view with switchable display modes:
 * - List mode: Hierarchical task list with drag-drop
 * - Table mode: Dense table view with inline editing
 *
 * **Features:**
 * - View type switcher (list/table)
 * - Density control (comfortable/compact/ultrathin)
 * - Sort by date/priority/title/created
 * - Status filter
 * - Hide done tasks toggle
 * - Expand/collapse all
 *
 * **Store Dependencies:**
 * - taskStore: Task data and filtering
 * - timerStore: Timer integration for tasks
 */
const meta: Meta = {
  title: '✨ Views/AllTasksView',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `Task catalog with list and table view modes.

**View Modes:**
- List: Hierarchical task list with subtasks
- Table: Dense spreadsheet-style view

**Controls:**
- View type (list/table)
- Density (comfortable/compact/ultrathin)
- Sort options (due date, priority, title, created)
- Status filter
- Hide done tasks toggle

**Note:** This story shows the layout structure. Full functionality requires store setup.`
      }
    }
  }
}

export default meta
type Story = StoryObj

function setupMockStores() {
  const pinia = createPinia()
  setActivePinia(pinia)
}

/**
 * List View - Default
 *
 * Shows the hierarchical list mode with tasks.
 */
export const ListMode: Story = {
  parameters: {
    docs: {
      description: {
        story: 'List mode with hierarchical task display.'
      }
    }
  },
  render: () => ({
    components: { List, Table2 },
    setup() {
      setupMockStores()
      const viewType = ref('list')
      const mockTasks = [
        { id: '1', title: 'Review Q4 marketing proposal', status: 'in_progress', priority: 'high' },
        { id: '2', title: 'Update team documentation', status: 'planned', priority: 'medium' },
        { id: '3', title: 'Schedule client call', status: 'done', priority: 'low' }
      ]
      return { viewType, mockTasks }
    },
    template: `
      <div style="
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        background: var(--app-background-gradient);
        padding: var(--space-6);
      ">
        <!-- View Controls -->
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-4);
          padding: var(--space-3);
          background: var(--glass-bg-medium);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
        ">
          <div style="display: flex; gap: var(--space-2);">
            <!-- View Type Switcher -->
            <button
              :class="{ active: viewType === 'list' }"
              @click="viewType = 'list'"
              style="
                padding: var(--space-2) var(--space-3);
                background: var(--glass-bg-light);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-md);
                color: var(--text-secondary);
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: var(--space-2);
              "
            >
              <List :size="16" />
              <span>List</span>
            </button>
            <button
              :class="{ active: viewType === 'table' }"
              @click="viewType = 'table'"
              style="
                padding: var(--space-2) var(--space-3);
                background: transparent;
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-md);
                color: var(--text-secondary);
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: var(--space-2);
              "
            >
              <Table2 :size="16" />
              <span>Table</span>
            </button>
          </div>

          <div style="display: flex; gap: var(--space-2); align-items: center;">
            <span style="font-size: var(--text-sm); color: var(--text-muted);">Sort by:</span>
            <select style="
              padding: var(--space-1_5) var(--space-2);
              background: var(--glass-bg-medium);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-md);
              color: var(--text-primary);
              font-size: var(--text-sm);
            ">
              <option>Due Date</option>
              <option>Priority</option>
              <option>Title</option>
              <option>Created</option>
            </select>
          </div>
        </div>

        <!-- Task List -->
        <div style="
          flex: 1;
          overflow-y: auto;
        ">
          <div
            v-for="task in mockTasks"
            :key="task.id"
            style="
              padding: var(--space-3) var(--space-4);
              background: var(--glass-bg-soft);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-lg);
              margin-bottom: var(--space-2);
              cursor: pointer;
              transition: all var(--duration-fast);
            "
          >
            <div style="display: flex; align-items: center; gap: var(--space-3);">
              <input type="checkbox" :checked="task.status === 'done'" />
              <span style="
                flex: 1;
                font-size: var(--text-base);
                color: var(--text-primary);
              ">{{ task.title }}</span>
              <span style="
                padding: var(--space-0_5) var(--space-2);
                background: var(--color-priority-{{ task.priority }}-bg-subtle);
                color: var(--color-priority-{{ task.priority }});
                border-radius: var(--radius-sm);
                font-size: var(--text-xs);
                text-transform: uppercase;
              ">{{ task.priority }}</span>
            </div>
          </div>
        </div>
      </div>
    `
  })
}

/**
 * Table View
 *
 * Shows the dense table mode.
 */
export const TableMode: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Table mode with dense spreadsheet-style layout.'
      }
    }
  },
  render: () => ({
    setup() {
      const mockTasks = [
        { id: '1', title: 'Review Q4 marketing proposal', status: 'in_progress', priority: 'high', dueDate: '2026-02-15' },
        { id: '2', title: 'Update team documentation', status: 'planned', priority: 'medium', dueDate: '2026-02-20' },
        { id: '3', title: 'Schedule client call', status: 'done', priority: 'low', dueDate: '2026-02-10' }
      ]
      return { mockTasks }
    },
    template: `
      <div style="
        min-height: 100vh;
        background: var(--app-background-gradient);
        padding: var(--space-6);
      ">
        <div style="
          background: var(--glass-bg-soft);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          overflow: hidden;
        ">
          <table style="
            width: 100%;
            border-collapse: collapse;
          ">
            <thead>
              <tr style="
                background: var(--glass-bg-medium);
                border-bottom: 1px solid var(--glass-border);
              ">
                <th style="padding: var(--space-3); text-align: left; font-size: var(--text-sm); color: var(--text-secondary); font-weight: var(--font-semibold);">Task</th>
                <th style="padding: var(--space-3); text-align: left; font-size: var(--text-sm); color: var(--text-secondary); font-weight: var(--font-semibold);">Status</th>
                <th style="padding: var(--space-3); text-align: left; font-size: var(--text-sm); color: var(--text-secondary); font-weight: var(--font-semibold);">Priority</th>
                <th style="padding: var(--space-3); text-align: left; font-size: var(--text-sm); color: var(--text-secondary); font-weight: var(--font-semibold);">Due Date</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="task in mockTasks"
                :key="task.id"
                style="
                  border-bottom: 1px solid var(--glass-border-faint);
                  transition: background var(--duration-fast);
                "
              >
                <td style="padding: var(--space-3); font-size: var(--text-sm); color: var(--text-primary);">
                  {{ task.title }}
                </td>
                <td style="padding: var(--space-3);">
                  <span style="
                    padding: var(--space-0_5) var(--space-2);
                    background: var(--status-{{ task.status }}-bg-subtle);
                    color: var(--status-{{ task.status }}-text);
                    border-radius: var(--radius-sm);
                    font-size: var(--text-xs);
                  ">{{ task.status }}</span>
                </td>
                <td style="padding: var(--space-3);">
                  <span style="
                    padding: var(--space-0_5) var(--space-2);
                    background: var(--color-priority-{{ task.priority }}-bg-subtle);
                    color: var(--color-priority-{{ task.priority }});
                    border-radius: var(--radius-sm);
                    font-size: var(--text-xs);
                  ">{{ task.priority }}</span>
                </td>
                <td style="padding: var(--space-3); font-size: var(--text-sm); color: var(--text-muted);">
                  {{ task.dueDate }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `
  })
}
