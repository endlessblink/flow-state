import type { Meta, StoryObj } from '@storybook/vue3'
import TaskRow from '@/components/TaskRow.vue'
import type { Task } from '@/stores/tasks'

const meta = {
  component: TaskRow,
  title: '🧩 Components/📋 Board/TaskRow',
  tags: ['autodocs'],

  args: {
    task: {} as Task,
    density: 'comfortable',
    selected: false,
    rowIndex: 0,
  },

  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TaskRow>

export default meta
type Story = StoryObj<typeof meta>

// Sample task
const sampleTask: Task = {
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
  instances: [],
  tags: ['documentation', 'api', 'important']
}

// Default task row
export const Default: Story = {
  args: {
    task: sampleTask,
    rowIndex: 1,
  },
}

// Selected state
export const Selected: Story = {
  args: {
    task: sampleTask,
    selected: true,
    rowIndex: 2,
  },
}

// Anchor row (every 5th row for ADHD visual anchor)
export const AnchorRow: Story = {
  args: {
    task: sampleTask,
    rowIndex: 4, // 5th row (0-indexed)
  },
}

// Completed task
export const Completed: Story = {
  args: {
    task: {
      ...sampleTask,
      id: 'completed-1',
      title: 'Setup development environment',
      status: 'done',
      priority: 'medium',
      progress: 100,
      completedPomodoros: 3,
      tags: ['setup', 'environment']
    },
    rowIndex: 3,
  },
}

// High priority task
export const HighPriority: Story = {
  args: {
    task: {
      ...sampleTask,
      id: 'high-1',
      title: 'Fix critical production bug',
      priority: 'high',
      status: 'planned',
      dueDate: new Date().toISOString().split('T')[0], // Due today
      tags: ['critical', 'bug', 'production']
    },
    rowIndex: 1,
  },
}

// Medium priority task
export const MediumPriority: Story = {
  args: {
    task: {
      ...sampleTask,
      id: 'medium-1',
      title: 'Review pull requests',
      priority: 'medium',
      status: 'in_progress',
      tags: ['review', 'team', 'pull-requests']
    },
    rowIndex: 2,
  },
}

// Low priority task
export const LowPriority: Story = {
  args: {
    task: {
      ...sampleTask,
      id: 'low-1',
      title: 'Update dependencies',
      priority: 'low',
      status: 'backlog',
      tags: ['maintenance', 'dependencies']
    },
    rowIndex: 3,
  },
}

// No priority task
export const NoPriority: Story = {
  args: {
    task: {
      ...sampleTask,
      id: 'no-priority-1',
      title: 'Research new frameworks',
      priority: null,
      status: 'planned',
      tags: ['research', 'learning']
    },
    rowIndex: 1,
  },
}

// Task due today
export const DueToday: Story = {
  args: {
    task: {
      ...sampleTask,
      id: 'today-1',
      title: 'Submit daily report',
      status: 'planned',
      priority: 'high',
      dueDate: new Date().toISOString().split('T')[0],
      tags: ['daily', 'report']
    },
    rowIndex: 2,
  },
}

// Task due tomorrow
export const DueTomorrow: Story = {
  args: {
    task: {
      ...sampleTask,
      id: 'tomorrow-1',
      title: 'Team presentation',
      status: 'planned',
      priority: 'medium',
      dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      tags: ['presentation', 'team']
    },
    rowIndex: 3,
  },
}

// Overdue task
export const Overdue: Story = {
  args: {
    task: {
      ...sampleTask,
      id: 'overdue-1',
      title: 'Missed deadline task',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2024-12-15',
      tags: ['overdue', 'urgent']
    },
    rowIndex: 1,
  },
}

// Task with no due date
export const NoDueDate: Story = {
  args: {
    task: {
      ...sampleTask,
      id: 'no-due-1',
      title: 'Research task without deadline',
      status: 'planned',
      priority: 'low',
      dueDate: '',
      tags: ['research', 'no-deadline']
    },
    rowIndex: 2,
  },
}

// Compact density
export const CompactDensity: Story = {
  args: {
    task: sampleTask,
    density: 'compact',
    rowIndex: 1,
  },
}

// Comfortable density (default)
export const ComfortableDensity: Story = {
  args: {
    task: sampleTask,
    density: 'comfortable',
    rowIndex: 2,
  },
}

// Spacious density
export const SpaciousDensity: Story = {
  args: {
    task: sampleTask,
    density: 'spacious',
    rowIndex: 3,
  },
}

// Task with many tags
export const ManyTags: Story = {
  args: {
    task: {
      ...sampleTask,
      id: 'many-tags-1',
      title: 'Complex feature implementation',
      tags: ['frontend', 'backend', 'api', 'database', 'testing', 'documentation', 'performance', 'security'],
    },
    rowIndex: 1,
  },
}

// Task with no tags
export const NoTags: Story = {
  args: {
    task: {
      ...sampleTask,
      id: 'no-tags-1',
      title: 'Simple task without tags',
      tags: [],
    },
    rowIndex: 2,
  },
}

// Long title task
export const LongTitle: Story = {
  args: {
    task: {
      ...sampleTask,
      id: 'long-title-1',
      title: 'This is a very long task title that demonstrates how the row component handles text overflow and truncation',
      tags: ['long-title', 'overflow']
    },
    rowIndex: 1,
  },
}

// On hold status
export const OnHold: Story = {
  args: {
    task: {
      ...sampleTask,
      id: 'hold-1',
      title: 'Blocked task waiting for dependencies',
      status: 'on_hold',
      priority: 'medium',
      tags: ['blocked', 'waiting']
    },
    rowIndex: 2,
  },
}

// Backlog status
export const Backlog: Story = {
  args: {
    task: {
      ...sampleTask,
      id: 'backlog-1',
      title: 'Future improvement idea',
      status: 'backlog',
      priority: 'low',
      tags: ['future', 'enhancement']
    },
    rowIndex: 3,
  },
}

// In progress status
export const InProgress: Story = {
  args: {
    task: {
      ...sampleTask,
      id: 'progress-1',
      title: 'Currently working on this',
      status: 'in_progress',
      priority: 'high',
      progress: 45,
      tags: ['active', 'current']
    },
    rowIndex: 1,
  },
}