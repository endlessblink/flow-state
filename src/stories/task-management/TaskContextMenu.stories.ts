import type { Meta, StoryObj } from '@storybook/vue3'

/**
 * # TaskContextMenu
 *
 * The right-click context menu for tasks across Board, Calendar, and Canvas views.
 * Provides quick access to task actions: edit, status toggle, due date, priority,
 * project assignment, timer, AI assist, and delete.
 *
 * **Note:** The actual component uses `<Teleport to="body">` with `position: fixed`,
 * so it renders outside Storybook's iframe. These stories use inline visual replicas
 * that faithfully reproduce the menu's CSS and layout using the same design tokens.
 *
 * ## Features
 * - Glass morphism backdrop with slide-in animation
 * - Submenu system for Due Date, Priority, Project, and More options
 * - Batch mode for multi-task operations
 * - Keyboard shortcut hints
 * - AI Assist integration
 */

// Dummy component placeholder — stories use render functions with inline replicas
const DummyComponent = { template: '<div />' }

const meta = {
  title: '📝 Task Management/TaskContextMenu',
  component: DummyComponent as any,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Right-click context menu for tasks. Uses `<Teleport to="body">` in production — stories show inline replicas with identical CSS.'
      }
    }
  }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

// Shared inline styles matching the real component's scoped CSS
const menuStyle = `
  background: var(--overlay-component-bg);
  backdrop-filter: var(--overlay-component-backdrop);
  -webkit-backdrop-filter: var(--overlay-component-backdrop);
  border: var(--overlay-component-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--overlay-component-shadow), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  padding: var(--space-2) 0;
  min-width: 240px;
  max-width: 280px;
  overflow: hidden;
`

const menuItemStyle = `
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-primary);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  text-align: start;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
`

const dividerStyle = `
  height: 1px;
  background: var(--glass-bg-heavy);
  margin: var(--space-2) 0;
`

const headerStyle = `
  padding: var(--space-1_5) var(--space-3);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-muted);
  background: var(--glass-bg-light);
  border-bottom: 1px solid var(--glass-border-light);
  margin-bottom: var(--space-1);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const shortcutStyle = `
  color: var(--text-muted);
  font-size: var(--text-xs);
  opacity: 0.6;
  margin-inline-start: auto;
`

const valueStyle = `
  color: var(--text-muted);
  font-size: var(--text-xs);
  margin-inline-start: auto;
  margin-inline-end: var(--space-1);
`

const arrowStyle = `
  color: var(--text-muted);
  font-size: 10px;
`

const submenuStyle = `
  background: var(--overlay-component-bg);
  backdrop-filter: var(--overlay-component-backdrop);
  -webkit-backdrop-filter: var(--overlay-component-backdrop);
  border: var(--overlay-component-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--overlay-component-shadow);
  padding: var(--space-2) 0;
  min-width: 160px;
`

const priorityDotStyle = (color: string) => `
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
  background: ${color};
`

const iconBase = `width: 16px; height: 16px; flex-shrink: 0; opacity: 0.8;`

// Inline SVG icons matching the Lucide icons used in the real component
const icons = {
  pencil: (color = 'currentColor') => `<svg style="${iconBase}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,
  checkCircle: (color = 'currentColor') => `<svg style="${iconBase}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  checkCircleFilled: (color = 'var(--brand-primary)') => `<svg style="${iconBase}; opacity: 1;" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  calendar: (color = 'currentColor') => `<svg style="${iconBase}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`,
  folderOpen: (color = 'currentColor') => `<svg style="${iconBase}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/></svg>`,
  timer: (color = 'currentColor') => `<svg style="${iconBase}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/></svg>`,
  sparkles: (color = 'var(--brand-primary)') => `<svg style="${iconBase}; opacity: 1;" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>`,
  moreHorizontal: (color = 'currentColor') => `<svg style="${iconBase}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`,
  trash: (color = 'var(--danger-text)') => `<svg style="${iconBase}; opacity: 1;" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`,
  chevronRight: `<svg style="width: 14px; height: 14px; color: var(--text-muted); margin-inline-start: auto;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
}

/**
 * Full context menu as it appears when right-clicking a task.
 * Shows all menu items with their icons, shortcuts, and current values.
 */
export const FullMenu: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-8); display: flex; gap: var(--space-8); align-items: flex-start;">
        <!-- Context: task row that was right-clicked -->
        <div style="display: flex; flex-direction: column; gap: var(--space-3); width: 320px;">
          <div style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Task Row (right-clicked)</div>
          <div style="
            background: var(--glass-bg-soft);
            border: 1px solid var(--brand-primary);
            border-radius: var(--radius-md);
            padding: var(--space-3) var(--space-4);
            display: flex;
            align-items: center;
            gap: var(--space-3);
          ">
            <div style="${priorityDotStyle('var(--color-priority-high)')}"></div>
            <span style="font-size: var(--text-sm); color: var(--text-primary); flex: 1;">Complete project documentation</span>
            <span style="font-size: var(--text-xs); color: var(--text-muted);">Dec 25</span>
          </div>
          <div style="font-size: var(--text-xs); color: var(--text-tertiary); margin-top: var(--space-2);">
            Right-click opens the context menu to the right of the cursor position.
            The menu auto-positions to stay within viewport bounds.
          </div>
        </div>

        <!-- The context menu -->
        <div style="display: flex; flex-direction: column; gap: var(--space-2);">
          <div style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Context Menu</div>
          <div style="${menuStyle}">
            <!-- Edit -->
            <div style="${menuItemStyle}">
              ${icons.pencil()}
              <span style="flex: 1;">Edit</span>
              <span style="${shortcutStyle}">Ctrl+E</span>
            </div>

            <!-- Mark as Done -->
            <div style="${menuItemStyle}">
              ${icons.checkCircle()}
              <span style="flex: 1;">Mark as Done</span>
            </div>

            <div style="${dividerStyle}"></div>

            <!-- Due Date -->
            <div style="${menuItemStyle}">
              ${icons.calendar()}
              <span style="flex: 1;">Due Date</span>
              <span style="${valueStyle}">Dec 25</span>
              ${icons.chevronRight}
            </div>

            <!-- Priority -->
            <div style="${menuItemStyle}">
              <div style="${priorityDotStyle('var(--color-priority-high)')}"></div>
              <span style="flex: 1;">Priority</span>
              <span style="${valueStyle}">High</span>
              ${icons.chevronRight}
            </div>

            <!-- Project -->
            <div style="${menuItemStyle}">
              ${icons.folderOpen()}
              <span style="flex: 1;">Project</span>
              <span style="${valueStyle}">No Project</span>
              ${icons.chevronRight}
            </div>

            <div style="${dividerStyle}"></div>

            <!-- Start Timer -->
            <div style="${menuItemStyle}">
              ${icons.timer()}
              <span style="flex: 1;">Start Timer</span>
            </div>

            <!-- AI Assist -->
            <div style="${menuItemStyle}; color: var(--brand-primary);">
              ${icons.sparkles()}
              <span style="flex: 1;">AI Assist</span>
            </div>

            <div style="${dividerStyle}"></div>

            <!-- More -->
            <div style="${menuItemStyle}">
              ${icons.moreHorizontal()}
              <span style="flex: 1;">More</span>
              ${icons.chevronRight}
            </div>

            <div style="${dividerStyle}"></div>

            <!-- Delete -->
            <div style="${menuItemStyle}; color: var(--danger-text);">
              ${icons.trash()}
              <span style="flex: 1;">Delete</span>
            </div>

            <!-- Permanently Delete -->
            <div style="${menuItemStyle}; color: var(--danger-text); opacity: 0.7;">
              ${icons.trash()}
              <span style="flex: 1;">Permanently Delete</span>
            </div>
          </div>
        </div>
      </div>
    `
  })
}

/**
 * Context menu with the Due Date submenu expanded.
 * Shows the cascading submenu with quick date options and a date picker trigger.
 */
export const WithDueDateSubmenu: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-8); display: flex; gap: var(--space-2); align-items: flex-start;">
        <!-- Main menu -->
        <div style="${menuStyle}">
          <div style="${menuItemStyle}">
            ${icons.pencil()}
            <span style="flex: 1;">Edit</span>
            <span style="${shortcutStyle}">Ctrl+E</span>
          </div>
          <div style="${menuItemStyle}">
            ${icons.checkCircle()}
            <span style="flex: 1;">Mark as Done</span>
          </div>
          <div style="${dividerStyle}"></div>
          <!-- Due Date - highlighted as hovered -->
          <div style="${menuItemStyle}; background: var(--glass-bg-heavy);">
            ${icons.calendar()}
            <span style="flex: 1;">Due Date</span>
            <span style="${valueStyle}">Today</span>
            ${icons.chevronRight}
          </div>
          <div style="${menuItemStyle}">
            <div style="${priorityDotStyle('var(--color-priority-medium)')}"></div>
            <span style="flex: 1;">Priority</span>
            <span style="${valueStyle}">Medium</span>
            ${icons.chevronRight}
          </div>
          <div style="${menuItemStyle}">
            ${icons.folderOpen()}
            <span style="flex: 1;">Project</span>
            <span style="${valueStyle}">Work</span>
            ${icons.chevronRight}
          </div>
          <div style="${dividerStyle}"></div>
          <div style="${menuItemStyle}">
            ${icons.timer()}
            <span style="flex: 1;">Start Timer</span>
          </div>
          <div style="${menuItemStyle}; color: var(--brand-primary);">
            ${icons.sparkles()}
            <span style="flex: 1;">AI Assist</span>
          </div>
          <div style="${dividerStyle}"></div>
          <div style="${menuItemStyle}">
            ${icons.moreHorizontal()}
            <span style="flex: 1;">More</span>
            ${icons.chevronRight}
          </div>
          <div style="${dividerStyle}"></div>
          <div style="${menuItemStyle}; color: var(--danger-text);">
            ${icons.trash()}
            <span style="flex: 1;">Delete</span>
          </div>
        </div>

        <!-- Due Date submenu -->
        <div style="${submenuStyle}; min-width: 180px;">
          <div style="${menuItemStyle}">
            <span style="flex: 1;">Today</span>
            <span style="${valueStyle}">Thu</span>
          </div>
          <div style="${menuItemStyle}">
            <span style="flex: 1;">Tomorrow</span>
            <span style="${valueStyle}">Fri</span>
          </div>
          <div style="${menuItemStyle}">
            <span style="flex: 1;">This Weekend</span>
            <span style="${valueStyle}">Sat</span>
          </div>
          <div style="${menuItemStyle}">
            <span style="flex: 1;">Next Week</span>
            <span style="${valueStyle}">Mon</span>
          </div>
          <div style="${dividerStyle}"></div>
          <div style="${menuItemStyle}">
            ${icons.calendar()}
            <span style="flex: 1;">Pick Date...</span>
          </div>
          <div style="${dividerStyle}"></div>
          <div style="${menuItemStyle}; color: var(--danger-text);">
            <span style="flex: 1;">Clear Date</span>
          </div>
        </div>
      </div>
    `
  })
}

/**
 * Context menu with the Priority submenu expanded.
 * Shows all priority levels with colored dots matching the design system.
 */
export const WithPrioritySubmenu: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-8); display: flex; gap: var(--space-2); align-items: flex-start;">
        <!-- Main menu (compact) -->
        <div style="${menuStyle}">
          <div style="${menuItemStyle}">
            ${icons.pencil()}
            <span style="flex: 1;">Edit</span>
            <span style="${shortcutStyle}">Ctrl+E</span>
          </div>
          <div style="${menuItemStyle}">
            ${icons.checkCircle()}
            <span style="flex: 1;">Mark as Done</span>
          </div>
          <div style="${dividerStyle}"></div>
          <div style="${menuItemStyle}">
            ${icons.calendar()}
            <span style="flex: 1;">Due Date</span>
            ${icons.chevronRight}
          </div>
          <!-- Priority - highlighted -->
          <div style="${menuItemStyle}; background: var(--glass-bg-heavy);">
            <div style="${priorityDotStyle('var(--color-priority-high)')}"></div>
            <span style="flex: 1;">Priority</span>
            <span style="${valueStyle}">High</span>
            ${icons.chevronRight}
          </div>
          <div style="${menuItemStyle}">
            ${icons.folderOpen()}
            <span style="flex: 1;">Project</span>
            ${icons.chevronRight}
          </div>
          <div style="${dividerStyle}"></div>
          <div style="${menuItemStyle}; color: var(--danger-text);">
            ${icons.trash()}
            <span style="flex: 1;">Delete</span>
          </div>
        </div>

        <!-- Priority submenu -->
        <div style="${submenuStyle}; min-width: 150px;">
          <div style="${menuItemStyle}; color: var(--brand-primary);">
            <div style="${priorityDotStyle('var(--color-priority-high)')}"></div>
            <span style="flex: 1;">High</span>
            <span style="font-size: var(--text-xs); opacity: 0.6;">&#10003;</span>
          </div>
          <div style="${menuItemStyle}">
            <div style="${priorityDotStyle('var(--color-priority-medium)')}"></div>
            <span style="flex: 1;">Medium</span>
          </div>
          <div style="${menuItemStyle}">
            <div style="${priorityDotStyle('var(--color-priority-low)')}"></div>
            <span style="flex: 1;">Low</span>
          </div>
          <div style="${dividerStyle}"></div>
          <div style="${menuItemStyle}; color: var(--text-muted);">
            <span style="flex: 1;">Clear Priority</span>
          </div>
        </div>
      </div>
    `
  })
}

/**
 * Batch mode — when multiple tasks are selected.
 * Shows the header with selection count and batch-specific actions.
 * Single-task-only items (Edit, Permanently Delete) are hidden.
 */
export const BatchSelection: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-8); display: flex; gap: var(--space-8); align-items: flex-start;">
        <!-- Context: selected tasks -->
        <div style="display: flex; flex-direction: column; gap: var(--space-2); width: 320px;">
          <div style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Selected Tasks (5)</div>
          <div v-for="(task, i) in [
            { title: 'Complete documentation', priority: 'high' },
            { title: 'Fix login bug', priority: 'medium' },
            { title: 'Update dependencies', priority: 'low' },
            { title: 'Write unit tests', priority: 'medium' },
            { title: 'Deploy to staging', priority: 'high' }
          ]" :key="i" style="
            background: var(--glass-bg-soft);
            border: 1px solid var(--brand-primary);
            border-radius: var(--radius-md);
            padding: var(--space-2) var(--space-3);
            display: flex;
            align-items: center;
            gap: var(--space-2);
            opacity: 0.9;
          ">
            <div style="width: 14px; height: 14px; border: 1.5px solid var(--brand-primary); border-radius: var(--radius-xs); display: flex; align-items: center; justify-content: center;">
              <span style="font-size: 9px; color: var(--brand-primary);">&#10003;</span>
            </div>
            <span style="font-size: var(--text-sm); color: var(--text-primary);">{{ task.title }}</span>
          </div>
        </div>

        <!-- Batch context menu -->
        <div style="display: flex; flex-direction: column; gap: var(--space-2);">
          <div style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Batch Context Menu</div>
          <div style="${menuStyle}">
            <!-- Batch header -->
            <div style="${headerStyle}">5 SELECTED</div>

            <!-- No Edit in batch mode -->

            <!-- Mark as Done (batch) -->
            <div style="${menuItemStyle}">
              ${icons.checkCircle()}
              <span style="flex: 1;">Mark 5 as Done</span>
            </div>

            <div style="${dividerStyle}"></div>

            <div style="${menuItemStyle}">
              ${icons.calendar()}
              <span style="flex: 1;">Due Date</span>
              ${icons.chevronRight}
            </div>
            <div style="${menuItemStyle}">
              <div style="${priorityDotStyle('var(--text-muted)')}; opacity: 0.4;"></div>
              <span style="flex: 1;">Priority</span>
              ${icons.chevronRight}
            </div>
            <div style="${menuItemStyle}">
              ${icons.folderOpen()}
              <span style="flex: 1;">Project</span>
              ${icons.chevronRight}
            </div>

            <div style="${dividerStyle}"></div>

            <div style="${menuItemStyle}">
              ${icons.timer()}
              <span style="flex: 1;">Start Timer</span>
            </div>
            <div style="${menuItemStyle}; color: var(--brand-primary);">
              ${icons.sparkles()}
              <span style="flex: 1;">AI Assist</span>
            </div>

            <div style="${dividerStyle}"></div>

            <div style="${menuItemStyle}">
              ${icons.moreHorizontal()}
              <span style="flex: 1;">More</span>
              ${icons.chevronRight}
            </div>

            <div style="${dividerStyle}"></div>

            <!-- Delete batch -->
            <div style="${menuItemStyle}; color: var(--danger-text);">
              ${icons.trash()}
              <span style="flex: 1;">Delete 5</span>
            </div>

            <!-- No Permanently Delete in batch mode -->
          </div>
        </div>
      </div>
    `
  })
}

/**
 * Side-by-side comparison of the "Mark as Done" vs "Mark as To Do" states.
 * When a task is already done, the toggle label and icon color change.
 */
export const DoneVsTodo: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-8); display: flex; gap: var(--space-8); align-items: flex-start;">
        <!-- Todo task menu -->
        <div style="display: flex; flex-direction: column; gap: var(--space-2);">
          <div style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Status: To Do</div>
          <div style="${menuStyle}">
            <div style="${menuItemStyle}">
              ${icons.pencil()}
              <span style="flex: 1;">Edit</span>
              <span style="${shortcutStyle}">Ctrl+E</span>
            </div>
            <div style="${menuItemStyle}">
              ${icons.checkCircle()}
              <span style="flex: 1;">Mark as Done</span>
            </div>
            <div style="${dividerStyle}"></div>
            <div style="${menuItemStyle}">
              ${icons.calendar()}
              <span style="flex: 1;">Due Date</span>
              ${icons.chevronRight}
            </div>
            <div style="${menuItemStyle}">
              <div style="${priorityDotStyle('var(--color-priority-high)')}"></div>
              <span style="flex: 1;">Priority</span>
              <span style="${valueStyle}">High</span>
              ${icons.chevronRight}
            </div>
          </div>
        </div>

        <!-- Done task menu -->
        <div style="display: flex; flex-direction: column; gap: var(--space-2);">
          <div style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Status: Done</div>
          <div style="${menuStyle}">
            <div style="${menuItemStyle}">
              ${icons.pencil()}
              <span style="flex: 1;">Edit</span>
              <span style="${shortcutStyle}">Ctrl+E</span>
            </div>
            <div style="${menuItemStyle}">
              ${icons.checkCircleFilled()}
              <span style="flex: 1;">Mark as To Do</span>
            </div>
            <div style="${dividerStyle}"></div>
            <div style="${menuItemStyle}">
              ${icons.calendar()}
              <span style="flex: 1;">Due Date</span>
              ${icons.chevronRight}
            </div>
            <div style="${menuItemStyle}">
              <div style="${priorityDotStyle('var(--color-priority-low)')}"></div>
              <span style="flex: 1;">Priority</span>
              <span style="${valueStyle}">Low</span>
              ${icons.chevronRight}
            </div>
          </div>
        </div>
      </div>
    `
  })
}

/**
 * CSS anatomy breakdown of the context menu.
 * Shows the design tokens, spacing, and visual properties used.
 */
export const Anatomy: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-8); display: flex; flex-direction: column; gap: var(--space-8);">
        <!-- Token reference table -->
        <div style="display: flex; flex-direction: column; gap: var(--space-3);">
          <div style="font-size: var(--text-sm); font-weight: 600; color: var(--text-primary);">Design Token Reference</div>
          <div style="display: grid; grid-template-columns: 200px 1fr 1fr; gap: 1px; background: var(--glass-border); border-radius: var(--radius-md); overflow: hidden; font-size: var(--text-xs);">
            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-medium); color: var(--text-muted); font-weight: 600;">Property</div>
            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-medium); color: var(--text-muted); font-weight: 600;">Token</div>
            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-medium); color: var(--text-muted); font-weight: 600;">Preview</div>

            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); color: var(--text-secondary);">Background</div>
            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); color: var(--text-tertiary); font-family: monospace;">--overlay-component-bg</div>
            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft);"><div style="width: 40px; height: 16px; background: var(--overlay-component-bg); border-radius: var(--radius-xs); border: 1px solid var(--glass-border);"></div></div>

            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); color: var(--text-secondary);">Hover State</div>
            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); color: var(--text-tertiary); font-family: monospace;">--glass-bg-heavy</div>
            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft);"><div style="width: 40px; height: 16px; background: var(--glass-bg-heavy); border-radius: var(--radius-xs); border: 1px solid var(--glass-border);"></div></div>

            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); color: var(--text-secondary);">Danger Text</div>
            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); color: var(--text-tertiary); font-family: monospace;">--danger-text</div>
            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft);"><span style="color: var(--danger-text); font-weight: 600;">Delete</span></div>

            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); color: var(--text-secondary);">AI Accent</div>
            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); color: var(--text-tertiary); font-family: monospace;">--brand-primary</div>
            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft);"><span style="color: var(--brand-primary); font-weight: 600;">AI Assist</span></div>

            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); color: var(--text-secondary);">Border Radius</div>
            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); color: var(--text-tertiary); font-family: monospace;">--radius-lg</div>
            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft);"><div style="width: 40px; height: 16px; background: var(--glass-bg-medium); border-radius: var(--radius-lg); border: 1px solid var(--glass-border);"></div></div>

            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); color: var(--text-secondary);">Priority High</div>
            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); color: var(--text-tertiary); font-family: monospace;">--color-priority-high</div>
            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft);"><div style="${priorityDotStyle('var(--color-priority-high)')}"></div></div>

            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); color: var(--text-secondary);">Priority Medium</div>
            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); color: var(--text-tertiary); font-family: monospace;">--color-priority-medium</div>
            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft);"><div style="${priorityDotStyle('var(--color-priority-medium)')}"></div></div>

            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); color: var(--text-secondary);">Priority Low</div>
            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); color: var(--text-tertiary); font-family: monospace;">--color-priority-low</div>
            <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft);"><div style="${priorityDotStyle('var(--color-priority-low)')}"></div></div>
          </div>
        </div>

        <!-- Sizing info -->
        <div style="display: flex; gap: var(--space-6);">
          <div style="display: flex; flex-direction: column; gap: var(--space-2);">
            <div style="font-size: var(--text-sm); font-weight: 600; color: var(--text-primary);">Menu Dimensions</div>
            <div style="font-size: var(--text-xs); color: var(--text-tertiary); line-height: 1.6;">
              <div>Min width: <span style="color: var(--text-secondary); font-family: monospace;">240px</span></div>
              <div>Max width: <span style="color: var(--text-secondary); font-family: monospace;">280px</span></div>
              <div>Max height: <span style="color: var(--text-secondary); font-family: monospace;">calc(100vh - 16px)</span></div>
              <div>Item padding: <span style="color: var(--text-secondary); font-family: monospace;">var(--space-2) var(--space-3)</span></div>
              <div>Font size: <span style="color: var(--text-secondary); font-family: monospace;">var(--text-sm)</span></div>
              <div>Animation: <span style="color: var(--text-secondary); font-family: monospace;">150ms ease-out scale+fade</span></div>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: var(--space-2);">
            <div style="font-size: var(--text-sm); font-weight: 600; color: var(--text-primary);">Submenu Behavior</div>
            <div style="font-size: var(--text-xs); color: var(--text-tertiary); line-height: 1.6;">
              <div>Position: <span style="color: var(--text-secondary);">Right of menu (flips left if no space)</span></div>
              <div>Open delay: <span style="color: var(--text-secondary); font-family: monospace;">0ms</span> (immediate on hover)</div>
              <div>Switch delay: <span style="color: var(--text-secondary); font-family: monospace;">80ms</span> (between submenus)</div>
              <div>Close delay: <span style="color: var(--text-secondary); font-family: monospace;">150ms</span> (panel leave)</div>
              <div>Safe polygon: <span style="color: var(--text-secondary);">Tracks cursor path to submenu</span></div>
              <div>Z-index: <span style="color: var(--text-secondary); font-family: monospace;">var(--z-context-menu, 9999)</span></div>
            </div>
          </div>
        </div>
      </div>
    `
  })
}
