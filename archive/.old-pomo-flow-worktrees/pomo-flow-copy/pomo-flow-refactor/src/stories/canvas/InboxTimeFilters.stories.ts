import type { Meta, StoryObj } from '@storybook/vue3'
import InboxTimeFilters from '@/components/canvas/InboxTimeFilters.vue'
import type { Task } from '@/stores/tasks'

const meta = {
  component: InboxTimeFilters,
  title: '🧩 Components/🎨 Canvas/InboxTimeFilters',
  tags: ['autodocs'],

  args: {
    tasks: [],
    activeFilter: 'all',
  },

  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof InboxTimeFilters>

export default meta
type Story = StoryObj<typeof meta>

// Helper function to create sample tasks
const createTask = (id: string, title: string, scheduledDate?: string, dueDate?: string, status = 'planned'): Task => ({
  id,
  title,
  description: `Description for ${title}`,
  status,
  priority: 'medium',
  progress: 0,
  completedPomodoros: 0,
  subtasks: [],
  dueDate,
  estimatedDuration: 60,
  projectId: '1',
  parentTaskId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  isInInbox: true,
  canvasPosition: { x: 0, y: 0 },
  instances: scheduledDate ? [{
    id: `instance-${id}`,
    scheduledDate,
    scheduledTime: '09:00',
    duration: 60
  }] : [],
  tags: []
})

// Today's date for testing
const today = new Date().toISOString().split('T')[0]
const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

// Empty state
export const Empty: Story = {
  args: {
    tasks: [],
    activeFilter: 'all',
  },
}

// All filter active
export const AllFilter: Story = {
  args: {
    tasks: [
      createTask('1', 'Task for today', today),
      createTask('2', 'Task for tomorrow', tomorrow),
      createTask('3', 'Task for next week', nextWeek),
      createTask('4', 'Task with no date'),
    ],
    activeFilter: 'all',
  },
}

// Now filter - tasks for right now
export const NowFilter: Story = {
  args: {
    tasks: [
      createTask('1', 'Task scheduled today', today),
      createTask('2', 'Task created today', undefined, today, 'in_progress'),
      createTask('3', 'Task due today', undefined, today),
      createTask('4', 'Task in progress', undefined, undefined, 'in_progress'),
      createTask('5', 'Task for tomorrow', tomorrow),
    ],
    activeFilter: 'now',
  },
}

// Today filter
export const TodayFilter: Story = {
  args: {
    tasks: [
      createTask('1', 'Today task 1', today),
      createTask('2', 'Today task 2', today),
      createTask('3', 'Tomorrow task', tomorrow),
      createTask('4', 'No date task'),
    ],
    activeFilter: 'today',
  },
}

// Tomorrow filter
export const TomorrowFilter: Story = {
  args: {
    tasks: [
      createTask('1', 'Today task', today),
      createTask('2', 'Tomorrow task 1', tomorrow),
      createTask('3', 'Tomorrow task 2', tomorrow),
      createTask('4', 'Next week task', nextWeek),
    ],
    activeFilter: 'tomorrow',
  },
}

// This week filter
export const ThisWeekFilter: Story = {
  args: {
    tasks: [
      createTask('1', 'Today task', today),
      createTask('2', 'Tomorrow task', tomorrow),
      createTask('3', 'In 3 days', new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]),
      createTask('4', 'In 5 days', new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]),
      createTask('5', 'Next week task', nextWeek),
    ],
    activeFilter: 'thisWeek',
  },
}

// No date filter
export const NoDateFilter: Story = {
  args: {
    tasks: [
      createTask('1', 'Task with date', today),
      createTask('2', 'Task without date 1'),
      createTask('3', 'Task without date 2'),
      createTask('4', 'Another task with date', tomorrow),
    ],
    activeFilter: 'noDate',
  },
}

// Mixed tasks with counts
export const MixedTasks: Story = {
  args: {
    tasks: [
      // Now tasks (4)
      createTask('now-1', 'In progress task', undefined, today, 'in_progress'),
      createTask('now-2', 'Created today', today),
      createTask('now-3', 'Due today', undefined, today),
      createTask('now-4', 'Scheduled today', today),

      // Today tasks (2 additional, total 6 including now)
      createTask('today-1', 'Another today task', today),
      createTask('today-2', 'Third today task', today),

      // Tomorrow tasks (2)
      createTask('tomorrow-1', 'Tomorrow task 1', tomorrow),
      createTask('tomorrow-2', 'Tomorrow task 2', tomorrow),

      // This week tasks (3)
      createTask('week-1', 'In 2 days', new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]),
      createTask('week-2', 'In 4 days', new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0]),
      createTask('week-3', 'In 6 days', new Date(Date.now() + 6 * 86400000).toISOString().split('T')[0]),

      // No date tasks (3)
      createTask('nodate-1', 'No date task 1'),
      createTask('nodate-2', 'No date task 2'),
      createTask('nodate-3', 'No date task 3'),
    ],
    activeFilter: 'all',
  },
}

// High task counts
export const HighCounts: Story = {
  args: {
    tasks: [
      // Create many tasks for each filter
      ...Array.from({ length: 8 }, (_, i) => createTask(`now-${i}`, `Now task ${i + 1}`, today)),
      ...Array.from({ length: 5 }, (_, i) => createTask(`today-${i}`, `Today task ${i + 1}`, today)),
      ...Array.from({ length: 3 }, (_, i) => createTask(`tomorrow-${i}`, `Tomorrow task ${i + 1}`, tomorrow)),
      ...Array.from({ length: 4 }, (_, i) => createTask(`week-${i}`, `Week task ${i + 1}`, new Date(Date.now() + (i + 1) * 86400000).toISOString().split('T')[0])),
      ...Array.from({ length: 6 }, (_, i) => createTask(`nodate-${i}`, `No date task ${i + 1}`)),
    ],
    activeFilter: 'all',
  },
}

// Single task per filter
export const SingleTasks: Story = {
  args: {
    tasks: [
      createTask('single-1', 'One now task', today),
      createTask('single-2', 'One today task', today),
      createTask('single-3', 'One tomorrow task', tomorrow),
      createTask('single-4', 'One week task', new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]),
      createTask('single-5', 'One no date task'),
    ],
    activeFilter: 'all',
  },
}

// Tasks with different statuses
export const DifferentStatuses: Story = {
  args: {
    tasks: [
      createTask('planned', 'Planned task', today),
      createTask('progress', 'In progress task', today, today, 'in_progress'),
      createTask('done', 'Completed task', tomorrow, tomorrow, 'done'),
      createTask('backlog', 'Backlog task', new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]),
      createTask('hold', 'On hold task'),
    ],
    activeFilter: 'today',
  },
}

// Tasks using legacy scheduledDate format
export const LegacyFormat: Story = {
  args: {
    tasks: [
      {
        ...createTask('legacy-1', 'Legacy task 1'),
        scheduledDate: today,
        instances: []
      },
      {
        ...createTask('legacy-2', 'Legacy task 2'),
        scheduledDate: tomorrow,
        instances: []
      },
      {
        ...createTask('legacy-3', 'Legacy task 3'),
        instances: []
      }
    ] as Task[],
    activeFilter: 'today',
  },
}