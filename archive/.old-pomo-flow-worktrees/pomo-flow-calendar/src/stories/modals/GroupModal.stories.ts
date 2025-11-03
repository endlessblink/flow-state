import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import GroupModal from '@/components/GroupModal.vue'

const meta = {
  component: GroupModal,
  title: '🎭 Overlays/🪟 Modals/GroupModal',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Modal for creating and editing custom canvas groups with color selection, positioning, and validation.'
      }
    }
  },

  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Whether the modal is open',
    },
    group: {
      control: 'object',
      description: 'Existing group data for editing mode',
    },
    position: {
      control: 'object',
      description: 'Position where new group should be created',
    },
  },
} satisfies Meta<typeof GroupModal>

export default meta
type Story = StoryObj<typeof meta>

// Default create modal
export const Default: Story = {
  args: {
    isOpen: true,
    group: null,
    position: { x: 100, y: 100 },
  },
  render: (args) => ({
    components: { GroupModal },
    setup() {
      const isOpen = ref(args.isOpen)
      const group = ref(args.group)
      const position = ref(args.position)

      const handleClose = () => {
        isOpen.value = false
        console.log('GroupModal closed')
      }

      const handleCreated = (newGroup: any) => {
        console.log('Group created:', newGroup)
      }

      const handleUpdated = (updatedGroup: any) => {
        console.log('Group updated:', updatedGroup)
      }

      return {
        isOpen,
        group,
        position,
        handleClose,
        handleCreated,
        handleUpdated,
      }
    },
    template: `
      <GroupModal
        :is-open="isOpen"
        :group="group"
        :position="position"
        @close="handleClose"
        @created="handleCreated"
        @updated="handleUpdated"
      />
    `,
  }),
}

// Edit existing group
export const EditGroup: Story = {
  args: {
    isOpen: true,
    group: {
      id: 'group-1',
      name: 'Important Tasks',
      color: '#ef4444',
      type: 'custom',
      position: { x: 200, y: 150 },
      width: 300,
      height: 200,
    },
    position: { x: 100, y: 100 },
  },
  render: (args) => ({
    components: { GroupModal },
    setup() {
      const isOpen = ref(args.isOpen)
      const group = ref(args.group)
      const position = ref(args.position)

      const handleClose = () => {
        isOpen.value = false
        console.log('Edit GroupModal closed')
      }

      const handleCreated = (newGroup: any) => {
        console.log('Group created:', newGroup)
      }

      const handleUpdated = (updatedGroup: any) => {
        console.log('Group updated:', updatedGroup)
      }

      return {
        isOpen,
        group,
        position,
        handleClose,
        handleCreated,
        handleUpdated,
      }
    },
    template: `
      <div style="padding: 40px; background: var(--surface-secondary); min-height: 600px;">
        <h3 style="margin: 0 0 24px 0; font-size: 18px; color: var(--text-primary);">Edit Group Modal</h3>
        <p style="margin: 0 0 32px 0; color: var(--text-secondary);">Modifying existing group with pre-filled data</p>

        <GroupModal
          :is-open="isOpen"
          :group="group"
          :position="position"
          @close="handleClose"
          @created="handleCreated"
          @updated="handleUpdated"
        />
      </div>
    `,
  }),
}

// Color selection showcase
export const ColorSelection: Story = {
  render: () => ({
    components: { GroupModal },
    setup() {
      const isOpen = ref(true)
      const group = ref(null)
      const position = ref({ x: 100, y: 100 })

      const handleClose = () => {
        console.log('Color selection modal closed')
      }

      const handleCreated = (newGroup: any) => {
        console.log('Group created with color:', newGroup.color)
      }

      return {
        isOpen,
        group,
        position,
        handleClose,
        handleCreated,
      }
    },
    template: `
      <div style="padding: 40px; background: var(--surface-secondary); min-height: 700px;">
        <h3 style="margin: 0 0 24px 0; font-size: 20px; color: var(--text-primary);">Color Selection Features</h3>
        <p style="margin: 0 0 32px 0; color: var(--text-secondary);">Comprehensive color picker with presets and custom colors</p>

        <GroupModal
          :is-open="isOpen"
          :group="group"
          :position="position"
          @close="handleClose"
          @created="handleCreated"
        />

        <div style="margin-top: 32px; padding: 20px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Color Features</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            <li><strong>20 Color Presets</strong> - Quick selection from curated palette</li>
            <li><strong>Custom Color Input</strong> - Hex color code entry with validation</li>
            <li><strong>Native Color Picker</strong> - Browser color picker integration</li>
            <li><strong>Live Preview</strong> - Real-time color preview with hex value</li>
            <li><strong>Visual Feedback</strong> - Active selection indicators and hover states</li>
            <li><strong>Color Validation</strong> - Hex format validation for custom inputs</li>
          </ul>
        </div>
      </div>
    `,
  }),
}

// Multiple positions demo
export const MultiplePositions: Story = {
  render: () => ({
    components: { GroupModal },
    setup() {
      const modals = ref([
        {
          id: 'modal-1',
          isOpen: true,
          group: null,
          position: { x: 50, y: 50 },
          label: 'Top Left'
        },
        {
          id: 'modal-2',
          isOpen: false,
          group: null,
          position: { x: 300, y: 200 },
          label: 'Center'
        },
        {
          id: 'modal-3',
          isOpen: false,
          group: null,
          position: { x: 500, y: 100 },
          label: 'Top Right'
        }
      ])

      const openModal = (modalId: string) => {
        modals.value.forEach(modal => {
          modal.isOpen = modal.id === modalId
        })
      }

      const handleClose = () => {
        console.log('Modal closed')
      }

      const handleCreated = (newGroup: any, position: { x: number, y: number }) => {
        console.log(`Group created at position (${position.x}, ${position.y}):`, newGroup)
      }

      return {
        modals,
        openModal,
        handleClose,
        handleCreated,
      }
    },
    template: `
      <div style="padding: 40px; background: var(--surface-secondary); min-height: 600px; position: relative;">
        <h3 style="margin: 0 0 24px 0; font-size: 20px; color: var(--text-primary);">Multiple Position Demo</h3>
        <p style="margin: 0 0 32px 0; color: var(--text-secondary);">Click buttons to open modals at different positions</p>

        <!-- Control Buttons -->
        <div style="display: flex; gap: 12px; margin-bottom: 32px; flex-wrap: wrap;">
          <button
            v-for="modal in modals"
            :key="modal.id"
            @click="openModal(modal.id)"
            style="
              padding: 12px 20px;
              background: var(--surface-primary);
              border: 1px solid var(--border-subtle);
              border-radius: 8px;
              color: var(--text-primary);
              cursor: pointer;
              font-size: 14px;
              transition: all 0.2s ease;
            "
            @mouseenter="$event.target.style.background = 'var(--glass-bg-soft)'"
            @mouseleave="$event.target.style.background = 'var(--surface-primary)'"
          >
            Open {{ modal.label }} ({{ modal.position.x }}, {{ modal.position.y }})
          </button>
        </div>

        <!-- Demo Canvas Area -->
        <div style="
          position: relative;
          height: 400px;
          background: var(--surface-primary);
          border: 2px dashed var(--border-medium);
          border-radius: 12px;
          overflow: hidden;
        ">
          <!-- Position Indicators -->
          <div
            v-for="modal in modals"
            :key="'indicator-' + modal.id"
            style="
              position: absolute;
              width: 8px;
              height: 8px;
              background: var(--brand-primary);
              border-radius: 50%;
              transform: translate(-50%, -50%);
              z-index: 1;
            "
            :style="{ left: modal.position.x + 'px', top: modal.position.y + 'px' }"
            :title="modal.label + ' position'"
          />

          <!-- Group Modals -->
          <GroupModal
            v-for="modal in modals"
            :key="modal.id"
            :is-open="modal.isOpen"
            :group="modal.group"
            :position="modal.position"
            @close="handleClose"
            @created="(group) => handleCreated(group, modal.position)"
          />
        </div>

        <div style="margin-top: 24px; padding: 16px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 8px 0; font-size: 16px; color: var(--text-primary);">Position Features</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            <li><strong>Flexible Positioning</strong> - Create groups at any canvas position</li>
            <li><strong>Coordinate System</strong> - Precise X,Y positioning for new groups</li>
            <li><strong>Visual Indicators</strong> - Blue dots show creation positions</li>
            <li><strong>Context-Aware</strong> - Position affects initial group placement</li>
          </ul>
        </div>
      </div>
    `,
  }),
}

// Validation and states
export const ValidationStates: Story = {
  render: () => ({
    components: { GroupModal },
    setup() {
      const scenarios = ref([
        {
          isOpen: false,
          group: null,
          position: { x: 100, y: 100 },
          title: 'Empty Form',
          description: 'Create mode with empty fields',
          buttonLabel: 'Show Empty Form'
        },
        {
          isOpen: false,
          group: {
            id: 'group-2',
            name: 'Design Tasks',
            color: '#3b82f6',
            type: 'custom'
          },
          position: { x: 100, y: 100 },
          title: 'Pre-filled Edit',
          description: 'Edit mode with existing data',
          buttonLabel: 'Show Edit Form'
        },
        {
          isOpen: false,
          group: {
            id: 'group-3',
            name: '',
            color: '#22c55e',
            type: 'custom'
          },
          position: { x: 100, y: 100 },
          title: 'Empty Name Edit',
          description: 'Edit mode with empty name (disabled save)',
          buttonLabel: 'Show Invalid Form'
        }
      ])

      const activeScenario = ref<number | null>(null)

      const showScenario = (index: number) => {
        // Close all scenarios first
        scenarios.value.forEach(scenario => scenario.isOpen = false)

        // Open the selected scenario
        scenarios.value[index].isOpen = true
        activeScenario.value = index
      }

      const handleClose = () => {
        activeScenario.value = null
        scenarios.value.forEach(scenario => scenario.isOpen = false)
      }

      const handleCreated = (newGroup: any) => {
        console.log('Group created:', newGroup)
      }

      const handleUpdated = (updatedGroup: any) => {
        console.log('Group updated:', updatedGroup)
      }

      return {
        scenarios,
        activeScenario,
        showScenario,
        handleClose,
        handleCreated,
        handleUpdated,
      }
    },
    template: `
      <div style="padding: 40px; background: var(--surface-secondary); min-height: 600px;">
        <h3 style="margin: 0 0 24px 0; font-size: 20px; color: var(--text-primary);">Validation and States</h3>
        <p style="margin: 0 0 32px 0; color: var(--text-secondary);">Different form states and validation scenarios</p>

        <!-- Scenario Buttons -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 32px;">
          <div
            v-for="(scenario, index) in scenarios"
            :key="index"
            style="
              padding: 20px;
              background: var(--surface-primary);
              border: 1px solid var(--border-subtle);
              border-radius: 12px;
              cursor: pointer;
              transition: all 0.2s ease;
            "
            @click="showScenario(index)"
            @mouseenter="$event.currentTarget.style.borderColor = 'var(--border-medium)'"
            @mouseleave="$event.currentTarget.style.borderColor = 'var(--border-subtle)'"
          >
            <h4 style="margin: 0 0 8px 0; font-size: 16px; color: var(--text-primary);">{{ scenario.title }}</h4>
            <p style="margin: 0 0 12px 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">{{ scenario.description }}</p>
            <div style="
              padding: 8px 12px;
              background: var(--brand-primary);
              color: white;
              border-radius: 6px;
              font-size: 12px;
              font-weight: 500;
              text-align: center;
            ">
              {{ scenario.buttonLabel }}
            </div>
          </div>
        </div>

        <!-- Active Modal -->
        <GroupModal
          v-for="(scenario, index) in scenarios"
          :key="'modal-' + index"
          :is-open="scenario.isOpen"
          :group="scenario.group"
          :position="scenario.position"
          @close="handleClose"
          @created="handleCreated"
          @updated="handleUpdated"
        />

        <!-- Validation Info -->
        <div style="margin-top: 32px; padding: 20px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Validation Features</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            <li><strong>Required Field Validation</strong> - Name is required to save/create</li>
            <li><strong>Real-time Feedback</strong> - Save button enables/disables based on input</li>
            <li><strong>Edit Mode Detection</strong> - Automatically switches to edit when group provided</li>
            <li><strong>Form State Management</strong> - Properly handles form reset and data population</li>
            <li><strong>Color Validation</strong> - Hex color format validation for custom inputs</li>
            <li><strong>Focus Management</strong> - Auto-focuses name input when modal opens</li>
          </ul>
        </div>
      </div>
    `,
  }),
}

// Interactive workflow demo
export const InteractiveWorkflow: Story = {
  render: () => ({
    components: { GroupModal },
    setup() {
      const isOpen = ref(false)
      const createdGroups = ref([])
      const editingGroup = ref(null)
      const mode = ref('create') // 'create' or 'edit'

      const openCreateModal = () => {
        mode.value = 'create'
        editingGroup.value = null
        isOpen.value = true
      }

      const openEditModal = (group: any) => {
        mode.value = 'edit'
        editingGroup.value = group
        isOpen.value = true
      }

      const handleClose = () => {
        isOpen.value = false
      }

      const handleCreated = (newGroup: any) => {
        createdGroups.value.push({
          ...newGroup,
          id: `group-${Date.now()}`,
          createdAt: new Date().toLocaleTimeString()
        })
        console.log('Group created:', newGroup)
      }

      const handleUpdated = (updatedGroup: any) => {
        const index = createdGroups.value.findIndex(g => g.id === updatedGroup.id)
        if (index !== -1) {
          createdGroups.value[index] = {
            ...createdGroups.value[index],
            ...updatedGroup,
            updatedAt: new Date().toLocaleTimeString()
          }
        }
        console.log('Group updated:', updatedGroup)
      }

      const deleteGroup = (groupId: string) => {
        createdGroups.value = createdGroups.value.filter(g => g.id !== groupId)
      }

      return {
        isOpen,
        editingGroup,
        createdGroups,
        mode,
        openCreateModal,
        openEditModal,
        handleClose,
        handleCreated,
        handleUpdated,
        deleteGroup,
      }
    },
    template: `
      <div style="padding: 40px; background: var(--surface-secondary); min-height: 600px;">
        <h3 style="margin: 0 0 24px 0; font-size: 20px; color: var(--text-primary);">Interactive Group Workflow</h3>
        <p style="margin: 0 0 32px 0; color: var(--text-secondary);">Create, edit, and manage canvas groups</p>

        <!-- Control Panel -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding: 20px; background: var(--surface-primary); border-radius: 12px; border: 1px solid var(--border-subtle);">
          <div>
            <h4 style="margin: 0 0 4px 0; font-size: 16px; color: var(--text-primary);">Group Manager</h4>
            <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">{{ createdGroups.length }} groups created</p>
          </div>

          <button
            @click="openCreateModal"
            style="
              padding: 12px 20px;
              background: linear-gradient(135deg, var(--brand-primary), var(--brand-primary-hover));
              color: white;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
              transition: all 0.2s ease;
            "
            @mouseenter="$event.target.style.transform = 'translateY(-1px)'"
            @mouseleave="$event.target.style.transform = 'translateY(0)'"
          >
            + Create New Group
          </button>
        </div>

        <!-- Groups List -->
        <div v-if="createdGroups.length > 0" style="margin-bottom: 24px;">
          <h4 style="margin: 0 0 16px 0; font-size: 16px; color: var(--text-primary);">Created Groups</h4>
          <div style="display: grid; gap: 12px;">
            <div
              v-for="group in createdGroups"
              :key="group.id"
              style="
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 16px;
                background: var(--surface-primary);
                border: 1px solid var(--border-subtle);
                border-radius: 8px;
                transition: all 0.2s ease;
              "
              @mouseenter="$event.currentTarget.style.borderColor = 'var(--border-medium)'"
              @mouseleave="$event.currentTarget.style.borderColor = 'var(--border-subtle)'"
            >
              <div
                style="
                  width: 24px;
                  height: 24px;
                  border-radius: 4px;
                  border: 1px solid var(--border-secondary);
                  flex-shrink: 0;
                "
                :style="{ backgroundColor: group.color }"
              />

              <div style="flex: 1;">
                <div style="font-size: 15px; color: var(--text-primary); font-weight: 500;">{{ group.name }}</div>
                <div style="font-size: 12px; color: var(--text-muted);">
                  {{ group.color }} • {{ group.createdAt }} {{ group.updatedAt ? '• Updated ' + group.updatedAt : '' }}
                </div>
              </div>

              <div style="display: flex; gap: 8px;">
                <button
                  @click="openEditModal(group)"
                  style="
                    padding: 6px 12px;
                    background: var(--glass-bg-soft);
                    border: 1px solid var(--glass-border);
                    border-radius: 6px;
                    color: var(--text-secondary);
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s ease;
                  "
                  @mouseenter="$event.target.style.background = 'var(--glass-bg-medium)'"
                  @mouseleave="$event.target.style.background = 'var(--glass-bg-soft)'"
                >
                  Edit
                </button>

                <button
                  @click="deleteGroup(group.id)"
                  style="
                    padding: 6px 12px;
                    background: var(--danger-bg-subtle);
                    border: 1px solid var(--danger-border);
                    border-radius: 6px;
                    color: var(--danger-text);
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s ease;
                  "
                  @mouseenter="$event.target.style.background = 'var(--danger-bg-medium)'"
                  @mouseleave="$event.target.style.background = 'var(--danger-bg-subtle)'"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else style="
          margin-bottom: 24px;
          padding: 40px;
          text-align: center;
          background: var(--surface-primary);
          border: 2px dashed var(--border-medium);
          border-radius: 12px;
        ">
          <div style="font-size: 24px; margin-bottom: 8px;">📁</div>
          <h4 style="margin: 0 0 8px 0; font-size: 16px; color: var(--text-primary);">No Groups Yet</h4>
          <p style="margin: 0; font-size: 14px; color: var(--text-secondary);">Create your first group to get started</p>
        </div>

        <!-- Group Modal -->
        <GroupModal
          :is-open="isOpen"
          :group="editingGroup"
          :position="{ x: 100, y: 100 }"
          @close="handleClose"
          @created="handleCreated"
          @updated="handleUpdated"
        />

        <!-- Workflow Info -->
        <div style="margin-top: 32px; padding: 20px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Workflow Features</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            <li><strong>Complete CRUD Operations</strong> - Create, read, update, and delete groups</li>
            <li><strong>Mode Switching</strong> - Automatically switches between create/edit modes</li>
            <li><strong>Real-time Updates</strong> - Immediate UI updates after operations</li>
            <li><strong>State Management</strong> - Proper handling of form states and validation</li>
            <li><strong>Visual Feedback</strong> - Color previews and status indicators</li>
            <li><strong>Persistence</strong> - Groups are stored and managed throughout the session</li>
          </ul>
        </div>
      </div>
    `,
  }),
}