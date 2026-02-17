import type { Meta, StoryObj } from '@storybook/vue3'
import CanvasContextMenu from '@/components/canvas/CanvasContextMenu.vue'
import type { CanvasSection } from '@/stores/canvas'

/**
 * CanvasContextMenu - Context-sensitive menu for canvas interactions
 *
 * Shows different options based on:
 * - **Empty canvas**: Create Task Here, Create Group
 * - **Right-click on group**: Group-specific actions (Add Task, Edit, Settings, Power Mode, Delete)
 * - **Selected tasks (1+)**: Move to Inbox, Delete Tasks
 * - **Multiple selected tasks (2+)**: Layout submenu with align/distribute/arrange options
 *
 * Uses glass morphism styling with `--overlay-component-*` tokens.
 */
const meta: Meta<typeof CanvasContextMenu> = {
  title: '🎨 Canvas/CanvasContextMenu',
  component: CanvasContextMenu,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0f172a' },
      ],
    },
    docs: {
      story: {
        inline: false,
        iframeHeight: 500,
      },
      description: {
        component: `Context menu for canvas interactions. Shows different options based on context:

**States:**
- Empty canvas right-click: Create Task, Create Group
- Group right-click: Group actions (edit, settings, power mode, delete)
- Selected tasks: Move to Inbox, Delete
- Multiple selections: Layout submenu (align, distribute, arrange)`
      }
    }
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="
          min-height: 600px;
          width: 100%;
          background: var(--app-background-gradient);
          position: relative;
          padding: 6.25rem var(--space-16);
        ">
          <story />
        </div>
      `
    })
  ],
  argTypes: {
    isVisible: {
      control: 'boolean',
      description: 'Whether the menu is visible'
    },
    x: {
      control: 'number',
      description: 'X position in pixels'
    },
    y: {
      control: 'number',
      description: 'Y position in pixels'
    },
    hasSelectedTasks: {
      control: 'boolean',
      description: 'Whether there are selected tasks (shows Move to Inbox, Delete)'
    },
    selectedCount: {
      control: 'number',
      description: 'Number of selected tasks (2+ shows Layout submenu)'
    },
    contextSection: {
      control: 'object',
      description: 'Group/section context (shows group-specific actions when provided)'
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

// Mock group data for group context stories
const mockGroup: CanvasSection = {
  id: 'group-1',
  name: 'High Priority',
  type: 'priority',
  propertyValue: 'high',
  color: '#ef4444',
  position: { x: 100, y: 100, width: 400, height: 300 },
  isVisible: true,
  isCollapsed: false,
  isPowerMode: false,
  powerKeyword: 'priority:high'
}

const mockPowerModeGroup: CanvasSection = {
  ...mockGroup,
  id: 'group-2',
  name: 'Work Tasks',
  isPowerMode: true,
  powerKeyword: 'project:work'
}

/**
 * Default - Empty Canvas Right-Click
 *
 * Shows the basic options when right-clicking on empty canvas space.
 */
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Basic menu when right-clicking on empty canvas. Shows "Create Task Here" and "Create Group" options.'
      }
    }
  },
  args: {
    isVisible: true,
    x: 60,
    y: 100
  }
}

/**
 * With Group Context
 *
 * Shows group-specific options when right-clicking on a group.
 */
export const WithGroupContext: Story = {
  parameters: {
    docs: {
      description: {
        story: `Menu when right-clicking on a group. Shows:
- Add Task to Group
- Edit Group
- Group Settings
- Power Mode toggle (if group has powerKeyword)
- Delete Group`
      }
    }
  },
  args: {
    isVisible: true,
    x: 60,
    y: 100,
    contextSection: mockGroup
  }
}

/**
 * Group with Power Mode Active
 *
 * Shows additional "Collect Matching Tasks" option when power mode is enabled.
 */
export const GroupWithPowerMode: Story = {
  parameters: {
    docs: {
      description: {
        story: `Group context when Power Mode is active. Shows additional "Collect Matching Tasks" option.`
      }
    }
  },
  args: {
    isVisible: true,
    x: 60,
    y: 100,
    contextSection: mockPowerModeGroup
  }
}

/**
 * With Selected Tasks
 *
 * Shows task-specific options when tasks are selected.
 */
export const WithSelectedTasks: Story = {
  parameters: {
    docs: {
      description: {
        story: `Menu when 1 task is selected. Shows:
- Create Task Here
- Create Group
- Move to Inbox (with Del shortcut)
- Delete Task (with Shift+Del shortcut)`
      }
    }
  },
  args: {
    isVisible: true,
    x: 60,
    y: 100,
    hasSelectedTasks: true,
    selectedCount: 1
  }
}

/**
 * Multiple Selected Tasks
 *
 * Shows Layout submenu when 2+ tasks are selected.
 */
export const MultipleSelectedTasks: Story = {
  parameters: {
    docs: {
      description: {
        story: `Menu when multiple tasks are selected. Shows Layout submenu with:
- Align options (Left, Right, Top, Bottom, Center H/V)
- Arrange options (Row, Column, Grid)

With 3+ tasks, also shows Distribute Horizontally/Vertically.`
      }
    }
  },
  args: {
    isVisible: true,
    x: 60,
    y: 100,
    hasSelectedTasks: true,
    selectedCount: 3
  }
}
