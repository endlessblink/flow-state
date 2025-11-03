import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import CanvasContextMenu from '@/components/canvas/CanvasContextMenu.vue'

const meta = {
  component: CanvasContextMenu,
  title: '🎭 Overlays/💬 Context Menus/CanvasContextMenu',
  tags: ['autodocs'],

  parameters: {
    layout: 'fullscreen',
    docs: {
      story: {
        height: '700px',
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
    hasSelectedTasks: {
      control: 'boolean',
      description: 'Whether tasks are currently selected',
    },
    selectedCount: {
      control: 'number',
      description: 'Number of selected tasks',
    },
    contextSection: {
      control: 'object',
      description: 'Canvas section context for group operations',
    },
  },
} satisfies Meta<typeof CanvasContextMenu>

export default meta
type Story = StoryObj<typeof meta>

// Default empty canvas context menu
export const Default: Story = {
  args: {
    isVisible: true,
    x: 400,
    y: 300,
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
      const hasSelectedTasks = ref(args.hasSelectedTasks)
      const selectedCount = ref(args.selectedCount)
      const contextSection = ref(args.contextSection)

      const handleClose = () => {
        isVisible.value = false
      }

      const handleCreateTaskHere = () => {
        console.log('Creating task at position:', { x: x.value, y: y.value })
        isVisible.value = false
      }

      const handleCreateGroup = () => {
        console.log('Creating custom group')
        isVisible.value = false
      }

      const handleCanvasClick = (event: MouseEvent) => {
        x.value = event.clientX
        y.value = event.clientY
        isVisible.value = true
      }

      const logAction = (action: string) => {
        console.log(`Canvas action: ${action}`)
        isVisible.value = false
      }

      return {
        isVisible,
        x,
        y,
        hasSelectedTasks,
        selectedCount,
        contextSection,
        handleClose,
        handleCreateTaskHere,
        handleCreateGroup,
        handleCanvasClick,
        logAction
      }
    },
    template: `
      <div
        style="padding: 40px; min-height: 100vh; background: var(--surface-secondary); cursor: crosshair;"
        @click="handleCanvasClick"
      >
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Canvas Context Menu</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Click anywhere on the canvas to show the context menu</p>

        <!-- Canvas area -->
        <div style="position: relative; width: 100%; height: 500px; background: var(--surface-primary); border: 2px dashed var(--border-medium); border-radius: 12px;">
          <div style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); text-align: center; color: var(--text-muted); font-size: 14px;">
            Click to test context menu positioning
          </div>
        </div>

        <CanvasContextMenu
          :is-visible="isVisible"
          :x="x"
          :y="y"
          :has-selected-tasks="hasSelectedTasks"
          :selected-count="selectedCount"
          :context-section="contextSection"
          @close="handleClose"
          @create-task-here="handleCreateTaskHere"
          @create-group="handleCreateGroup"
          @align-left="() => logAction('alignLeft')"
          @align-right="() => logAction('alignRight')"
          @align-top="() => logAction('alignTop')"
          @align-bottom="() => logAction('alignBottom')"
          @align-center-horizontal="() => logAction('alignCenterHorizontal')"
          @align-center-vertical="() => logAction('alignCenterVertical')"
          @distribute-horizontal="() => logAction('distributeHorizontal')"
          @distribute-vertical="() => logAction('distributeVertical')"
        />
      </div>
    `,
  })
}

// With selected tasks (shows alignment options)
export const WithSelectedTasks: Story = {
  args: {
    isVisible: true,
    x: 400,
    y: 300,
    hasSelectedTasks: true,
    selectedCount: 2,
    contextSection: null,
  },
  render: (args) => ({
    components: { CanvasContextMenu },
    setup() {
      const isVisible = ref(args.isVisible)
      const x = ref(args.x)
      const y = ref(args.y)
      const hasSelectedTasks = ref(args.hasSelectedTasks)
      const selectedCount = ref(args.selectedCount)
      const contextSection = ref(args.contextSection)

      const handleClose = () => {
        isVisible.value = false
      }

      const handleCreateTaskHere = () => {
        console.log('Creating task with', selectedCount.value, 'selected tasks')
        isVisible.value = false
      }

      const updateSelectedCount = (count: number) => {
        selectedCount.value = count
        hasSelectedTasks.value = count > 0
      }

      const logAction = (action: string) => {
        console.log(`Canvas action with ${selectedCount.value} selected: ${action}`)
        isVisible.value = false
      }

      return {
        isVisible,
        x,
        y,
        hasSelectedTasks,
        selectedCount,
        contextSection,
        handleClose,
        handleCreateTaskHere,
        updateSelectedCount,
        logAction
      }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">With Selected Tasks</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Context menu with alignment tools for selected tasks</p>

        <!-- Selection controls -->
        <div style="display: flex; gap: 12px; margin-bottom: 32px; flex-wrap: wrap;">
          <button
            @click="updateSelectedCount(0)"
            style="padding: 8px 16px; background: var(--surface-tertiary); color: var(--text-primary); border: 1px solid var(--border-secondary); border-radius: 6px; cursor: pointer; font-size: 14px;"
          >
            Clear Selection
          </button>
          <button
            @click="updateSelectedCount(1)"
            style="padding: 8px 16px; background: var(--surface-tertiary); color: var(--text-primary); border: 1px solid var(--border-secondary); border-radius: 6px; cursor: pointer; font-size: 14px;"
          >
            Select 1 Task
          </button>
          <button
            @click="updateSelectedCount(2)"
            style="padding: 8px 16px; background: var(--brand-primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;"
          >
            Select 2 Tasks (Alignment)
          </button>
          <button
            @click="updateSelectedCount(3)"
            style="padding: 8px 16px; background: var(--brand-primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;"
          >
            Select 3+ Tasks (Distribution)
          </button>
        </div>

        <!-- Canvas area with selected tasks visualization -->
        <div style="position: relative; width: 100%; height: 400px; background: var(--surface-primary); border: 2px dashed var(--border-medium); border-radius: 12px;">
          <!-- Selected task visualization -->
          <div v-if="selectedCount > 0" style="position: absolute; top: 20px; left: 20px; background: var(--glass-bg-soft); padding: 12px; border-radius: 8px; border: 1px solid var(--glass-border);">
            <div style="font-size: 14px; color: var(--text-primary); font-weight: bold;">
              {{ selectedCount }} task{{ selectedCount > 1 ? 's' : '' }} selected
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
              Alignment tools: {{ selectedCount >= 2 ? 'Available' : 'Need 2+ tasks' }}
            </div>
            <div style="font-size: 12px; color: var(--text-secondary);">
              Distribution tools: {{ selectedCount >= 3 ? 'Available' : 'Need 3+ tasks' }}
            </div>
          </div>
        </div>

        <CanvasContextMenu
          :is-visible="isVisible"
          :x="x"
          :y="y"
          :has-selected-tasks="hasSelectedTasks"
          :selected-count="selectedCount"
          :context-section="contextSection"
          @close="handleClose"
          @create-task-here="handleCreateTaskHere"
          @create-group="() => logAction('createGroup')"
          @align-left="() => logAction('alignLeft')"
          @align-right="() => logAction('alignRight')"
          @align-top="() => logAction('alignTop')"
          @align-bottom="() => logAction('alignBottom')"
          @align-center-horizontal="() => logAction('alignCenterHorizontal')"
          @align-center-vertical="() => logAction('alignCenterVertical')"
          @distribute-horizontal="() => logAction('distributeHorizontal')"
          @distribute-vertical="() => logAction('distributeVertical')"
        />
      </div>
    `,
  })
}

// With group context
export const WithGroupContext: Story = {
  args: {
    isVisible: true,
    x: 400,
    y: 300,
    hasSelectedTasks: false,
    selectedCount: 0,
    contextSection: { id: 'group-1', name: 'Development Tasks' },
  },
  render: (args) => ({
    components: { CanvasContextMenu },
    setup() {
      const isVisible = ref(args.isVisible)
      const x = ref(args.x)
      const y = ref(args.y)
      const hasSelectedTasks = ref(args.hasSelectedTasks)
      const selectedCount = ref(args.selectedCount)
      const contextSection = ref(args.contextSection)

      const handleClose = () => {
        isVisible.value = false
      }

      const handleCreateTaskHere = () => {
        console.log('Creating task in group:', contextSection.value)
        isVisible.value = false
      }

      const handleEditGroup = () => {
        console.log('Editing group:', contextSection.value)
        isVisible.value = false
      }

      const handleDeleteGroup = () => {
        console.log('Deleting group:', contextSection.value)
        isVisible.value = false
      }

      const switchGroup = (group: typeof contextSection.value) => {
        contextSection.value = group
      }

      const clearGroup = () => {
        contextSection.value = null
      }

      return {
        isVisible,
        x,
        y,
        hasSelectedTasks,
        selectedCount,
        contextSection,
        handleClose,
        handleCreateTaskHere,
        handleEditGroup,
        handleDeleteGroup,
        switchGroup,
        clearGroup
      }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">With Group Context</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Context menu with group-specific options</p>

        <!-- Group selector -->
        <div style="display: flex; gap: 12px; margin-bottom: 32px; flex-wrap: wrap;">
          <button
            @click="clearGroup"
            style="padding: 8px 16px; background: var(--surface-tertiary); color: var(--text-primary); border: 1px solid var(--border-secondary); border-radius: 6px; cursor: pointer; font-size: 14px;"
          >
            No Group Context
          </button>
          <button
            @click="switchGroup({ id: 'group-1', name: 'Development Tasks' })"
            style="padding: 8px 16px; background: var(--brand-primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;"
          >
            Development Tasks
          </button>
          <button
            @click="switchGroup({ id: 'group-2', name: 'Design Work' })"
            style="padding: 8px 16px; background: var(--brand-primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;"
          >
            Design Work
          </button>
          <button
            @click="switchGroup({ id: 'group-3', name: 'Planning' })"
            style="padding: 8px 16px; background: var(--brand-primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;"
          >
            Planning
          </button>
        </div>

        <!-- Canvas area with group visualization -->
        <div style="position: relative; width: 100%; height: 400px; background: var(--surface-primary); border: 2px dashed var(--border-medium); border-radius: 12px;">
          <div v-if="contextSection" style="position: absolute; top: 20px; left: 20px; background: var(--glass-bg-soft); padding: 12px; border-radius: 8px; border: 1px solid var(--glass-border);">
            <div style="font-size: 14px; color: var(--text-primary); font-weight: bold;">
              Current Group:
            </div>
            <div style="font-size: 16px; color: var(--brand-primary); margin-top: 4px;">
              {{ contextSection.name }}
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
              ID: {{ contextSection.id }}
            </div>
          </div>
        </div>

        <CanvasContextMenu
          :is-visible="isVisible"
          :x="x"
          :y="y"
          :has-selected-tasks="hasSelectedTasks"
          :selected-count="selectedCount"
          :context-section="contextSection"
          @close="handleClose"
          @create-task-here="handleCreateTaskHere"
          @create-group="() => console.log('Create group')"
          @edit-group="handleEditGroup"
          @delete-group="handleDeleteGroup"
          @align-left="() => console.log('alignLeft')"
          @align-right="() => console.log('alignRight')"
          @align-top="() => console.log('alignTop')"
          @align-bottom="() => console.log('alignBottom')"
          @align-center-horizontal="() => console.log('alignCenterHorizontal')"
          @align-center-vertical="() => console.log('alignCenterVertical')"
          @distribute-horizontal="() => console.log('distributeHorizontal')"
          @distribute-vertical="() => console.log('distributeVertical')"
        />
      </div>
    `,
  })
}

// Full context menu with all features
export const FullFeatured: Story = {
  args: {
    isVisible: true,
    x: 400,
    y: 300,
    hasSelectedTasks: true,
    selectedCount: 4,
    contextSection: { id: 'team-group', name: 'Team Tasks' },
  },
  render: (args) => ({
    components: { CanvasContextMenu },
    setup() {
      const isVisible = ref(args.isVisible)
      const x = ref(args.x)
      const y = ref(args.y)
      const hasSelectedTasks = ref(args.hasSelectedTasks)
      const selectedCount = ref(args.selectedCount)
      const contextSection = ref(args.contextSection)

      const actionLog = ref<string[]>([])

      const handleClose = () => {
        isVisible.value = false
      }

      const logAction = (action: string, data?: any) => {
        const message = data ? `${action}: ${JSON.stringify(data)}` : action
        actionLog.value.unshift(message)
        if (actionLog.value.length > 10) actionLog.value.pop()
        console.log('Canvas action:', message)
        isVisible.value = false
      }

      const toggleMenu = () => {
        isVisible.value = !isVisible.value
      }

      return {
        isVisible,
        x,
        y,
        hasSelectedTasks,
        selectedCount,
        contextSection,
        actionLog,
        handleClose,
        logAction,
        toggleMenu
      }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Full Featured Canvas Menu</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Complete context menu with all options available</p>

        <button
          @click="toggleMenu"
          style="padding: 12px 24px; background: var(--brand-primary); color: white; border: none; border-radius: 8px; cursor: pointer; margin-bottom: 32px;"
        >
          {{ isVisible ? 'Hide Menu' : 'Show Menu' }}
        </button>

        <!-- Feature showcase -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px;">
          <div style="padding: 20px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
            <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Current State</h4>
            <div style="font-size: 14px; color: var(--text-secondary); line-height: 1.6;">
              <div><strong>Selected Tasks:</strong> {{ selectedCount }}</div>
              <div><strong>Has Selection:</strong> {{ hasSelectedTasks ? 'Yes' : 'No' }}</div>
              <div><strong>Group Context:</strong> {{ contextSection?.name || 'None' }}</div>
              <div><strong>Menu Position:</strong> ({{ x }}, {{ y }})</div>
            </div>
          </div>

          <div style="padding: 20px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
            <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Available Features</h4>
            <div style="font-size: 14px; color: var(--text-secondary); line-height: 1.6;">
              <div>✅ Create Task Here</div>
              <div>✅ Group Operations</div>
              <div>✅ Alignment Tools ({{ selectedCount >= 2 ? 'Active' : 'Need 2+' }})</div>
              <div>✅ Distribution Tools ({{ selectedCount >= 3 ? 'Active' : 'Need 3+' }})</div>
            </div>
          </div>
        </div>

        <!-- Action log -->
        <div v-if="actionLog.length > 0" style="padding: 20px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Recent Actions</h4>
          <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.4;">
            <div v-for="(action, index) in actionLog" :key="index" style="padding: 4px 0; border-bottom: 1px solid var(--border-secondary);">
              {{ action }}
            </div>
          </div>
        </div>

        <CanvasContextMenu
          :is-visible="isVisible"
          :x="x"
          :y="y"
          :has-selected-tasks="hasSelectedTasks"
          :selected-count="selectedCount"
          :context-section="contextSection"
          @close="handleClose"
          @create-task-here="() => logAction('Create task here')"
          @create-group="() => logAction('Create custom group')"
          @edit-group="(group) => logAction('Edit group', group)"
          @delete-group="(group) => logAction('Delete group', group)"
          @align-left="() => logAction('Align left')"
          @align-right="() => logAction('Align right')"
          @align-top="() => logAction('Align top')"
          @align-bottom="() => logAction('Align bottom')"
          @align-center-horizontal="() => logAction('Align center horizontal')"
          @align-center-vertical="() => logAction('Align center vertical')"
          @distribute-horizontal="() => logAction('Distribute horizontal')"
          @distribute-vertical="() => logAction('Distribute vertical')"
        />
      </div>
    `,
  })
}