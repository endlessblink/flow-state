import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import EdgeContextMenu from '@/components/canvas/EdgeContextMenu.vue'

const meta = {
  component: EdgeContextMenu,
  title: '🎭 Overlays/💬 Context Menus/EdgeContextMenu',
  tags: ['autodocs'],

  parameters: {
    layout: 'fullscreen',
    docs: {
      story: {
        height: '600px',
      },
    },
  },

  argTypes: {
    isVisible: {
      control: 'boolean',
      description: 'Whether the context menu is visible',
    },
    x: {
      control: 'number',
      description: 'X coordinate for menu position',
    },
    y: {
      control: 'number',
      description: 'Y coordinate for menu position',
    },
    menuText: {
      control: 'text',
      description: 'Custom text for the menu action',
    },
  },
} satisfies Meta<typeof EdgeContextMenu>

export default meta
type Story = StoryObj<typeof meta>

// Default positioned context menu
export const Default: Story = {
  args: {
    isVisible: true,
    x: 400,
    y: 300,
    menuText: 'Disconnect',
  },
  render: (args) => ({
    components: { EdgeContextMenu },
    setup() {
      const isVisible = ref(args.isVisible)
      const x = ref(args.x)
      const y = ref(args.y)

      const handleClose = () => {
        isVisible.value = false
      }

      const handleDisconnect = () => {
        console.log('Edge disconnected')
        isVisible.value = false
      }

      const handleCanvasClick = (event: MouseEvent) => {
        x.value = event.clientX
        y.value = event.clientY
        isVisible.value = true
      }

      return {
        ...args,
        isVisible,
        x,
        y,
        handleClose,
        handleDisconnect,
        handleCanvasClick
      }
    },
    template: `
      <div
        style="padding: 40px; min-height: 100vh; background: var(--surface-secondary); cursor: crosshair;"
        @click="handleCanvasClick"
      >
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Edge Context Menu</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Click anywhere on the canvas to show the context menu</p>

        <!-- Canvas area visualization -->
        <div style="position: relative; width: 100%; height: 400px; background: var(--surface-primary); border: 2px dashed var(--border-medium); border-radius: 12px;">
          <!-- Sample nodes -->
          <div style="position: absolute; left: 100px; top: 150px; width: 120px; height: 60px; background: var(--brand-primary); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
            Task Node A
          </div>
          <div style="position: absolute; left: 500px; top: 250px; width: 120px; height: 60px; background: var(--brand-primary); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
            Task Node B
          </div>

          <!-- Connection line -->
          <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">
            <path
              d="M 220 180 Q 400 150 500 280"
              stroke="var(--brand-primary)"
              stroke-width="2"
              fill="none"
              stroke-dasharray="5,5"
            />
          </svg>

          <!-- Instructions -->
          <div style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); text-align: center; color: var(--text-muted); font-size: 14px;">
            Click on the connection or anywhere to test context menu
          </div>
        </div>

        <EdgeContextMenu
          :is-visible="isVisible"
          :x="x"
          :y="y"
          :menu-text="menuText"
          @close="handleClose"
          @disconnect="handleDisconnect"
        />
      </div>
    `,
  })
}

// Custom menu text variant
export const CustomText: Story = {
  args: {
    isVisible: true,
    x: 400,
    y: 300,
    menuText: 'Remove Connection',
  },
  render: (args) => ({
    components: { EdgeContextMenu },
    setup() {
      const isVisible = ref(args.isVisible)
      const x = ref(args.x)
      const y = ref(args.y)

      const handleClose = () => {
        isVisible.value = false
      }

      const handleDisconnect = () => {
        console.log('Connection removed:', args.menuText)
        isVisible.value = false
      }

      return {
        ...args,
        isVisible,
        x,
        y,
        handleClose,
        handleDisconnect
      }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Custom Menu Text</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Context menu with custom action text</p>

        <EdgeContextMenu
          :is-visible="isVisible"
          :x="x"
          :y="y"
          :menu-text="menuText"
          @close="handleClose"
          @disconnect="handleDisconnect"
        />
      </div>
    `,
  })
}

// Positioned at different locations
export const TopLeft: Story = {
  args: {
    isVisible: true,
    x: 100,
    y: 100,
    menuText: 'Disconnect Edge',
  },
  render: (args) => ({
    components: { EdgeContextMenu },
    setup() {
      const isVisible = ref(args.isVisible)
      const positions = ref([
        { x: 100, y: 100, label: 'Top Left' },
        { x: 700, y: 100, label: 'Top Right' },
        { x: 400, y: 400, label: 'Center' },
        { x: 100, y: 500, label: 'Bottom Left' },
      ])

      const currentPosition = ref(positions.value[2])
      const x = ref(currentPosition.value.x)
      const y = ref(currentPosition.value.y)

      const handleClose = () => {
        isVisible.value = false
      }

      const handleDisconnect = () => {
        console.log('Disconnected from:', currentPosition.value.label)
        isVisible.value = false
      }

      const showMenuAt = (position: typeof positions.value[0]) => {
        currentPosition.value = position
        x.value = position.x
        y.value = position.y
        isVisible.value = true
      }

      return {
        ...args,
        isVisible,
        x,
        y,
        positions,
        currentPosition,
        handleClose,
        handleDisconnect,
        showMenuAt
      }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Multi-Position Test</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Test context menu positioning at different screen locations</p>

        <!-- Position buttons -->
        <div style="display: flex; gap: 12px; margin-bottom: 32px; flex-wrap: wrap;">
          <button
            v-for="pos in positions"
            :key="pos.label"
            @click="showMenuAt(pos)"
            style="padding: 8px 16px; background: var(--brand-primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;"
          >
            {{ pos.label }}
          </button>
        </div>

        <!-- Canvas area -->
        <div style="position: relative; width: 100%; height: 500px; background: var(--surface-primary); border: 2px dashed var(--border-medium); border-radius: 12px;">
          <!-- Position indicators -->
          <div
            v-for="pos in positions"
            :key="pos.label"
            :style="{
              position: 'absolute',
              left: (pos.x - 8) + 'px',
              top: (pos.y - 8) + 'px',
              width: '16px',
              height: '16px',
              background: currentPosition.label === pos.label ? 'var(--brand-primary)' : 'var(--border-medium)',
              borderRadius: '50%',
              border: '2px solid white'
            }"
          />

          <div style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); text-align: center; color: var(--text-muted); font-size: 14px;">
            Current position: <strong>{{ currentPosition.label }}</strong> ({{ x }}, {{ y }})
          </div>
        </div>

        <EdgeContextMenu
          :is-visible="isVisible"
          :x="x"
          :y="y"
          :menu-text="menuText"
          @close="handleClose"
          @disconnect="handleDisconnect"
        />
      </div>
    `,
  })
}

// Hidden state
export const Hidden: Story = {
  args: {
    isVisible: false,
    x: 0,
    y: 0,
    menuText: 'Disconnect',
  },
  render: (args) => ({
    components: { EdgeContextMenu },
    setup() {
      const isVisible = ref(args.isVisible)
      const x = ref(400)
      const y = ref(300)

      const handleClose = () => {
        isVisible.value = false
      }

      const handleDisconnect = () => {
        console.log('Edge disconnected')
        isVisible.value = false
      }

      const toggleMenu = () => {
        isVisible.value = !isVisible.value
      }

      return {
        ...args,
        isVisible,
        x,
        y,
        handleClose,
        handleDisconnect,
        toggleMenu
      }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Hidden/Visible States</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Toggle context menu visibility</p>

        <button
          @click="toggleMenu"
          style="padding: 12px 24px; background: var(--brand-primary); color: white; border: none; border-radius: 8px; cursor: pointer; margin-bottom: 32px;"
        >
          {{ isVisible ? 'Hide Menu' : 'Show Menu' }}
        </button>

        <div style="padding: 20px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">EdgeContextMenu Features</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            <li><strong>Fixed positioning</strong> - Appears at exact coordinates</li>
            <li><strong>Click outside</strong> - Automatically closes when clicking elsewhere</li>
            <li><strong>Escape key</strong> - Closes with Escape button</li>
            <li><strong>Custom text</strong> - Supports custom menu action text</li>
            <li><strong>Smooth animation</strong> - Elegant slide-in with backdrop blur</li>
            <li><strong>Danger styling</strong> - Hover states with red accent for destructive actions</li>
          </ul>
        </div>

        <EdgeContextMenu
          :is-visible="isVisible"
          :x="x"
          :y="y"
          :menu-text="menuText"
          @close="handleClose"
          @disconnect="handleDisconnect"
        />
      </div>
    `,
  })
}