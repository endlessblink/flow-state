import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, ref } from 'vue'

/**
 * ## UnifiedGroupModal
 *
 * Create/Edit modal for canvas groups (sections). Provides name input,
 * color presets, custom color picker, and keyword detection (e.g. "In Progress"
 * auto-detected as status group).
 *
 * **Dependencies:** Canvas store, BaseInput
 *
 * **Location:** `src/components/canvas/UnifiedGroupModal.vue`
 */
const UnifiedGroupModalMock = defineComponent({
  name: 'UnifiedGroupModalMock',
  props: {
    isEditing: { type: Boolean, default: false },
  },
  setup(props) {
    const name = ref(props.isEditing ? 'In Progress' : '')
    const selectedColor = ref('#3b82f6')
    const customColor = ref('')
    const colorPresets = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#6b7280']
    return { name, selectedColor, customColor, colorPresets }
  },
  template: `
    <div style="width: 440px; background: var(--overlay-component-bg); border: 1px solid var(--glass-border); border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-2xl);">
      <div style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-4); border-bottom: 1px solid var(--border-subtle);">
        <h2 style="font-size: var(--text-lg); font-weight: var(--font-semibold); color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: var(--space-2);">
          📦 {{ isEditing ? 'Edit Group' : 'Create Group' }}
        </h2>
        <button style="background: none; border: none; color: var(--text-muted); cursor: pointer;">✕</button>
      </div>

      <div style="padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-4);">
        <!-- Name -->
        <div>
          <label style="display: block; font-size: var(--text-xs); font-weight: var(--font-medium); color: var(--text-secondary); margin-bottom: var(--space-1);">Group Name *</label>
          <input
            v-model="name"
            placeholder="Enter group name..."
            style="width: 100%; padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-sm); box-sizing: border-box;"
          />
          <p v-if="name.toLowerCase().includes('progress')" style="font-size: var(--text-xs); color: var(--status-on-hold-text); margin: var(--space-1) 0 0; display: flex; align-items: center; gap: 4px;">
            ⚡ Detected: In Progress
          </p>
        </div>

        <!-- Color Presets -->
        <div>
          <label style="display: block; font-size: var(--text-xs); font-weight: var(--font-medium); color: var(--text-secondary); margin-bottom: var(--space-2);">Group Color</label>
          <div style="display: flex; gap: var(--space-2); flex-wrap: wrap;">
            <button
              v-for="color in colorPresets"
              :key="color"
              :style="{
                width: '28px', height: '28px', borderRadius: 'var(--radius-md)',
                backgroundColor: color, border: selectedColor === color ? '2px solid white' : '2px solid transparent',
                cursor: 'pointer', boxShadow: selectedColor === color ? '0 0 0 2px ' + color : 'none',
                transition: 'all 0.15s ease',
              }"
              @click="selectedColor = color"
            />
          </div>
        </div>

        <!-- Custom Color -->
        <div>
          <label style="display: block; font-size: var(--text-xs); font-weight: var(--font-medium); color: var(--text-secondary); margin-bottom: var(--space-1);">Custom Color</label>
          <div style="display: flex; align-items: center; gap: var(--space-2);">
            <input v-model="customColor" type="text" placeholder="#3b82f6" style="flex: 1; padding: var(--space-2); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-sm);" />
            <input v-model="customColor" type="color" style="width: 36px; height: 36px; border: 1px solid var(--glass-border); border-radius: var(--radius-md); cursor: pointer; padding: 2px;" />
          </div>

          <!-- Preview -->
          <div style="display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-2);">
            <div :style="{ width: '20px', height: '20px', borderRadius: 'var(--radius-md)', backgroundColor: customColor || selectedColor }" />
            <span style="font-size: var(--text-xs); color: var(--text-muted);">{{ customColor || selectedColor }}</span>
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: var(--space-2); padding: var(--space-3) var(--space-4); border-top: 1px solid var(--border-subtle);">
        <button style="padding: var(--space-2) var(--space-4); background: transparent; border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-secondary); cursor: pointer; font-size: var(--text-sm);">Cancel</button>
        <button
          :disabled="!name.trim()"
          :style="{
            padding: 'var(--space-2) var(--space-4)',
            background: name.trim() ? 'var(--brand-primary)' : 'var(--glass-bg-medium)',
            border: 'none', borderRadius: 'var(--radius-md)',
            color: name.trim() ? 'white' : 'var(--text-muted)',
            cursor: name.trim() ? 'pointer' : 'not-allowed',
            fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)',
          }"
        >{{ isEditing ? 'Save Changes' : 'Create Group' }}</button>
      </div>
    </div>
  `,
})

const meta = {
  component: UnifiedGroupModalMock,
  title: '🎨 Canvas/UnifiedGroupModal',
  tags: ['autodocs', 'new'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof UnifiedGroupModalMock>

export default meta
type Story = StoryObj<typeof meta>

export const CreateNew: Story = {}

export const EditExisting: Story = {
  args: { isEditing: true },
}
