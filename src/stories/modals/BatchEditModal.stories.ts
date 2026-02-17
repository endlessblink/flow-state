import type { Meta, StoryObj } from '@storybook/vue3'
import { createPinia, setActivePinia } from 'pinia'
import BatchEditModal from '@/components/tasks/BatchEditModal.vue'

// Initialize Pinia to prevent store errors
const pinia = createPinia()
setActivePinia(pinia)

const meta: Meta<typeof BatchEditModal> = {
  title: '🎯 Modals/BatchEditModal',
  component: BatchEditModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#0f172a' }],
    },
    docs: {
      description: {
        component: 'BatchEditModal allows editing multiple tasks at once. Users can modify status, priority, project, due date, and estimated duration for all selected tasks.',
      },
    },
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="min-height: 600px; width: 100%; display: flex; align-items: center; justify-content: center; background: var(--app-background-gradient); border-radius: var(--radius-xl);">
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
    taskIds: {
      description: 'Array of task IDs to batch edit',
      control: { type: 'object' },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Default (2 Tasks Selected)',
  args: {
    isOpen: true,
    taskIds: ['task-1', 'task-2'],
  },
  render: (args) => ({
    components: { BatchEditModal },
    setup() {
      const handleClose = () => console.log('Modal closed')
      const handleApplied = () => console.log('Changes applied')
      return { args, handleClose, handleApplied }
    },
    template: `
      <BatchEditModal
        :is-open="args.isOpen"
        :task-ids="args.taskIds"
        @close="handleClose"
        @applied="handleApplied"
      />
    `,
  }),
}

export const ManyTasks: Story = {
  name: 'Many Tasks Selected',
  args: {
    isOpen: true,
    taskIds: ['task-1', 'task-2', 'task-3', 'task-4', 'task-5'],
  },
  render: (args) => ({
    components: { BatchEditModal },
    setup() {
      const handleClose = () => console.log('Modal closed')
      const handleApplied = () => console.log('Changes applied')
      return { args, handleClose, handleApplied }
    },
    template: `
      <BatchEditModal
        :is-open="args.isOpen"
        :task-ids="args.taskIds"
        @close="handleClose"
        @applied="handleApplied"
      />
    `,
  }),
}

export const Closed: Story = {
  name: 'Closed State',
  args: {
    isOpen: false,
    taskIds: ['task-1'],
  },
  render: (args) => ({
    components: { BatchEditModal },
    setup() {
      const handleClose = () => console.log('Modal closed')
      const handleApplied = () => console.log('Changes applied')
      return { args, handleClose, handleApplied }
    },
    template: `
      <div style="color: var(--text-secondary); text-align: center;">
        <p>Modal is closed. Toggle isOpen to open.</p>
        <BatchEditModal
          :is-open="args.isOpen"
          :task-ids="args.taskIds"
          @close="handleClose"
          @applied="handleApplied"
        />
      </div>
    `,
  }),
}
