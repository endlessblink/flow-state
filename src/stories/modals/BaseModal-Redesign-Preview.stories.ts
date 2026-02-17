import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import EmojiPicker from '@/components/common/EmojiPicker.vue'

const meta = {
  component: BaseModal,
  title: '🎯 Modals/BaseModal Redesign Preview',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0f172a' },
      ],
    },
    docs: {
      description: {
        component: 'BaseModal with neutral, clean styling - no blue tint, sharper borders, reduced blur. Global styling now applied to all modals.'
      }
    }
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="padding: var(--space-10); background: var(--app-background-gradient); min-height: 500px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-xl);">
          <story />
        </div>
      `
    })
  ]
} satisfies Meta<typeof BaseModal>

export default meta
type Story = StoryObj<typeof meta>

// Story 1: Simple Modal with Redesigned Styling
export const SimpleModal: Story = {
  args: {
    isOpen: true,
    title: 'Settings',
    description: 'Configure your application preferences',
    showFooter: true,
    cancelText: 'Cancel',
    confirmText: 'Save Changes'
  },
  render: (args) => ({
    components: { BaseModal, BaseInput },
    setup() {
      return { args }
    },
    template: `
      <div>
        <BaseModal v-bind="args">
          <div style="padding: var(--space-3) 0;">
            <div style="margin-bottom: var(--space-6);">
              <label style="display: block; color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-2);">
                🍅 Pomodoro Settings
              </label>
              <p style="color: var(--text-muted); font-size: var(--text-sm);">
                Adjust your work and break durations
              </p>
            </div>

            <div style="display: flex; gap: var(--space-3); margin-bottom: var(--space-4);">
              <button style="padding: var(--space-2) var(--space-4); background: transparent; border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); cursor: pointer;">
                15m
              </button>
              <button style="padding: var(--space-2) var(--space-4); background: transparent; border: 1px solid var(--brand-primary); border-radius: var(--radius-md); color: var(--brand-primary); cursor: pointer;">
                20m
              </button>
              <button style="padding: var(--space-2) var(--space-4); background: transparent; border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); cursor: pointer;">
                25m
              </button>
              <button style="padding: var(--space-2) var(--space-4); background: transparent; border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); cursor: pointer;">
                30m
              </button>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-3); background: transparent; border: 1px solid var(--glass-border); border-radius: var(--radius-md); margin-top: var(--space-4);">
              <span style="color: var(--text-secondary); font-size: var(--text-sm);">Auto-start breaks</span>
              <div style="width: 40px; height: 20px; background: transparent; border: 2px solid var(--brand-primary); border-radius: 10px; position: relative;">
                <div style="width: 14px; height: 14px; background: var(--brand-primary); border-radius: 50%; position: absolute; right: 1px; top: 1px;"></div>
              </div>
            </div>
          </div>
        </BaseModal>
      </div>
    `
  })
}

// Story 2: Project Modal Style (matching your use case)
export const ProjectModalStyle: Story = {
  args: {
    isOpen: true,
    title: 'Create Project',
    size: 'md',
    showFooter: true,
    cancelText: 'Cancel',
    confirmText: 'Create Project'
  },
  render: (args) => ({
    components: { BaseModal, BaseInput, EmojiPicker },
    setup() {
      const selectedColor = ref('#4ecdc4')
      const selectedEmoji = ref('🎯')
      const showPicker = ref(false)

      const handlePickerSelect = (data: { type: 'emoji' | 'color'; value: string }) => {
        if (data.type === 'emoji') {
          selectedEmoji.value = data.value
        } else {
          selectedColor.value = data.value
        }
      }

      return { args, selectedColor, selectedEmoji, showPicker, handlePickerSelect }
    },
    template: `
      <div>
        <BaseModal v-bind="args">
        <div style="padding: 0;">
          <div style="margin-bottom: var(--space-6);">
            <label style="display: block; color: var(--text-secondary); font-size: var(--text-sm); font-weight: 500; margin-bottom: var(--space-3);">
              Project Name
            </label>
            <BaseInput
              placeholder="Enter project name..."
            />
          </div>

          <div style="margin-bottom: var(--space-6);">
            <label style="display: block; color: var(--text-secondary); font-size: var(--text-sm); font-weight: 500; margin-bottom: var(--space-3);">
              Parent Project (Optional)
            </label>
            <select style="width: 100%; padding: var(--space-3) var(--space-4); background: rgba(30, 30, 50, 0.35); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-sm);">
              <option>None (Top Level)</option>
              <option>Work</option>
              <option>Personal</option>
            </select>
          </div>

          <div style="margin-bottom: 0;">
            <label style="display: block; color: var(--text-secondary); font-size: var(--text-sm); font-weight: 500; margin-bottom: var(--space-3);">
              Icon & Color
            </label>
            <button
              @click="showPicker = true"
              style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); background: transparent; border: 1px solid var(--glass-border); border-radius: var(--radius-md); cursor: pointer; width: 100%; transition: all 0.2s ease;"
            >
              <!-- Icon Preview -->
              <div
                :style="{
                  width: '40px',
                  height: '40px',
                  background: selectedColor,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--glass-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--text-xl)',
                  flexShrink: '0'
                }"
              >{{ selectedEmoji }}</div>
              <span style="color: var(--text-secondary); font-size: var(--text-sm);">Click to change icon & color</span>
            </button>
          </div>
        </div>
      </BaseModal>

      <!-- EmojiPicker Modal -->
      <EmojiPicker
        :is-open="showPicker"
        :current-emoji="selectedEmoji"
        :current-color="selectedColor"
        @close="showPicker = false"
        @select="handlePickerSelect"
      />
      </div>
    `
  })
}

// Story 3: Styling Details
export const ComparisonView: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Showcases the neutral styling features: no blue tint, reduced saturation (100%), sharper borders (rgba white 0.1), cleaner neutral background (rgba 20,24,32,0.85), and pure black overlay.'
      }
    }
  },
  args: {
    isOpen: true,
    title: 'Redesigned Modal',
    description: 'Neutral, clean aesthetic',
    showFooter: true
  },
  render: (args) => ({
    components: { BaseModal },
    setup() {
      return { args }
    },
    template: `
      <div>
        <BaseModal v-bind="args">
          <div style="padding: var(--space-3) 0;">
            <h3 style="color: var(--text-primary); margin-bottom: var(--space-4);">New Styling Features:</h3>
            <ul style="color: var(--text-secondary); line-height: 1.8; padding-left: var(--space-5);">
              <li>Neutral dark background (no blue tint)</li>
              <li>Sharper, cleaner borders</li>
              <li>Reduced backdrop blur (20px vs 32px)</li>
              <li>Removed inset glow for crisper appearance</li>
              <li>More subtle header/footer separators</li>
              <li>Matches SettingsModal aesthetic</li>
            </ul>
          </div>
        </BaseModal>
      </div>
    `
  })
}

// Story 4: Form Example
export const FormExample: Story = {
  args: {
    isOpen: true,
    title: 'Edit Task',
    size: 'md',
    showFooter: true,
    cancelText: 'Cancel',
    confirmText: 'Save'
  },
  render: (args) => ({
    components: { BaseModal, BaseInput },
    setup() {
      const taskName = ref('Design new modal system')
      return { args, taskName }
    },
    template: `
      <div>
        <BaseModal v-bind="args">
          <div style="padding: 0;">
            <div style="margin-bottom: var(--space-5);">
              <label style="display: block; color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-2);">Task Name</label>
              <BaseInput v-model="taskName" />
            </div>

            <div style="margin-bottom: var(--space-5);">
              <label style="display: block; color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-2);">Description</label>
              <textarea
                style="width: 100%; padding: var(--space-3); background: transparent; border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); font-family: inherit; resize: vertical; min-height: 80px;"
                placeholder="Add task description..."
              >Create a unified, clean modal design system that matches the SettingsModal aesthetic...</textarea>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
              <div>
                <label style="display: block; color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-2);">Priority</label>
                <select style="width: 100%; padding: var(--space-2-5) var(--space-3); background: rgba(30, 30, 50, 0.35); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-sm);">
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </div>
              <div>
                <label style="display: block; color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-2);">Status</label>
                <select style="width: 100%; padding: var(--space-2-5) var(--space-3); background: rgba(30, 30, 50, 0.35); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-sm);">
                  <option>In Progress</option>
                  <option>Planned</option>
                  <option>Done</option>
                </select>
              </div>
            </div>
          </div>
        </BaseModal>
      </div>
    `
  })
}
