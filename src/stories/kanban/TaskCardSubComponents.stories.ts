import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent } from 'vue'

/**
 * TaskCard sub-components: TaskCardActions, TaskCardBadges, and TaskCardStatus.
 * These compose the full TaskCard used in the Board/Kanban view.
 * Real components:
 *   - src/components/kanban/card/TaskCardActions.vue
 *   - src/components/kanban/card/TaskCardBadges.vue
 *   - src/components/kanban/card/TaskCardStatus.vue
 */

// --- TaskCardActions Mock ---
const TaskCardActionsMock = defineComponent({
  name: 'TaskCardActionsMock',
  props: {
    visible: { type: Boolean, default: true },
  },
  template: `
    <div :style="{ display: 'flex', gap: 'var(--space-1)', flexShrink: '0', opacity: visible ? '1' : '0.3' }">
      <button style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: 1px solid var(--glass-border); border-radius: var(--radius-sm); background: var(--glass-bg-subtle); color: var(--text-secondary); cursor: pointer;" title="Start Timer">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </button>
      <button style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: 1px solid var(--glass-border); border-radius: var(--radius-sm); background: var(--glass-bg-subtle); color: var(--text-secondary); cursor: pointer;" title="Edit Task">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
      </button>
    </div>
  `
})

// --- TaskCardBadges Mock ---
const TaskCardBadgesMock = defineComponent({
  name: 'TaskCardBadgesMock',
  props: {
    dueDate: { type: String, default: '' },
    dueDateClass: { type: String, default: '' },
    subtasksDone: { type: Number, default: 0 },
    subtasksTotal: { type: Number, default: 0 },
    pomodoros: { type: Number, default: 0 },
  },
  template: `
    <div style="display: flex; flex-wrap: wrap; gap: var(--space-1); align-items: center; min-height: 18px; margin-top: var(--space-1);">
      <span v-if="dueDate"
        :style="{
          display: 'inline-flex', alignItems: 'center',
          fontSize: 'var(--text-xs)', fontWeight: dueDateClass ? '500' : '400',
          color: dueDateClass === 'overdue' ? '#ef4444' : dueDateClass === 'today' ? '#22c55e' : 'var(--text-tertiary)',
          whiteSpace: 'nowrap'
        }"
      >{{ dueDate }}</span>

      <span v-if="dueDate && subtasksTotal > 0" style="color: var(--text-subtle); font-size: var(--text-xs); margin: 0 var(--space-1); user-select: none;">·</span>

      <span v-if="subtasksTotal > 0" style="display: inline-flex; align-items: center; font-size: var(--text-xs); color: var(--text-tertiary); white-space: nowrap;">
        {{ subtasksDone }}/{{ subtasksTotal }}
      </span>

      <span v-if="(dueDate || subtasksTotal > 0) && pomodoros > 0" style="color: var(--text-subtle); font-size: var(--text-xs); margin: 0 var(--space-1); user-select: none;">·</span>

      <span v-if="pomodoros > 0" style="display: inline-flex; align-items: center; font-size: var(--text-xs); color: rgba(239,68,68,0.6); white-space: nowrap;">
        <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: currentColor; margin-right: var(--space-1);" />
        {{ pomodoros }}
      </span>
    </div>
  `
})

// --- TaskCardStatus Mock ---
const TaskCardStatusMock = defineComponent({
  name: 'TaskCardStatusMock',
  props: {
    priority: { type: String, default: 'none' },
  },
  template: `
    <button
      :style="{
        width: '10px', height: '10px', borderRadius: '50%', border: 'none', flexShrink: '0',
        marginRight: 'var(--space-3)', cursor: 'pointer', padding: '0',
        background: priority === 'high' ? '#ef4444' : priority === 'medium' ? '#f59e0b' : priority === 'low' ? '#3b82f6' : 'rgba(255,255,255,0.2)',
        boxShadow: priority === 'high' ? '0 0 6px rgba(239,68,68,0.4)' : priority === 'medium' ? '0 0 6px rgba(245,158,11,0.3)' : priority === 'low' ? '0 0 6px rgba(59,130,246,0.3)' : 'none'
      }"
      :title="priority === 'high' ? 'High priority' : priority === 'medium' ? 'Medium priority' : priority === 'low' ? 'Low priority' : 'No priority'"
    />
  `
})

// --- Combined Showcase ---
const TaskCardSubComponentsShowcase = defineComponent({
  name: 'TaskCardSubComponentsShowcase',
  components: { TaskCardActionsMock, TaskCardBadgesMock, TaskCardStatusMock },
  template: `
    <div style="display: flex; flex-direction: column; gap: var(--space-8); color: var(--text-primary);">
      <!-- TaskCardActions -->
      <div>
        <h3 style="margin: 0 0 var(--space-3) 0; font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">TaskCardActions</h3>
        <p style="margin: 0 0 var(--space-3) 0; font-size: var(--text-sm); color: var(--text-tertiary);">Play (start timer) and Edit buttons. Visible on card hover.</p>
        <div style="display: flex; gap: var(--space-6); align-items: center;">
          <div style="text-align: center;">
            <TaskCardActionsMock :visible="true" />
            <span style="display: block; margin-top: var(--space-2); font-size: var(--text-xs); color: var(--text-muted);">Visible (hovered)</span>
          </div>
          <div style="text-align: center;">
            <TaskCardActionsMock :visible="false" />
            <span style="display: block; margin-top: var(--space-2); font-size: var(--text-xs); color: var(--text-muted);">Hidden (default)</span>
          </div>
        </div>
      </div>

      <!-- TaskCardBadges -->
      <div>
        <h3 style="margin: 0 0 var(--space-3) 0; font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">TaskCardBadges</h3>
        <p style="margin: 0 0 var(--space-3) 0; font-size: var(--text-sm); color: var(--text-tertiary);">Metadata row: due date, subtask progress, pomodoro count.</p>
        <div style="display: flex; flex-direction: column; gap: var(--space-3);">
          <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); border-radius: var(--radius-md);">
            <span style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 2px; display: block;">All badges</span>
            <TaskCardBadgesMock dueDate="Tomorrow" subtasksDone="3" subtasksTotal="5" pomodoros="2" />
          </div>
          <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); border-radius: var(--radius-md);">
            <span style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 2px; display: block;">Overdue</span>
            <TaskCardBadgesMock dueDate="2 days ago" dueDateClass="overdue" subtasksDone="1" subtasksTotal="4" />
          </div>
          <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); border-radius: var(--radius-md);">
            <span style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 2px; display: block;">Due today</span>
            <TaskCardBadgesMock dueDate="Today" dueDateClass="today" />
          </div>
          <div style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); border-radius: var(--radius-md);">
            <span style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 2px; display: block;">Pomodoros only</span>
            <TaskCardBadgesMock pomodoros="7" />
          </div>
        </div>
      </div>

      <!-- TaskCardStatus (Priority Dot) -->
      <div>
        <h3 style="margin: 0 0 var(--space-3) 0; font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">TaskCardStatus (Priority Dot)</h3>
        <p style="margin: 0 0 var(--space-3) 0; font-size: var(--text-sm); color: var(--text-tertiary);">Clickable priority indicator dot. Color changes by priority level.</p>
        <div style="display: flex; gap: var(--space-6); align-items: center;">
          <div style="text-align: center;">
            <TaskCardStatusMock priority="high" />
            <span style="display: block; margin-top: var(--space-2); font-size: var(--text-xs); color: var(--text-muted);">High</span>
          </div>
          <div style="text-align: center;">
            <TaskCardStatusMock priority="medium" />
            <span style="display: block; margin-top: var(--space-2); font-size: var(--text-xs); color: var(--text-muted);">Medium</span>
          </div>
          <div style="text-align: center;">
            <TaskCardStatusMock priority="low" />
            <span style="display: block; margin-top: var(--space-2); font-size: var(--text-xs); color: var(--text-muted);">Low</span>
          </div>
          <div style="text-align: center;">
            <TaskCardStatusMock priority="none" />
            <span style="display: block; margin-top: var(--space-2); font-size: var(--text-xs); color: var(--text-muted);">None</span>
          </div>
        </div>
      </div>

      <!-- Composed Card Preview -->
      <div>
        <h3 style="margin: 0 0 var(--space-3) 0; font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Composed Card Preview</h3>
        <div style="padding: var(--space-3); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); max-width: 300px;">
          <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-1);">
            <TaskCardStatusMock priority="high" />
            <span style="flex: 1; font-size: var(--text-sm); font-weight: 500; color: var(--text-primary);">Fix authentication bug</span>
            <TaskCardActionsMock :visible="true" />
          </div>
          <div style="padding-left: 22px;">
            <TaskCardBadgesMock dueDate="Today" dueDateClass="today" subtasksDone="2" subtasksTotal="3" pomodoros="1" />
          </div>
        </div>
      </div>
    </div>
  `
})

const meta = {
  component: TaskCardSubComponentsShowcase,
  title: '📋 Board/TaskCardSubComponents',
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
        <div style="padding: var(--space-6); background: var(--glass-bg-soft); border-radius: var(--radius-xl); border: 1px solid var(--glass-border); max-width: 700px;">
          <story />
        </div>
      `,
    })
  ],
} satisfies Meta<typeof TaskCardSubComponentsShowcase>

export default meta
type Story = StoryObj<typeof meta>

export const AllSubComponents: Story = {}
