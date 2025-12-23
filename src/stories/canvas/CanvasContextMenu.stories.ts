import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import CanvasContextMenu from '@/components/canvas/CanvasContextMenu.vue'

const meta = {
  component: CanvasContextMenu,
  title: '🎨 Canvas/CanvasContextMenu',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: { story: { height: '500px' } },
  },
  argTypes: {
    isVisible: { control: 'boolean' },
    x: { control: 'number' },
    y: { control: 'number' },
    hasSelectedTasks: { control: 'boolean' },
    selectedCount: { control: 'number' },
    contextSection: { control: 'object' },
  },
} satisfies Meta<typeof CanvasContextMenu>

export default meta
type Story = StoryObj<typeof meta>

// Default canvas context menu
export const Default: Story = {
  args: {
    isVisible: true,
    x: 200,
    y: 150,
    hasSelectedTasks: false,
    selectedCount: 0,
    contextSection: null,
  },
  render: (args) => ({
    components: { CanvasContextMenu },
    setup() {
      const isVisible = ref(args.isVisible)
      const x = ref(args.x)
      const y = ref(args.y)

      const handleCanvasClick = (e: MouseEvent) => {
        x.value = e.clientX
        y.value = e.clientY
        isVisible.value = true
      }

      return {
        isVisible,
        x,
        y,
        hasSelectedTasks: ref(args.hasSelectedTasks),
        selectedCount: ref(args.selectedCount),
        contextSection: ref(args.contextSection),
        handleClose: () => { isVisible.value = false },
        handleCanvasClick,
        log: (action: string) => { console.log(action); isVisible.value = false }
      }
    },
    template: `
      <div style="min-height: 100vh; background: rgba(0, 0, 0, 0.95); padding: 40px;" @click="handleCanvasClick">
        <div style="margin-bottom: 20px;">
          <h3 style="color: var(--text-primary); margin: 0 0 8px 0;">Canvas Context Menu</h3>
          <p style="color: var(--text-secondary); margin: 0;">Click anywhere to reposition menu</p>
        </div>
        <CanvasContextMenu
          :is-visible="isVisible"
          :x="x"
          :y="y"
          :has-selected-tasks="hasSelectedTasks"
          :selected-count="selectedCount"
          :context-section="contextSection"
          @close="handleClose"
          @create-task-here="() => log('Create task')"
          @create-group="() => log('Create group')"
        />
      </div>
    `,
  })
}

// With selected tasks and group context (full features)
export const FullFeatured: Story = {
  args: {
    isVisible: true,
    x: 200,
    y: 150,
    hasSelectedTasks: true,
    selectedCount: 3,
    contextSection: { id: 'group-1', name: 'Development' },
  },
  render: (args) => ({
    components: { CanvasContextMenu },
    setup() {
      const isVisible = ref(args.isVisible)
      const selectedCount = ref(args.selectedCount)
      const contextSection = ref(args.contextSection)

      const setSelection = (count: number) => {
        selectedCount.value = count
      }

      const setGroup = (group: typeof contextSection.value) => {
        contextSection.value = group
      }

      return {
        isVisible,
        x: ref(args.x),
        y: ref(args.y),
        hasSelectedTasks: ref(args.hasSelectedTasks),
        selectedCount,
        contextSection,
        handleClose: () => { isVisible.value = false },
        log: (action: string) => { console.log(action); isVisible.value = false },
        setSelection,
        setGroup
      }
    },
    template: `
      <div style="min-height: 100vh; background: rgba(0, 0, 0, 0.95); padding: 40px;">
        <div style="margin-bottom: 20px;">
          <h3 style="color: var(--text-primary); margin: 0 0 8px 0;">Full Featured Menu</h3>
          <p style="color: var(--text-secondary); margin: 0 0 16px 0;">Shows group operations, task actions, and layout tools</p>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px;">
          <button @click="setSelection(0)" style="padding: 6px 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: var(--text-primary); cursor: pointer;">0 tasks</button>
          <button @click="setSelection(2)" style="padding: 6px 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: var(--text-primary); cursor: pointer;">2 tasks (align)</button>
          <button @click="setSelection(3)" style="padding: 6px 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: var(--text-primary); cursor: pointer;">3+ tasks (distribute)</button>
          <button @click="setGroup(null)" style="padding: 6px 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: var(--text-primary); cursor: pointer;">No group</button>
          <button @click="setGroup({ id: 'g1', name: 'Development' })" style="padding: 6px 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: var(--text-primary); cursor: pointer;">With group</button>
        </div>

        <div style="color: var(--text-muted); font-size: 13px; margin-bottom: 20px;">
          Selected: {{ selectedCount }} | Group: {{ contextSection?.name || 'None' }}
        </div>

        <CanvasContextMenu
          :is-visible="isVisible"
          :x="x"
          :y="y"
          :has-selected-tasks="selectedCount > 0"
          :selected-count="selectedCount"
          :context-section="contextSection"
          @close="handleClose"
          @create-task-here="() => log('Create task')"
          @create-group="() => log('Create group')"
          @edit-group="() => log('Edit group')"
          @delete-group="() => log('Delete group')"
          @move-to-inbox="() => log('Move to inbox')"
          @delete-tasks="() => log('Delete tasks')"
          @align-left="() => log('Align left')"
          @align-right="() => log('Align right')"
          @align-top="() => log('Align top')"
          @align-bottom="() => log('Align bottom')"
          @align-center-horizontal="() => log('Center horizontal')"
          @align-center-vertical="() => log('Center vertical')"
          @distribute-horizontal="() => log('Distribute horizontal')"
          @distribute-vertical="() => log('Distribute vertical')"
          @arrange-in-row="() => log('Arrange in row')"
          @arrange-in-column="() => log('Arrange in column')"
          @arrange-in-grid="() => log('Arrange in grid')"
        />
      </div>
    `,
  })
}
