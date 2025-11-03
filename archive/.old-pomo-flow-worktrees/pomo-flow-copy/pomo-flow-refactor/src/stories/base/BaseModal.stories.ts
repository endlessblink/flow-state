import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import BaseModal from '@/components/base/BaseModal.vue'

const meta = {
  component: BaseModal,
  title: '🧩 Components/🔘 Base/BaseModal',
  tags: ['autodocs'],

  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof BaseModal>

export default meta
type Story = StoryObj<typeof meta>

// Basic Modals
export const Default: Story = {
  args: {
    isOpen: true,
    title: 'Modal Title',
    description: 'This is a default modal with basic content.',
    showFooter: true,
  },
  render: (args) => ({
    components: { BaseModal },
    setup() {
      return { args }
    },
    template: `
      <BaseModal v-bind="args">
        <p>This is the modal content. You can put any content here, including forms, text, or other components.</p>
      </BaseModal>
    `,
  })
}

export const Small: Story = {
  args: {
    isOpen: true,
    title: 'Small Modal',
    size: 'sm',
    description: 'A compact modal for simple interactions.',
    showFooter: true,
  },
  render: (args) => ({
    components: { BaseModal },
    setup() {
      return { args }
    },
    template: `
      <BaseModal v-bind="args">
        <p>This is a small modal with minimal content.</p>
      </BaseModal>
    `,
  })
}

export const Large: Story = {
  args: {
    isOpen: true,
    title: 'Large Modal',
    size: 'lg',
    description: 'A spacious modal for complex content.',
    showFooter: true,
  },
  render: (args) => ({
    components: { BaseModal },
    setup() {
      return { args }
    },
    template: `
      <BaseModal v-bind="args">
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <p>This is a large modal with plenty of space for complex content.</p>
          <div style="padding: 16px; background: var(--surface-tertiary); border-radius: 8px;">
            <h4 style="margin: 0 0 8px 0;">Content Section</h4>
            <p>You can organize content into sections within the modal.</p>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div style="padding: 12px; background: var(--surface-hover); border-radius: 6px;">
              <strong>Column 1</strong>
              <p style="margin: 4px 0 0 0; font-size: 14px;">Content here</p>
            </div>
            <div style="padding: 12px; background: var(--surface-hover); border-radius: 6px;">
              <strong>Column 2</strong>
              <p style="margin: 4px 0 0 0; font-size: 14px;">Content here</p>
            </div>
          </div>
        </div>
      </BaseModal>
    `,
  })
}

// Variant Examples
export const SuccessModal: Story = {
  args: {
    isOpen: true,
    title: 'Success!',
    description: 'Your changes have been saved successfully.',
    variant: 'success',
    size: 'sm',
    showFooter: true,
    confirmText: 'Great!',
    showCancelButton: false,
  },
  render: (args) => ({
    components: { BaseModal },
    setup() {
      return { args }
    },
    template: `
      <BaseModal v-bind="args">
        <div style="text-align: center; padding: 20px 0;">
          <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
          <p>The operation completed successfully.</p>
        </div>
      </BaseModal>
    `,
  })
}

export const WarningModal: Story = {
  args: {
    isOpen: true,
    title: 'Warning',
    description: 'This action cannot be undone. Are you sure you want to continue?',
    variant: 'warning',
    size: 'md',
    showFooter: true,
    confirmText: 'Yes, Continue',
    cancelText: 'Cancel',
  },
  render: (args) => ({
    components: { BaseModal },
    setup() {
      return { args }
    },
    template: `
      <BaseModal v-bind="args">
        <div style="display: flex; align-items: start; gap: 16px;">
          <div style="font-size: 24px;">⚠️</div>
          <div>
            <p>Please review the following before proceeding:</p>
            <ul style="margin: 12px 0; padding-left: 20px;">
              <li>This will permanently delete the selected items</li>
              <li>Associated data will also be removed</li>
              <li>This action cannot be reversed</li>
            </ul>
          </div>
        </div>
      </BaseModal>
    `,
  })
}

export const DangerModal: Story = {
  args: {
    isOpen: true,
    title: 'Delete Item',
    description: 'Are you sure you want to delete this item? This action cannot be undone.',
    variant: 'danger',
    size: 'md',
    showFooter: true,
    confirmText: 'Delete',
    cancelText: 'Cancel',
  },
  render: (args) => ({
    components: { BaseModal },
    setup() {
      return { args }
    },
    template: `
      <BaseModal v-bind="args">
        <div style="display: flex; align-items: start; gap: 16px;">
          <div style="font-size: 24px;">🗑️</div>
          <div>
            <p>You are about to delete <strong>"Project Documentation"</strong></p>
            <p style="margin-top: 12px; color: var(--text-muted);">This will remove all associated tasks and cannot be undone.</p>
          </div>
        </div>
      </BaseModal>
    `,
  })
}

// Modals without Header/Footer
export const NoHeader: Story = {
  args: {
    isOpen: true,
    size: 'md',
    showHeader: false,
    showFooter: false,
  },
  render: (args) => ({
    components: { BaseModal },
    setup() {
      return { args }
    },
    template: `
      <BaseModal v-bind="args">
        <div style="text-align: center; padding: 40px 20px;">
          <div style="font-size: 64px; margin-bottom: 20px;">🎉</div>
          <h3 style="margin: 0 0 12px 0;">Congratulations!</h3>
          <p style="margin: 0; color: var(--text-secondary);">You've completed all your tasks for today!</p>
        </div>
      </BaseModal>
    `,
  })
}

export const CustomFooter: Story = {
  args: {
    isOpen: true,
    title: 'Custom Actions',
    description: 'This modal has custom footer actions.',
    size: 'md',
    showFooter: true,
    showCancelButton: false,
    showConfirmButton: false,
  },
  render: (args) => ({
    components: { BaseModal },
    setup() {
      return { args }
    },
    template: `
      <BaseModal v-bind="args">
        <p>This modal demonstrates custom footer actions.</p>
        <template #footer>
          <div style="display: flex; gap: 8px; width: 100%;">
            <button style="flex: 1; padding: 8px 16px; background: var(--surface-hover); border: 1px solid var(--border-medium); border-radius: 6px; cursor: pointer;">
              Save Draft
            </button>
            <button style="flex: 1; padding: 8px 16px; background: var(--brand-primary); color: white; border: none; border-radius: 6px; cursor: pointer;">
              Publish
            </button>
            <button style="flex: 1; padding: 8px 16px; background: var(--color-navigation); color: white; border: none; border-radius: 6px; cursor: pointer;">
              Schedule
            </button>
          </div>
        </template>
      </BaseModal>
    `,
  })
}

// Loading and States
export const LoadingModal: Story = {
  args: {
    isOpen: true,
    title: 'Processing...',
    description: 'Please wait while we process your request.',
    size: 'sm',
    showFooter: true,
    loading: true,
    confirmText: 'Processing',
    confirmDisabled: true,
    showCancelButton: false,
  },
  render: (args) => ({
    components: { BaseModal },
    setup() {
      return { args }
    },
    template: `
      <BaseModal v-bind="args">
        <div style="text-align: center; padding: 20px 0;">
          <div style="width: 40px; height: 40px; border: 4px solid var(--border-medium); border-top-color: var(--brand-primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;"></div>
          <p>This may take a few moments...</p>
        </div>
      </BaseModal>
    `,
  })
}

// Form Modal
export const FormModal: Story = {
  args: {
    isOpen: true,
    title: 'Create New Task',
    description: 'Fill in the details below to create a new task.',
    size: 'lg',
    showFooter: true,
    confirmText: 'Create Task',
    cancelText: 'Cancel',
  },
  render: (args) => ({
    components: { BaseModal },
    setup() {
      return { args }
    },
    template: `
      <BaseModal v-bind="args">
        <form style="display: flex; flex-direction: column; gap: 20px;">
          <div>
            <label style="display: block; margin-bottom: 6px; font-weight: 500; color: var(--text-secondary); font-size: 14px;">Task Title *</label>
            <input type="text" placeholder="Enter task title..." style="width: 100%; padding: 10px 12px; border: 1px solid var(--border-medium); border-radius: 6px; font-size: 14px;" />
          </div>

          <div>
            <label style="display: block; margin-bottom: 6px; font-weight: 500; color: var(--text-secondary); font-size: 14px;">Description</label>
            <textarea placeholder="Add task details..." rows="4" style="width: 100%; padding: 10px 12px; border: 1px solid var(--border-medium); border-radius: 6px; font-size: 14px; resize: vertical;"></textarea>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div>
              <label style="display: block; margin-bottom: 6px; font-weight: 500; color: var(--text-secondary); font-size: 14px;">Priority</label>
              <select style="width: 100%; padding: 10px 12px; border: 1px solid var(--border-medium); border-radius: 6px; font-size: 14px;">
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </div>

            <div>
              <label style="display: block; margin-bottom: 6px; font-weight: 500; color: var(--text-secondary); font-size: 14px;">Due Date</label>
              <input type="date" style="width: 100%; padding: 10px 12px; border: 1px solid var(--border-medium); border-radius: 6px; font-size: 14px;" />
            </div>
          </div>

          <div>
            <label style="display: block; margin-bottom: 6px; font-weight: 500; color: var(--text-secondary); font-size: 14px;">Project</label>
            <select style="width: 100%; padding: 10px 12px; border: 1px solid var(--border-medium); border-radius: 6px; font-size: 14px;">
              <option>Personal Tasks</option>
              <option>Work Projects</option>
              <option>Learning</option>
            </select>
          </div>
        </form>
      </BaseModal>
    `,
  })
}

// Interactive Demo
export const InteractiveDemo: Story = {
  render: () => ({
    components: { BaseModal },
    setup() {
      const isModalOpen = ref(false)
      const modalVariant = ref('default')
      const modalSize = ref('md')
      const isLoading = ref(false)

      const openModal = (variant = 'default', size = 'md') => {
        modalVariant.value = variant
        modalSize.value = size
        isModalOpen.value = true
      }

      const closeModal = () => {
        isModalOpen.value = false
        isLoading.value = false
      }

      const handleConfirm = () => {
        isLoading.value = true
        setTimeout(() => {
          closeModal()
        }, 2000)
      }

      return {
        isModalOpen,
        modalVariant,
        modalSize,
        isLoading,
        openModal,
        closeModal,
        handleConfirm
      }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary);">
        <h2 style="margin: 0 0 24px 0;">BaseModal Interactive Demo</h2>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
          <div>
            <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">Sizes</h4>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <button @click="openModal('default', 'sm')" style="padding: 8px 16px; background: var(--surface-hover); border: 1px solid var(--border-medium); border-radius: 6px; cursor: pointer;">Small Modal</button>
              <button @click="openModal('default', 'md')" style="padding: 8px 16px; background: var(--surface-hover); border: 1px solid var(--border-medium); border-radius: 6px; cursor: pointer;">Medium Modal</button>
              <button @click="openModal('default', 'lg')" style="padding: 8px 16px; background: var(--surface-hover); border: 1px solid var(--border-medium); border-radius: 6px; cursor: pointer;">Large Modal</button>
            </div>
          </div>

          <div>
            <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">Variants</h4>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <button @click="openModal('success', 'sm')" style="padding: 8px 16px; background: var(--surface-hover); border: 1px solid var(--border-medium); border-radius: 6px; cursor: pointer;">Success</button>
              <button @click="openModal('warning', 'md')" style="padding: 8px 16px; background: var(--surface-hover); border: 1px solid var(--border-medium); border-radius: 6px; cursor: pointer;">Warning</button>
              <button @click="openModal('danger', 'md')" style="padding: 8px 16px; background: var(--surface-hover); border: 1px solid var(--border-medium); border-radius: 6px; cursor: pointer;">Danger</button>
            </div>
          </div>

          <div>
            <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">Special</h4>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <button @click="openModal('default', 'lg')" style="padding: 8px 16px; background: var(--surface-hover); border: 1px solid var(--border-medium); border-radius: 6px; cursor: pointer;">Form Modal</button>
              <button @click="openModal('default', 'sm')" style="padding: 8px 16px; background: var(--surface-hover); border: 1px solid var(--border-medium); border-radius: 6px; cursor: pointer;">Loading Demo</button>
            </div>
          </div>
        </div>

        <div style="padding: 16px; background: var(--surface-tertiary); border-radius: 8px;">
          <p style="margin: 0; font-size: 14px; color: var(--text-muted);">
            <strong>Current State:</strong> Modal is {{ isModalOpen ? 'open' : 'closed' }}
            {{ isModalOpen ? '(' + modalVariant + ' variant, ' + modalSize + ' size)' : '' }}
          </p>
        </div>

        <BaseModal
          :is-open="isModalOpen"
          :title="modalVariant === 'success' ? 'Success!' : modalVariant === 'warning' ? 'Warning' : modalVariant === 'danger' ? 'Confirm Delete' : 'Demo Modal'"
          :description="modalVariant === 'success' ? 'Operation completed successfully!' : modalVariant === 'warning' ? 'Please review before continuing' : modalVariant === 'danger' ? 'This action cannot be undone.' : 'This is a demonstration modal.'"
          :variant="modalVariant"
          :size="modalSize"
          :loading="isLoading"
          @confirm="handleConfirm"
          @close="closeModal"
          @cancel="closeModal"
        >
          <div v-if="modalVariant === 'default' && modalSize === 'lg'" style="display: flex; flex-direction: column; gap: 16px;">
            <p>This is a form modal demonstration.</p>
            <input type="text" placeholder="Sample input field..." style="width: 100%; padding: 10px 12px; border: 1px solid var(--border-medium); border-radius: 6px;">
            <textarea placeholder="Sample textarea..." rows="3" style="width: 100%; padding: 10px 12px; border: 1px solid var(--border-medium); border-radius: 6px; resize: vertical;"></textarea>
          </div>
          <div v-else-if="modalVariant === 'default' && modalSize === 'sm'" style="text-align: center;">
            <p>This will demonstrate the loading state when you click Confirm.</p>
          </div>
          <div v-else>
            <p>{{ modalVariant === 'success' ? 'Your action was completed successfully!' : modalVariant === 'warning' ? 'Please make sure you understand the consequences.' : 'Are you absolutely sure you want to proceed?' }}</p>
          </div>
        </BaseModal>
      </div>
    `,
  })
}