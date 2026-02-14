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

// All styles as single-line strings — multiline breaks Storybook rendering
const S = {
  root: 'display:flex; flex-direction:column; min-height:100vh; background:var(--app-background-gradient); padding:var(--space-4);',
  headerRow: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-4);',
  titleGroup: 'display:flex; align-items:center; gap:var(--space-3);',
  title: 'font-size:var(--text-2xl); font-weight:var(--font-bold); color:var(--text-primary); margin:0;',
  taskCount: 'font-size:var(--text-sm); color:var(--text-muted);',
  viewBtnGroup: 'display:flex; gap:var(--space-2);',
  viewBtnActive: 'padding:var(--space-2) var(--space-3); background:var(--glass-bg-medium); border:1px solid var(--glass-border); border-radius:var(--radius-md); color:var(--text-primary); cursor:pointer; display:flex; align-items:center; gap:var(--space-2);',
  viewBtn: 'padding:var(--space-2) var(--space-3); background:transparent; border:1px solid var(--glass-border); border-radius:var(--radius-md); color:var(--text-secondary); cursor:pointer; display:flex; align-items:center; gap:var(--space-2);',
  boardScroll: 'flex:1; overflow-x:auto; overflow-y:auto;',
  swimlane: 'margin-bottom:var(--space-6);',
  projectHeader: 'display:flex; align-items:center; gap:var(--space-2); margin-bottom:var(--space-3); padding:var(--space-2) var(--space-3); background:var(--glass-bg-soft); border-radius:var(--radius-md);',
  projectDot: 'width:8px; height:8px; background:var(--color-indigo); border-radius:var(--radius-full);',
  projectName: 'font-size:var(--text-base); font-weight:var(--font-semibold); color:var(--text-primary);',
  projectCount: 'font-size:var(--text-xs); color:var(--text-muted);',
  columnsGrid: 'display:grid; grid-template-columns:repeat(3, 1fr); gap:var(--space-4);',
  column: 'background:var(--glass-bg-soft); border:1px solid var(--glass-border); border-radius:var(--radius-lg); padding:var(--space-3); min-height:200px;',
  colHeaderRow: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-3);',
  colTitle: 'font-size:var(--text-sm); font-weight:var(--font-semibold); color:var(--text-secondary); text-transform:uppercase; margin:0;',
  colCount: 'font-size:var(--text-xs); color:var(--text-muted);',
  card: 'padding:var(--space-3); background:var(--glass-bg-medium); border:1px solid var(--glass-border); border-radius:var(--radius-md); margin-bottom:var(--space-2); cursor:pointer; transition:all var(--duration-fast);',
  cardHigh: 'padding:var(--space-3); background:var(--glass-bg-medium); border:1px solid var(--color-priority-high-border-medium); border-radius:var(--radius-md); margin-bottom:var(--space-2); cursor:pointer; transition:all var(--duration-fast);',
  cardMedium: 'padding:var(--space-3); background:var(--glass-bg-medium); border:1px solid var(--color-priority-medium-border-medium); border-radius:var(--radius-md); cursor:pointer;',
  cardLow: 'padding:var(--space-3); background:var(--glass-bg-medium); border:1px solid var(--color-priority-low-border-medium); border-radius:var(--radius-md); cursor:pointer;',
  cardTitle: 'font-size:var(--text-sm); color:var(--text-primary); margin-bottom:var(--space-1);',
  tagRow: 'display:flex; gap:var(--space-2); flex-wrap:wrap;',
  high: 'padding:var(--space-0_5) var(--space-1_5); background:var(--danger-bg-subtle); color:var(--color-danger); border-radius:var(--radius-sm); font-size:var(--text-xs);',
  medium: 'padding:var(--space-0_5) var(--space-1_5); background:var(--color-warning-alpha-10); color:var(--color-warning); border-radius:var(--radius-sm); font-size:var(--text-xs);',
  low: 'padding:var(--space-0_5) var(--space-1_5); background:var(--blue-bg-light); color:var(--status-planned-text); border-radius:var(--radius-sm); font-size:var(--text-xs);',
  dueDate: 'font-size:var(--text-xs); color:var(--text-muted);',
}

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
      return { S }
    },
    template: `
      <div :style="S.root">
        <div :style="S.headerRow">
          <div :style="S.titleGroup">
            <h2 :style="S.title">Board</h2>
            <span :style="S.taskCount">12 tasks</span>
          </div>
          <div :style="S.viewBtnGroup">
            <button :style="S.viewBtnActive"><Flag :size="16" /><span>Priority</span></button>
            <button :style="S.viewBtn"><Calendar :size="16" /><span>Due Date</span></button>
            <button :style="S.viewBtn"><ListTodo :size="16" /><span>Status</span></button>
          </div>
        </div>
        <div :style="S.boardScroll">
          <div :style="S.swimlane">
            <div :style="S.projectHeader">
              <span :style="S.projectDot"></span>
              <span :style="S.projectName">Work</span>
              <span :style="S.projectCount">(5 tasks)</span>
            </div>
            <div :style="S.columnsGrid">
              <div :style="S.column">
                <div :style="S.colHeaderRow">
                  <h3 :style="S.colTitle">High Priority</h3>
                  <span :style="S.colCount">2</span>
                </div>
                <div :style="S.cardHigh">
                  <div :style="S.cardTitle">Review Q4 marketing proposal</div>
                  <div :style="S.tagRow">
                    <span :style="S.high">HIGH</span>
                    <span :style="S.dueDate">Due: Feb 15</span>
                  </div>
                </div>
              </div>
              <div :style="S.column">
                <div :style="S.colHeaderRow">
                  <h3 :style="S.colTitle">Medium Priority</h3>
                  <span :style="S.colCount">2</span>
                </div>
                <div :style="S.cardMedium">
                  <div :style="S.cardTitle">Update team documentation</div>
                  <div :style="S.tagRow"><span :style="S.medium">MEDIUM</span></div>
                </div>
              </div>
              <div :style="S.column">
                <div :style="S.colHeaderRow">
                  <h3 :style="S.colTitle">Low Priority</h3>
                  <span :style="S.colCount">1</span>
                </div>
                <div :style="S.cardLow">
                  <div :style="S.cardTitle">Schedule client call</div>
                  <div :style="S.tagRow"><span :style="S.low">LOW</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  })
}
