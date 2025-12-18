import type { Meta, StoryObj } from '@storybook/vue3'
import BaseModal from './BaseModal.vue'

const meta = {
  title: 'Overlays/Modals/BaseModal',
  component: BaseModal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Base modal component with glass morphism styling, accessibility features, and multiple size/variant options.'
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
    description: {
      control: 'text',
      description: 'Modal description text'
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl', 'full'],
      description: 'Modal size variant'
    },
    variant: {
      control: 'select',
      options: ['default', 'danger', 'warning', 'success'],
      description: 'Modal style variant'
    },
    closeOnOverlayClick: {
      control: 'boolean',
      description: 'Close modal when clicking overlay'
    },
    closeOnEscape: {
      control: 'boolean',
      description: 'Close modal on escape key'
    },
    showHeader: {
      control: 'boolean',
      description: 'Show modal header'
    },
    showFooter: {
      control: 'boolean',
      description: 'Show modal footer'
    },
    showCloseButton: {
      control: 'boolean',
      description: 'Show close button in header'
    },
    showCancelButton: {
      control: 'boolean',
      description: 'Show cancel button'
    },
    showConfirmButton: {
      control: 'boolean',
      description: 'Show confirm button'
    },
    loading: {
      control: 'boolean',
      description: 'Loading state for confirm button'
    },
    confirmDisabled: {
      control: 'boolean',
      description: 'Disable confirm button'
    }
  },
  args: {
    isOpen: true,
    title: 'Modal Title',
    description: 'This is a modal description that provides context for the modal content.',
    size: 'md',
    variant: 'default',
    closeOnOverlayClick: true,
    closeOnEscape: true,
    showHeader: true,
    showFooter: true,
    showCloseButton: true,
    showCancelButton: true,
    showConfirmButton: true,
    loading: false,
    confirmDisabled: false,
    cancelText: 'Cancel',
    confirmText: 'Confirm',
    emptyMessage: '',
    fallbackComponent: '',
    fallbackMessage: '',
    fallbackProps: () => ({}),
    componentProps: () => ({}),
    errorMessage: '',
    errorTitle: '',
    progress: 0,
    message: ''
  }
} satisfies Meta<typeof BaseModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    isOpen: true,
    title: 'Sample Modal',
    description: 'This is a default modal with standard styling and functionality.'
  },
  render: (args) => ({
    components: { BaseModal },
    setup() {
      return { args }
    },
    template: `
      <BaseModal v-bind="args" @close="action('close')" @cancel="action('cancel')" @confirm="action('confirm')">
        <div style="padding: 20px;">
          <p>This is the modal content area where you can place any content you need.</p>
          <p>The modal supports glass morphism styling and proper z-index management.</p>
        </div>
      </BaseModal>
    `
  })
}

export const Small: Story = {
  args: {
    isOpen: true,
    size: 'sm',
    title: 'Small Modal',
    description: 'A compact modal for simple interactions.'
  }
}

export const Large: Story = {
  args: {
    isOpen: true,
    size: 'lg',
    title: 'Large Modal',
    description: 'A spacious modal for complex content and forms.'
  }
}

export const Danger: Story = {
  args: {
    isOpen: true,
    variant: 'danger',
    title: 'Confirm Deletion',
    description: 'Are you sure you want to delete this item? This action cannot be undone.',
    confirmText: 'Delete',
    cancelText: 'Cancel'
  }
}

export const Warning: Story = {
  args: {
    isOpen: true,
    variant: 'warning',
    title: 'Warning',
    description: 'Please review this information carefully before proceeding.',
    confirmText: 'Continue',
    cancelText: 'Go Back'
  }
}

export const Success: Story = {
  args: {
    isOpen: true,
    variant: 'success',
    title: 'Success!',
    description: 'Your changes have been saved successfully.',
    showCancelButton: false,
    confirmText: 'Done'
  }
}

export const NoFooter: Story = {
  args: {
    isOpen: true,
    showFooter: false,
    title: 'Simple Modal',
    description: 'This modal has no footer, only a close button.'
  }
}

export const Loading: Story = {
  args: {
    isOpen: true,
    loading: true,
    title: 'Processing',
    description: 'Please wait while we process your request...',
    confirmDisabled: true
  }
}

export const CustomContent: Story = {
  args: {
    isOpen: true,
    title: 'Custom Modal Content',
    showFooter: false
  },
  render: (args) => ({
    components: { BaseModal },
    setup() {
      return { args }
    },
    template: `
      <BaseModal v-bind="args" @close="action('close')">
        <div style="padding: 20px;">
          <h3 style="margin: 0 0 16px 0; color: #60a5fa;">Custom Form Example</h3>
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">Name:</label>
            <input
              type="text"
              style="width: 100%; padding: 8px; border: 1px solid #374151; border-radius: 6px; background: rgba(17, 24, 39, 0.5); color: #f9fafb;"
              placeholder="Enter your name"
            />
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">Email:</label>
            <input
              type="email"
              style="width: 100%; padding: 8px; border: 1px solid #374151; border-radius: 6px; background: rgba(17, 24, 39, 0.5); color: #f9fafb;"
              placeholder="Enter your email"
            />
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">Message:</label>
            <textarea
              style="width: 100%; padding: 8px; border: 1px solid #374151; border-radius: 6px; background: rgba(17, 24, 39, 0.5); color: #f9fafb; min-height: 100px; resize: vertical;"
              placeholder="Enter your message"
            ></textarea>
          </div>
        </div>
      </BaseModal>
    `
  })
}