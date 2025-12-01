import type { Meta, StoryObj } from '@storybook/vue3'
import { Edit, Trash2, Copy, Link, Star, Archive, MoreHorizontal } from 'lucide-vue-next'
import ContextMenu from './ContextMenu.vue'

const meta = {
  title: 'Overlays/Context Menus/ContextMenu',
  component: ContextMenu,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Base context menu component with glass morphism styling, keyboard navigation, and viewport-aware positioning.'
      }
    }
  },
  argTypes: {
    isVisible: {
      control: 'boolean',
      description: 'Whether the context menu is visible'
    },
    x: {
      control: 'number',
      description: 'X position for the menu'
    },
    y: {
      control: 'number',
      description: 'Y position for the menu'
    },
    items: {
      control: 'object',
      description: 'Array of menu items'
    }
  },
  args: {
    isVisible: true,
    x: 400,
    y: 300
  }
} satisfies Meta<typeof ContextMenu>

export default meta
type Story = StoryObj<typeof meta>

const basicItems = [
  {
    id: 'edit',
    label: 'Edit',
    icon: Edit,
    shortcut: 'Enter',
    action: () => console.log('Edit clicked')
  },
  {
    id: 'duplicate',
    label: 'Duplicate',
    icon: Copy,
    shortcut: 'Ctrl+D',
    action: () => console.log('Duplicate clicked')
  },
  {
    id: 'link',
    label: 'Copy Link',
    icon: Link,
    shortcut: 'Ctrl+C',
    action: () => console.log('Copy Link clicked')
  },
  {
    id: 'separator1',
    label: '',
    separator: true,
    action: () => {}
  },
  {
    id: 'favorite',
    label: 'Add to Favorites',
    icon: Star,
    action: () => console.log('Add to Favorites clicked')
  },
  {
    id: 'archive',
    label: 'Archive',
    icon: Archive,
    action: () => console.log('Archive clicked')
  },
  {
    id: 'separator2',
    label: '',
    separator: true,
    action: () => {}
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: Trash2,
    shortcut: 'Del',
    danger: true,
    action: () => console.log('Delete clicked')
  }
]

export const Default: Story = {
  args: {
    isVisible: true,
    x: 400,
    y: 300,
    items: basicItems
  },
  render: (args) => ({
    components: { ContextMenu },
    setup() {
      return { args }
    },
    template: `
      <div style="position: relative; width: 100vw; height: 100vh; background: #1a1a1a;">
        <div style="padding: 20px; color: white;">
          <h2>Context Menu Demo</h2>
          <p>Right-click anywhere or use the rendered context menu below</p>
        </div>
        <ContextMenu
          v-bind="args"
          @close="action('close')"
        />
      </div>
    `
  })
}

export const TopLeft: Story = {
  args: {
    isVisible: true,
    x: 50,
    y: 50,
    items: basicItems
  }
}

export const BottomRight: Story = {
  args: {
    isVisible: true,
    x: window.innerWidth - 250,
    y: window.innerHeight - 400,
    items: basicItems
  }
}

export const WithDisabledItems: Story = {
  args: {
    isVisible: true,
    x: 400,
    y: 300,
    items: [
      {
        id: 'edit',
        label: 'Edit',
        icon: Edit,
        action: () => console.log('Edit clicked')
      },
      {
        id: 'duplicate',
        label: 'Duplicate',
        icon: Copy,
        disabled: true,
        action: () => console.log('Duplicate clicked')
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash2,
        danger: true,
        disabled: true,
        action: () => console.log('Delete clicked')
      }
    ]
  }
}

export const CompactMenu: Story = {
  args: {
    isVisible: true,
    x: 400,
    y: 300,
    items: [
      {
        id: 'more',
        label: 'More Options',
        icon: MoreHorizontal,
        action: () => console.log('More Options clicked')
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash2,
        danger: true,
        action: () => console.log('Delete clicked')
      }
    ]
  }
}

export const MenuWithoutIcons: Story = {
  args: {
    isVisible: true,
    x: 400,
    y: 300,
    items: [
      {
        id: 'option1',
        label: 'Option 1',
        shortcut: 'Ctrl+1',
        action: () => console.log('Option 1 clicked')
      },
      {
        id: 'option2',
        label: 'Option 2',
        shortcut: 'Ctrl+2',
        action: () => console.log('Option 2 clicked')
      },
      {
        id: 'separator1',
        label: '',
        separator: true,
        action: () => {}
      },
      {
        id: 'help',
        label: 'Help',
        shortcut: 'F1',
        action: () => console.log('Help clicked')
      }
    ]
  }
}