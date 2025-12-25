import type { Meta, StoryObj } from '@storybook/vue3'
import { createPinia, setActivePinia } from 'pinia'
import SearchModal from '@/components/layout/SearchModal.vue'

// Initialize Pinia to prevent store errors
const pinia = createPinia()
setActivePinia(pinia)

const meta: Meta<typeof SearchModal> = {
  title: '🪟 Modals & Dialogs/SearchModal',
  component: SearchModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#0f172a' }],
    },
    docs: {
      description: {
        component: 'SearchModal provides global search functionality across tasks and projects. Supports keyboard navigation and real-time filtering.',
      },
    },
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="min-height: 600px; width: 100%; display: flex; align-items: center; justify-content: center; background: var(--app-background-gradient); border-radius: 12px;">
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
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Default (Open)',
  args: {
    isOpen: true,
  },
  render: (args) => ({
    components: { SearchModal },
    setup() {
      const handleClose = () => console.log('Modal closed')
      const handleSelectTask = (task: any) => console.log('Task selected:', task)
      const handleSelectProject = (project: any) => console.log('Project selected:', project)
      return { args, handleClose, handleSelectTask, handleSelectProject }
    },
    template: `
      <SearchModal
        :is-open="args.isOpen"
        @close="handleClose"
        @select-task="handleSelectTask"
        @select-project="handleSelectProject"
      />
    `,
  }),
}

export const Closed: Story = {
  name: 'Closed State',
  args: {
    isOpen: false,
  },
  render: (args) => ({
    components: { SearchModal },
    setup() {
      const handleClose = () => console.log('Modal closed')
      const handleSelectTask = (task: any) => console.log('Task selected:', task)
      const handleSelectProject = (project: any) => console.log('Project selected:', project)
      return { args, handleClose, handleSelectTask, handleSelectProject }
    },
    template: `
      <div style="color: var(--text-secondary); text-align: center;">
        <p>Modal is closed. Toggle isOpen to open or press Ctrl+K.</p>
        <SearchModal
          :is-open="args.isOpen"
          @close="handleClose"
          @select-task="handleSelectTask"
          @select-project="handleSelectProject"
        />
      </div>
    `,
  }),
}
