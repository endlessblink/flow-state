import type { Meta, StoryObj } from '@storybook/vue3'
import ConfirmationModal from '@/components/common/ConfirmationModal.vue'

const meta: Meta<typeof ConfirmationModal> = {
  title: '🎯 Modals/ConfirmationModal',
  component: ConfirmationModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#0f172a' }],
    },
    docs: {
      description: {
        component: 'ConfirmationModal displays a confirmation dialog for destructive or important actions. Supports custom title, message, details list, and confirm button text.',
      },
    },
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="min-height: 500px; width: 100%; display: flex; align-items: center; justify-content: center; background: var(--app-background-gradient); border-radius: var(--radius-xl);">
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
    title: {
      description: 'Modal title',
      control: { type: 'text' },
    },
    message: {
      description: 'Confirmation message',
      control: { type: 'text' },
    },
    details: {
      description: 'List of detail items to display',
      control: { type: 'object' },
    },
    confirmText: {
      description: 'Confirm button text',
      control: { type: 'text' },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Default Confirmation',
  args: {
    isOpen: true,
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
  },
  render: (args) => ({
    components: { ConfirmationModal },
    setup() {
      const handleConfirm = () => console.log('Confirmed!')
      const handleCancel = () => console.log('Cancelled')
      return { args, handleConfirm, handleCancel }
    },
    template: `
      <ConfirmationModal
        :is-open="args.isOpen"
        :title="args.title"
        :message="args.message"
        :details="args.details"
        :confirm-text="args.confirmText"
        @confirm="handleConfirm"
        @cancel="handleCancel"
      />
    `,
  }),
}

export const DeleteConfirmation: Story = {
  name: 'Delete Confirmation',
  args: {
    isOpen: true,
    title: 'Delete Project',
    message: 'This action cannot be undone. Are you sure you want to delete this project?',
    confirmText: 'Delete',
  },
  render: (args) => ({
    components: { ConfirmationModal },
    setup() {
      const handleConfirm = () => console.log('Deleted!')
      const handleCancel = () => console.log('Cancelled')
      return { args, handleConfirm, handleCancel }
    },
    template: `
      <ConfirmationModal
        :is-open="args.isOpen"
        :title="args.title"
        :message="args.message"
        :confirm-text="args.confirmText"
        @confirm="handleConfirm"
        @cancel="handleCancel"
      />
    `,
  }),
}

export const WithDetails: Story = {
  name: 'With Details List',
  args: {
    isOpen: true,
    title: 'Delete Multiple Tasks',
    message: 'The following tasks will be permanently deleted:',
    details: ['Task 1: Design homepage', 'Task 2: Implement API', 'Task 3: Write tests'],
    confirmText: 'Delete All',
  },
  render: (args) => ({
    components: { ConfirmationModal },
    setup() {
      const handleConfirm = () => console.log('Deleted all!')
      const handleCancel = () => console.log('Cancelled')
      return { args, handleConfirm, handleCancel }
    },
    template: `
      <ConfirmationModal
        :is-open="args.isOpen"
        :title="args.title"
        :message="args.message"
        :details="args.details"
        :confirm-text="args.confirmText"
        @confirm="handleConfirm"
        @cancel="handleCancel"
      />
    `,
  }),
}

export const Closed: Story = {
  name: 'Closed State',
  args: {
    isOpen: false,
    title: 'Confirm',
    message: 'This modal is closed',
  },
  render: (args) => ({
    components: { ConfirmationModal },
    setup() {
      const handleConfirm = () => console.log('Confirmed!')
      const handleCancel = () => console.log('Cancelled')
      return { args, handleConfirm, handleCancel }
    },
    template: `
      <div style="color: var(--text-secondary); text-align: center;">
        <p>Modal is closed. Toggle isOpen to open.</p>
        <ConfirmationModal
          :is-open="args.isOpen"
          :title="args.title"
          :message="args.message"
          @confirm="handleConfirm"
          @cancel="handleCancel"
        />
      </div>
    `,
  }),
}
