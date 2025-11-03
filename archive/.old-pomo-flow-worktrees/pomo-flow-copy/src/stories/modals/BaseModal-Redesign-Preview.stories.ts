import type { Meta, StoryObj } from '@storybook/vue3'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseInput from '@/components/base/BaseInput.vue'

const meta = {
  component: BaseModal,
  title: '🎭 Overlays/🪟 Modals/BaseModal Redesign Preview',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'BaseModal with neutral, clean styling - no blue tint, sharper borders, reduced blur. Global styling now applied to all modals.'
      }
    }
  },
  decorators: [
    () => ({
      template: '<div style="width: 100%; height: 100vh;"><story /></div>'
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
          <div style="padding: 12px 0;">
            <div style="margin-bottom: 24px;">
              <label style="display: block; color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: 8px;">
                🍅 Pomodoro Settings
              </label>
              <p style="color: var(--text-muted); font-size: var(--text-sm);">
                Adjust your work and break durations
              </p>
            </div>

            <div style="display: flex; gap: 12px; margin-bottom: 16px;">
              <button style="padding: 8px 16px; background: var(--glass-bg-medium); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); cursor: pointer;">
                15m
              </button>
              <button style="padding: 8px 16px; background: transparent; border: 1px solid var(--brand-primary); border-radius: var(--radius-md); color: var(--brand-primary); cursor: pointer; box-shadow: 0 0 0 1px var(--brand-primary) inset;">
                20m
              </button>
              <button style="padding: 8px 16px; background: var(--glass-bg-medium); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); cursor: pointer;">
                25m
              </button>
              <button style="padding: 8px 16px; background: var(--glass-bg-medium); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); cursor: pointer;">
                30m
              </button>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--glass-bg-soft); border-radius: var(--radius-md); margin-top: 16px;">
              <span style="color: var(--text-secondary); font-size: var(--text-sm);">Auto-start breaks</span>
              <div style="width: 40px; height: 20px; background: var(--brand-primary); border-radius: 10px; position: relative;">
                <div style="width: 16px; height: 16px; background: white; border-radius: 50%; position: absolute; right: 2px; top: 2px;"></div>
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
    components: { BaseModal, BaseInput },
    setup() {
      return { args }
    },
    template: `
      <div>
        <BaseModal v-bind="args">
        <div style="padding: 0;">
          <div style="margin-bottom: 24px;">
            <label style="display: block; color: var(--text-secondary); font-size: var(--text-sm); font-weight: 500; margin-bottom: 12px;">
              Project Name
            </label>
            <BaseInput
              placeholder="Enter project name..."
            />
          </div>

          <div style="margin-bottom: 24px;">
            <label style="display: block; color: var(--text-secondary); font-size: var(--text-sm); font-weight: 500; margin-bottom: 12px;">
              Parent Project (Optional)
            </label>
            <select style="width: 100%; padding: 12px 16px; background: var(--glass-bg-light); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-sm);">
              <option>None (Top Level)</option>
              <option>Work</option>
              <option>Personal</option>
            </select>
          </div>

          <div style="margin-bottom: 0;">
            <label style="display: block; color: var(--text-secondary); font-size: var(--text-sm); font-weight: 500; margin-bottom: 12px;">
              Project Icon & Color
            </label>
            <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-lg);">
              <div style="width: 56px; height: 56px; background: #3b82f6; border-radius: var(--radius-xl); border: 2px solid var(--glass-border);"></div>
              <button style="flex: 1; padding: 12px 16px; background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-secondary); font-size: var(--text-sm); cursor: pointer;">
                Choose Icon or Color
              </button>
            </div>
          </div>
        </div>
      </BaseModal>
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
          <div style="padding: 12px 0;">
            <h3 style="color: var(--text-primary); margin-bottom: 16px;">New Styling Features:</h3>
            <ul style="color: var(--text-secondary); line-height: 1.8; padding-left: 20px;">
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
      return { args }
    },
    template: `
      <div>
        <BaseModal v-bind="args">
          <div style="padding: 0;">
            <div style="margin-bottom: 20px;">
              <label style="display: block; color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: 8px;">Task Name</label>
              <BaseInput value="Design new modal system" />
            </div>

            <div style="margin-bottom: 20px;">
              <label style="display: block; color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: 8px;">Description</label>
              <textarea
                style="width: 100%; padding: 12px; background: var(--glass-bg-light); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); font-family: inherit; resize: vertical; min-height: 80px;"
                placeholder="Add task description..."
              >Create a unified, clean modal design system that matches the SettingsModal aesthetic...</textarea>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div>
                <label style="display: block; color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: 8px;">Priority</label>
                <select style="width: 100%; padding: 10px 12px; background: var(--glass-bg-light); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-sm);">
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </div>
              <div>
                <label style="display: block; color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: 8px;">Status</label>
                <select style="width: 100%; padding: 10px 12px; background: var(--glass-bg-light); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-sm);">
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
