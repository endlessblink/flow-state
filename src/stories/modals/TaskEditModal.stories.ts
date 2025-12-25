import type { Meta, StoryObj } from '@storybook/vue3'
import { createPinia, setActivePinia } from 'pinia'
import TaskEditModal from '@/components/tasks/TaskEditModal.vue'
import type { Task } from '@/types/tasks'

// Initialize Pinia to prevent store errors
const pinia = createPinia()
setActivePinia(pinia)

// Mock task data
const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  title: 'Design new dashboard layout',
  description: 'Create wireframes and mockups for the main dashboard with improved UX',
  status: 'in_progress',
  priority: 'high',
  progress: 35,
  completedPomodoros: 2,
  subtasks: [
    { id: 'st-1', title: 'Research competitors', completed: true },
    { id: 'st-2', title: 'Create wireframes', completed: false },
    { id: 'st-3', title: 'Design mockups', completed: false },
  ],
  dueDate: '2025-12-30',
  estimatedDuration: 180,
  estimatedPomodoros: 6,
  projectId: 'project-1',
  parentTaskId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  canvasPosition: { x: 100, y: 100 },
  isInInbox: false,
  dependsOn: [],
  tags: ['design', 'ux'],
  ...overrides,
})

const meta: Meta<typeof TaskEditModal> = {
  title: '🪟 Modals & Dialogs/TaskEditModal',
  component: TaskEditModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#0f172a' }],
    },
    docs: {
      description: {
        component: 'TaskEditModal provides comprehensive task editing capabilities including title, description, status, priority, due date, subtasks, tags, and time estimation.',
      },
    },
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="min-height: 800px; width: 100%; display: flex; align-items: center; justify-content: center; background: var(--app-background-gradient); border-radius: 12px;">
          <story />
        </div>
      `,
    }),
  ],
  argTypes: {
    isOpen: {
      description: 'Controls modal visibility',
      control: { type: 'boolean' },
    },
    task: {
      description: 'Task object to edit',
      control: { type: 'object' },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Edit Task',
  args: {
    isOpen: true,
    task: createMockTask(),
  },
  render: (args) => ({
    components: { TaskEditModal },
    setup() {
      const handleClose = () => console.log('Modal closed')
      return { args, handleClose }
    },
    template: `
      <TaskEditModal
        :is-open="args.isOpen"
        :task="args.task"
        @close="handleClose"
      />
    `,
  }),
}

export const HighPriorityTask: Story = {
  name: 'High Priority Task',
  args: {
    isOpen: true,
    task: createMockTask({
      title: 'Critical security fix',
      description: 'Patch authentication vulnerability before release',
      priority: 'high',
      status: 'in_progress',
      dueDate: '2025-12-26',
    }),
  },
  render: (args) => ({
    components: { TaskEditModal },
    setup() {
      const handleClose = () => console.log('Modal closed')
      return { args, handleClose }
    },
    template: `
      <TaskEditModal
        :is-open="args.isOpen"
        :task="args.task"
        @close="handleClose"
      />
    `,
  }),
}

export const CompletedTask: Story = {
  name: 'Completed Task',
  args: {
    isOpen: true,
    task: createMockTask({
      title: 'Setup CI/CD pipeline',
      description: 'Configure GitHub Actions for automated testing and deployment',
      priority: 'medium',
      status: 'done',
      progress: 100,
      completedPomodoros: 4,
      subtasks: [
        { id: 'st-1', title: 'Create workflow file', completed: true },
        { id: 'st-2', title: 'Configure secrets', completed: true },
        { id: 'st-3', title: 'Test deployment', completed: true },
      ],
    }),
  },
  render: (args) => ({
    components: { TaskEditModal },
    setup() {
      const handleClose = () => console.log('Modal closed')
      return { args, handleClose }
    },
    template: `
      <TaskEditModal
        :is-open="args.isOpen"
        :task="args.task"
        @close="handleClose"
      />
    `,
  }),
}

export const NewTask: Story = {
  name: 'New Task (No Data)',
  args: {
    isOpen: true,
    task: null,
  },
  render: (args) => ({
    components: { TaskEditModal },
    setup() {
      const handleClose = () => console.log('Modal closed')
      return { args, handleClose }
    },
    template: `
      <TaskEditModal
        :is-open="args.isOpen"
        :task="args.task"
        @close="handleClose"
      />
    `,
  }),
}

export const Closed: Story = {
  name: 'Closed State',
  args: {
    isOpen: false,
    task: createMockTask(),
  },
  render: (args) => ({
    components: { TaskEditModal },
    setup() {
      const handleClose = () => console.log('Modal closed')
      return { args, handleClose }
    },
    template: `
      <div style="color: var(--text-secondary); text-align: center;">
        <p>Modal is closed. Toggle isOpen to edit task.</p>
        <TaskEditModal
          :is-open="args.isOpen"
          :task="args.task"
          @close="handleClose"
        />
      </div>
    `,
  }),
}
