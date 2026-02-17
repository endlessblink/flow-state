import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent } from 'vue'

/**
 * HierarchicalTaskRowContent - The content layer of a hierarchical task row.
 * Composes DoneToggle, TaskRowTitle, TaskRowProject, status select,
 * TaskRowPriority, TaskRowDueDate, progress bar, and TaskRowActions.
 * Used in the All Tasks view table layout.
 * Real component: src/components/tasks/HierarchicalTaskRowContent.vue
 */
const HierarchicalTaskRowContentMock = defineComponent({
  name: 'HierarchicalTaskRowContentMock',
  props: {
    title: { type: String, default: 'Complete project documentation' },
    status: { type: String, default: 'planned' },
    priority: { type: String, default: 'none' },
    isCompleted: { type: Boolean, default: false },
    isHovered: { type: Boolean, default: false },
    isSelected: { type: Boolean, default: false },
    isOverdue: { type: Boolean, default: false },
    isTimerActive: { type: Boolean, default: false },
    isDragging: { type: Boolean, default: false },
    indentLevel: { type: Number, default: 0 },
    hasSubtasks: { type: Boolean, default: false },
    completedSubtasks: { type: Number, default: 0 },
    totalSubtasks: { type: Number, default: 0 },
    dueDate: { type: String, default: '' },
    projectName: { type: String, default: '' },
    projectColor: { type: String, default: '' },
    progress: { type: Number, default: 0 },
  },
  template: `
    <div
      :style="{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        padding: '8px 12px',
        paddingLeft: (indentLevel * 20 + 12) + 'px',
        background: isSelected ? 'rgba(78,205,196,0.08)' : isHovered ? 'var(--glass-bg-light)' : 'transparent',
        borderRadius: 'var(--radius-md)',
        border: isTimerActive ? '1px solid var(--timer-active-border, rgba(245,158,11,0.4))' : isOverdue ? '1px solid rgba(239,68,68,0.3)' : '1px solid transparent',
        boxShadow: isTimerActive ? '0 0 12px var(--timer-active-glow, rgba(245,158,11,0.15))' : 'none',
        opacity: isDragging ? '0.5' : '1',
        cursor: 'pointer',
        transition: 'all 0.15s ease'
      }"
    >
      <!-- Done Toggle -->
      <button
        :style="{
          width: '18px', height: '18px', borderRadius: '50%', flexShrink: '0',
          border: isCompleted ? 'none' : '2px solid var(--glass-border)',
          background: isCompleted ? 'var(--brand-primary)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: '0'
        }"
      >
        <svg v-if="isCompleted" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
      </button>

      <!-- Title -->
      <div style="flex: 1; min-width: 0; display: flex; align-items: center; gap: var(--space-2);">
        <span :style="{
          fontSize: 'var(--text-sm)', fontWeight: '500',
          color: isCompleted ? 'var(--text-muted)' : 'var(--text-primary)',
          textDecoration: isCompleted ? 'line-through' : 'none',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }">{{ title }}</span>
        <span v-if="hasSubtasks" style="font-size: var(--text-xs); color: var(--text-muted); white-space: nowrap;">
          {{ completedSubtasks }}/{{ totalSubtasks }}
        </span>
      </div>

      <!-- Project -->
      <div v-if="projectName" style="display: flex; align-items: center; gap: var(--space-1); flex-shrink: 0;">
        <span v-if="projectColor" :style="{ width: '8px', height: '8px', borderRadius: '50%', background: projectColor }" />
        <span style="font-size: var(--text-xs); color: var(--text-tertiary); max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ projectName }}</span>
      </div>

      <!-- Status -->
      <span :style="{
        padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', fontWeight: '500',
        background: status === 'done' ? 'rgba(16,185,129,0.15)' : status === 'active' ? 'rgba(59,130,246,0.15)' : 'var(--glass-bg-medium)',
        color: status === 'done' ? 'var(--success)' : status === 'active' ? 'var(--info)' : 'var(--text-secondary)',
        flexShrink: '0', textTransform: 'capitalize'
      }">{{ status }}</span>

      <!-- Priority Dot -->
      <span :style="{
        width: '10px', height: '10px', borderRadius: '50%', flexShrink: '0',
        background: priority === 'high' ? 'var(--color-danger)' : priority === 'medium' ? 'var(--color-warning)' : priority === 'low' ? '#3b82f6' : 'rgba(255,255,255,0.2)',
        boxShadow: priority === 'high' ? '0 0 6px rgba(239,68,68,0.4)' : priority === 'medium' ? '0 0 6px rgba(245,158,11,0.3)' : priority === 'low' ? '0 0 6px rgba(59,130,246,0.3)' : 'none'
      }" />

      <!-- Due Date -->
      <span v-if="dueDate" :style="{
        fontSize: 'var(--text-xs)', flexShrink: '0',
        color: isOverdue ? 'var(--color-danger)' : 'var(--text-tertiary)'
      }">{{ dueDate }}</span>

      <!-- Progress -->
      <div v-if="progress > 0" style="width: 60px; flex-shrink: 0;">
        <div style="position: relative; height: 4px; background: var(--glass-bg-heavy); border-radius: 2px; overflow: hidden;">
          <div :style="{ width: progress + '%', height: '100%', background: 'var(--brand-primary)', borderRadius: '2px', transition: 'width 0.3s ease' }" />
        </div>
        <span style="font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px; display: block; text-align: center;">{{ progress }}%</span>
      </div>
      <span v-else style="width: 60px; text-align: center; font-size: var(--text-xs); color: var(--text-muted); flex-shrink: 0;">-</span>

      <!-- Actions -->
      <div :style="{ display: 'flex', gap: 'var(--space-1)', flexShrink: '0', opacity: isHovered ? '1' : '0', transition: 'opacity 0.15s ease' }">
        <button style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: 1px solid var(--glass-border); border-radius: var(--radius-sm); background: var(--glass-bg-subtle); color: var(--text-secondary); cursor: pointer;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
        <button style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: 1px solid var(--glass-border); border-radius: var(--radius-sm); background: var(--glass-bg-subtle); color: var(--text-secondary); cursor: pointer;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
        </button>
      </div>
    </div>
  `
})

const meta = {
  component: HierarchicalTaskRowContentMock,
  title: '📝 Task Management/HierarchicalTaskRowContent',
  tags: ['autodocs', 'new'],

  args: {
    title: 'Complete project documentation',
    status: 'planned',
    priority: 'none',
    isCompleted: false,
    isHovered: false,
    isSelected: false,
    isOverdue: false,
    isTimerActive: false,
    isDragging: false,
    indentLevel: 0,
    hasSubtasks: false,
    completedSubtasks: 0,
    totalSubtasks: 0,
    dueDate: '',
    projectName: '',
    projectColor: '',
    progress: 0,
  },

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
        <div style="padding: var(--space-4); background: var(--glass-bg-soft); border-radius: var(--radius-xl); border: 1px solid var(--glass-border); max-width: 900px;">
          <story />
        </div>
      `,
    })
  ],
} satisfies Meta<typeof HierarchicalTaskRowContentMock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Hovered: Story = {
  args: {
    title: 'Refactor authentication module',
    isHovered: true,
    priority: 'medium',
    status: 'active',
    dueDate: 'Tomorrow',
    projectName: 'Backend',
    projectColor: '#4ecdc4',
  },
}

export const Selected: Story = {
  args: {
    title: 'Fix critical payment bug',
    isSelected: true,
    priority: 'high',
    status: 'active',
    dueDate: 'Today',
  },
}

export const Completed: Story = {
  args: {
    title: 'Write API documentation',
    isCompleted: true,
    status: 'done',
    projectName: 'Docs',
    projectColor: '#a78bfa',
  },
}

export const Overdue: Story = {
  args: {
    title: 'Submit quarterly report',
    isOverdue: true,
    priority: 'high',
    dueDate: '2 days ago',
    status: 'planned',
  },
}

export const TimerActive: Story = {
  args: {
    title: 'Deep work: implement caching layer',
    isTimerActive: true,
    priority: 'medium',
    status: 'active',
    progress: 60,
    projectName: 'Performance',
    projectColor: '#f59e0b',
  },
}

export const WithSubtasks: Story = {
  args: {
    title: 'Implement new dashboard',
    hasSubtasks: true,
    completedSubtasks: 3,
    totalSubtasks: 7,
    progress: 42,
    status: 'active',
    priority: 'medium',
    projectName: 'Frontend',
    projectColor: '#ff6b6b',
  },
}

export const ChildTask: Story = {
  args: {
    title: 'Add unit tests for auth service',
    indentLevel: 1,
    status: 'planned',
    priority: 'low',
    dueDate: 'Next week',
  },
}

export const DeeplyNested: Story = {
  args: {
    title: 'Test edge case: expired token refresh',
    indentLevel: 2,
    status: 'planned',
    priority: 'low',
  },
}

export const FullyLoaded: Story = {
  args: {
    title: 'Complete sprint deliverables',
    status: 'active',
    priority: 'high',
    isHovered: true,
    hasSubtasks: true,
    completedSubtasks: 5,
    totalSubtasks: 8,
    dueDate: 'Friday',
    projectName: 'Sprint 12',
    projectColor: '#4ecdc4',
    progress: 62,
  },
}
