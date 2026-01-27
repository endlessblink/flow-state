import { ref, reactive, onMounted } from 'vue'
import { Edit, Copy, Trash2, Archive, CheckCircle, Flag, Clock } from 'lucide-vue-next'
import ContextMenu from '@/components/ContextMenu.vue'
import type { ContextMenuItem } from '@/components/ContextMenu.vue'

// Glass morphism container style
const glassContainer = `
  padding: 40px;
  background: rgba(28, 25, 45, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
`

const meta = {
  title: '🧩 Primitives/ContextMenu',
  component: ContextMenu,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    isVisible: { control: 'boolean', description: 'Controls menu visibility' },
    x: { control: 'number', description: 'X position of menu' },
    y: { control: 'number', description: 'Y position of menu' },
    items: { control: 'object', description: 'Menu items array' },
  },
}

export default meta

// Basic Context Menu - shows the actual component centered in viewport
export const Default = {
  render: () => ({
    components: { ContextMenu },
    setup() {
      const isVisible = ref(false) // Start hidden, show after positioning
      const menuX = ref(350)  // Initial centered estimate
      const menuY = ref(130)
      const items: ContextMenuItem[] = [
        { id: 'edit', label: 'Edit', icon: Edit, action: () => console.log('Edit clicked'), shortcut: 'Enter' },
        { id: 'copy', label: 'Copy', icon: Copy, action: () => console.log('Copy clicked'), shortcut: 'Ctrl+C' },
        { id: 'sep', label: '', separator: true },
        { id: 'delete', label: 'Delete', icon: Trash2, action: () => console.log('Delete clicked'), shortcut: 'Del', danger: true },
      ]

      const handleClose = () => {
        isVisible.value = false
        // Re-show after a brief delay for demo purposes
        setTimeout(() => { isVisible.value = true }, 500)
      }

      // Calculate center position on mount
      onMounted(() => {
        // Menu dimensions (approximate)
        const menuWidth = 180
        const menuHeight = 140
        // Center in viewport (iframe dimensions in Storybook)
        menuX.value = Math.max(50, (window.innerWidth - menuWidth) / 2)
        menuY.value = Math.max(50, (window.innerHeight - menuHeight) / 2)
        // Show menu after positioning
        setTimeout(() => { isVisible.value = true }, 50)
      })

      return { isVisible, items, handleClose, menuX, menuY, Edit, Copy, Trash2, glassContainer }
    },
    template: `
      <div :style="glassContainer + 'min-height: 400px; min-width: 500px; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;'">
        <div style="margin-bottom: 20px; text-align: center;">
          <h3 style="color: var(--text-primary); margin: 0 0 8px 0;">Basic Context Menu</h3>
          <p style="color: var(--text-secondary); margin: 0;">The ContextMenu component centered in the viewport</p>
        </div>
        <ContextMenu
          :is-visible="isVisible"
          :x="menuX"
          :y="menuY"
          :items="items"
          @close="handleClose"
        />
      </div>
    `,
  })
}

// Interactive Demo
export const InteractiveDemo = {
  render: () => ({
    components: { ContextMenu },
    setup() {
      const menu = reactive({
        isVisible: false,
        x: 0,
        y: 0,
        items: [] as ContextMenuItem[],
        lastAction: '',
      })

      const showTaskMenu = (e: MouseEvent) => {
        e.preventDefault()
        menu.items = [
          { id: 'edit', label: 'Edit Task', icon: Edit, action: () => { menu.lastAction = 'Edited task'; menu.isVisible = false }, shortcut: 'Enter' },
          { id: 'complete', label: 'Mark Complete', icon: CheckCircle, action: () => { menu.lastAction = 'Marked complete'; menu.isVisible = false } },
          { id: 'priority', label: 'Set Priority', icon: Flag, action: () => { menu.lastAction = 'Set priority'; menu.isVisible = false } },
          { id: 'time', label: 'Log Time', icon: Clock, action: () => { menu.lastAction = 'Logged time'; menu.isVisible = false } },
          { id: 'sep', label: '', separator: true },
          { id: 'archive', label: 'Archive', icon: Archive, action: () => { menu.lastAction = 'Archived'; menu.isVisible = false } },
          { id: 'delete', label: 'Delete', icon: Trash2, action: () => { menu.lastAction = 'Deleted'; menu.isVisible = false }, danger: true },
        ]
        menu.x = e.clientX
        menu.y = e.clientY
        menu.isVisible = true
      }

      return { menu, showTaskMenu, glassContainer }
    },
    template: `
      <div :style="glassContainer + 'min-height: 400px; min-width: 500px;'">
        <h3 style="color: var(--text-primary); margin: 0 0 8px 0;">Interactive Demo</h3>
        <p style="color: var(--text-secondary); margin: 0 0 20px 0;">Right-click on the task card below</p>

        <div v-if="menu.lastAction" style="padding: 10px 14px; background: rgba(78, 205, 196, 0.1); border: 1px solid rgba(78, 205, 196, 0.3); border-radius: 8px; margin-bottom: 20px; color: var(--text-primary); font-size: 14px;">
          Last action: {{ menu.lastAction }}
        </div>

        <div
          @contextmenu.prevent="showTaskMenu"
          style="padding: 16px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; cursor: context-menu; max-width: 400px; transition: border-color 0.2s;"
        >
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 18px; height: 18px; border-radius: 4px; background: var(--brand-primary);"></div>
            <div>
              <div style="color: var(--text-primary); font-weight: 500;">Complete project docs</div>
              <div style="color: var(--text-muted); font-size: 13px; margin-top: 2px;">Right-click for options</div>
            </div>
          </div>
        </div>

        <ContextMenu
          :is-visible="menu.isVisible"
          :x="menu.x"
          :y="menu.y"
          :items="menu.items"
          @close="menu.isVisible = false"
        />
      </div>
    `,
  })
}
