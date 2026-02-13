import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, ref } from 'vue'

/**
 * ## SectionSelectionModal
 *
 * Modal for moving a task to a specific canvas section.
 * Uses SectionSelector dropdown internally.
 *
 * **Dependencies:** Canvas store (for section list), SectionSelector
 *
 * **Location:** `src/components/canvas/SectionSelectionModal.vue`
 */
const SectionSelectionModalMock = defineComponent({
  name: 'SectionSelectionModalMock',
  setup() {
    const selected = ref('')
    return { selected }
  },
  template: `
    <div style="width: 420px; background: var(--overlay-component-bg); border: 1px solid var(--glass-border); border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-2xl);">
      <div style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-4); border-bottom: 1px solid var(--border-subtle);">
        <h2 style="font-size: var(--text-lg); font-weight: var(--font-semibold); color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: var(--space-2);">
          📐 Move to Section
        </h2>
        <button style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: var(--space-1);">✕</button>
      </div>

      <div style="padding: var(--space-4);">
        <p style="font-size: var(--text-sm); color: var(--text-secondary); margin: 0 0 var(--space-4);">
          Select a section to place <strong style="color: var(--text-primary);">Implement dark mode</strong> on the canvas.
        </p>

        <div>
          <label style="display: block; font-size: var(--text-xs); font-weight: var(--font-medium); color: var(--text-secondary); margin-bottom: var(--space-2);">Canvas Section</label>
          <select v-model="selected" style="width: 100%; padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-sm);">
            <option value="" disabled>Choose a target section...</option>
            <option value="todo">To Do</option>
            <option value="progress">In Progress</option>
            <option value="done">Done</option>
            <option value="backlog">Backlog</option>
          </select>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: var(--space-2); padding: var(--space-3) var(--space-4); border-top: 1px solid var(--border-subtle);">
        <button style="padding: var(--space-2) var(--space-4); background: transparent; border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-secondary); cursor: pointer; font-size: var(--text-sm);">Cancel</button>
        <button
          :disabled="!selected"
          :style="{
            padding: 'var(--space-2) var(--space-4)',
            background: selected ? 'var(--brand-primary)' : 'var(--glass-bg-medium)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            color: selected ? 'white' : 'var(--text-muted)',
            cursor: selected ? 'pointer' : 'not-allowed',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-medium)',
          }"
        >Move Task</button>
      </div>
    </div>
  `,
})

const meta = {
  component: SectionSelectionModalMock,
  title: '🎨 Canvas/SectionSelectionModal',
  tags: ['autodocs', 'new'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof SectionSelectionModalMock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
