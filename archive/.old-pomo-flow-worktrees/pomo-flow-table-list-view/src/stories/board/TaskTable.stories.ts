import type { Meta, StoryObj } from '@storybook/vue3'
import TaskTable from '@/components/TaskTable.vue'
import type { Task } from '@/stores/tasks'

const meta = {
  component: TaskTable,
  title: '🧩 Components/📋 Board/TaskTable',
  tags: ['autodocs'],

  args: {
    tasks: [],
    density: 'comfortable',
  },

  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TaskTable>

export default meta
type Story = StoryObj<typeof meta>

// Sample tasks for testing
const sampleTasks: Task[] = [
  {
    id: '1',
    title: 'Complete project documentation',
    description: 'Write comprehensive API documentation for all endpoints',
    status: 'in_progress',
    priority: 'high',
    progress: 25,
    completedPomodoros: 2,
    subtasks: [],
    dueDate: '2024-12-25',
    estimatedDuration: 120,
    projectId: '1',
    parentTaskId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    isInInbox: false,
    canvasPosition: { x: 100, y: 200 },
    instances: []
  },
  {
    id: '2',
    title: 'Review pull requests',
    description: 'Review and approve pending team pull requests',
    status: 'planned',
    priority: 'medium',
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: '2024-12-22',
    estimatedDuration: 60,
    projectId: '1',
    parentTaskId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    isInInbox: false,
    canvasPosition: { x: 300, y: 200 },
    instances: []
  },
  {
    id: '3',
    title: 'Update dependencies',
    description: 'Update npm packages to latest stable versions',
    status: 'backlog',
    priority: 'low',
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    estimatedDuration: 45,
    projectId: '2',
    parentTaskId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    isInInbox: false,
    canvasPosition: { x: 500, y: 200 },
    instances: []
  },
  {
    id: '4',
    title: 'Fix critical bug',
    description: 'Investigate and fix authentication issue',
    status: 'done',
    priority: 'high',
    progress: 100,
    completedPomodoros: 3,
    subtasks: [],
    dueDate: '2024-12-20',
    estimatedDuration: 90,
    projectId: '1',
    parentTaskId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    isInInbox: false,
    canvasPosition: { x: 700, y: 200 },
    instances: []
  }
]

// Empty state
export const Empty: Story = {
  args: {
    tasks: [],
  },
}

// Single task
export const SingleTask: Story = {
  args: {
    tasks: [sampleTasks[0]],
  },
}

// Multiple tasks
export const MultipleTasks: Story = {
  args: {
    tasks: sampleTasks,
  },
}

// Compact density
export const CompactDensity: Story = {
  args: {
    tasks: sampleTasks,
    density: 'compact',
  },
}

// Comfortable density (default)
export const ComfortableDensity: Story = {
  args: {
    tasks: sampleTasks,
    density: 'comfortable',
  },
}

// Spacious density
export const SpaciousDensity: Story = {
  args: {
    tasks: sampleTasks,
    density: 'spacious',
  },
}

// Tasks with different priorities
export const MixedPriorities: Story = {
  args: {
    tasks: [
      { ...sampleTasks[0], id: 'high-1', title: 'Critical production issue', priority: 'high' },
      { ...sampleTasks[1], id: 'medium-1', title: 'Feature development', priority: 'medium' },
      { ...sampleTasks[2], id: 'low-1', title: 'Documentation update', priority: 'low' },
      { ...sampleTasks[3], id: 'no-priority-1', title: 'Research task', priority: null },
    ],
    density: 'comfortable',
  },
}

// Tasks with different statuses
export const MixedStatuses: Story = {
  args: {
    tasks: [
      { ...sampleTasks[0], id: 'planned-1', title: 'Plan new feature', status: 'planned', priority: 'high' },
      { ...sampleTasks[1], id: 'progress-1', title: 'Develop API endpoint', status: 'in_progress', priority: 'medium' },
      { ...sampleTasks[2], id: 'done-1', title: 'Setup CI/CD', status: 'done', priority: 'low', progress: 100 },
      { ...sampleTasks[3], id: 'backlog-1', title: 'Performance optimization', status: 'backlog', priority: 'medium' },
      { ...sampleTasks[0], id: 'hold-1', title: 'Fix dependency issue', status: 'on_hold', priority: 'high' },
    ],
    density: 'comfortable',
  },
}

// Tasks with different progress levels
export const MixedProgress: Story = {
  args: {
    tasks: [
      { ...sampleTasks[0], id: 'progress-0', title: 'Not started', progress: 0, status: 'planned' },
      { ...sampleTasks[1], id: 'progress-25', title: 'Quarter complete', progress: 25, status: 'in_progress' },
      { ...sampleTasks[2], id: 'progress-50', title: 'Half done', progress: 50, status: 'in_progress' },
      { ...sampleTasks[3], id: 'progress-75', title: 'Mostly complete', progress: 75, status: 'in_progress' },
      { ...sampleTasks[0], id: 'progress-100', title: 'Completed', progress: 100, status: 'done' },
    ],
    density: 'comfortable',
  },
}

// Tasks due today and overdue
export const DueDates: Story = {
  args: {
    tasks: [
      { ...sampleTasks[0], id: 'today-1', title: 'Submit daily report', dueDate: new Date().toISOString().split('T')[0], priority: 'high' },
      { ...sampleTasks[1], id: 'tomorrow-1', title: 'Team presentation', dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], priority: 'medium' },
      { ...sampleTasks[2], id: 'overdue-1', title: 'Missed deadline', dueDate: '2024-12-15', priority: 'high', status: 'in_progress' },
      { ...sampleTasks[3], id: 'no-due-1', title: 'No deadline set', dueDate: '', priority: 'low' },
    ],
    density: 'comfortable',
  },
}

// Large table
export const LargeTable: Story = {
  args: {
    tasks: Array.from({ length: 15 }, (_, i) => ({
      ...sampleTasks[i % 4],
      id: `task-${i}`,
      title: `Task ${i + 1}: ${['Development', 'Documentation', 'Testing', 'Review', 'Planning', 'Deployment', 'Research', 'Optimization'][i % 8]}`,
      priority: ['high', 'medium', 'low', null][i % 4] as Task['priority'],
      status: ['planned', 'in_progress', 'done', 'backlog', 'on_hold'][i % 5] as Task['status'],
      progress: [0, 25, 50, 75, 100][i % 5],
      dueDate: i % 3 === 0 ? `2024-12-${20 + (i % 10)}` : '',
    })),
    density: 'comfortable',
  },
}

// Tasks with long titles
export const LongTitles: Story = {
  args: {
    tasks: [
      {
        ...sampleTasks[0],
        id: 'long-1',
        title: 'This is a very long task title that demonstrates how the table handles text overflow and truncation in various scenarios',
        priority: 'high'
      },
      {
        ...sampleTasks[1],
        id: 'long-2',
        title: 'Another extremely long title that should be properly truncated to maintain table layout and readability',
        priority: 'medium'
      },
      {
        ...sampleTasks[2],
        id: 'short-1',
        title: 'Short title',
        priority: 'low'
      }
    ],
    density: 'comfortable',
  },
}