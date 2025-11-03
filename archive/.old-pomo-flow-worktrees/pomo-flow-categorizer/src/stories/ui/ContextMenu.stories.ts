import type { Meta, StoryObj } from '@storybook/vue3'
import { ref, reactive } from 'vue'
import {
  Edit,
  Copy,
  Trash2,
  Archive,
  Share,
  Star,
  MoreHorizontal,
  Plus,
  Settings,
  Flag,
  CheckCircle,
  XCircle,
  Clock,
  Tag
} from 'lucide-vue-next'
import ContextMenu from '@/components/ContextMenu.vue'
import type { ContextMenuItem } from '@/components/ContextMenu.vue'

const meta = {
  component: ContextMenu,
  title: '🎭 Overlays/💬 Context Menus/ContextMenu',
  tags: ['autodocs'],

  parameters: {
    layout: 'fullscreen',
  },

  argTypes: {
    isVisible: {
      control: 'boolean',
      description: 'Whether the context menu is visible',
    },
    x: {
      control: 'number',
      description: 'X coordinate position',
    },
    y: {
      control: 'number',
      description: 'Y coordinate position',
    },
    items: {
      control: 'object',
      description: 'Array of context menu items',
    },
  },
} satisfies Meta<typeof ContextMenu>

export default meta
type Story = StoryObj<typeof meta>

// Basic Context Menu
export const Default: Story = {
  args: {
    isVisible: true,
    x: 200,
    y: 150,
    items: [
      {
        id: 'edit',
        label: 'Edit',
        icon: Edit,
        action: () => console.log('Edit clicked'),
        shortcut: 'Ctrl+E',
      },
      {
        id: 'copy',
        label: 'Copy',
        icon: Copy,
        action: () => console.log('Copy clicked'),
        shortcut: 'Ctrl+C',
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash2,
        action: () => console.log('Delete clicked'),
        danger: true,
        shortcut: 'Del',
      },
    ] as ContextMenuItem[],
  },
  render: (args) => ({
    components: { ContextMenu },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary); position: relative;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Basic Context Menu</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Right-click anywhere to test positioning</p>

        <div
          style="padding: 60px; background: var(--surface-primary); border-radius: 12px; border: 2px dashed var(--border-medium); text-align: center; color: var(--text-muted);"
          @contextmenu.prevent="(e) => { console.log('Context menu at:', e.clientX, e.clientY) }"
        >
          <p style="margin: 0; font-size: 16px;">Right-click in this area</p>
          <p style="margin: 8px 0 0 0; font-size: 14px;">Menu positioned at: {{ args.x }}, {{ args.y }}</p>
        </div>

        <ContextMenu v-bind="args" @close="() => console.log('Menu closed')" />
      </div>
    `,
  })
}

// Task Context Menu
export const TaskMenu: Story = {
  args: {
    isVisible: true,
    x: 300,
    y: 200,
    items: [
      {
        id: 'edit',
        label: 'Edit Task',
        icon: Edit,
        action: () => console.log('Edit task'),
        shortcut: 'Enter',
      },
      {
        id: 'duplicate',
        label: 'Duplicate',
        icon: Copy,
        action: () => console.log('Duplicate task'),
      },
      {
        id: 'complete',
        label: 'Mark Complete',
        icon: CheckCircle,
        action: () => console.log('Mark complete'),
      },
      {
        id: 'separator1',
        label: '',
        separator: true,
      },
      {
        id: 'priority',
        label: 'Set Priority',
        icon: Flag,
        action: () => console.log('Set priority'),
      },
      {
        id: 'tag',
        label: 'Add Tag',
        icon: Tag,
        action: () => console.log('Add tag'),
      },
      {
        id: 'time',
        label: 'Log Time',
        icon: Clock,
        action: () => console.log('Log time'),
      },
      {
        id: 'separator2',
        label: '',
        separator: true,
      },
      {
        id: 'archive',
        label: 'Archive',
        icon: Archive,
        action: () => console.log('Archive task'),
      },
      {
        id: 'delete',
        label: 'Delete Task',
        icon: Trash2,
        action: () => console.log('Delete task'),
        danger: true,
        shortcut: 'Del',
      },
    ] as ContextMenuItem[],
  },
  render: (args) => ({
    components: { ContextMenu },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary); position: relative;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Task Context Menu</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Comprehensive task management options</p>

        <div style="display: grid; gap: 16px; max-width: 600px;">
          <div style="padding: 20px; background: var(--surface-primary); border-radius: 12px; border: 1px solid var(--border-medium);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
              <div style="width: 20px; height: 20px; border-radius: 4px; background: var(--brand-primary);"></div>
              <span style="font-weight: 500; color: var(--text-primary);">Complete project documentation</span>
            </div>
            <p style="margin: 0; font-size: 14px; color: var(--text-secondary);">Right-click on this task to see options</p>
          </div>
        </div>

        <ContextMenu v-bind="args" @close="() => console.log('Menu closed')" />
      </div>
    `,
  })
}

// Disabled Items Menu
export const WithDisabledItems: Story = {
  args: {
    isVisible: true,
    x: 250,
    y: 180,
    items: [
      {
        id: 'edit',
        label: 'Edit',
        icon: Edit,
        action: () => console.log('Edit clicked'),
        shortcut: 'Ctrl+E',
      },
      {
        id: 'copy',
        label: 'Copy',
        icon: Copy,
        action: () => console.log('Copy clicked'),
        disabled: true,
        shortcut: 'Ctrl+C',
      },
      {
        id: 'share',
        label: 'Share',
        icon: Share,
        action: () => console.log('Share clicked'),
        disabled: true,
      },
      {
        id: 'separator',
        label: '',
        separator: true,
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash2,
        action: () => console.log('Delete clicked'),
        danger: true,
      },
    ] as ContextMenuItem[],
  },
  render: (args) => ({
    components: { ContextMenu },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary); position: relative;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Context Menu with Disabled Items</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Some actions are unavailable based on current state</p>

        <div style="padding: 40px; background: var(--surface-primary); border-radius: 12px; border: 1px solid var(--border-medium); text-align: center;">
          <p style="margin: 0; font-size: 16px; color: var(--text-secondary);">Read-only item selected</p>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: var(--text-muted);">Copy and Share actions are disabled</p>
        </div>

        <ContextMenu v-bind="args" @close="() => console.log('Menu closed')" />
      </div>
    `,
  })
}

// Simple Actions Menu
export const SimpleActions: Story = {
  args: {
    isVisible: true,
    x: 180,
    y: 120,
    items: [
      {
        id: 'add',
        label: 'Add New',
        icon: Plus,
        action: () => console.log('Add new'),
        shortcut: 'Ctrl+N',
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        action: () => console.log('Settings'),
      },
      {
        id: 'more',
        label: 'More Options',
        icon: MoreHorizontal,
        action: () => console.log('More options'),
      },
    ] as ContextMenuItem[],
  },
  render: (args) => ({
    components: { ContextMenu },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary); position: relative;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Simple Actions Menu</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Minimal context menu for quick actions</p>

        <div style="display: flex; gap: 16px; flex-wrap: wrap;">
          <button style="padding: 12px 24px; background: var(--surface-primary); border: 1px solid var(--border-medium); border-radius: 8px; cursor: pointer;">
            Quick Actions
          </button>
        </div>

        <ContextMenu v-bind="args" @close="() => console.log('Menu closed')" />
      </div>
    `,
  })
}

// Project Menu
export const ProjectMenu: Story = {
  args: {
    isVisible: true,
    x: 320,
    y: 160,
    items: [
      {
        id: 'open',
        label: 'Open Project',
        icon: Edit,
        action: () => console.log('Open project'),
      },
      {
        id: 'favorite',
        label: 'Add to Favorites',
        icon: Star,
        action: () => console.log('Add to favorites'),
      },
      {
        id: 'share',
        label: 'Share Project',
        icon: Share,
        action: () => console.log('Share project'),
      },
      {
        id: 'separator1',
        label: '',
        separator: true,
      },
      {
        id: 'archive',
        label: 'Archive Project',
        icon: Archive,
        action: () => console.log('Archive project'),
      },
      {
        id: 'delete',
        label: 'Delete Project',
        icon: Trash2,
        action: () => console.log('Delete project'),
        danger: true,
      },
    ] as ContextMenuItem[],
  },
  render: (args) => ({
    components: { ContextMenu },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary); position: relative;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Project Context Menu</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Project-specific actions and management</p>

        <div style="display: grid; gap: 12px; max-width: 500px;">
          <div style="padding: 16px; background: var(--surface-primary); border-radius: 8px; border: 1px solid var(--border-medium); display: flex; align-items: center; gap: 12px;">
            <div style="font-size: 24px;">📁</div>
            <div>
              <div style="font-weight: 500; color: var(--text-primary);">Web Development</div>
              <div style="font-size: 14px; color: var(--text-secondary);">12 tasks • 3 active</div>
            </div>
          </div>
        </div>

        <ContextMenu v-bind="args" @close="() => console.log('Menu closed')" />
      </div>
    `,
  })
}

// Interactive Demo
export const InteractiveDemo: Story = {
  render: () => ({
    components: { ContextMenu },
    setup() {
      const menuState = reactive({
        isVisible: false,
        x: 0,
        y: 0,
        items: [] as ContextMenuItem[],
        lastAction: '',
      })

      const showTaskMenu = (event: MouseEvent) => {
        event.preventDefault()
        menuState.items = [
          {
            id: 'edit',
            label: 'Edit Task',
            icon: Edit,
            action: () => {
              menuState.lastAction = 'Edit task: "Complete project documentation"'
              menuState.isVisible = false
            },
            shortcut: 'Enter',
          },
          {
            id: 'complete',
            label: 'Mark Complete',
            icon: CheckCircle,
            action: () => {
              menuState.lastAction = 'Marked task as complete ✓'
              menuState.isVisible = false
            },
          },
          {
            id: 'duplicate',
            label: 'Duplicate',
            icon: Copy,
            action: () => {
              menuState.lastAction = 'Duplicated task'
              menuState.isVisible = false
            },
          },
          {
            id: 'separator1',
            label: '',
            separator: true,
          },
          {
            id: 'priority',
            label: 'High Priority',
            icon: Flag,
            action: () => {
              menuState.lastAction = 'Set task priority to High'
              menuState.isVisible = false
            },
          },
          {
            id: 'delete',
            label: 'Delete Task',
            icon: Trash2,
            action: () => {
              menuState.lastAction = 'Deleted task 🗑️'
              menuState.isVisible = false
            },
            danger: true,
            shortcut: 'Del',
          },
        ]
        menuState.x = event.clientX
        menuState.y = event.clientY
        menuState.isVisible = true
      }

      const showProjectMenu = (event: MouseEvent) => {
        event.preventDefault()
        menuState.items = [
          {
            id: 'open',
            label: 'Open Project',
            icon: Edit,
            action: () => {
              menuState.lastAction = 'Opened project: "Web Development"'
              menuState.isVisible = false
            },
          },
          {
            id: 'favorite',
            label: 'Add to Favorites',
            icon: Star,
            action: () => {
              menuState.lastAction = 'Added project to favorites ⭐'
              menuState.isVisible = false
            },
          },
          {
            id: 'separator1',
            label: '',
            separator: true,
          },
          {
            id: 'archive',
            label: 'Archive Project',
            icon: Archive,
            action: () => {
              menuState.lastAction = 'Archived project'
              menuState.isVisible = false
            },
          },
        ]
        menuState.x = event.clientX
        menuState.y = event.clientY
        menuState.isVisible = true
      }

      const closeMenu = () => {
        menuState.isVisible = false
      }

      return {
        menuState,
        showTaskMenu,
        showProjectMenu,
        closeMenu
      }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary); position: relative;">
        <h2 style="margin: 0 0 16px 0; font-size: 20px; color: var(--text-primary);">Interactive Context Menu Demo</h2>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Right-click on any item below to see its context menu</p>

        <!-- Last Action Display -->
        <div v-if="menuState.lastAction" style="margin-bottom: 24px; padding: 12px 16px; background: var(--glass-bg-soft); border-radius: 8px; border: 1px solid var(--glass-border);">
          <strong style="color: var(--text-primary);">Last Action:</strong>
          <span style="color: var(--text-secondary);">{{ menuState.lastAction }}</span>
        </div>

        <!-- Demo Items -->
        <div style="display: grid; gap: 16px; max-width: 600px;">
          <!-- Task Item -->
          <div
            style="padding: 20px; background: var(--surface-primary); border-radius: 12px; border: 1px solid var(--border-medium); cursor: pointer; transition: all var(--duration-fast) ease;"
            @contextmenu.prevent="showTaskMenu"
            @mouseenter="$event.target.style.borderColor = 'var(--brand-primary)'"
            @mouseleave="$event.target.style.borderColor = 'var(--border-medium)'"
          >
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 20px; height: 20px; border-radius: 4px; background: var(--brand-primary);"></div>
              <div style="flex: 1;">
                <div style="font-weight: 500; color: var(--text-primary);">Complete project documentation</div>
                <div style="font-size: 14px; color: var(--text-secondary);">Right-click for task options</div>
              </div>
            </div>
          </div>

          <!-- Project Item -->
          <div
            style="padding: 20px; background: var(--surface-primary); border-radius: 12px; border: 1px solid var(--border-medium); cursor: pointer; transition: all var(--duration-fast) ease;"
            @contextmenu.prevent="showProjectMenu"
            @mouseenter="$event.target.style.borderColor = 'var(--color-navigation)'"
            @mouseleave="$event.target.style.borderColor = 'var(--border-medium)'"
          >
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="font-size: 24px;">📁</div>
              <div style="flex: 1;">
                <div style="font-weight: 500; color: var(--text-primary);">Web Development</div>
                <div style="font-size: 14px; color: var(--text-secondary);">12 tasks • 3 active • Right-click for project options</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Instructions -->
        <div style="margin-top: 32px; padding: 20px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Instructions</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            <li>Right-click on the task or project items above</li>
            <li>Click any menu item to perform the action</li>
            <li>Press Escape or click outside to close the menu</li>
            <li>Try keyboard shortcuts when available</li>
          </ul>
        </div>

        <!-- Context Menu Component -->
        <ContextMenu
          :is-visible="menuState.isVisible"
          :x="menuState.x"
          :y="menuState.y"
          :items="menuState.items"
          @close="closeMenu"
        />
      </div>
    `,
  })
}

// All Variants Showcase
export const AllVariants: Story = {
  render: () => ({
    components: { ContextMenu },
    setup() {
      const menu1 = reactive({
        isVisible: true,
        x: 100,
        y: 120,
        items: [
          { id: 'edit', label: 'Edit', icon: Edit, action: () => {} },
          { id: 'copy', label: 'Copy', icon: Copy, action: () => {}, shortcut: 'Ctrl+C' },
          { id: 'delete', label: 'Delete', icon: Trash2, action: () => {}, danger: true },
        ] as ContextMenuItem[],
      })

      const menu2 = reactive({
        isVisible: true,
        x: 400,
        y: 200,
        items: [
          { id: 'complete', label: 'Mark Complete', icon: CheckCircle, action: () => {} },
          { id: 'priority', label: 'High Priority', icon: Flag, action: () => {} },
          { id: 'separator1', label: '', separator: true },
          { id: 'archive', label: 'Archive', icon: Archive, action: () => {} },
        ] as ContextMenuItem[],
      })

      const menu3 = reactive({
        isVisible: true,
        x: 250,
        y: 350,
        items: [
          { id: 'add', label: 'Add New', icon: Plus, action: () => {}, shortcut: 'Ctrl+N' },
          { id: 'settings', label: 'Settings', icon: Settings, action: () => {} },
          { id: 'share', label: 'Share', icon: Share, action: () => {}, disabled: true },
        ] as ContextMenuItem[],
      })

      return { menu1, menu2, menu3 }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary); position: relative;">
        <h2 style="margin: 0 0 24px 0; font-size: 20px; text-align: center; color: var(--text-primary);">ContextMenu Component Variants</h2>

        <!-- Menu Areas -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; margin-bottom: 40px;">
          <div style="padding: 20px; background: var(--surface-primary); border-radius: 12px; border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Task Actions</h3>
            <p style="margin: 0 0 16px 0; font-size: 14px; color: var(--text-secondary);">Standard task operations with danger actions</p>
            <div style="padding: 40px; background: var(--surface-secondary); border-radius: 8px; text-align: center; color: var(--text-muted); border: 1px dashed var(--border-medium);">
              Task Menu Area
            </div>
          </div>

          <div style="padding: 20px; background: var(--surface-primary); border-radius: 12px; border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Status & Priority</h3>
            <p style="margin: 0 0 16px 0; font-size: 14px; color: var(--text-secondary);">Quick status changes and priority settings</p>
            <div style="padding: 40px; background: var(--surface-secondary); border-radius: 8px; text-align: center; color: var(--text-muted); border: 1px dashed var(--border-medium);">
              Status Menu Area
            </div>
          </div>

          <div style="padding: 20px; background: var(--surface-primary); border-radius: 12px; border: 1px solid var(--border-medium);">
            <h3 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Quick Actions</h3>
            <p style="margin: 0 0 16px 0; font-size: 14px; color: var(--text-secondary);">Common actions with disabled states</p>
            <div style="padding: 40px; background: var(--surface-secondary); border-radius: 8px; text-align: center; color: var(--text-muted); border: 1px dashed var(--border-medium);">
              Actions Menu Area
            </div>
          </div>
        </div>

        <!-- Features Overview -->
        <div style="padding: 24px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Key Features</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; font-size: 14px;">
            <div style="display: flex; align-items: start; gap: 8px;">
              <span style="font-size: 16px;">🎯</span>
              <div style="color: var(--text-secondary);">
                <strong>Smart Positioning</strong> - Prevents viewport overflow
              </div>
            </div>
            <div style="display: flex; align-items: start; gap: 8px;">
              <span style="font-size: 16px;">⌨️</span>
              <div style="color: var(--text-secondary);">
                <strong>Keyboard Support</strong> - Escape to close
              </div>
            </div>
            <div style="display: flex; align-items: start; gap: 8px;">
              <span style="font-size: 16px;">🎨</span>
              <div style="color: var(--text-secondary);">
                <strong>Glass Morphism</strong> - Modern blur effects
              </div>
            </div>
            <div style="display: flex; align-items: start; gap: 8px;">
              <span style="font-size: 16px;">⚡</span>
              <div style="color: var(--text-secondary);">
                <strong>Smooth Animations</strong> - Spring-based transitions
              </div>
            </div>
            <div style="display: flex; align-items: start; gap: 8px;">
              <span style="font-size: 16px;">🔧</span>
              <div style="color: var(--text-secondary);">
                <strong>Versatile Items</strong> - Icons, shortcuts, separators
              </div>
            </div>
            <div style="display: flex; align-items: start; gap: 8px;">
              <span style="font-size: 16px;">🚨</span>
              <div style="color: var(--text-secondary);">
                <strong>Danger Actions</strong> - Visual warning styles
              </div>
            </div>
          </div>
        </div>

        <!-- Context Menus -->
        <ContextMenu
          :is-visible="menu1.isVisible"
          :x="menu1.x"
          :y="menu1.y"
          :items="menu1.items"
          @close="() => menu1.isVisible = false"
        />

        <ContextMenu
          :is-visible="menu2.isVisible"
          :x="menu2.x"
          :y="menu2.y"
          :items="menu2.items"
          @close="() => menu2.isVisible = false"
        />

        <ContextMenu
          :is-visible="menu3.isVisible"
          :x="menu3.x"
          :y="menu3.y"
          :items="menu3.items"
          @close="() => menu3.isVisible = false"
        />
      </div>
    `,
  })
}