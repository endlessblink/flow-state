import type { Meta, StoryObj } from '@storybook/vue3'
import { Clock } from 'lucide-vue-next'
import TaskNodeMeta from '@/components/canvas/node/TaskNodeMeta.vue'

const meta: Meta<typeof TaskNodeMeta> = {
  title: '🎨 Canvas/Node/TaskNodeMeta',
  component: TaskNodeMeta,
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered'
  }
}

export default meta
type Story = StoryObj<typeof TaskNodeMeta>

export const Default: Story = {
  args: {
    showStatus: true,
    statusLabel: 'In Progress',
    dueDate: null,
    formattedDueDate: '',
    showSchedule: false,
    hasSchedule: false,
    showDuration: true,
    duration: 30,
    durationBadgeClass: 'duration-short',
    durationIcon: Clock,
    formattedDuration: '30m',
    isDone: false,
    isOverdue: false,
    doneForNowUntil: null,
    subtaskCount: 0,
    completedSubtaskCount: 0
  },
  render: (args) => ({
    components: { TaskNodeMeta },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-4); background: var(--surface-secondary); border-radius: var(--radius-lg);">
        <TaskNodeMeta v-bind="args" />
      </div>
    `
  })
}

export const WithDueDate: Story = {
  args: {
    showStatus: true,
    statusLabel: 'Planned',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    formattedDueDate: 'Tomorrow',
    showSchedule: false,
    hasSchedule: false,
    showDuration: true,
    duration: 60,
    durationBadgeClass: 'duration-medium',
    durationIcon: Clock,
    formattedDuration: '1h',
    isDone: false,
    isOverdue: false,
    doneForNowUntil: null,
    subtaskCount: 0,
    completedSubtaskCount: 0
  },
  render: (args) => ({
    components: { TaskNodeMeta },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-4); background: var(--surface-secondary); border-radius: var(--radius-lg);">
        <TaskNodeMeta v-bind="args" />
      </div>
    `
  })
}

export const Overdue: Story = {
  args: {
    showStatus: true,
    statusLabel: 'In Progress',
    dueDate: new Date(Date.now() - 86400000).toISOString(),
    formattedDueDate: 'Yesterday',
    showSchedule: false,
    hasSchedule: false,
    showDuration: true,
    duration: 45,
    durationBadgeClass: 'duration-short',
    durationIcon: Clock,
    formattedDuration: '45m',
    isDone: false,
    isOverdue: true,
    doneForNowUntil: null,
    subtaskCount: 0,
    completedSubtaskCount: 0
  },
  render: (args) => ({
    components: { TaskNodeMeta },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-4); background: var(--surface-secondary); border-radius: var(--radius-lg);">
        <TaskNodeMeta v-bind="args" />
      </div>
    `
  })
}

export const DoneForNow: Story = {
  args: {
    showStatus: true,
    statusLabel: 'Planned',
    dueDate: null,
    formattedDueDate: '',
    showSchedule: false,
    hasSchedule: false,
    showDuration: true,
    duration: 30,
    durationBadgeClass: 'duration-short',
    durationIcon: Clock,
    formattedDuration: '30m',
    isDone: false,
    isOverdue: false,
    doneForNowUntil: new Date(Date.now() + 3600000).toISOString(),
    subtaskCount: 0,
    completedSubtaskCount: 0
  },
  render: (args) => ({
    components: { TaskNodeMeta },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-4); background: var(--surface-secondary); border-radius: var(--radius-lg);">
        <TaskNodeMeta v-bind="args" />
      </div>
    `
  })
}

export const WithSubtasks: Story = {
  args: {
    showStatus: true,
    statusLabel: 'In Progress',
    dueDate: null,
    formattedDueDate: '',
    showSchedule: false,
    hasSchedule: false,
    showDuration: true,
    duration: 90,
    durationBadgeClass: 'duration-long',
    durationIcon: Clock,
    formattedDuration: '1.5h',
    isDone: false,
    isOverdue: false,
    doneForNowUntil: null,
    subtaskCount: 5,
    completedSubtaskCount: 3
  },
  render: (args) => ({
    components: { TaskNodeMeta },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-4); background: var(--surface-secondary); border-radius: var(--radius-lg);">
        <TaskNodeMeta v-bind="args" />
      </div>
    `
  })
}

export const CompletedWithSubtasks: Story = {
  args: {
    showStatus: true,
    statusLabel: 'Done',
    dueDate: null,
    formattedDueDate: '',
    showSchedule: false,
    hasSchedule: false,
    showDuration: true,
    duration: 60,
    durationBadgeClass: 'duration-medium',
    durationIcon: Clock,
    formattedDuration: '1h',
    isDone: true,
    isOverdue: false,
    doneForNowUntil: null,
    subtaskCount: 4,
    completedSubtaskCount: 4
  },
  render: (args) => ({
    components: { TaskNodeMeta },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-4); background: var(--surface-secondary); border-radius: var(--radius-lg);">
        <TaskNodeMeta v-bind="args" />
      </div>
    `
  })
}

export const FullMetadata: Story = {
  args: {
    showStatus: true,
    statusLabel: 'In Progress',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    formattedDueDate: 'Tomorrow',
    showSchedule: true,
    hasSchedule: true,
    showDuration: true,
    duration: 120,
    durationBadgeClass: 'duration-long',
    durationIcon: Clock,
    formattedDuration: '2h',
    isDone: false,
    isOverdue: false,
    doneForNowUntil: null,
    subtaskCount: 6,
    completedSubtaskCount: 2
  },
  render: (args) => ({
    components: { TaskNodeMeta },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-4); background: var(--surface-secondary); border-radius: var(--radius-lg);">
        <TaskNodeMeta v-bind="args" />
      </div>
    `
  })
}
