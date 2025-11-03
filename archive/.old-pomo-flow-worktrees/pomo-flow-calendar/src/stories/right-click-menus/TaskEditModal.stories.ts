import type { Meta, StoryObj } from '@storybook/vue3'
import TaskEditModal from '@/components/TaskEditModal.vue'
import type { Task } from '@/stores/tasks'

const meta = {
  component: TaskEditModal,
  title: '🎭 Overlays/🪟 Modals/TaskEditModal',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TaskEditModal>

export default meta
type Story = StoryObj<typeof meta>

// Real production task example - exactly matches Task interface
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

export const Default: Story = {
  args: {
    isOpen: true,
    task: realTask,
  },
}

export const WithSubtasks: Story = {
  args: {
    isOpen: true,
    task: {
      ...realTask,
      subtasks: [
        {
          id: 'subtask-1',
          parentTaskId: '1',
          title: 'Set up API documentation structure',
          description: 'Create the main documentation pages and navigation',
          completedPomodoros: 1,
          isCompleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'subtask-2',
          parentTaskId: '1',
          title: 'Document authentication endpoints',
          description: 'Write detailed documentation for login, register, and token refresh',
          completedPomodoros: 0,
          isCompleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    },
  },
}

export const WithPomodoros: Story = {
  args: {
    isOpen: true,
    task: {
      ...realTask,
      completedPomodoros: 3,
      progress: 60,
    },
  },
}
