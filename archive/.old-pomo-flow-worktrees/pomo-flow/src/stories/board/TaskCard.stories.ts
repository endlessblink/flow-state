import type { Meta, StoryObj } from '@storybook/vue3'
import TaskCard from '@/components/kanban/TaskCard.vue'
import type { Task } from '@/stores/tasks'
import { provideProgressiveDisclosure } from '@/composables/useProgressiveDisclosure'

// Progressive disclosure provider decorator
const ProgressiveDisclosureDecorator = (story: any) => {
  // Mock localStorage for Storybook environment
  const mockLocalStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
  }

  // Replace localStorage temporarily
  const originalLocalStorage = global.localStorage
  global.localStorage = mockLocalStorage

  try {
    // Provide the context
    provideProgressiveDisclosure()
    return story()
  } finally {
    // Restore original localStorage
    global.localStorage = originalLocalStorage
  }
}

const meta = {
  component: TaskCard,
  title: '✨ Features/📋 Board View/TaskCard',
  tags: ['autodocs'],
  decorators: [ProgressiveDisclosureDecorator],

  args: {
    selected: false,
    draggable: true,
    compact: false,
    showProject: true,
    showProgress: true,
  },

  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TaskCard>

export default meta
type Story = StoryObj<typeof meta>

// Real production task examples
const realTask: Task = {
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
  instances: [{
    id: 'instance-1',
    scheduledDate: '2024-12-25',
    scheduledTime: '09:00',
    duration: 60
  }]
}

// Default task card
export const Default: Story = {
  args: {
    task: realTask,
    onClick: () => console.log('Task card clicked'),
    onEdit: (taskId: string) => console.log('Edit task:', taskId),
    onDelete: (taskId: string) => console.log('Delete task:', taskId),
  },
}

// High priority task
export const HighPriority: Story = {
  args: {
    task: {
      ...realTask,
      id: '2',
      title: 'Fix critical production bug',
      priority: 'high',
      status: 'planned',
      description: 'Investigate and fix the authentication issue affecting users',
    },
  },
}

// Medium priority task
export const MediumPriority: Story = {
  args: {
    task: {
      ...realTask,
      id: '3',
      title: 'Review pull requests',
      priority: 'medium',
      status: 'in_progress',
      description: 'Review and approve pending team pull requests',
    },
  },
}

// Low priority task
export const LowPriority: Story = {
  args: {
    task: {
      ...realTask,
      id: '4',
      title: 'Update dependencies',
      priority: 'low',
      status: 'backlog',
      description: 'Update npm packages to latest stable versions',
    },
  },
}

// No priority task
export const NoPriority: Story = {
  args: {
    task: {
      ...realTask,
      id: '5',
      title: 'Research new frameworks',
      priority: null,
      status: 'planned',
      description: 'Explore React alternatives for next project',
    },
  },
}

// Completed task
export const Completed: Story = {
  args: {
    task: {
      ...realTask,
      id: '6',
      title: 'Setup development environment',
      status: 'done',
      priority: 'medium',
      progress: 100,
      completedPomodoros: 3,
      description: 'Configure IDE, extensions, and development tools',
    },
  },
}

// Task with subtasks
export const WithSubtasks: Story = {
  args: {
    task: {
      ...realTask,
      id: '7',
      title: 'Deploy application to production',
      status: 'in_progress',
      subtasks: [
        {
          id: 'subtask-1',
          parentTaskId: '7',
          title: 'Run automated tests',
          description: '',
          completedPomodoros: 1,
          isCompleted: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'subtask-2',
          parentTaskId: '7',
          title: 'Update documentation',
          description: '',
          completedPomodoros: 0,
          isCompleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    },
  },
}

// Task with due date
export const WithDueDate: Story = {
  args: {
    task: {
      ...realTask,
      id: '8',
      title: 'Submit project proposal',
      dueDate: '2024-12-20',
      status: 'planned',
      priority: 'high',
      description: 'Finalize and submit Q1 project proposal to management',
    },
  },
}

// Compact mode
export const Compact: Story = {
  args: {
    task: {
      ...realTask,
      id: '9',
      title: 'Quick meeting',
      description: 'Team standup',
    },
    compact: true,
  },
}

// Selected state
export const Selected: Story = {
  args: {
    task: {
      ...realTask,
      id: '10',
      title: 'Selected task example',
    },
    selected: true,
  },
}

// Not draggable
export const NotDraggable: Story = {
  args: {
    task: {
      ...realTask,
      id: '11',
      title: 'Locked task',
    },
    draggable: false,
  },
}

// Long title task
export const LongTitle: Story = {
  args: {
    task: {
      ...realTask,
      id: '12',
      title: 'This is a very long task title that should demonstrate how the component handles text overflow and wrapping in different scenarios',
      description: 'Short description',
    },
  },
}

// Long description task
export const LongDescription: Story = {
  args: {
    task: {
      ...realTask,
      id: '13',
      title: 'Complex feature implementation',
      description: 'This is a detailed description of a complex task that requires multiple steps and careful planning. It demonstrates how the TaskCard component handles longer text content and ensures proper display in various contexts.',
    },
  },
}