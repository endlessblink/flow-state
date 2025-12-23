import type { Meta, StoryObj } from '@storybook/vue3'
import ConfirmationModal from './ConfirmationModal.vue'

const meta = {
  title: '🪟 Modals & Dialogs/ConfirmationModal',
  component: ConfirmationModal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Confirmation modal with danger variant styling, warning icon, and customizable details list.'
      }
    }
  },
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Whether the modal is open'
    },
    title: {
      control: 'text',
      description: 'Modal title'
    },
    message: {
      control: 'text',
      description: 'Confirmation message'
    },
    details: {
      control: 'object',
      description: 'List of items that will be affected'
    },
    confirmText: {
      control: 'text',
      description: 'Text for confirm button'
    }
  },
  args: {
    isOpen: true,
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
    details: [],
    confirmText: 'Confirm'
  }
} satisfies Meta<typeof ConfirmationModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    isOpen: true,
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed with this action?'
  },
  render: (args) => ({
    components: { ConfirmationModal },
    setup() {
      return { args }
    },
    template: `
      <ConfirmationModal
        v-bind="args"
        @confirm="action('confirm')"
        @cancel="action('cancel')"
      />
    `
  })
}

export const DeleteTask: Story = {
  args: {
    isOpen: true,
    title: 'Delete Task',
    message: 'Are you sure you want to delete this task?',
    confirmText: 'Delete Task'
  }
}

export const DeleteMultiple: Story = {
  args: {
    isOpen: true,
    title: 'Delete Multiple Tasks',
    message: 'Are you sure you want to delete these tasks?',
    details: [
      'Complete project documentation',
      'Review pull requests',
      'Update team meeting notes',
      'Fix critical bug in production'
    ],
    confirmText: 'Delete All Tasks'
  }
}

export const DeleteProject: Story = {
  args: {
    isOpen: true,
    title: 'Delete Project',
    message: 'Are you sure you want to delete this project and all its tasks?',
    details: [
      'All tasks within this project will be permanently deleted',
      'Project settings and metadata will be removed',
      'This action cannot be undone'
    ],
    confirmText: 'Delete Project'
  }
}

export const ClearCompleted: Story = {
  args: {
    isOpen: true,
    title: 'Clear Completed Tasks',
    message: 'Are you sure you want to clear all completed tasks?',
    details: [
      'Website Redesign',
      'Database Migration',
      'API Documentation',
      'Testing Framework Setup'
    ],
    confirmText: 'Clear All'
  }
}

export const SignOut: Story = {
  args: {
    isOpen: true,
    title: 'Sign Out',
    message: 'Are you sure you want to sign out of your account?',
    confirmText: 'Sign Out'
  }
}
