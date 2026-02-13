import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent } from 'vue'

/**
 * QuickCaptureTab - First step in the QuickSort workflow.
 * Allows rapid task entry with title, description, priority, and due date.
 * Shows a pending task list below the form. Supports voice input.
 * Real component: src/components/quicksort/QuickCaptureTab.vue
 */
const QuickCaptureTabMock = defineComponent({
  name: 'QuickCaptureTabMock',
  props: {
    taskCount: { type: Number, default: 0 },
    showVoiceFeedback: { type: Boolean, default: false },
    activePriority: { type: String, default: '' },
    activeDatePreset: { type: String, default: '' },
    pendingTasks: {
      type: Array as () => Array<{ id: string; title: string; priority?: string; dueDate?: string; description?: string }>,
      default: () => []
    }
  },
  template: `
    <div style="display: flex; flex-direction: column; gap: var(--space-6); height: 100%; color: var(--text-primary);">
      <!-- Capture Form -->
      <div style="display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-5); background: var(--glass-bg-light); border: 1px solid var(--glass-border); border-radius: var(--radius-xl);">
        <!-- Title Input Row -->
        <div style="display: flex; gap: var(--space-2); align-items: center;">
          <input
            type="text"
            placeholder="What needs to be done?"
            style="flex: 1; padding: var(--space-3) var(--space-4); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); color: var(--text-primary); font-size: var(--text-base); font-weight: 500; outline: none;"
          />
          <button
            :style="{
              width: '40px', height: '40px', borderRadius: '50%', border: 'none',
              background: showVoiceFeedback ? '#ef4444' : 'var(--glass-bg-soft)',
              color: showVoiceFeedback ? 'white' : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: '0'
            }"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path v-if="!showVoiceFeedback" d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
              <path v-if="!showVoiceFeedback" d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line v-if="!showVoiceFeedback" x1="12" x2="12" y1="19" y2="22"/>
              <path v-if="showVoiceFeedback" d="m2 2 20 20"/>
              <path v-if="showVoiceFeedback" d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/>
            </svg>
          </button>
        </div>

        <!-- Voice Feedback -->
        <div v-if="showVoiceFeedback" style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); border-radius: var(--radius-md); border: 1px solid var(--glass-border);">
          <div style="display: flex; align-items: center; gap: 2px; height: 20px;">
            <span v-for="i in 5" :key="i" style="width: 3px; height: 6px; background: #ef4444; border-radius: 2px;" />
          </div>
          <span style="flex: 1; font-size: var(--text-sm); color: var(--text-secondary);">Speak now...</span>
          <button style="width: 24px; height: 24px; border-radius: 50%; border: none; background: transparent; color: var(--text-tertiary); display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Description -->
        <textarea
          placeholder="Description (optional, supports markdown)..."
          rows="3"
          style="width: 100%; padding: var(--space-3) var(--space-4); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); color: var(--text-primary); font-size: var(--text-sm); resize: vertical; min-height: 80px; outline: none;"
        />

        <!-- Metadata Row -->
        <div style="display: flex; gap: var(--space-6); flex-wrap: wrap;">
          <!-- Priority -->
          <div style="display: flex; flex-direction: column; gap: var(--space-2);">
            <label style="font-size: var(--text-xs); font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Priority:</label>
            <div style="display: flex; gap: var(--space-1);">
              <button v-for="p in ['None', 'Low', 'Med', 'High']" :key="p"
                :style="{
                  padding: '6px 12px', background: activePriority === p.toLowerCase() ? 'transparent' : 'var(--glass-bg-soft)',
                  border: '1px solid ' + (activePriority === p.toLowerCase() ? (p === 'Low' ? 'var(--success)' : p === 'Med' ? 'var(--warning)' : p === 'High' ? 'var(--danger)' : 'var(--brand-primary)') : 'var(--glass-border)'),
                  borderRadius: 'var(--radius-md)',
                  color: activePriority === p.toLowerCase() ? (p === 'Low' ? 'var(--success)' : p === 'Med' ? 'var(--warning)' : p === 'High' ? 'var(--danger)' : 'var(--brand-primary)') : 'var(--text-secondary)',
                  fontSize: 'var(--text-xs)', fontWeight: '500', cursor: 'pointer'
                }"
              >{{ p }}</button>
            </div>
          </div>

          <!-- Due Date -->
          <div style="display: flex; flex-direction: column; gap: var(--space-2);">
            <label style="font-size: var(--text-xs); font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Due:</label>
            <div style="display: flex; gap: var(--space-1);">
              <button v-for="d in ['Today', 'Tomorrow', 'Weekend']" :key="d"
                :style="{
                  padding: '6px 12px', background: activeDatePreset === d.toLowerCase() ? 'transparent' : 'var(--glass-bg-soft)',
                  border: '1px solid ' + (activeDatePreset === d.toLowerCase() ? 'var(--brand-primary)' : 'var(--glass-border)'),
                  borderRadius: 'var(--radius-md)',
                  color: activeDatePreset === d.toLowerCase() ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  fontSize: 'var(--text-xs)', fontWeight: '500', cursor: 'pointer'
                }"
              >{{ d }}</button>
            </div>
          </div>
        </div>

        <!-- Add Task Button -->
        <div style="display: flex; justify-content: flex-end; padding-top: var(--space-2);">
          <button style="display: flex; align-items: center; gap: var(--space-2); padding: 10px 20px; background: transparent; border: 1px solid var(--brand-primary); border-radius: var(--radius-lg); color: var(--brand-primary); font-size: var(--text-sm); font-weight: 600; cursor: pointer;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5v14"/></svg>
            <span>Add Task</span>
            <kbd style="padding: 2px 6px; background: var(--glass-bg-heavy); border: 1px solid var(--glass-border); border-radius: var(--radius-sm); font-size: var(--text-xs); font-family: monospace;">Enter</kbd>
          </button>
        </div>
      </div>

      <!-- Pending Tasks -->
      <div style="flex: 1; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-3) 0; border-bottom: 1px solid var(--border-subtle); margin-bottom: var(--space-4);">
          <h3 style="display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); margin: 0;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
            Pending Tasks
            <span v-if="pendingTasks.length > 0" style="color: var(--brand-primary);">({{ pendingTasks.length }})</span>
          </h3>
          <button v-if="pendingTasks.length > 0" style="display: flex; align-items: center; gap: 6px; padding: 8px 16px; background: var(--glass-bg-medium); border: 1px solid var(--brand-primary); border-radius: var(--radius-md); color: var(--brand-primary); font-size: var(--text-sm); font-weight: 500; cursor: pointer;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <span>Sort All</span>
            <kbd style="padding: 2px 4px; background: rgba(255,255,255,0.06); border-radius: var(--radius-sm); font-size: var(--text-xs); font-family: monospace;">Tab</kbd>
          </button>
        </div>

        <!-- Task List -->
        <div v-if="pendingTasks.length > 0" style="display: flex; flex-direction: column; gap: var(--space-2);">
          <div v-for="task in pendingTasks" :key="task.id" style="display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-3) var(--space-4); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-lg);">
            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--space-1);">
              <span style="font-size: var(--text-sm); font-weight: 500; color: var(--text-primary);">{{ task.title }}</span>
              <div v-if="task.priority || task.dueDate" style="display: flex; flex-wrap: wrap; gap: var(--space-2);">
                <span v-if="task.priority" :style="{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', textTransform: 'capitalize',
                  color: task.priority === 'high' ? 'var(--danger)' : task.priority === 'medium' ? 'var(--warning)' : 'var(--success)',
                  background: task.priority === 'high' ? 'rgba(239,68,68,0.1)' : task.priority === 'medium' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)'
                }">{{ task.priority }}</span>
                <span v-if="task.dueDate" style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; background: rgba(59,130,246,0.1); border-radius: var(--radius-sm); font-size: var(--text-xs); color: var(--info);">{{ task.dueDate }}</span>
              </div>
              <p v-if="task.description" style="font-size: var(--text-xs); color: var(--text-muted); margin: 0;">{{ task.description }}</p>
            </div>
            <button style="flex-shrink: 0; padding: 6px; background: transparent; border: 1px solid transparent; border-radius: var(--radius-sm); color: var(--text-muted); cursor: pointer;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-3); padding: var(--space-12); text-align: center;">
          <div style="color: var(--text-muted); opacity: 0.5;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
          </div>
          <p style="font-size: var(--text-base); font-weight: 500; color: var(--text-secondary); margin: 0;">No tasks captured yet</p>
          <p style="font-size: var(--text-sm); color: var(--text-muted); margin: 0;">Type a task title above and press Enter to add</p>
        </div>
      </div>
    </div>
  `
})

const meta = {
  component: QuickCaptureTabMock,
  title: '✨ Views/QuickSort/QuickCaptureTab',
  tags: ['autodocs', 'new'],

  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: 'var(--bg-primary)' }],
    },
  },

  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="padding: var(--space-6); background: var(--glass-bg-soft); border-radius: var(--radius-xl); border: 1px solid var(--glass-border); max-width: 700px; min-height: 600px;">
          <story />
        </div>
      `,
    })
  ],
} satisfies Meta<typeof QuickCaptureTabMock>

export default meta
type Story = StoryObj<typeof meta>

export const EmptyState: Story = {
  args: {
    pendingTasks: [],
  },
}

export const WithPendingTasks: Story = {
  args: {
    pendingTasks: [
      { id: '1', title: 'Review pull request #42', priority: 'high', dueDate: 'Today' },
      { id: '2', title: 'Write unit tests for auth module', priority: 'medium', dueDate: 'Tomorrow' },
      { id: '3', title: 'Update documentation', priority: 'low', description: 'Add API reference for new endpoints...' },
    ],
  },
}

export const VoiceInputActive: Story = {
  args: {
    showVoiceFeedback: true,
    pendingTasks: [
      { id: '1', title: 'Previously captured task', priority: 'medium' },
    ],
  },
}

export const HighPrioritySelected: Story = {
  args: {
    activePriority: 'high',
    activeDatePreset: 'today',
    pendingTasks: [],
  },
}

export const MediumPriorityTomorrow: Story = {
  args: {
    activePriority: 'med',
    activeDatePreset: 'tomorrow',
    pendingTasks: [
      { id: '1', title: 'Deploy staging environment', priority: 'high', dueDate: 'Today' },
    ],
  },
}

export const FullBatch: Story = {
  args: {
    pendingTasks: [
      { id: '1', title: 'Fix login timeout bug', priority: 'high', dueDate: 'Today' },
      { id: '2', title: 'Add dark mode toggle', priority: 'medium', dueDate: 'Tomorrow' },
      { id: '3', title: 'Refactor API client', priority: 'low' },
      { id: '4', title: 'Write integration tests', dueDate: 'Weekend' },
      { id: '5', title: 'Update CI pipeline configuration', priority: 'medium', description: 'Add caching for node_modules...' },
    ],
  },
}
