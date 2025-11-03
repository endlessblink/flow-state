import type { Meta, StoryObj } from '@storybook/vue3'
import TaskNode from '@/components/canvas/TaskNode.vue'
import type { Task } from '@/stores/tasks'

const meta = {
  component: TaskNode,
  title: '✨ Features/🎨 Canvas View/TaskNode',
  tags: ['autodocs'],

  args: {
    selected: false,
    isDragging: false,
    isHovered: false,
    readOnly: false,
    showConnections: true,
  },

  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TaskNode>

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

// Default task node
export const Default: Story = {
  args: {
    task: realTask,
    onClick: () => console.log('Task node clicked'),
    onEdit: (taskId: string) => console.log('Edit task:', taskId),
    onDelete: (taskId: string) => console.log('Delete task:', taskId),
    onPositionChange: (taskId: string, position: { x: number, y: number }) =>
      console.log('Task position changed:', taskId, position),
  },
}

// In-progress task
export const InProgress: Story = {
  args: {
    task: {
      ...realTask,
      id: '2',
      title: 'Develop authentication system',
      status: 'in_progress',
      priority: 'high',
      progress: 60,
      canvasPosition: { x: 200, y: 150 },
    },
  },
}

// Planned task
export const Planned: Story = {
  args: {
    task: {
      ...realTask,
      id: '3',
      title: 'Design user interface',
      status: 'planned',
      priority: 'medium',
      progress: 0,
      canvasPosition: { x: 300, y: 100 },
    },
  },
}

// Completed task
export const Completed: Story = {
  args: {
    task: {
      ...realTask,
      id: '4',
      title: 'Setup project structure',
      status: 'done',
      priority: 'low',
      progress: 100,
      completedPomodoros: 4,
      canvasPosition: { x: 150, y: 300 },
    },
  },
}

// High priority task
export const HighPriority: Story = {
  args: {
    task: {
      ...realTask,
      id: '5',
      title: 'Fix critical bug',
      status: 'in_progress',
      priority: 'high',
      canvasPosition: { x: 400, y: 200 },
    },
  },
}

// Selected state
export const Selected: Story = {
  args: {
    task: {
      ...realTask,
      id: '6',
      title: 'Selected task',
    },
    selected: true,
  },
}

// Dragging state
export const Dragging: Story = {
  args: {
    task: {
      ...realTask,
      id: '7',
      title: 'Being dragged',
    },
    isDragging: true,
  },
}

// Hover state
export const Hovered: Story = {
  args: {
    task: {
      ...realTask,
      id: '8',
      title: 'Hovered task',
    },
    isHovered: true,
  },
}

// Read only mode
export const ReadOnly: Story = {
  args: {
    task: {
      ...realTask,
      id: '9',
      title: 'Read only task',
    },
    readOnly: true,
  },
}

// Task with dependencies
export const WithDependencies: Story = {
  args: {
    task: {
      ...realTask,
      id: '10',
      title: 'Dependent task',
      dependsOn: ['1', '2'],
      connectionTypes: {
        '1': 'sequential',
        '2': 'blocker'
      },
      canvasPosition: { x: 250, y: 350 },
    },
    showConnections: true,
  },
}

// Task in inbox (not positioned)
export const InboxTask: Story = {
  args: {
    task: {
      ...realTask,
      id: '11',
      title: 'New inbox task',
      isInInbox: true,
      canvasPosition: undefined,
    },
  },
}

// Task with subtasks
export const WithSubtasks: Story = {
  args: {
    task: {
      ...realTask,
      id: '12',
      title: 'Parent task with subtasks',
      subtasks: [
        {
          id: 'subtask-1',
          parentTaskId: '12',
          title: 'First subtask',
          description: '',
          completedPomodoros: 1,
          isCompleted: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'subtask-2',
          parentTaskId: '12',
          title: 'Second subtask',
          description: '',
          completedPomodoros: 0,
          isCompleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      canvasPosition: { x: 500, y: 150 },
    },
  },
}

// Task with due date
export const WithDueDate: Story = {
  args: {
    task: {
      ...realTask,
      id: '13',
      title: 'Urgent deadline task',
      dueDate: '2024-12-20',
      priority: 'high',
      status: 'planned',
      canvasPosition: { x: 350, y: 300 },
    },
  },
}