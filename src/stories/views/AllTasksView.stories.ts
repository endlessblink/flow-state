import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
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

// All styles as single-line strings — multiline breaks Storybook rendering
const S = {
  root: 'display:flex; flex-direction:column; min-height:100vh; background:var(--app-background-gradient); padding:var(--space-6);',
  rootTable: 'min-height:100vh; background:var(--app-background-gradient); padding:var(--space-6);',
  controlBar: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-4); padding:var(--space-3); background:var(--glass-bg-medium); border:1px solid var(--glass-border); border-radius:var(--radius-lg);',
  viewBtnGroup: 'display:flex; gap:var(--space-2);',
  viewBtnActive: 'padding:var(--space-2) var(--space-3); background:var(--glass-bg-light); border:1px solid var(--glass-border); border-radius:var(--radius-md); color:var(--text-secondary); cursor:pointer; display:flex; align-items:center; gap:var(--space-2);',
  viewBtn: 'padding:var(--space-2) var(--space-3); background:transparent; border:1px solid var(--glass-border); border-radius:var(--radius-md); color:var(--text-secondary); cursor:pointer; display:flex; align-items:center; gap:var(--space-2);',
  sortGroup: 'display:flex; gap:var(--space-2); align-items:center;',
  sortLabel: 'font-size:var(--text-sm); color:var(--text-muted);',
  sortSelect: 'padding:var(--space-1_5) var(--space-2); background:var(--glass-bg-medium); border:1px solid var(--glass-border); border-radius:var(--radius-md); color:var(--text-primary); font-size:var(--text-sm);',
  listScroll: 'flex:1; overflow-y:auto;',
  taskRow: 'padding:var(--space-3) var(--space-4); background:var(--glass-bg-soft); border:1px solid var(--glass-border); border-radius:var(--radius-lg); margin-bottom:var(--space-2); cursor:pointer; transition:all var(--duration-fast);',
  taskRowInner: 'display:flex; align-items:center; gap:var(--space-3);',
  taskTitle: 'flex:1; font-size:var(--text-base); color:var(--text-primary);',
  priorityHigh: 'padding:var(--space-0_5) var(--space-2); background:var(--danger-bg-subtle); color:var(--color-danger); border-radius:var(--radius-sm); font-size:var(--text-xs); text-transform:uppercase;',
  priorityMedium: 'padding:var(--space-0_5) var(--space-2); background:var(--color-warning-alpha-10); color:var(--color-warning); border-radius:var(--radius-sm); font-size:var(--text-xs); text-transform:uppercase;',
  priorityLow: 'padding:var(--space-0_5) var(--space-2); background:var(--blue-bg-light); color:var(--status-planned-text); border-radius:var(--radius-sm); font-size:var(--text-xs); text-transform:uppercase;',
  tableWrap: 'background:var(--glass-bg-soft); border:1px solid var(--glass-border); border-radius:var(--radius-lg); overflow:hidden;',
  table: 'width:100%; border-collapse:collapse;',
  thead: 'background:var(--glass-bg-medium); border-bottom:1px solid var(--glass-border);',
  th: 'padding:var(--space-3); text-align:left; font-size:var(--text-sm); color:var(--text-secondary); font-weight:var(--font-semibold);',
  tr: 'border-bottom:1px solid var(--glass-border-faint); transition:background var(--duration-fast);',
  td: 'padding:var(--space-3); font-size:var(--text-sm); color:var(--text-primary);',
  tdMuted: 'padding:var(--space-3); font-size:var(--text-sm); color:var(--text-muted);',
  statusPlanned: 'padding:var(--space-0_5) var(--space-2); background:var(--glass-bg-medium); color:var(--text-secondary); border-radius:var(--radius-sm); font-size:var(--text-xs);',
  statusProgress: 'padding:var(--space-0_5) var(--space-2); background:var(--color-warning-alpha-10); color:var(--color-warning); border-radius:var(--radius-sm); font-size:var(--text-xs);',
  statusDone: 'padding:var(--space-0_5) var(--space-2); background:var(--success-bg-light); color:var(--color-success); border-radius:var(--radius-sm); font-size:var(--text-xs);',
}

// Priority style map for dynamic lookup
const priorityStyleMap: Record<string, string> = {
  high: S.priorityHigh,
  medium: S.priorityMedium,
  low: S.priorityLow,
}

// Status style map for dynamic lookup
const statusStyleMap: Record<string, string> = {
  planned: S.statusPlanned,
  in_progress: S.statusProgress,
  done: S.statusDone,
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
      const mockTasks = [
        { id: '1', title: 'Review Q4 marketing proposal', status: 'in_progress', priority: 'high' },
        { id: '2', title: 'Update team documentation', status: 'planned', priority: 'medium' },
        { id: '3', title: 'Schedule client call', status: 'done', priority: 'low' }
      ]
      return { S, mockTasks, priorityStyleMap }
    },
    template: `
      <div :style="S.root">
        <div :style="S.controlBar">
          <div :style="S.viewBtnGroup">
            <button :style="S.viewBtnActive"><List :size="16" /><span>List</span></button>
            <button :style="S.viewBtn"><Table2 :size="16" /><span>Table</span></button>
          </div>
          <div :style="S.sortGroup">
            <span :style="S.sortLabel">Sort by:</span>
            <select :style="S.sortSelect">
              <option>Due Date</option>
              <option>Priority</option>
              <option>Title</option>
              <option>Created</option>
            </select>
          </div>
        </div>
        <div :style="S.listScroll">
          <div v-for="task in mockTasks" :key="task.id" :style="S.taskRow">
            <div :style="S.taskRowInner">
              <input type="checkbox" :checked="task.status === 'done'" />
              <span :style="S.taskTitle">{{ task.title }}</span>
              <span :style="priorityStyleMap[task.priority]">{{ task.priority }}</span>
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
      return { S, mockTasks, priorityStyleMap, statusStyleMap }
    },
    template: `
      <div :style="S.rootTable">
        <div :style="S.tableWrap">
          <table :style="S.table">
            <thead :style="S.thead">
              <tr>
                <th :style="S.th">Task</th>
                <th :style="S.th">Status</th>
                <th :style="S.th">Priority</th>
                <th :style="S.th">Due Date</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="task in mockTasks" :key="task.id" :style="S.tr">
                <td :style="S.td">{{ task.title }}</td>
                <td :style="S.td"><span :style="statusStyleMap[task.status]">{{ task.status }}</span></td>
                <td :style="S.td"><span :style="priorityStyleMap[task.priority]">{{ task.priority }}</span></td>
                <td :style="S.tdMuted">{{ task.dueDate }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `
  })
}
