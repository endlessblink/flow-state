import type { Meta, StoryObj } from '@storybook/vue3'
import QuickTaskCreateModal from '@/components/tasks/QuickTaskCreateModal.vue'

const meta: Meta<typeof QuickTaskCreateModal> = {
  title: '🎯 Modals/QuickTaskCreateModal',
  component: QuickTaskCreateModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#0f172a' }],
    },
    docs: {
      description: {
        component: 'QuickTaskCreateModal provides a streamlined interface for quickly creating new tasks with title and optional description.',
      },
    },
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="min-height: 500px; width: 100%; display: flex; align-items: center; justify-content: center; background: var(--app-background-gradient); border-radius: 12px;">
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
    loading: {
      description: 'Shows loading state on create button',
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
    loading: false,
  },
  render: (args) => ({
    components: { QuickTaskCreateModal },
    setup() {
      const handleCancel = () => console.log('Cancelled')
      const handleCreate = (title: string, description: string) => {
        console.log('Creating task:', { title, description })
      }
      return { args, handleCancel, handleCreate }
    },
    template: `
      <QuickTaskCreateModal
        :is-open="args.isOpen"
        :loading="args.loading"
        @cancel="handleCancel"
        @create="handleCreate"
      />
    `,
  }),
}

export const Loading: Story = {
  name: 'Loading State',
  args: {
    isOpen: true,
    loading: true,
  },
  render: (args) => ({
    components: { QuickTaskCreateModal },
    setup() {
      const handleCancel = () => console.log('Cancelled')
      const handleCreate = (title: string, description: string) => {
        console.log('Creating task:', { title, description })
      }
      return { args, handleCancel, handleCreate }
    },
    template: `
      <QuickTaskCreateModal
        :is-open="args.isOpen"
        :loading="args.loading"
        @cancel="handleCancel"
        @create="handleCreate"
      />
    `,
  }),
}

export const Closed: Story = {
  name: 'Closed State',
  args: {
    isOpen: false,
    loading: false,
  },
  render: (args) => ({
    components: { QuickTaskCreateModal },
    setup() {
      const handleCancel = () => console.log('Cancelled')
      const handleCreate = (title: string, description: string) => {
        console.log('Creating task:', { title, description })
      }
      return { args, handleCancel, handleCreate }
    },
    template: `
      <div style="color: var(--text-secondary); text-align: center;">
        <p>Modal is closed. Toggle isOpen to open.</p>
        <QuickTaskCreateModal
          :is-open="args.isOpen"
          :loading="args.loading"
          @cancel="handleCancel"
          @create="handleCreate"
        />
      </div>
    `,
  }),
}
