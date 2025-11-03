import type { Meta, StoryObj } from '@storybook/vue3'
import ConfirmationModal from '@/components/ConfirmationModal.vue'

const meta = {
  component: ConfirmationModal,
  title: '🎭 Overlays/🪟 Modals/ConfirmationModal',
  tags: ['autodocs'],

  args: {
    isOpen: true,
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed with this action?',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'info',
    showIcon: true,
  },

  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ConfirmationModal>

export default meta
type Story = StoryObj<typeof meta>

// Default confirmation
export const Default: Story = {
  args: {
    isOpen: true,
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed with this action?',
    onConfirm: () => console.log('Confirmed'),
    onCancel: () => console.log('Cancelled'),
  },
}

// Delete confirmation (danger)
export const DeleteConfirmation: Story = {
  args: {
    isOpen: true,
    title: 'Delete Task',
    message: 'Are you sure you want to delete this task? This action cannot be undone.',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    variant: 'danger',
    showIcon: true,
    onConfirm: () => console.log('Task deleted'),
    onCancel: () => console.log('Delete cancelled'),
  },
}

// Save warning
export const SaveWarning: Story = {
  args: {
    isOpen: true,
    title: 'Unsaved Changes',
    message: 'You have unsaved changes. Do you want to save them before leaving?',
    confirmText: 'Save',
    cancelText: 'Don\'t Save',
    variant: 'warning',
    showIcon: true,
    onConfirm: () => console.log('Changes saved'),
    onCancel: () => console.log('Changes discarded'),
  },
}

// Navigation confirmation
export const NavigationWarning: Story = {
  args: {
    isOpen: true,
    title: 'Leave Page?',
    message: 'You may have unsaved changes. Are you sure you want to leave this page?',
    confirmText: 'Leave',
    cancelText: 'Stay',
    variant: 'warning',
    showIcon: true,
    onConfirm: () => console.log('Left page'),
    onCancel: () => console.log('Stayed on page'),
  },
}

// Bulk delete confirmation
export const BulkDelete: Story = {
  args: {
    isOpen: true,
    title: 'Delete Multiple Tasks',
    message: 'Are you sure you want to delete 5 selected tasks? This action cannot be undone.',
    confirmText: 'Delete All',
    cancelText: 'Cancel',
    variant: 'danger',
    showIcon: true,
    onConfirm: () => console.log('Bulk delete confirmed'),
    onCancel: () => console.log('Bulk delete cancelled'),
  },
}

// Project deletion
export const DeleteProject: Story = {
  args: {
    isOpen: true,
    title: 'Delete Project',
    message: 'Are you sure you want to delete the "My Tasks" project? All tasks in this project will be moved to the default project.',
    confirmText: 'Delete Project',
    cancelText: 'Cancel',
    variant: 'danger',
    showIcon: true,
    onConfirm: () => console.log('Project deleted'),
    onCancel: () => console.log('Project deletion cancelled'),
  },
}

// Archive confirmation
export const ArchiveConfirmation: Story = {
  args: {
    isOpen: true,
    title: 'Archive Completed Tasks',
    message: 'Archive all completed tasks in this project? They will be moved to the archive and can be restored later.',
    confirmText: 'Archive',
    cancelText: 'Cancel',
    variant: 'info',
    showIcon: true,
    onConfirm: () => console.log('Tasks archived'),
    onCancel: () => console.log('Archive cancelled'),
  },
}

// Sign out confirmation
export const SignOut: Story = {
  args: {
    isOpen: true,
    title: 'Sign Out',
    message: 'Are you sure you want to sign out of your account?',
    confirmText: 'Sign Out',
    cancelText: 'Cancel',
    variant: 'info',
    showIcon: true,
    onConfirm: () => console.log('Signed out'),
    onCancel: () => console.log('Sign out cancelled'),
  },
}

// Reset confirmation
export const ResetData: Story = {
  args: {
    isOpen: true,
    title: 'Reset All Data',
    message: 'Are you sure you want to reset all application data? This will permanently delete all your tasks, projects, and settings.',
    confirmText: 'Reset Everything',
    cancelText: 'Cancel',
    variant: 'danger',
    showIcon: true,
    onConfirm: () => console.log('Data reset'),
    onCancel: () => console.log('Reset cancelled'),
  },
}

// Success confirmation
export const SuccessMessage: Story = {
  args: {
    isOpen: true,
    title: 'Operation Complete',
    message: 'Your changes have been saved successfully!',
    confirmText: 'OK',
    cancelText: '',
    variant: 'success',
    showIcon: true,
    onConfirm: () => console.log('Success acknowledged'),
  },
}

// No icon variant
export const NoIcon: Story = {
  args: {
    isOpen: true,
    title: 'Simple Confirmation',
    message: 'Proceed with the action?',
    confirmText: 'Yes',
    cancelText: 'No',
    variant: 'info',
    showIcon: false,
    onConfirm: () => console.log('Confirmed without icon'),
    onCancel: () => console.log('Cancelled without icon'),
  },
}