import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import SectionManager from '@/components/canvas/SectionManager.vue'

const meta = {
  component: SectionManager,
  title: '✨ Features/🎨 Canvas View/SectionManager',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
    docs: {
      story: {
        height: '600px',
      },
    },
  },
} satisfies Meta<typeof SectionManager>

export default meta
type Story = StoryObj<typeof meta>

// Empty state
export const EmptyState: Story = {
  render: () => ({
    setup() {
      return {}
    },
    template: `
      <div style="padding: 40px; min-height: 500px; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Section Manager - Empty State</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">When no sections have been created yet</p>

        <div style="width: 300px; background: var(--surface-secondary); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h4 style="margin: 0; font-size: 16px; font-weight: bold; color: var(--text-primary);">Canvas Sections</h4>
            <button style="display: flex; align-items: center; gap: 6px; background: var(--brand-primary); border: none; color: white; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 14px;">
              <span style="font-size: 16px;">+</span> Add Section
            </button>
          </div>

          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; text-align: center;">
            <div style="color: var(--text-muted); margin-bottom: 16px; font-size: 48px;">⊞</div>
            <p style="font-size: 16px; font-weight: bold; color: var(--text-primary); margin: 0 0 8px 0;">No sections created yet</p>
            <p style="font-size: 14px; color: var(--text-secondary); margin: 0;">Create custom sections to organize your tasks</p>
          </div>
        </div>
      </div>
    `,
  })
}

// With sections
export const WithSections: Story = {
  render: () => ({
    setup() {
      const sections = ref([
        { id: '1', name: 'High Priority', type: 'priority', color: '#ef4444', isVisible: true },
        { id: '2', name: 'In Progress', type: 'status', color: '#3b82f6', isVisible: true },
        { id: '3', name: 'Design Tasks', type: 'project', color: '#8b5cf6', isVisible: false },
        { id: '4', name: 'This Week', type: 'date', color: '#22c55e', isVisible: true },
      ])

      return { sections }
    },
    template: `
      <div style="padding: 40px; min-height: 500px; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Section Manager with Sections</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Managing multiple canvas sections</p>

        <div style="width: 300px; background: var(--surface-secondary); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h4 style="margin: 0; font-size: 16px; font-weight: bold; color: var(--text-primary);">Canvas Sections</h4>
            <button style="display: flex; align-items: center; gap: 6px; background: var(--brand-primary); border: none; color: white; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 14px;">
              <span style="font-size: 16px;">+</span> Add Section
            </button>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div
              v-for="section in sections"
              :key="section.id"
              style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--surface-primary); border: 1px solid var(--border-subtle); border-radius: 8px;"
              :style="{
                borderColor: section.isVisible ? 'var(--brand-primary)' : 'var(--border-subtle)',
                background: section.isVisible ? 'var(--glass-bg-soft)' : 'var(--surface-primary)',
              }"
            >
              <div style="display: flex; align-items: center; gap: 12px;">
                <div
                  :style="{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: section.color,
                    boxShadow: '0 0 8px ' + section.color,
                  }"
                ></div>
                <div>
                  <div style="font-size: 14px; font-weight: bold; color: var(--text-primary);">{{ section.name }}</div>
                  <div style="font-size: 12px; color: var(--text-secondary); text-transform: capitalize;">{{ section.type }}</div>
                </div>
              </div>

              <div style="display: flex; gap: 4px;">
                <button
                  style="background: transparent; border: none; color: var(--text-secondary); padding: 4px; border-radius: 4px; cursor: pointer; font-size: 12px;"
                  :title="section.isVisible ? 'Hide' : 'Show'"
                >
                  {{ section.isVisible ? '👁️' : '👁️‍🗨️' }}
                </button>
                <button style="background: transparent; border: none; color: var(--text-secondary); padding: 4px; border-radius: 4px; cursor: pointer; font-size: 12px;" title="Edit">
                  ✏️
                </button>
                <button style="background: transparent; border: none; color: var(--text-secondary); padding: 4px; border-radius: 4px; cursor: pointer; font-size: 12px;" title="Delete">
                  🗑️
                </button>
              </div>
            </div>
          </div>

          <div style="margin-top: 20px; padding: 12px; background: var(--glass-bg-soft); border-radius: 8px; border: 1px solid var(--glass-border); font-size: 13px; color: var(--text-muted); line-height: 1.4;">
            <strong>Features:</strong><br>
            • Create custom filtered sections<br>
            • Toggle section visibility<br>
            • Edit section properties<br>
            • Organize by priority, status, project, or date
          </div>
        </div>
      </div>
    `,
  })
}