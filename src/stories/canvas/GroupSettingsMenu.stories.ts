import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, ref } from 'vue'

/**
 * ## GroupSettingsMenu
 *
 * Settings modal for canvas groups. Configures auto-assign behavior
 * when tasks are dropped into a group (priority, status, due date, project).
 *
 * **Dependencies:** Canvas store, project store, CustomSelect
 *
 * **Location:** `src/components/canvas/GroupSettingsMenu.vue`
 */
const GroupSettingsMenuMock = defineComponent({
  name: 'GroupSettingsMenuMock',
  setup() {
    const priority = ref('')
    const status = ref('')
    const dueDate = ref('')
    return { priority, status, dueDate }
  },
  template: `
    <div style="width: 400px; background: var(--overlay-component-bg); border: 1px solid var(--glass-border); border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-2xl);">
      <div style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-4); border-bottom: 1px solid var(--border-subtle);">
        <h2 style="font-size: var(--text-lg); font-weight: var(--font-semibold); color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: var(--space-2);">
          ⚙️ Group Settings
        </h2>
        <button style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: var(--space-1);">✕</button>
      </div>

      <div style="padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-4);">
        <div style="display: flex; align-items: center; gap: var(--space-2);">
          <span style="font-size: var(--text-base); font-weight: var(--font-medium); color: var(--text-primary);">In Progress</span>
          <span style="font-size: var(--text-xs); padding: 2px var(--space-2); background: var(--orange-bg-light); color: var(--status-on-hold-text); border-radius: var(--radius-full);">⚡ Detected: In Progress</span>
        </div>

        <div>
          <h3 style="font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--text-primary); margin: 0 0 var(--space-1); display: flex; align-items: center; gap: var(--space-1);">⚡ Auto-assign when task dropped</h3>
          <p style="font-size: var(--text-xs); color: var(--text-muted); margin: 0 0 var(--space-3);">Tasks dropped into this group will have these properties set</p>

          <div style="display: flex; flex-direction: column; gap: var(--space-3);">
            <div>
              <label style="display: block; font-size: var(--text-xs); font-weight: var(--font-medium); color: var(--text-secondary); margin-bottom: var(--space-1);">Priority</label>
              <select v-model="priority" style="width: 100%; padding: var(--space-2); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-sm);">
                <option value="">No auto-assign</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label style="display: block; font-size: var(--text-xs); font-weight: var(--font-medium); color: var(--text-secondary); margin-bottom: var(--space-1);">Status</label>
              <select v-model="status" style="width: 100%; padding: var(--space-2); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-sm);">
                <option value="">No auto-assign</option>
                <option value="planned">Planned</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div>
              <label style="display: block; font-size: var(--text-xs); font-weight: var(--font-medium); color: var(--text-secondary); margin-bottom: var(--space-1);">Due Date</label>
              <select v-model="dueDate" style="width: 100%; padding: var(--space-2); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-sm);">
                <option value="">No auto-assign</option>
                <option value="today">Today</option>
                <option value="tomorrow">Tomorrow</option>
                <option value="next_week">Next Week</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: var(--space-2); padding: var(--space-3) var(--space-4); border-top: 1px solid var(--border-subtle);">
        <button style="padding: var(--space-2) var(--space-4); background: transparent; border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-secondary); cursor: pointer; font-size: var(--text-sm);">Cancel</button>
        <button style="padding: var(--space-2) var(--space-4); background: var(--brand-primary); border: none; border-radius: var(--radius-md); color: white; cursor: pointer; font-size: var(--text-sm); font-weight: var(--font-medium);">Save</button>
      </div>
    </div>
  `,
})

const meta = {
  component: GroupSettingsMenuMock,
  title: '🎨 Canvas/GroupSettingsMenu',
  tags: ['autodocs', 'new'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof GroupSettingsMenuMock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
