import type { Meta, StoryObj } from '@storybook/vue3'
import { ref, reactive } from 'vue'
import { Edit, Copy, Trash2, Archive, CheckCircle, Flag, Clock } from 'lucide-vue-next'
import ContextMenu from '@/components/ContextMenu.vue'
import type { ContextMenuItem } from '@/components/ContextMenu.vue'

const meta = {
  component: ContextMenu,
  title: '🎭 Overlays/💬 Context Menus/ContextMenu',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    isVisible: { control: 'boolean' },
    x: { control: 'number' },
    y: { control: 'number' },
    items: { control: 'object' },
  },
} satisfies Meta<typeof ContextMenu>

export default meta
type Story = StoryObj<typeof meta>

// Basic Context Menu
export const Default: Story = {
  render: () => ({
    components: { ContextMenu, Edit, Copy, Trash2 },
    setup() {
      return { Edit, Copy, Trash2 }
    },
    template: `
      <div style="min-height: 280px; background: rgba(0, 0, 0, 0.95); padding: 20px; display: flex; gap: 40px; align-items: flex-start;">
        <div>
          <h3 style="color: var(--text-primary); margin: 0 0 8px 0;">Basic Context Menu</h3>
          <p style="color: var(--text-secondary); margin: 0;">Standard menu with shortcuts and danger action</p>
        </div>
        <div style="min-width: 200px; background: rgba(20, 20, 20, 0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 12px; box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5), 0 8px 24px rgba(0, 0, 0, 0.3); padding: 8px;">
          <button style="display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 14px; background: transparent; border: 1px solid transparent; border-radius: 8px; color: var(--text-primary); font-size: 14px; font-weight: 500; text-align: left; cursor: pointer;">
            <Edit :size="16" :stroke-width="1.5" style="flex-shrink: 0;" />
            <span style="flex: 1;">Edit</span>
            <span style="flex-shrink: 0; font-size: 12px; color: var(--text-muted); padding: 4px 8px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 4px;">Enter</span>
          </button>
          <button style="display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 14px; background: transparent; border: 1px solid transparent; border-radius: 8px; color: var(--text-primary); font-size: 14px; font-weight: 500; text-align: left; cursor: pointer;">
            <Copy :size="16" :stroke-width="1.5" style="flex-shrink: 0;" />
            <span style="flex: 1;">Copy</span>
            <span style="flex-shrink: 0; font-size: 12px; color: var(--text-muted); padding: 4px 8px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 4px;">Ctrl+C</span>
          </button>
          <div style="height: 1px; margin: 8px 12px; background: rgba(255, 255, 255, 0.15);"></div>
          <button style="display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 14px; background: transparent; border: 1px solid transparent; border-radius: 8px; color: #ef4444; font-size: 14px; font-weight: 500; text-align: left; cursor: pointer;">
            <Trash2 :size="16" :stroke-width="1.5" style="flex-shrink: 0;" />
            <span style="flex: 1;">Delete</span>
            <span style="flex-shrink: 0; font-size: 12px; color: var(--text-muted); padding: 4px 8px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 4px;">Del</span>
          </button>
        </div>
      </div>
    `,
  })
}

// Interactive Demo
export const InteractiveDemo: Story = {
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

      return { menu, showTaskMenu }
    },
    template: `
      <div style="min-height: 100vh; background: rgba(0, 0, 0, 0.95); padding: 40px;">
        <h3 style="color: var(--text-primary); margin: 0 0 8px 0;">Interactive Demo</h3>
        <p style="color: var(--text-secondary); margin: 0 0 20px 0;">Right-click on the task card below</p>

        <div v-if="menu.lastAction" style="padding: 10px 14px; background: rgba(78, 205, 196, 0.1); border: 1px solid rgba(78, 205, 196, 0.3); border-radius: 8px; margin-bottom: 20px; color: var(--text-primary); font-size: 14px;">
          Last action: {{ menu.lastAction }}
        </div>

        <div
          @contextmenu.prevent="showTaskMenu"
          style="padding: 16px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; cursor: context-menu; max-width: 400px; transition: border-color 0.2s;"
          @mouseenter="$event.target.style.borderColor = 'rgba(78, 205, 196, 0.5)'"
          @mouseleave="$event.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'"
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
