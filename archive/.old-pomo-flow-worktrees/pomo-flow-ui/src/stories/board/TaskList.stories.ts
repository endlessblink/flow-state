import type { Meta, StoryObj } from '@storybook/vue3'
import TaskList from '@/components/TaskList.vue'
import type { Task } from '@/stores/tasks'

const meta = {
  component: TaskList,
  title: '🧩 Components/📋 Board/TaskList',
  tags: ['autodocs'],

  args: {
    tasks: [],
    emptyMessage: 'Create your first task to get started',
  },

  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TaskList>

export default meta
type Story = StoryObj<typeof meta>

// Sample tasks for testing
const sampleTasks: Task[] = [
  {
    id: '1',
    title: 'Complete project documentation',
    description: 'Write comprehensive API documentation',
    status: 'in_progress',
    priority: 'high',
    progress: 25,
    completedPomodoros: 2,
    subtasks: [
      {
        id: 'subtask-1',
        parentTaskId: '1',
        title: 'Setup documentation structure',
        description: '',
        completedPomodoros: 1,
        isCompleted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ],
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
    description: 'Review and approve pending team PRs',
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
    description: 'Update npm packages to latest versions',
    status: 'backlog',
    priority: 'low',
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: '2024-12-30',
    estimatedDuration: 45,
    projectId: '2',
    parentTaskId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    isInInbox: false,
    canvasPosition: { x: 500, y: 200 },
    instances: []
  }
]

// Empty state
export const Empty: Story = {
  args: {
    tasks: [],
    emptyMessage: 'No tasks found. Create your first task to get started!',
  },
}

// Single task
export const SingleTask: Story = {
  args: {
    tasks: [sampleTasks[0]],
  },
}

// Multiple tasks in single project
export const SingleProject: Story = {
  args: {
    tasks: [sampleTasks[0], sampleTasks[1]],
  },
}

// Multiple projects
export const MultipleProjects: Story = {
  args: {
    tasks: sampleTasks,
  },
}

// Tasks with subtasks
export const WithSubtasks: Story = {
  args: {
    tasks: [
      {
        ...sampleTasks[0],
        subtasks: [
          {
            id: 'subtask-1',
            parentTaskId: '1',
            title: 'Setup documentation structure',
            description: 'Create the main documentation files and folders',
            completedPomodoros: 1,
            isCompleted: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'subtask-2',
            parentTaskId: '1',
            title: 'Write API endpoints documentation',
            description: 'Document all REST API endpoints',
            completedPomodoros: 0,
            isCompleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'subtask-3',
            parentTaskId: '1',
            title: 'Add code examples',
            description: 'Include practical code examples',
            completedPomodoros: 0,
            isCompleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        ]
      }
    ],
  },
}

// Tasks with different priorities
export const MixedPriorities: Story = {
  args: {
    tasks: [
      { ...sampleTasks[0], id: 'high-1', title: 'Critical bug fix', priority: 'high' },
      { ...sampleTasks[1], id: 'medium-1', title: 'Code review', priority: 'medium' },
      { ...sampleTasks[2], id: 'low-1', title: 'Cleanup tasks', priority: 'low' },
      { ...sampleTasks[0], id: 'no-priority-1', title: 'Research task', priority: null },
    ],
  },
}

// Tasks with different statuses
export const MixedStatuses: Story = {
  args: {
    tasks: [
      { ...sampleTasks[0], id: 'planned-1', title: 'Plan new feature', status: 'planned' },
      { ...sampleTasks[1], id: 'progress-1', title: 'Develop feature', status: 'in_progress' },
      { ...sampleTasks[2], id: 'done-1', title: 'Completed task', status: 'done', progress: 100 },
      { ...sampleTasks[0], id: 'backlog-1', title: 'Future improvement', status: 'backlog' },
      { ...sampleTasks[1], id: 'hold-1', title: 'Blocked task', status: 'on_hold' },
    ],
  },
}

// Tasks due today
export const DueToday: Story = {
  args: {
    tasks: [
      { ...sampleTasks[0], id: 'today-1', title: 'Submit report', dueDate: new Date().toISOString().split('T')[0] },
      { ...sampleTasks[1], id: 'today-2', title: 'Team meeting', dueDate: new Date().toISOString().split('T')[0] },
    ],
  },
}

// Overdue tasks
export const Overdue: Story = {
  args: {
    tasks: [
      { ...sampleTasks[0], id: 'overdue-1', title: 'Missed deadline', dueDate: '2024-12-15' },
      { ...sampleTasks[1], id: 'overdue-2', title: 'Late task', dueDate: '2024-12-10' },
    ],
  },
}

// Large number of tasks
export const ManyTasks: Story = {
  args: {
    tasks: Array.from({ length: 10 }, (_, i) => ({
      ...sampleTasks[0],
      id: `task-${i}`,
      title: `Task ${i + 1}: ${['Development', 'Documentation', 'Testing', 'Review', 'Planning'][i % 5]} task`,
      projectId: `${(i % 3) + 1}`,
      priority: ['high', 'medium', 'low', null][i % 4] as Task['priority'],
      status: ['planned', 'in_progress', 'done', 'backlog'][i % 4] as Task['status'],
    })),
  },
}

// Custom empty message
export const CustomEmptyMessage: Story = {
  args: {
    tasks: [],
    emptyMessage: 'No tasks match your filters. Try adjusting your search criteria.',
  },
}