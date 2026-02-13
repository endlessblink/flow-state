import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
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
    components: { Plus, Grid3x3, Inbox, ZoomIn, ZoomOut },
    setup() {
      return { Plus, Grid3x3, Inbox, ZoomIn, ZoomOut }
    },
    template: `
      <div style="
        position: relative;
        width: 100vw;
        height: 100vh;
        background: var(--app-background-gradient);
        overflow: hidden;
      ">
        <!-- Canvas Toolbar -->
        <div style="
          position: absolute;
          top: var(--space-4);
          left: 50%;
          transform: translateX(-50%);
          z-index: 100;
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background: var(--glass-bg-medium);
          backdrop-filter: blur(16px);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-2xl);
        ">
          <button style="
            display: flex;
            align-items: center;
            gap: var(--space-2);
            padding: var(--space-2) var(--space-3);
            background: var(--primary-bg);
            color: var(--primary-text);
            border: none;
            border-radius: var(--radius-md);
            cursor: pointer;
            font-size: var(--text-sm);
            font-weight: var(--font-medium);
          ">
            <Plus :size="16" />
            <span>Add Task</span>
          </button>
          <button style="
            display: flex;
            align-items: center;
            gap: var(--space-2);
            padding: var(--space-2) var(--space-3);
            background: transparent;
            color: var(--text-secondary);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            cursor: pointer;
            font-size: var(--text-sm);
          ">
            <Grid3x3 :size="16" />
            <span>Create Group</span>
          </button>
        </div>

        <!-- Canvas Container -->
        <div style="
          width: 100%;
          height: 100%;
          background-image: radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px);
          background-size: 16px 16px;
          position: relative;
        ">
          <!-- Task Node 1 -->
          <div style="
            position: absolute;
            top: 150px;
            left: 200px;
            width: 280px;
            padding: var(--space-3);
            background: var(--canvas-task-bg);
            backdrop-filter: blur(12px);
            border: 1px solid var(--canvas-task-border);
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-lg);
            cursor: move;
          ">
            <div style="
              display: flex;
              align-items: start;
              gap: var(--space-2);
              margin-bottom: var(--space-2);
            ">
              <input type="checkbox" style="
                margin-top: 2px;
                cursor: pointer;
              " />
              <div style="
                flex: 1;
                font-size: var(--text-sm);
                color: var(--text-primary);
                font-weight: var(--font-medium);
              ">Review Q4 marketing proposal</div>
            </div>
            <div style="display: flex; gap: var(--space-2); flex-wrap: wrap;">
              <span style="
                padding: var(--space-0_5) var(--space-1_5);
                background: var(--danger-bg-subtle);
                color: var(--color-danger);
                border-radius: var(--radius-sm);
                font-size: var(--text-xs);
                font-weight: var(--font-medium);
              ">HIGH</span>
              <span style="
                font-size: var(--text-xs);
                color: var(--text-muted);
              ">Due: Feb 15</span>
            </div>
          </div>

          <!-- Task Node 2 -->
          <div style="
            position: absolute;
            top: 150px;
            left: 520px;
            width: 280px;
            padding: var(--space-3);
            background: var(--canvas-task-bg);
            backdrop-filter: blur(12px);
            border: 1px solid var(--canvas-task-border);
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-lg);
            cursor: move;
          ">
            <div style="
              display: flex;
              align-items: start;
              gap: var(--space-2);
              margin-bottom: var(--space-2);
            ">
              <input type="checkbox" style="
                margin-top: 2px;
                cursor: pointer;
              " />
              <div style="
                flex: 1;
                font-size: var(--text-sm);
                color: var(--text-primary);
                font-weight: var(--font-medium);
              ">Update team documentation</div>
            </div>
            <div style="display: flex; gap: var(--space-2); flex-wrap: wrap;">
              <span style="
                padding: var(--space-0_5) var(--space-1_5);
                background: var(--color-warning-alpha-10);
                color: var(--color-warning);
                border-radius: var(--radius-sm);
                font-size: var(--text-xs);
                font-weight: var(--font-medium);
              ">MEDIUM</span>
            </div>
          </div>

          <!-- Group Node -->
          <div style="
            position: absolute;
            top: 320px;
            left: 200px;
            width: 380px;
            min-height: 200px;
            background: var(--canvas-group-bg);
            backdrop-filter: blur(16px);
            border: 2px solid var(--canvas-group-border);
            border-radius: var(--radius-xl);
            box-shadow: var(--shadow-2xl);
            overflow: hidden;
          ">
            <!-- Group Header -->
            <div style="
              padding: var(--space-3);
              background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(147, 51, 234, 0.2));
              border-bottom: 1px solid var(--canvas-group-border);
              cursor: move;
            ">
              <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
              ">
                <div style="
                  font-size: var(--text-base);
                  font-weight: var(--font-semibold);
                  color: var(--text-primary);
                ">Sprint Planning</div>
                <span style="
                  padding: var(--space-1) var(--space-2);
                  background: rgba(255, 255, 255, 0.1);
                  border-radius: var(--radius-full);
                  font-size: var(--text-xs);
                  color: var(--text-secondary);
                ">3 tasks</span>
              </div>
            </div>

            <!-- Group Content -->
            <div style="
              padding: var(--space-3);
            ">
              <div style="
                text-align: center;
                color: var(--text-muted);
                font-size: var(--text-sm);
                padding: var(--space-4);
              ">Drag tasks here to add to group</div>
            </div>
          </div>

          <!-- Task Node 3 (outside group) -->
          <div style="
            position: absolute;
            top: 320px;
            left: 620px;
            width: 280px;
            padding: var(--space-3);
            background: var(--canvas-task-bg);
            backdrop-filter: blur(12px);
            border: 1px solid var(--canvas-task-border);
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-lg);
            cursor: move;
          ">
            <div style="
              display: flex;
              align-items: start;
              gap: var(--space-2);
              margin-bottom: var(--space-2);
            ">
              <input type="checkbox" style="
                margin-top: 2px;
                cursor: pointer;
              " />
              <div style="
                flex: 1;
                font-size: var(--text-sm);
                color: var(--text-primary);
                font-weight: var(--font-medium);
              ">Schedule client call</div>
            </div>
            <div style="display: flex; gap: var(--space-2); flex-wrap: wrap;">
              <span style="
                padding: var(--space-0_5) var(--space-1_5);
                background: var(--blue-bg-light);
                color: var(--status-planned-text);
                border-radius: var(--radius-sm);
                font-size: var(--text-xs);
                font-weight: var(--font-medium);
              ">LOW</span>
            </div>
          </div>
        </div>

        <!-- Minimap Indicator -->
        <div style="
          position: absolute;
          bottom: var(--space-4);
          right: var(--space-4);
          width: 180px;
          height: 120px;
          background: var(--glass-bg-medium);
          backdrop-filter: blur(8px);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-xl);
        ">
          <div style="
            padding: var(--space-2);
            border-bottom: 1px solid var(--glass-border);
            font-size: var(--text-xs);
            color: var(--text-muted);
            text-align: center;
          ">Minimap</div>
        </div>

        <!-- Zoom Controls -->
        <div style="
          position: absolute;
          bottom: var(--space-4);
          left: var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        ">
          <button style="
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--glass-bg-medium);
            backdrop-filter: blur(8px);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            color: var(--text-secondary);
            cursor: pointer;
          ">
            <ZoomIn :size="20" />
          </button>
          <button style="
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--glass-bg-medium);
            backdrop-filter: blur(8px);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            color: var(--text-secondary);
            cursor: pointer;
          ">
            <ZoomOut :size="20" />
          </button>
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
      return { Plus, Grid3x3, Inbox, ZoomIn, ZoomOut }
    },
    template: `
      <div style="
        position: relative;
        width: 100vw;
        height: 100vh;
        background: var(--app-background-gradient);
        overflow: hidden;
        display: flex;
      ">
        <!-- Inbox Sidebar -->
        <div style="
          width: 320px;
          height: 100%;
          background: var(--glass-bg-medium);
          backdrop-filter: blur(20px);
          border-right: 1px solid var(--glass-border);
          box-shadow: var(--shadow-2xl);
          display: flex;
          flex-direction: column;
          z-index: 50;
        ">
          <!-- Inbox Header -->
          <div style="
            padding: var(--space-4);
            border-bottom: 1px solid var(--glass-border);
          ">
            <div style="
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: var(--space-2);
            ">
              <div style="
                display: flex;
                align-items: center;
                gap: var(--space-2);
              ">
                <Inbox :size="20" style="color: var(--text-secondary);" />
                <h3 style="
                  font-size: var(--text-lg);
                  font-weight: var(--font-semibold);
                  color: var(--text-primary);
                  margin: 0;
                ">Inbox</h3>
              </div>
              <span style="
                padding: var(--space-1) var(--space-2);
                background: var(--blue-bg-light);
                color: var(--status-planned-text);
                border-radius: var(--radius-full);
                font-size: var(--text-xs);
                font-weight: var(--font-medium);
              ">4</span>
            </div>
            <p style="
              font-size: var(--text-xs);
              color: var(--text-muted);
              margin: 0;
            ">Drag tasks onto canvas to schedule</p>
          </div>

          <!-- Inbox Tasks -->
          <div style="
            flex: 1;
            overflow-y: auto;
            padding: var(--space-3);
          ">
            <!-- Task 1 -->
            <div style="
              padding: var(--space-3);
              background: var(--glass-bg-soft);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-md);
              margin-bottom: var(--space-2);
              cursor: move;
            ">
              <div style="
                font-size: var(--text-sm);
                color: var(--text-primary);
                margin-bottom: var(--space-1);
              ">Prepare presentation slides</div>
              <span style="
                padding: var(--space-0_5) var(--space-1_5);
                background: var(--danger-bg-subtle);
                color: var(--color-danger);
                border-radius: var(--radius-sm);
                font-size: var(--text-xs);
                font-weight: var(--font-medium);
              ">HIGH</span>
            </div>

            <!-- Task 2 -->
            <div style="
              padding: var(--space-3);
              background: var(--glass-bg-soft);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-md);
              margin-bottom: var(--space-2);
              cursor: move;
            ">
              <div style="
                font-size: var(--text-sm);
                color: var(--text-primary);
                margin-bottom: var(--space-1);
              ">Email design mockups</div>
              <span style="
                padding: var(--space-0_5) var(--space-1_5);
                background: var(--color-warning-alpha-10);
                color: var(--color-warning);
                border-radius: var(--radius-sm);
                font-size: var(--text-xs);
                font-weight: var(--font-medium);
              ">MEDIUM</span>
            </div>

            <!-- Task 3 -->
            <div style="
              padding: var(--space-3);
              background: var(--glass-bg-soft);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-md);
              margin-bottom: var(--space-2);
              cursor: move;
            ">
              <div style="
                font-size: var(--text-sm);
                color: var(--text-primary);
                margin-bottom: var(--space-1);
              ">Research competitor pricing</div>
              <span style="
                padding: var(--space-0_5) var(--space-1_5);
                background: var(--blue-bg-light);
                color: var(--status-planned-text);
                border-radius: var(--radius-sm);
                font-size: var(--text-xs);
                font-weight: var(--font-medium);
              ">LOW</span>
            </div>
          </div>
        </div>

        <!-- Canvas Area -->
        <div style="
          flex: 1;
          position: relative;
        ">
          <!-- Canvas Toolbar -->
          <div style="
            position: absolute;
            top: var(--space-4);
            left: 50%;
            transform: translateX(-50%);
            z-index: 100;
            display: flex;
            align-items: center;
            gap: var(--space-2);
            padding: var(--space-2) var(--space-3);
            background: var(--glass-bg-medium);
            backdrop-filter: blur(16px);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-2xl);
          ">
            <button style="
              display: flex;
              align-items: center;
              gap: var(--space-2);
              padding: var(--space-2) var(--space-3);
              background: var(--primary-bg);
              color: var(--primary-text);
              border: none;
              border-radius: var(--radius-md);
              cursor: pointer;
              font-size: var(--text-sm);
              font-weight: var(--font-medium);
            ">
              <Plus :size="16" />
              <span>Add Task</span>
            </button>
            <button style="
              display: flex;
              align-items: center;
              gap: var(--space-2);
              padding: var(--space-2) var(--space-3);
              background: transparent;
              color: var(--text-secondary);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-md);
              cursor: pointer;
              font-size: var(--text-sm);
            ">
              <Grid3x3 :size="16" />
              <span>Create Group</span>
            </button>
          </div>

          <!-- Canvas with Grid -->
          <div style="
            width: 100%;
            height: 100%;
            background-image: radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px);
            background-size: 16px 16px;
            position: relative;
          ">
            <!-- Task Node -->
            <div style="
              position: absolute;
              top: 200px;
              left: 250px;
              width: 280px;
              padding: var(--space-3);
              background: var(--canvas-task-bg);
              backdrop-filter: blur(12px);
              border: 1px solid var(--canvas-task-border);
              border-radius: var(--radius-lg);
              box-shadow: var(--shadow-lg);
              cursor: move;
            ">
              <div style="
                display: flex;
                align-items: start;
                gap: var(--space-2);
                margin-bottom: var(--space-2);
              ">
                <input type="checkbox" style="
                  margin-top: 2px;
                  cursor: pointer;
                " />
                <div style="
                  flex: 1;
                  font-size: var(--text-sm);
                  color: var(--text-primary);
                  font-weight: var(--font-medium);
                ">Review Q4 marketing proposal</div>
              </div>
              <div style="display: flex; gap: var(--space-2); flex-wrap: wrap;">
                <span style="
                  padding: var(--space-0_5) var(--space-1_5);
                  background: var(--danger-bg-subtle);
                  color: var(--color-danger);
                  border-radius: var(--radius-sm);
                  font-size: var(--text-xs);
                  font-weight: var(--font-medium);
                ">HIGH</span>
              </div>
            </div>
          </div>

          <!-- Minimap -->
          <div style="
            position: absolute;
            bottom: var(--space-4);
            right: var(--space-4);
            width: 180px;
            height: 120px;
            background: var(--glass-bg-medium);
            backdrop-filter: blur(8px);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            box-shadow: var(--shadow-xl);
          ">
            <div style="
              padding: var(--space-2);
              border-bottom: 1px solid var(--glass-border);
              font-size: var(--text-xs);
              color: var(--text-muted);
              text-align: center;
            ">Minimap</div>
          </div>

          <!-- Zoom Controls -->
          <div style="
            position: absolute;
            bottom: var(--space-4);
            left: var(--space-4);
            display: flex;
            flex-direction: column;
            gap: var(--space-1);
          ">
            <button style="
              width: 40px;
              height: 40px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: var(--glass-bg-medium);
              backdrop-filter: blur(8px);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-md);
              color: var(--text-secondary);
              cursor: pointer;
            ">
              <ZoomIn :size="20" />
            </button>
            <button style="
              width: 40px;
              height: 40px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: var(--glass-bg-medium);
              backdrop-filter: blur(8px);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-md);
              color: var(--text-secondary);
              cursor: pointer;
            ">
              <ZoomOut :size="20" />
            </button>
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
      return { Plus, Grid3x3 }
    },
    template: `
      <div style="
        position: relative;
        width: 100vw;
        height: 100vh;
        background: var(--app-background-gradient);
        overflow: hidden;
      ">
        <!-- Canvas Toolbar -->
        <div style="
          position: absolute;
          top: var(--space-4);
          left: 50%;
          transform: translateX(-50%);
          z-index: 100;
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background: var(--glass-bg-medium);
          backdrop-filter: blur(16px);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-2xl);
        ">
          <button style="
            display: flex;
            align-items: center;
            gap: var(--space-2);
            padding: var(--space-2) var(--space-3);
            background: var(--primary-bg);
            color: var(--primary-text);
            border: none;
            border-radius: var(--radius-md);
            cursor: pointer;
            font-size: var(--text-sm);
            font-weight: var(--font-medium);
          ">
            <Plus :size="16" />
            <span>Add Task</span>
          </button>
          <button style="
            display: flex;
            align-items: center;
            gap: var(--space-2);
            padding: var(--space-2) var(--space-3);
            background: transparent;
            color: var(--text-secondary);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            cursor: pointer;
            font-size: var(--text-sm);
          ">
            <Grid3x3 :size="16" />
            <span>Create Group</span>
          </button>
        </div>

        <!-- Canvas with Grid -->
        <div style="
          width: 100%;
          height: 100%;
          background-image: radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px);
          background-size: 16px 16px;
          position: relative;
        ">
          <!-- Empty State -->
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            max-width: 400px;
          ">
            <div style="
              margin-bottom: var(--space-4);
            ">
              <Grid3x3 :size="64" style="
                color: var(--text-muted);
                opacity: 0.3;
                margin: 0 auto var(--space-4);
              " />
              <h3 style="
                font-size: var(--text-2xl);
                font-weight: var(--font-bold);
                color: var(--text-primary);
                margin: 0 0 var(--space-2) 0;
              ">Your canvas is empty</h3>
              <p style="
                font-size: var(--text-base);
                color: var(--text-secondary);
                margin: 0 0 var(--space-6) 0;
              ">Start organizing your tasks visually by adding them to the canvas</p>
            </div>

            <div style="
              display: flex;
              gap: var(--space-3);
              justify-content: center;
            ">
              <button style="
                display: flex;
                align-items: center;
                gap: var(--space-2);
                padding: var(--space-3) var(--space-4);
                background: var(--primary-bg);
                color: var(--primary-text);
                border: none;
                border-radius: var(--radius-md);
                cursor: pointer;
                font-size: var(--text-base);
                font-weight: var(--font-medium);
                box-shadow: var(--shadow-lg);
              ">
                <Plus :size="20" />
                <span>Add Your First Task</span>
              </button>
              <button style="
                display: flex;
                align-items: center;
                gap: var(--space-2);
                padding: var(--space-3) var(--space-4);
                background: var(--glass-bg-medium);
                backdrop-filter: blur(8px);
                color: var(--text-primary);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-md);
                cursor: pointer;
                font-size: var(--text-base);
              ">
                <Grid3x3 :size="20" />
                <span>Create Group</span>
              </button>
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
    components: { Plus, Grid3x3, Inbox, ZoomIn, ZoomOut },
    setup() {
      return { Plus, Grid3x3, Inbox, ZoomIn, ZoomOut }
    },
    template: `
      <div style="
        position: relative;
        width: 100vw;
        height: 100vh;
        background: var(--app-background-gradient);
        overflow: hidden;
      ">
        <!-- Canvas Toolbar -->
        <div style="
          position: absolute;
          top: var(--space-4);
          left: 50%;
          transform: translateX(-50%);
          z-index: 100;
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background: var(--glass-bg-medium);
          backdrop-filter: blur(16px);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-2xl);
        ">
          <button style="
            display: flex;
            align-items: center;
            gap: var(--space-2);
            padding: var(--space-2) var(--space-3);
            background: var(--primary-bg);
            color: var(--primary-text);
            border: none;
            border-radius: var(--radius-md);
            cursor: pointer;
            font-size: var(--text-sm);
            font-weight: var(--font-medium);
          ">
            <Plus :size="16" />
            <span>Add Task</span>
          </button>
          <button style="
            display: flex;
            align-items: center;
            gap: var(--space-2);
            padding: var(--space-2) var(--space-3);
            background: transparent;
            color: var(--text-secondary);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            cursor: pointer;
            font-size: var(--text-sm);
          ">
            <Grid3x3 :size="16" />
            <span>Create Group</span>
          </button>
        </div>

        <!-- Canvas Container -->
        <div style="
          width: 100%;
          height: 100%;
          background-image: radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px);
          background-size: 16px 16px;
          position: relative;
        ">
          <!-- Multiple task nodes scattered -->
          <div style="position: absolute; top: 100px; left: 150px; width: 240px; padding: var(--space-3); background: var(--canvas-task-bg); backdrop-filter: blur(12px); border: 1px solid var(--canvas-task-border); border-radius: var(--radius-lg); cursor: move;">
            <div style="font-size: var(--text-sm); color: var(--text-primary); font-weight: var(--font-medium);">Design landing page</div>
            <span style="padding: var(--space-0_5) var(--space-1_5); background: var(--danger-bg-subtle); color: var(--color-danger); border-radius: var(--radius-sm); font-size: var(--text-xs); display: inline-block; margin-top: var(--space-1);">HIGH</span>
          </div>

          <div style="position: absolute; top: 100px; left: 430px; width: 240px; padding: var(--space-3); background: var(--canvas-task-bg); backdrop-filter: blur(12px); border: 1px solid var(--canvas-task-border); border-radius: var(--radius-lg); cursor: move;">
            <div style="font-size: var(--text-sm); color: var(--text-primary); font-weight: var(--font-medium);">Code review</div>
            <span style="padding: var(--space-0_5) var(--space-1_5); background: var(--color-warning-alpha-10); color: var(--color-warning); border-radius: var(--radius-sm); font-size: var(--text-xs); display: inline-block; margin-top: var(--space-1);">MEDIUM</span>
          </div>

          <div style="position: absolute; top: 100px; left: 710px; width: 240px; padding: var(--space-3); background: var(--canvas-task-bg); backdrop-filter: blur(12px); border: 1px solid var(--canvas-task-border); border-radius: var(--radius-lg); cursor: move;">
            <div style="font-size: var(--text-sm); color: var(--text-primary); font-weight: var(--font-medium);">Team sync</div>
            <span style="padding: var(--space-0_5) var(--space-1_5); background: var(--blue-bg-light); color: var(--status-planned-text); border-radius: var(--radius-sm); font-size: var(--text-xs); display: inline-block; margin-top: var(--space-1);">LOW</span>
          </div>

          <div style="position: absolute; top: 240px; left: 150px; width: 240px; padding: var(--space-3); background: var(--canvas-task-bg); backdrop-filter: blur(12px); border: 1px solid var(--canvas-task-border); border-radius: var(--radius-lg); cursor: move;">
            <div style="font-size: var(--text-sm); color: var(--text-primary); font-weight: var(--font-medium);">Write documentation</div>
            <span style="padding: var(--space-0_5) var(--space-1_5); background: var(--blue-bg-light); color: var(--status-planned-text); border-radius: var(--radius-sm); font-size: var(--text-xs); display: inline-block; margin-top: var(--space-1);">LOW</span>
          </div>

          <div style="position: absolute; top: 240px; left: 430px; width: 240px; padding: var(--space-3); background: var(--canvas-task-bg); backdrop-filter: blur(12px); border: 1px solid var(--canvas-task-border); border-radius: var(--radius-lg); cursor: move;">
            <div style="font-size: var(--text-sm); color: var(--text-primary); font-weight: var(--font-medium);">Fix bug #123</div>
            <span style="padding: var(--space-0_5) var(--space-1_5); background: var(--danger-bg-subtle); color: var(--color-danger); border-radius: var(--radius-sm); font-size: var(--text-xs); display: inline-block; margin-top: var(--space-1);">HIGH</span>
          </div>

          <div style="position: absolute; top: 380px; left: 150px; width: 240px; padding: var(--space-3); background: var(--canvas-task-bg); backdrop-filter: blur(12px); border: 1px solid var(--canvas-task-border); border-radius: var(--radius-lg); cursor: move;">
            <div style="font-size: var(--text-sm); color: var(--text-primary); font-weight: var(--font-medium);">Update analytics</div>
            <span style="padding: var(--space-0_5) var(--space-1_5); background: var(--color-warning-alpha-10); color: var(--color-warning); border-radius: var(--radius-sm); font-size: var(--text-xs); display: inline-block; margin-top: var(--space-1);">MEDIUM</span>
          </div>

          <!-- Group 1 -->
          <div style="
            position: absolute;
            top: 100px;
            left: 990px;
            width: 320px;
            min-height: 180px;
            background: var(--canvas-group-bg);
            backdrop-filter: blur(16px);
            border: 2px solid var(--canvas-group-border);
            border-radius: var(--radius-xl);
            overflow: hidden;
          ">
            <div style="
              padding: var(--space-3);
              background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(147, 51, 234, 0.2));
              border-bottom: 1px solid var(--canvas-group-border);
            ">
              <div style="font-size: var(--text-base); font-weight: var(--font-semibold); color: var(--text-primary);">Sprint 12</div>
              <span style="font-size: var(--text-xs); color: var(--text-muted);">5 tasks</span>
            </div>
          </div>

          <!-- Group 2 -->
          <div style="
            position: absolute;
            top: 320px;
            left: 990px;
            width: 320px;
            min-height: 180px;
            background: var(--canvas-group-bg);
            backdrop-filter: blur(16px);
            border: 2px solid var(--canvas-group-border);
            border-radius: var(--radius-xl);
            overflow: hidden;
          ">
            <div style="
              padding: var(--space-3);
              background: linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(251, 146, 60, 0.2));
              border-bottom: 1px solid var(--canvas-group-border);
            ">
              <div style="font-size: var(--text-base); font-weight: var(--font-semibold); color: var(--text-primary);">Marketing</div>
              <span style="font-size: var(--text-xs); color: var(--text-muted);">3 tasks</span>
            </div>
          </div>

          <div style="position: absolute; top: 520px; left: 150px; width: 240px; padding: var(--space-3); background: var(--canvas-task-bg); backdrop-filter: blur(12px); border: 1px solid var(--canvas-task-border); border-radius: var(--radius-lg); cursor: move;">
            <div style="font-size: var(--text-sm); color: var(--text-primary); font-weight: var(--font-medium);">Client presentation</div>
            <span style="padding: var(--space-0_5) var(--space-1_5); background: var(--danger-bg-subtle); color: var(--color-danger); border-radius: var(--radius-sm); font-size: var(--text-xs); display: inline-block; margin-top: var(--space-1);">HIGH</span>
          </div>

          <div style="position: absolute; top: 520px; left: 430px; width: 240px; padding: var(--space-3); background: var(--canvas-task-bg); backdrop-filter: blur(12px); border: 1px solid var(--canvas-task-border); border-radius: var(--radius-lg); cursor: move;">
            <div style="font-size: var(--text-sm); color: var(--text-primary); font-weight: var(--font-medium);">Research competitors</div>
            <span style="padding: var(--space-0_5) var(--space-1_5); background: var(--blue-bg-light); color: var(--status-planned-text); border-radius: var(--radius-sm); font-size: var(--text-xs); display: inline-block; margin-top: var(--space-1);">LOW</span>
          </div>
        </div>

        <!-- Minimap -->
        <div style="
          position: absolute;
          bottom: var(--space-4);
          right: var(--space-4);
          width: 180px;
          height: 120px;
          background: var(--glass-bg-medium);
          backdrop-filter: blur(8px);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-xl);
        ">
          <div style="
            padding: var(--space-2);
            border-bottom: 1px solid var(--glass-border);
            font-size: var(--text-xs);
            color: var(--text-muted);
            text-align: center;
          ">Minimap</div>
          <!-- Mini dots representing nodes -->
          <div style="padding: var(--space-2); position: relative;">
            <div style="position: absolute; top: 10px; left: 20px; width: 4px; height: 4px; background: var(--primary-bg); border-radius: 50%;"></div>
            <div style="position: absolute; top: 15px; left: 50px; width: 4px; height: 4px; background: var(--primary-bg); border-radius: 50%;"></div>
            <div style="position: absolute; top: 25px; left: 80px; width: 4px; height: 4px; background: var(--primary-bg); border-radius: 50%;"></div>
            <div style="position: absolute; top: 40px; left: 30px; width: 4px; height: 4px; background: var(--primary-bg); border-radius: 50%;"></div>
            <div style="position: absolute; top: 50px; left: 60px; width: 4px; height: 4px; background: var(--primary-bg); border-radius: 50%;"></div>
            <div style="position: absolute; top: 30px; left: 120px; width: 8px; height: 8px; background: rgba(59, 130, 246, 0.5); border-radius: var(--radius-sm);"></div>
            <div style="position: absolute; top: 60px; left: 120px; width: 8px; height: 8px; background: rgba(236, 72, 153, 0.5); border-radius: var(--radius-sm);"></div>
          </div>
        </div>

        <!-- Zoom Controls -->
        <div style="
          position: absolute;
          bottom: var(--space-4);
          left: var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        ">
          <button style="
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--glass-bg-medium);
            backdrop-filter: blur(8px);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            color: var(--text-secondary);
            cursor: pointer;
          ">
            <ZoomIn :size="20" />
          </button>
          <button style="
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--glass-bg-medium);
            backdrop-filter: blur(8px);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            color: var(--text-secondary);
            cursor: pointer;
          ">
            <ZoomOut :size="20" />
          </button>
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
      return { Plus, Grid3x3, ZoomIn, ZoomOut }
    },
    template: `
      <div style="
        position: relative;
        width: 100vw;
        height: 100vh;
        background: var(--app-background-gradient);
        overflow: hidden;
      ">
        <!-- Canvas Toolbar -->
        <div style="
          position: absolute;
          top: var(--space-4);
          left: 50%;
          transform: translateX(-50%);
          z-index: 100;
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background: var(--glass-bg-medium);
          backdrop-filter: blur(16px);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-2xl);
        ">
          <button style="
            display: flex;
            align-items: center;
            gap: var(--space-2);
            padding: var(--space-2) var(--space-3);
            background: var(--primary-bg);
            color: var(--primary-text);
            border: none;
            border-radius: var(--radius-md);
            cursor: pointer;
            font-size: var(--text-sm);
            font-weight: var(--font-medium);
          ">
            <Plus :size="16" />
            <span>Add Task</span>
          </button>
          <button style="
            display: flex;
            align-items: center;
            gap: var(--space-2);
            padding: var(--space-2) var(--space-3);
            background: transparent;
            color: var(--text-secondary);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            cursor: pointer;
            font-size: var(--text-sm);
          ">
            <Grid3x3 :size="16" />
            <span>Create Group</span>
          </button>
        </div>

        <!-- Canvas Container -->
        <div style="
          width: 100%;
          height: 100%;
          background-image: radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px);
          background-size: 16px 16px;
          position: relative;
        ">
          <!-- Task Node 1 (Selected) -->
          <div style="
            position: absolute;
            top: 200px;
            left: 250px;
            width: 280px;
            padding: var(--space-3);
            background: var(--canvas-task-bg);
            backdrop-filter: blur(12px);
            border: 2px solid var(--primary-bg);
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-xl), 0 0 20px rgba(59, 130, 246, 0.3);
            cursor: move;
          ">
            <div style="
              display: flex;
              align-items: start;
              gap: var(--space-2);
              margin-bottom: var(--space-2);
            ">
              <input type="checkbox" style="
                margin-top: 2px;
                cursor: pointer;
              " />
              <div style="
                flex: 1;
                font-size: var(--text-sm);
                color: var(--text-primary);
                font-weight: var(--font-medium);
              ">Review Q4 marketing proposal</div>
            </div>
            <div style="display: flex; gap: var(--space-2); flex-wrap: wrap;">
              <span style="
                padding: var(--space-0_5) var(--space-1_5);
                background: var(--danger-bg-subtle);
                color: var(--color-danger);
                border-radius: var(--radius-sm);
                font-size: var(--text-xs);
                font-weight: var(--font-medium);
              ">HIGH</span>
            </div>
          </div>

          <!-- Task Node 2 (Selected) -->
          <div style="
            position: absolute;
            top: 350px;
            left: 250px;
            width: 280px;
            padding: var(--space-3);
            background: var(--canvas-task-bg);
            backdrop-filter: blur(12px);
            border: 2px solid var(--primary-bg);
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-xl), 0 0 20px rgba(59, 130, 246, 0.3);
            cursor: move;
          ">
            <div style="
              display: flex;
              align-items: start;
              gap: var(--space-2);
              margin-bottom: var(--space-2);
            ">
              <input type="checkbox" style="
                margin-top: 2px;
                cursor: pointer;
              " />
              <div style="
                flex: 1;
                font-size: var(--text-sm);
                color: var(--text-primary);
                font-weight: var(--font-medium);
              ">Update team documentation</div>
            </div>
            <div style="display: flex; gap: var(--space-2); flex-wrap: wrap;">
              <span style="
                padding: var(--space-0_5) var(--space-1_5);
                background: var(--color-warning-alpha-10);
                color: var(--color-warning);
                border-radius: var(--radius-sm);
                font-size: var(--text-xs);
                font-weight: var(--font-medium);
              ">MEDIUM</span>
            </div>
          </div>

          <!-- Task Node 3 (Not Selected) -->
          <div style="
            position: absolute;
            top: 200px;
            left: 580px;
            width: 280px;
            padding: var(--space-3);
            background: var(--canvas-task-bg);
            backdrop-filter: blur(12px);
            border: 1px solid var(--canvas-task-border);
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-lg);
            cursor: move;
          ">
            <div style="
              display: flex;
              align-items: start;
              gap: var(--space-2);
              margin-bottom: var(--space-2);
            ">
              <input type="checkbox" style="
                margin-top: 2px;
                cursor: pointer;
              " />
              <div style="
                flex: 1;
                font-size: var(--text-sm);
                color: var(--text-primary);
                font-weight: var(--font-medium);
              ">Schedule client call</div>
            </div>
            <div style="display: flex; gap: var(--space-2); flex-wrap: wrap;">
              <span style="
                padding: var(--space-0_5) var(--space-1_5);
                background: var(--blue-bg-light);
                color: var(--status-planned-text);
                border-radius: var(--radius-sm);
                font-size: var(--text-xs);
                font-weight: var(--font-medium);
              ">LOW</span>
            </div>
          </div>

          <!-- Rubber-band Selection Box -->
          <div style="
            position: absolute;
            top: 190px;
            left: 240px;
            width: 300px;
            height: 190px;
            border: 2px dashed var(--primary-bg);
            background: rgba(59, 130, 246, 0.1);
            border-radius: var(--radius-md);
            pointer-events: none;
            animation: pulse 1.5s ease-in-out infinite;
          "></div>

          <!-- Selection Hint -->
          <div style="
            position: absolute;
            top: 400px;
            left: 580px;
            padding: var(--space-2) var(--space-3);
            background: var(--glass-bg-medium);
            backdrop-filter: blur(8px);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            font-size: var(--text-xs);
            color: var(--text-muted);
            box-shadow: var(--shadow-lg);
          ">
            <div style="margin-bottom: var(--space-1); color: var(--text-primary); font-weight: var(--font-semibold);">Multi-Select Active</div>
            <div>2 tasks selected</div>
            <div style="margin-top: var(--space-1); color: var(--text-secondary);">Hold Shift and drag to select</div>
          </div>
        </div>

        <!-- Minimap -->
        <div style="
          position: absolute;
          bottom: var(--space-4);
          right: var(--space-4);
          width: 180px;
          height: 120px;
          background: var(--glass-bg-medium);
          backdrop-filter: blur(8px);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-xl);
        ">
          <div style="
            padding: var(--space-2);
            border-bottom: 1px solid var(--glass-border);
            font-size: var(--text-xs);
            color: var(--text-muted);
            text-align: center;
          ">Minimap</div>
        </div>

        <!-- Zoom Controls -->
        <div style="
          position: absolute;
          bottom: var(--space-4);
          left: var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        ">
          <button style="
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--glass-bg-medium);
            backdrop-filter: blur(8px);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            color: var(--text-secondary);
            cursor: pointer;
          ">
            <ZoomIn :size="20" />
          </button>
          <button style="
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--glass-bg-medium);
            backdrop-filter: blur(8px);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            color: var(--text-secondary);
            cursor: pointer;
          ">
            <ZoomOut :size="20" />
          </button>
        </div>

        <style>
          @keyframes pulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 0.3; }
          }
        </style>
      </div>
    `
  })
}
