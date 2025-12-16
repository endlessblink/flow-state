import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import GroupEditModal from '@/components/canvas/GroupEditModal.vue'
import type { CanvasSection } from '@/stores/canvas'

// Helper to create sample sections
const createSection = (overrides: Partial<CanvasSection> = {}): CanvasSection => ({
  id: 'section-1',
  name: 'Development Tasks',
  color: '#6366f1',
  layout: 'grid',
  isCollapsed: false,
  isVisible: true,
  tasks: [],
  position: { x: 100, y: 200 },
  size: { width: 400, height: 300 },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const meta = {
  component: GroupEditModal,
  title: '🧩 Components/🎨 Canvas/GroupEditModal',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
    docs: {
      story: {
        height: '600px',
      },
    },
  },

  argTypes: {
    section: {
      control: 'object',
      description: 'Canvas section data to edit',
    },
    isVisible: {
      control: 'boolean',
      description: 'Whether the modal is visible',
    },
  },
} satisfies Meta<typeof GroupEditModal>

export default meta
type Story = StoryObj<typeof meta>

// Default interactive modal
export const Default: Story = {
  args: {
    section: createSection(),
    isVisible: true,
  },
  render: (args) => ({
    components: { GroupEditModal },
    setup() {
      const section = ref(args.section)
      const isVisible = ref(args.isVisible)

      const handleSave = (data: any) => {
        console.log('Section saved:', data)
        isVisible.value = false
      }

      const handleCancel = () => {
        isVisible.value = false
      }

      const handleDelete = () => {
        console.log('Section deleted')
        isVisible.value = false
      }

      return {
        section,
        isVisible,
        handleSave,
        handleCancel,
        handleDelete,
      }
    },
    template: `
      <div style="padding: 40px; min-height: 500px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Group Edit Modal</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Edit canvas section properties</p>

        <div style="display: flex; gap: 24px;">
          <div style="flex: 1;">
            <GroupEditModal
              :section="section"
              :is-visible="isVisible"
              @save="handleSave"
              @cancel="handleCancel"
              @delete="handleDelete"
            />

            <button
              v-if="!isVisible"
              @click="isVisible = true"
              style="padding: 12px 24px; background: rgba(78, 205, 196, 0.15); border: 1px solid rgba(78, 205, 196, 0.3); border-radius: 8px; color: rgba(78, 205, 196, 1); cursor: pointer; font-size: 14px;"
            >
              Open Modal
            </button>
          </div>

          <div style="width: 280px; padding: 20px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px;">
            <h4 style="margin: 0 0 16px 0; font-size: 16px; color: var(--text-primary);">Features</h4>
            <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.8;">
              <li><strong>Section Name</strong> - Edit group title</li>
              <li><strong>Color Picker</strong> - Choose section color</li>
              <li><strong>Layout Options</strong> - Grid, vertical, horizontal</li>
              <li><strong>Visibility</strong> - Show/hide section</li>
              <li><strong>Collapse State</strong> - Expand/collapse</li>
              <li><strong>Delete Option</strong> - Remove section</li>
            </ul>
          </div>
        </div>
      </div>
    `,
  }),
}

// Layout variants showcase
export const LayoutVariants: Story = {
  render: () => ({
    components: { GroupEditModal },
    setup() {
      const layouts = ref([
        { id: 'grid', name: 'Grid Layout', layout: 'grid' as const, color: '#6366f1', icon: '⊞' },
        { id: 'vertical', name: 'Vertical Layout', layout: 'vertical' as const, color: '#10b981', icon: '⬇' },
        { id: 'horizontal', name: 'Horizontal Layout', layout: 'horizontal' as const, color: '#f59e0b', icon: '➡' },
      ])

      const activeModal = ref<string | null>(null)

      const openModal = (id: string) => {
        activeModal.value = id
      }

      const closeModal = () => {
        activeModal.value = null
      }

      const getSection = (item: typeof layouts.value[0]) => createSection({
        id: item.id,
        name: item.name,
        layout: item.layout,
        color: item.color,
      })

      return { layouts, activeModal, openModal, closeModal, getSection }
    },
    template: `
      <div style="padding: 40px; min-height: 500px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Layout Variants</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Different layout configurations for canvas sections</p>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
          <div
            v-for="item in layouts"
            :key="item.id"
            @click="openModal(item.id)"
            style="padding: 24px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; cursor: pointer; transition: all 0.2s ease; text-align: center;"
            @mouseenter="$event.target.style.borderColor = item.color"
            @mouseleave="$event.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'"
          >
            <div style="font-size: 32px; margin-bottom: 12px;">{{ item.icon }}</div>
            <div style="font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">{{ item.name }}</div>
            <div style="font-size: 14px; color: var(--text-muted);">Click to edit</div>
          </div>
        </div>

        <GroupEditModal
          v-for="item in layouts"
          :key="item.id"
          :section="getSection(item)"
          :is-visible="activeModal === item.id"
          @cancel="closeModal"
          @save="closeModal"
        />

        <div style="margin-top: 32px; padding: 20px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px;">
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Layout Types</h4>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; font-size: 14px; color: var(--text-secondary);">
            <div><strong style="color: #6366f1;">Grid</strong> - Tasks arranged in a grid pattern</div>
            <div><strong style="color: #10b981;">Vertical</strong> - Tasks stacked vertically</div>
            <div><strong style="color: #f59e0b;">Horizontal</strong> - Tasks arranged horizontally</div>
          </div>
        </div>
      </div>
    `,
  }),
}

// Color palette showcase
export const ColorPalette: Story = {
  render: () => ({
    components: { GroupEditModal },
    setup() {
      const colors = ref([
        { id: 'red', name: 'Urgent', color: '#ef4444' },
        { id: 'orange', name: 'Important', color: '#f97316' },
        { id: 'amber', name: 'Warning', color: '#f59e0b' },
        { id: 'green', name: 'Completed', color: '#10b981' },
        { id: 'blue', name: 'In Progress', color: '#3b82f6' },
        { id: 'purple', name: 'Planning', color: '#8b5cf6' },
        { id: 'pink', name: 'Design', color: '#ec4899' },
        { id: 'cyan', name: 'Review', color: '#06b6d4' },
      ])

      const activeModal = ref<string | null>(null)

      const getSection = (item: typeof colors.value[0]) => createSection({
        id: item.id,
        name: `${item.name} Tasks`,
        color: item.color,
      })

      return { colors, activeModal, getSection }
    },
    template: `
      <div style="padding: 40px; min-height: 500px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Color Palette</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Available section colors for visual organization</p>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
          <div
            v-for="item in colors"
            :key="item.id"
            @click="activeModal = item.id"
            style="padding: 20px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; cursor: pointer; transition: all 0.2s ease;"
            @mouseenter="$event.target.style.borderColor = item.color"
            @mouseleave="$event.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'"
          >
            <div
              style="width: 40px; height: 40px; border-radius: 8px; margin-bottom: 12px;"
              :style="{ background: item.color }"
            ></div>
            <div style="font-size: 14px; font-weight: 600; color: var(--text-primary);">{{ item.name }}</div>
            <div style="font-size: 12px; color: var(--text-muted); font-family: monospace;">{{ item.color }}</div>
          </div>
        </div>

        <GroupEditModal
          v-for="item in colors"
          :key="item.id"
          :section="getSection(item)"
          :is-visible="activeModal === item.id"
          @cancel="activeModal = null"
          @save="activeModal = null"
        />
      </div>
    `,
  }),
}

// Section states
export const SectionStates: Story = {
  render: () => ({
    components: { GroupEditModal },
    setup() {
      const states = ref([
        {
          id: 'normal',
          name: 'Normal Section',
          description: 'Standard visible and expanded',
          isCollapsed: false,
          isVisible: true,
          color: '#3b82f6',
        },
        {
          id: 'collapsed',
          name: 'Collapsed Section',
          description: 'Minimized to save space',
          isCollapsed: true,
          isVisible: true,
          color: '#f59e0b',
        },
        {
          id: 'hidden',
          name: 'Hidden Section',
          description: 'Not displayed on canvas',
          isCollapsed: false,
          isVisible: false,
          color: '#6b7280',
        },
        {
          id: 'collapsed-hidden',
          name: 'Collapsed & Hidden',
          description: 'Both states active',
          isCollapsed: true,
          isVisible: false,
          color: '#ef4444',
        },
      ])

      const activeModal = ref<string | null>(null)

      const getSection = (item: typeof states.value[0]) => createSection({
        id: item.id,
        name: item.name,
        isCollapsed: item.isCollapsed,
        isVisible: item.isVisible,
        color: item.color,
      })

      return { states, activeModal, getSection }
    },
    template: `
      <div style="padding: 40px; min-height: 500px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Section States</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Different visibility and collapse states</p>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
          <div
            v-for="item in states"
            :key="item.id"
            @click="activeModal = item.id"
            style="padding: 20px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; cursor: pointer; transition: all 0.2s ease;"
          >
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <div
                style="width: 16px; height: 16px; border-radius: 4px;"
                :style="{ background: item.color }"
              ></div>
              <span style="font-size: 16px; font-weight: 600; color: var(--text-primary);">{{ item.name }}</span>
            </div>
            <p style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-secondary);">{{ item.description }}</p>
            <div style="display: flex; gap: 8px;">
              <span
                style="padding: 4px 8px; border-radius: 4px; font-size: 12px;"
                :style="{
                  background: item.isCollapsed ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  color: item.isCollapsed ? '#f59e0b' : '#3b82f6',
                  border: item.isCollapsed ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)',
                }"
              >
                {{ item.isCollapsed ? 'Collapsed' : 'Expanded' }}
              </span>
              <span
                style="padding: 4px 8px; border-radius: 4px; font-size: 12px;"
                :style="{
                  background: item.isVisible ? 'rgba(16, 185, 129, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                  color: item.isVisible ? '#10b981' : '#6b7280',
                  border: item.isVisible ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(107, 114, 128, 0.3)',
                }"
              >
                {{ item.isVisible ? 'Visible' : 'Hidden' }}
              </span>
            </div>
          </div>
        </div>

        <GroupEditModal
          v-for="item in states"
          :key="item.id"
          :section="getSection(item)"
          :is-visible="activeModal === item.id"
          @cancel="activeModal = null"
          @save="activeModal = null"
        />
      </div>
    `,
  }),
}

// Create new section
export const NewSection: Story = {
  args: {
    section: null,
    isVisible: true,
  },
  render: (args) => ({
    components: { GroupEditModal },
    setup() {
      const isVisible = ref(args.isVisible)

      return { isVisible }
    },
    template: `
      <div style="padding: 40px; min-height: 500px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">New Section</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Create a new canvas section from scratch</p>

        <div style="display: flex; gap: 24px;">
          <div style="flex: 1;">
            <GroupEditModal
              :section="null"
              :is-visible="isVisible"
              @save="isVisible = false"
              @cancel="isVisible = false"
            />

            <button
              v-if="!isVisible"
              @click="isVisible = true"
              style="padding: 12px 24px; background: rgba(78, 205, 196, 0.15); border: 1px solid rgba(78, 205, 196, 0.3); border-radius: 8px; color: rgba(78, 205, 196, 1); cursor: pointer; font-size: 14px;"
            >
              Create New Section
            </button>
          </div>

          <div style="width: 280px; padding: 20px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px;">
            <h4 style="margin: 0 0 16px 0; font-size: 16px; color: var(--text-primary);">New Section Workflow</h4>
            <ol style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.8;">
              <li>Enter section name</li>
              <li>Choose a color</li>
              <li>Select layout type</li>
              <li>Configure visibility</li>
              <li>Click Save</li>
            </ol>
            <div style="margin-top: 16px; padding: 12px; background: rgba(78, 205, 196, 0.1); border: 1px solid rgba(78, 205, 196, 0.2); border-radius: 8px;">
              <div style="font-size: 13px; color: rgba(78, 205, 196, 1);">
                <strong>Tip:</strong> Use descriptive names and consistent colors for better organization.
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
  }),
}
