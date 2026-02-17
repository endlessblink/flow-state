import type { Meta, StoryObj } from '@storybook/vue3'
import { createPinia, setActivePinia } from 'pinia'
import TaskNode from '@/components/canvas/TaskNode.vue'
import type { Task } from '@/types/tasks'

// Initialize Pinia to prevent store errors
const pinia = createPinia()
setActivePinia(pinia)

// Mock task data
const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  title: 'Implement user authentication',
  description: 'Add login/logout functionality with JWT tokens',
  status: 'in_progress',
  priority: 'high',
  progress: 40,
  completedPomodoros: 2,
  subtasks: [],
  dueDate: '2025-12-30',
  estimatedDuration: 120,
  estimatedPomodoros: 4,
  projectId: 'project-1',
  parentTaskId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  canvasPosition: { x: 100, y: 100 },
  isInInbox: false,
  dependsOn: [],
  tags: ['auth', 'backend'],
  ...overrides,
})

const meta: Meta<typeof TaskNode> = {
  title: '🎨 Canvas/TaskNode',
  component: TaskNode,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#0f172a' }],
    },
    docs: {
      description: {
        component: 'TaskNode displays a task card on the Canvas view with priority indicator, status badge, progress bar, and connection handles for task dependencies.',
      },
    },
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="padding: var(--space-16); background: var(--app-background-gradient); min-height: 400px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-xl);">
          <story />
        </div>
      `,
    }),
  ],
  argTypes: {
    task: {
      description: 'The task object to display',
      control: { type: 'object' },
    },
    selected: {
      description: 'Whether the task is currently selected',
      control: { type: 'boolean' },
    },
    isDragging: {
      description: 'Whether the task is being dragged',
      control: { type: 'boolean' },
    },
    isHovered: {
      description: 'Whether the task is hovered',
      control: { type: 'boolean' },
    },
    readOnly: {
      description: 'Whether the task is in read-only mode',
      control: { type: 'boolean' },
    },
    showConnections: {
      description: 'Whether to show connection handles',
      control: { type: 'boolean' },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    task: createMockTask(),
    selected: false,
    isDragging: false,
    isHovered: false,
    readOnly: false,
    showConnections: true,
  },
}

export const HighPriority: Story = {
  name: 'High Priority Task',
  args: {
    task: createMockTask({
      title: 'Critical bug fix',
      description: 'Fix authentication bypass vulnerability',
      priority: 'high',
      status: 'in_progress',
    }),
    selected: false,
    isDragging: false,
    isHovered: false,
    readOnly: false,
    showConnections: true,
  },
}

export const MediumPriority: Story = {
  name: 'Medium Priority Task',
  args: {
    task: createMockTask({
      title: 'Update documentation',
      description: 'Add API endpoint documentation',
      priority: 'medium',
      status: 'planned',
      progress: 0,
      completedPomodoros: 0,
    }),
    selected: false,
    isDragging: false,
    isHovered: false,
    readOnly: false,
    showConnections: true,
  },
}

export const LowPriority: Story = {
  name: 'Low Priority Task',
  args: {
    task: createMockTask({
      title: 'Code cleanup',
      description: 'Refactor utility functions',
      priority: 'low',
      status: 'backlog',
      progress: 0,
      completedPomodoros: 0,
    }),
    selected: false,
    isDragging: false,
    isHovered: false,
    readOnly: false,
    showConnections: true,
  },
}

export const CompletedTask: Story = {
  name: 'Completed Task',
  args: {
    task: createMockTask({
      title: 'Setup project structure',
      description: 'Initialize Vue 3 + TypeScript project',
      priority: 'high',
      status: 'done',
      progress: 100,
      completedPomodoros: 3,
    }),
    selected: false,
    isDragging: false,
    isHovered: false,
    readOnly: false,
    showConnections: true,
  },
}

export const Selected: Story = {
  name: 'Selected State',
  args: {
    task: createMockTask(),
    selected: true,
    isDragging: false,
    isHovered: false,
    readOnly: false,
    showConnections: true,
  },
}

export const Dragging: Story = {
  name: 'Dragging State',
  args: {
    task: createMockTask(),
    selected: true,
    isDragging: true,
    isHovered: false,
    readOnly: false,
    showConnections: true,
  },
}

export const ReadOnly: Story = {
  name: 'Read Only Mode',
  args: {
    task: createMockTask(),
    selected: false,
    isDragging: false,
    isHovered: false,
    readOnly: true,
    showConnections: false,
  },
}

export const NoPriority: Story = {
  name: 'No Priority Set',
  args: {
    task: createMockTask({
      title: 'New task without priority',
      description: 'Priority not yet assigned',
      priority: null,
      status: 'planned',
    }),
    selected: false,
    isDragging: false,
    isHovered: false,
    readOnly: false,
    showConnections: true,
  },
}
