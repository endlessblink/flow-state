import type { Meta, StoryObj } from '@storybook/vue3'
import { Plus, Grid3x3, Inbox, ZoomIn, ZoomOut } from 'lucide-vue-next'

/**
 * CanvasView - Infinite Canvas Workspace
 *
 * Main canvas/whiteboard view with drag-drop nodes and groups.
 *
 * **Features:**
 * - Infinite canvas workspace with zoom/pan
 * - Task nodes (draggable cards)
 * - Group nodes (containers for tasks)
 * - Inbox sidebar (collapsible)
 * - Canvas toolbar (Add Task, Create Group)
 * - Rubber-band selection (Shift+drag)
 * - Context menus (right-click)
 * - Minimap navigation
 * - Status filter banner
 *
 * **Store Dependencies:**
 * - taskStore: Task data
 * - canvasStore: Canvas state, nodes, groups
 * - timerStore: Timer integration
 * - uiStore: UI state
 */
const meta: Meta = {
  title: '✨ Views/CanvasView',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `Infinite canvas workspace for visual task organization.

**Canvas Elements:**
- Task nodes: Draggable cards with title, priority, due date
- Group nodes: Containers that hold multiple tasks
- Connections: Task dependencies shown as arrows
- Background: Grid dots for spatial reference

**Interactions:**
- Drag tasks/groups to reposition
- Shift+drag for rubber-band multi-select
- Right-click for context menus
- Scroll to zoom
- Middle-click drag to pan

**Note:** Full Vue Flow integration and drag-drop requires real component setup.`
      }
    }
  }
}

export default meta
type Story = StoryObj

// All styles as single-line strings — multiline breaks Storybook rendering
const S = {
  root: 'position:relative; width:100vw; height:100vh; background:var(--app-background-gradient); overflow:hidden;',
  rootFlex: 'position:relative; width:100vw; height:100vh; background:var(--app-background-gradient); overflow:hidden; display:flex;',
  toolbar: 'position:absolute; top:var(--space-4); left:50%; transform:translateX(-50%); z-index:100; display:flex; align-items:center; gap:var(--space-2); padding:var(--space-2) var(--space-3); background:var(--glass-bg-medium); backdrop-filter:blur(16px); border:1px solid var(--glass-border); border-radius:var(--radius-lg); box-shadow:var(--shadow-2xl);',
  addBtn: 'display:flex; align-items:center; gap:var(--space-2); padding:var(--space-2) var(--space-3); background:var(--primary-bg); color:var(--primary-text); border:none; border-radius:var(--radius-md); cursor:pointer; font-size:var(--text-sm); font-weight:var(--font-medium);',
  groupBtn: 'display:flex; align-items:center; gap:var(--space-2); padding:var(--space-2) var(--space-3); background:transparent; color:var(--text-secondary); border:1px solid var(--glass-border); border-radius:var(--radius-md); cursor:pointer; font-size:var(--text-sm);',
  grid: 'width:100%; height:100%; background-image:radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px); background-size:16px 16px; position:relative;',
  taskNode: 'width:280px; padding:var(--space-3); background:var(--canvas-task-bg); backdrop-filter:blur(12px); border:1px solid var(--canvas-task-border); border-radius:var(--radius-lg); box-shadow:var(--shadow-lg); cursor:move; position:absolute;',
  taskNodeCompact: 'width:240px; padding:var(--space-3); background:var(--canvas-task-bg); backdrop-filter:blur(12px); border:1px solid var(--canvas-task-border); border-radius:var(--radius-lg); cursor:move; position:absolute;',
  selectedNode: 'width:280px; padding:var(--space-3); background:var(--canvas-task-bg); backdrop-filter:blur(12px); border:2px solid var(--primary-bg); border-radius:var(--radius-lg); box-shadow:var(--shadow-xl), 0 0 20px rgba(59,130,246,0.3); cursor:move; position:absolute;',
  taskHeader: 'display:flex; align-items:start; gap:var(--space-2); margin-bottom:var(--space-2);',
  checkbox: 'margin-top:2px; cursor:pointer;',
  taskTitle: 'flex:1; font-size:var(--text-sm); color:var(--text-primary); font-weight:var(--font-medium);',
  tagRow: 'display:flex; gap:var(--space-2); flex-wrap:wrap;',
  tagRowInline: 'display:flex; gap:var(--space-2); flex-wrap:wrap; margin-top:var(--space-1);',
  high: 'padding:var(--space-0_5) var(--space-1_5); background:var(--danger-bg-subtle); color:var(--color-danger); border-radius:var(--radius-sm); font-size:var(--text-xs); font-weight:var(--font-medium);',
  highInline: 'padding:var(--space-0_5) var(--space-1_5); background:var(--danger-bg-subtle); color:var(--color-danger); border-radius:var(--radius-sm); font-size:var(--text-xs); font-weight:var(--font-medium); display:inline-block; margin-top:var(--space-1);',
  medium: 'padding:var(--space-0_5) var(--space-1_5); background:var(--color-warning-alpha-10); color:var(--color-warning); border-radius:var(--radius-sm); font-size:var(--text-xs); font-weight:var(--font-medium);',
  mediumInline: 'padding:var(--space-0_5) var(--space-1_5); background:var(--color-warning-alpha-10); color:var(--color-warning); border-radius:var(--radius-sm); font-size:var(--text-xs); font-weight:var(--font-medium); display:inline-block; margin-top:var(--space-1);',
  low: 'padding:var(--space-0_5) var(--space-1_5); background:var(--blue-bg-light); color:var(--status-planned-text); border-radius:var(--radius-sm); font-size:var(--text-xs); font-weight:var(--font-medium);',
  lowInline: 'padding:var(--space-0_5) var(--space-1_5); background:var(--blue-bg-light); color:var(--status-planned-text); border-radius:var(--radius-sm); font-size:var(--text-xs); font-weight:var(--font-medium); display:inline-block; margin-top:var(--space-1);',
  dueDate: 'font-size:var(--text-xs); color:var(--text-muted);',
  groupNode: 'min-height:200px; background:var(--canvas-group-bg); backdrop-filter:blur(16px); border:2px solid var(--canvas-group-border); border-radius:var(--radius-xl); box-shadow:var(--shadow-2xl); overflow:hidden; position:absolute;',
  groupNodeSmall: 'min-height:180px; background:var(--canvas-group-bg); backdrop-filter:blur(16px); border:2px solid var(--canvas-group-border); border-radius:var(--radius-xl); overflow:hidden; position:absolute;',
  groupHeader: 'padding:var(--space-3); background:linear-gradient(135deg, rgba(59,130,246,0.2), rgba(147,51,234,0.2)); border-bottom:1px solid var(--canvas-group-border); cursor:move;',
  groupHeaderPink: 'padding:var(--space-3); background:linear-gradient(135deg, rgba(236,72,153,0.2), rgba(251,146,60,0.2)); border-bottom:1px solid var(--canvas-group-border); cursor:move;',
  groupTitleRow: 'display:flex; justify-content:space-between; align-items:center;',
  groupTitle: 'font-size:var(--text-base); font-weight:var(--font-semibold); color:var(--text-primary);',
  groupBadge: 'padding:var(--space-1) var(--space-2); background:rgba(255,255,255,0.1); border-radius:var(--radius-full); font-size:var(--text-xs); color:var(--text-secondary);',
  groupContent: 'padding:var(--space-3);',
  groupPlaceholder: 'text-align:center; color:var(--text-muted); font-size:var(--text-sm); padding:var(--space-4);',
  groupSubtitle: 'font-size:var(--text-xs); color:var(--text-muted);',
  minimap: 'position:absolute; bottom:var(--space-4); right:var(--space-4); width:180px; height:120px; background:var(--glass-bg-medium); backdrop-filter:blur(8px); border:1px solid var(--glass-border); border-radius:var(--radius-md); box-shadow:var(--shadow-xl);',
  minimapHeader: 'padding:var(--space-2); border-bottom:1px solid var(--glass-border); font-size:var(--text-xs); color:var(--text-muted); text-align:center;',
  minimapDots: 'padding:var(--space-2); position:relative; height:80px;',
  minimapDot: 'position:absolute; width:4px; height:4px; background:var(--primary-bg); border-radius:50%;',
  minimapGroup: 'position:absolute; width:8px; height:8px; border-radius:var(--radius-sm);',
  zoomControls: 'position:absolute; bottom:var(--space-4); left:var(--space-4); display:flex; flex-direction:column; gap:var(--space-1);',
  zoomBtn: 'width:40px; height:40px; display:flex; align-items:center; justify-content:center; background:var(--glass-bg-medium); backdrop-filter:blur(8px); border:1px solid var(--glass-border); border-radius:var(--radius-md); color:var(--text-secondary); cursor:pointer;',
  // Inbox sidebar
  inboxSidebar: 'width:320px; height:100%; background:var(--glass-bg-medium); backdrop-filter:blur(20px); border-right:1px solid var(--glass-border); box-shadow:var(--shadow-2xl); display:flex; flex-direction:column; z-index:50;',
  inboxHeaderWrap: 'padding:var(--space-4); border-bottom:1px solid var(--glass-border);',
  inboxTitleRow: 'display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--space-2);',
  inboxTitleGroup: 'display:flex; align-items:center; gap:var(--space-2);',
  inboxTitle: 'font-size:var(--text-lg); font-weight:var(--font-semibold); color:var(--text-primary); margin:0;',
  inboxBadge: 'padding:var(--space-1) var(--space-2); background:var(--blue-bg-light); color:var(--status-planned-text); border-radius:var(--radius-full); font-size:var(--text-xs); font-weight:var(--font-medium);',
  inboxSubtext: 'font-size:var(--text-xs); color:var(--text-muted); margin:0;',
  inboxContent: 'flex:1; overflow-y:auto; padding:var(--space-3);',
  inboxTask: 'padding:var(--space-3); background:var(--glass-bg-soft); border:1px solid var(--glass-border); border-radius:var(--radius-md); margin-bottom:var(--space-2); cursor:move;',
  inboxTaskTitle: 'font-size:var(--text-sm); color:var(--text-primary); margin-bottom:var(--space-1);',
  canvasArea: 'flex:1; position:relative;',
  // Empty state
  emptyCenter: 'position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center; max-width:400px;',
  emptyIconWrap: 'margin-bottom:var(--space-4);',
  emptyTitle: 'font-size:var(--text-2xl); font-weight:var(--font-bold); color:var(--text-primary); margin:0 0 var(--space-2) 0;',
  emptyDesc: 'font-size:var(--text-base); color:var(--text-secondary); margin:0 0 var(--space-6) 0;',
  emptyCTA: 'display:flex; gap:var(--space-3); justify-content:center;',
  emptyPrimaryBtn: 'display:flex; align-items:center; gap:var(--space-2); padding:var(--space-3) var(--space-4); background:var(--primary-bg); color:var(--primary-text); border:none; border-radius:var(--radius-md); cursor:pointer; font-size:var(--text-base); font-weight:var(--font-medium); box-shadow:var(--shadow-lg);',
  emptySecondaryBtn: 'display:flex; align-items:center; gap:var(--space-2); padding:var(--space-3) var(--space-4); background:var(--glass-bg-medium); backdrop-filter:blur(8px); color:var(--text-primary); border:1px solid var(--glass-border); border-radius:var(--radius-md); cursor:pointer; font-size:var(--text-base);',
  // Selection story
  rubberBand: 'position:absolute; border:2px dashed var(--primary-bg); background:rgba(59,130,246,0.1); border-radius:var(--radius-md); pointer-events:none;',
  selectionHint: 'position:absolute; padding:var(--space-2) var(--space-3); background:var(--glass-bg-medium); backdrop-filter:blur(8px); border:1px solid var(--glass-border); border-radius:var(--radius-md); font-size:var(--text-xs); color:var(--text-muted); box-shadow:var(--shadow-lg);',
  hintTitle: 'margin-bottom:var(--space-1); color:var(--text-primary); font-weight:var(--font-semibold);',
  hintSub: 'margin-top:var(--space-1); color:var(--text-secondary);',
}

/**
 * Default - Basic Canvas
 *
 * Canvas with a few task nodes and one group.
 */
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Default canvas with scattered task nodes and one group container.'
      }
    }
  },
  render: () => ({
    components: { Plus, Grid3x3, ZoomIn, ZoomOut },
    setup() {
      return { S }
    },
    template: `
      <div :style="S.root">
        <div :style="S.toolbar">
          <button :style="S.addBtn"><Plus :size="16" /><span>Add Task</span></button>
          <button :style="S.groupBtn"><Grid3x3 :size="16" /><span>Create Group</span></button>
        </div>
        <div :style="S.grid">
          <div :style="S.taskNode + 'top:150px; left:200px;'">
            <div :style="S.taskHeader">
              <input type="checkbox" :style="S.checkbox" />
              <div :style="S.taskTitle">Review Q4 marketing proposal</div>
            </div>
            <div :style="S.tagRow">
              <span :style="S.high">HIGH</span>
              <span :style="S.dueDate">Due: Feb 15</span>
            </div>
          </div>
          <div :style="S.taskNode + 'top:150px; left:520px;'">
            <div :style="S.taskHeader">
              <input type="checkbox" :style="S.checkbox" />
              <div :style="S.taskTitle">Update team documentation</div>
            </div>
            <div :style="S.tagRow"><span :style="S.medium">MEDIUM</span></div>
          </div>
          <div :style="S.groupNode + 'top:320px; left:200px; width:380px;'">
            <div :style="S.groupHeader">
              <div :style="S.groupTitleRow">
                <div :style="S.groupTitle">Sprint Planning</div>
                <span :style="S.groupBadge">3 tasks</span>
              </div>
            </div>
            <div :style="S.groupContent">
              <div :style="S.groupPlaceholder">Drag tasks here to add to group</div>
            </div>
          </div>
          <div :style="S.taskNode + 'top:320px; left:620px;'">
            <div :style="S.taskHeader">
              <input type="checkbox" :style="S.checkbox" />
              <div :style="S.taskTitle">Schedule client call</div>
            </div>
            <div :style="S.tagRow"><span :style="S.low">LOW</span></div>
          </div>
        </div>
        <div :style="S.minimap">
          <div :style="S.minimapHeader">Minimap</div>
        </div>
        <div :style="S.zoomControls">
          <button :style="S.zoomBtn"><ZoomIn :size="20" /></button>
          <button :style="S.zoomBtn"><ZoomOut :size="20" /></button>
        </div>
      </div>
    `
  })
}

/**
 * With Inbox - Sidebar Open
 *
 * Canvas with inbox sidebar visible on the left.
 */
export const WithInbox: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Canvas with inbox sidebar open, showing unscheduled tasks ready to drag onto canvas.'
      }
    }
  },
  render: () => ({
    components: { Plus, Grid3x3, Inbox, ZoomIn, ZoomOut },
    setup() {
      return { S }
    },
    template: `
      <div :style="S.rootFlex">
        <div :style="S.inboxSidebar">
          <div :style="S.inboxHeaderWrap">
            <div :style="S.inboxTitleRow">
              <div :style="S.inboxTitleGroup">
                <Inbox :size="20" style="color:var(--text-secondary);" />
                <h3 :style="S.inboxTitle">Inbox</h3>
              </div>
              <span :style="S.inboxBadge">4</span>
            </div>
            <p :style="S.inboxSubtext">Drag tasks onto canvas to schedule</p>
          </div>
          <div :style="S.inboxContent">
            <div :style="S.inboxTask">
              <div :style="S.inboxTaskTitle">Prepare presentation slides</div>
              <span :style="S.high">HIGH</span>
            </div>
            <div :style="S.inboxTask">
              <div :style="S.inboxTaskTitle">Email design mockups</div>
              <span :style="S.medium">MEDIUM</span>
            </div>
            <div :style="S.inboxTask">
              <div :style="S.inboxTaskTitle">Research competitor pricing</div>
              <span :style="S.low">LOW</span>
            </div>
          </div>
        </div>
        <div :style="S.canvasArea">
          <div :style="S.toolbar">
            <button :style="S.addBtn"><Plus :size="16" /><span>Add Task</span></button>
            <button :style="S.groupBtn"><Grid3x3 :size="16" /><span>Create Group</span></button>
          </div>
          <div :style="S.grid">
            <div :style="S.taskNode + 'top:200px; left:250px;'">
              <div :style="S.taskHeader">
                <input type="checkbox" :style="S.checkbox" />
                <div :style="S.taskTitle">Review Q4 marketing proposal</div>
              </div>
              <div :style="S.tagRow"><span :style="S.high">HIGH</span></div>
            </div>
          </div>
          <div :style="S.minimap">
            <div :style="S.minimapHeader">Minimap</div>
          </div>
          <div :style="S.zoomControls">
            <button :style="S.zoomBtn"><ZoomIn :size="20" /></button>
            <button :style="S.zoomBtn"><ZoomOut :size="20" /></button>
          </div>
        </div>
      </div>
    `
  })
}

/**
 * Empty Canvas - Welcome State
 *
 * Shows the empty state with prompts to add first task or create group.
 */
export const EmptyCanvas: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Empty canvas state with call-to-action buttons for creating first tasks/groups.'
      }
    }
  },
  render: () => ({
    components: { Plus, Grid3x3 },
    setup() {
      return { S }
    },
    template: `
      <div :style="S.root">
        <div :style="S.toolbar">
          <button :style="S.addBtn"><Plus :size="16" /><span>Add Task</span></button>
          <button :style="S.groupBtn"><Grid3x3 :size="16" /><span>Create Group</span></button>
        </div>
        <div :style="S.grid">
          <div :style="S.emptyCenter">
            <div :style="S.emptyIconWrap">
              <Grid3x3 :size="64" style="color:var(--text-muted); opacity:0.3; margin:0 auto var(--space-4);" />
              <h3 :style="S.emptyTitle">Your canvas is empty</h3>
              <p :style="S.emptyDesc">Start organizing your tasks visually by adding them to the canvas</p>
            </div>
            <div :style="S.emptyCTA">
              <button :style="S.emptyPrimaryBtn"><Plus :size="20" /><span>Add Your First Task</span></button>
              <button :style="S.emptySecondaryBtn"><Grid3x3 :size="20" /><span>Create Group</span></button>
            </div>
          </div>
        </div>
      </div>
    `
  })
}

/**
 * Busy Canvas - Many Nodes
 *
 * Canvas with many nodes scattered around showing a realistic busy workspace.
 */
export const BusyCanvas: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Busy canvas with many task nodes and multiple groups demonstrating realistic usage.'
      }
    }
  },
  render: () => ({
    components: { Plus, Grid3x3, ZoomIn, ZoomOut },
    setup() {
      return { S }
    },
    template: `
      <div :style="S.root">
        <div :style="S.toolbar">
          <button :style="S.addBtn"><Plus :size="16" /><span>Add Task</span></button>
          <button :style="S.groupBtn"><Grid3x3 :size="16" /><span>Create Group</span></button>
        </div>
        <div :style="S.grid">
          <div :style="S.taskNodeCompact + 'top:100px; left:150px;'">
            <div :style="S.taskTitle">Design landing page</div>
            <span :style="S.highInline">HIGH</span>
          </div>
          <div :style="S.taskNodeCompact + 'top:100px; left:430px;'">
            <div :style="S.taskTitle">Code review</div>
            <span :style="S.mediumInline">MEDIUM</span>
          </div>
          <div :style="S.taskNodeCompact + 'top:100px; left:710px;'">
            <div :style="S.taskTitle">Team sync</div>
            <span :style="S.lowInline">LOW</span>
          </div>
          <div :style="S.taskNodeCompact + 'top:240px; left:150px;'">
            <div :style="S.taskTitle">Write documentation</div>
            <span :style="S.lowInline">LOW</span>
          </div>
          <div :style="S.taskNodeCompact + 'top:240px; left:430px;'">
            <div :style="S.taskTitle">Fix bug #123</div>
            <span :style="S.highInline">HIGH</span>
          </div>
          <div :style="S.taskNodeCompact + 'top:380px; left:150px;'">
            <div :style="S.taskTitle">Update analytics</div>
            <span :style="S.mediumInline">MEDIUM</span>
          </div>
          <div :style="S.groupNodeSmall + 'top:100px; left:990px; width:320px;'">
            <div :style="S.groupHeader">
              <div :style="S.groupTitle">Sprint 12</div>
              <span :style="S.groupSubtitle">5 tasks</span>
            </div>
          </div>
          <div :style="S.groupNodeSmall + 'top:320px; left:990px; width:320px;'">
            <div :style="S.groupHeaderPink">
              <div :style="S.groupTitle">Marketing</div>
              <span :style="S.groupSubtitle">3 tasks</span>
            </div>
          </div>
          <div :style="S.taskNodeCompact + 'top:520px; left:150px;'">
            <div :style="S.taskTitle">Client presentation</div>
            <span :style="S.highInline">HIGH</span>
          </div>
          <div :style="S.taskNodeCompact + 'top:520px; left:430px;'">
            <div :style="S.taskTitle">Research competitors</div>
            <span :style="S.lowInline">LOW</span>
          </div>
        </div>
        <div :style="S.minimap">
          <div :style="S.minimapHeader">Minimap</div>
          <div :style="S.minimapDots">
            <div :style="S.minimapDot + 'top:10px; left:20px;'"></div>
            <div :style="S.minimapDot + 'top:15px; left:50px;'"></div>
            <div :style="S.minimapDot + 'top:25px; left:80px;'"></div>
            <div :style="S.minimapDot + 'top:40px; left:30px;'"></div>
            <div :style="S.minimapDot + 'top:50px; left:60px;'"></div>
            <div :style="S.minimapGroup + 'top:30px; left:120px; background:rgba(59,130,246,0.5);'"></div>
            <div :style="S.minimapGroup + 'top:60px; left:120px; background:rgba(236,72,153,0.5);'"></div>
          </div>
        </div>
        <div :style="S.zoomControls">
          <button :style="S.zoomBtn"><ZoomIn :size="20" /></button>
          <button :style="S.zoomBtn"><ZoomOut :size="20" /></button>
        </div>
      </div>
    `
  })
}

/**
 * With Selection - Rubber-band Active
 *
 * Shows rubber-band selection box active (Shift+drag to multi-select).
 */
export const WithSelection: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Canvas with rubber-band selection box visible, demonstrating multi-select functionality.'
      }
    }
  },
  render: () => ({
    components: { Plus, Grid3x3, ZoomIn, ZoomOut },
    setup() {
      return { S }
    },
    template: `
      <div :style="S.root">
        <div :style="S.toolbar">
          <button :style="S.addBtn"><Plus :size="16" /><span>Add Task</span></button>
          <button :style="S.groupBtn"><Grid3x3 :size="16" /><span>Create Group</span></button>
        </div>
        <div :style="S.grid">
          <div :style="S.selectedNode + 'top:200px; left:250px;'">
            <div :style="S.taskHeader">
              <input type="checkbox" :style="S.checkbox" />
              <div :style="S.taskTitle">Review Q4 marketing proposal</div>
            </div>
            <div :style="S.tagRow"><span :style="S.high">HIGH</span></div>
          </div>
          <div :style="S.selectedNode + 'top:350px; left:250px;'">
            <div :style="S.taskHeader">
              <input type="checkbox" :style="S.checkbox" />
              <div :style="S.taskTitle">Update team documentation</div>
            </div>
            <div :style="S.tagRow"><span :style="S.medium">MEDIUM</span></div>
          </div>
          <div :style="S.taskNode + 'top:200px; left:580px;'">
            <div :style="S.taskHeader">
              <input type="checkbox" :style="S.checkbox" />
              <div :style="S.taskTitle">Schedule client call</div>
            </div>
            <div :style="S.tagRow"><span :style="S.low">LOW</span></div>
          </div>
          <div :style="S.rubberBand + 'top:190px; left:240px; width:300px; height:190px;'"></div>
          <div :style="S.selectionHint + 'top:400px; left:580px;'">
            <div :style="S.hintTitle">Multi-Select Active</div>
            <div>2 tasks selected</div>
            <div :style="S.hintSub">Hold Shift and drag to select</div>
          </div>
        </div>
        <div :style="S.minimap">
          <div :style="S.minimapHeader">Minimap</div>
        </div>
        <div :style="S.zoomControls">
          <button :style="S.zoomBtn"><ZoomIn :size="20" /></button>
          <button :style="S.zoomBtn"><ZoomOut :size="20" /></button>
        </div>
      </div>
    `
  })
}
