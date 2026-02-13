import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, ref } from 'vue'

/**
 * ## GroupNodeSimple
 *
 * Canvas group/section node rendered by Vue Flow. Shows a colored header
 * with name, task count, collapse toggle, and resize handles.
 * Contains child task nodes via slot.
 *
 * **Dependencies:** Vue Flow (NodeResizer, Position), canvas store
 *
 * > **Note:** This component requires Vue Flow context. Story shows visual mock only.
 *
 * **Location:** `src/components/canvas/GroupNodeSimple.vue`
 */
const GroupNodeSimpleMock = defineComponent({
  name: 'GroupNodeSimpleMock',
  props: {
    name: { type: String, default: 'In Progress' },
    color: { type: String, default: '#3b82f6' },
    taskCount: { type: Number, default: 3 },
    collapsed: { type: Boolean, default: false },
  },
  setup(props) {
    const isCollapsed = ref(props.collapsed)
    return { isCollapsed }
  },
  template: `
    <div
      :style="{
        width: '320px',
        minHeight: isCollapsed ? 'auto' : '200px',
        borderRadius: 'var(--radius-xl)',
        border: '2px dashed ' + color + '60',
        backgroundColor: color + '15',
        overflow: 'hidden',
      }"
    >
      <!-- Header -->
      <div
        :style="{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-3)',
          background: color + '20',
        }"
      >
        <div :style="{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }" />
        <button
          style="background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 0; display: flex;"
          @click="isCollapsed = !isCollapsed"
        >
          {{ isCollapsed ? '▸' : '▾' }}
        </button>
        <span style="flex: 1; font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--text-primary);">{{ name }}</span>
        <span
          :style="{
            fontSize: 'var(--text-xs)', color: taskCount > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
            padding: '1px var(--space-1_5)', borderRadius: 'var(--radius-full)',
            background: 'var(--glass-bg-soft)',
          }"
        >
          {{ taskCount }}
          <span v-if="isCollapsed && taskCount > 0"> 📦</span>
        </span>
      </div>

      <!-- Body (task nodes would go here) -->
      <div v-if="!isCollapsed" style="padding: var(--space-3); min-height: 120px; display: flex; flex-direction: column; gap: var(--space-2);">
        <div v-for="i in Math.min(taskCount, 3)" :key="i" style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-md); font-size: var(--text-xs); color: var(--text-secondary);">
          Task node {{ i }}
        </div>
      </div>
    </div>
  `,
})

const meta = {
  component: GroupNodeSimpleMock,
  title: '🎨 Canvas/GroupNodeSimple',
  tags: ['autodocs', 'new'],
  parameters: { layout: 'centered' },
  decorators: [
    (story: any) => ({
      components: { story },
      template: '<div style="padding: var(--space-8); background: var(--app-background-gradient);"><story /></div>',
    }),
  ],
} satisfies Meta<typeof GroupNodeSimpleMock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Collapsed: Story = {
  args: { collapsed: true },
}

export const EmptyGroup: Story = {
  args: { name: 'Backlog', color: '#6b7280', taskCount: 0 },
}

export const ManyTasks: Story = {
  args: { name: 'To Do', color: '#f59e0b', taskCount: 12 },
}
