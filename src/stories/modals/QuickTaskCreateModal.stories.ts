import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import QuickTaskCreateModal from '@/components/QuickTaskCreateModal.vue'

const meta = {
  component: QuickTaskCreateModal,
  title: '🪟 Modals & Dialogs/QuickTaskCreateModal',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
    docs: {
      story: {
        height: '500px',
      },
    },
  },

  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Whether the modal is open',
    },
    loading: {
      control: 'boolean',
      description: 'Whether the modal is in loading state',
    },
  },
} satisfies Meta<typeof QuickTaskCreateModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { QuickTaskCreateModal },
    setup() {
      const isOpen = ref(true)

      const handleCancel = () => {
        console.log('Modal cancelled')
        isOpen.value = false
      }

      const handleCreate = (title: string, description: string) => {
        console.log('Task created:', { title, description })
        isOpen.value = false
      }

      return {
        isOpen,
        handleCancel,
        handleCreate,
      }
    },
    template: `
      <div style="padding: 40px; min-height: 500px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Quick Task Create Modal</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">A lightweight modal for quickly creating new tasks</p>

        <button
          @click="isOpen = !isOpen"
          style="padding: 12px 24px; background: transparent; border: 1px solid var(--brand-primary); color: var(--brand-primary); border-radius: 8px; cursor: pointer;"
        >
          {{ isOpen ? 'Close Modal' : 'Open Modal' }}
        </button>

        <div style="margin-top: 24px; padding: 16px; background: var(--glass-bg-soft); border-radius: 8px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-primary);">Features:</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            <li>Auto-focus on title input when opened</li>
            <li>Press Enter to quickly create task</li>
            <li>Optional description field</li>
            <li>Character count display</li>
            <li>Hebrew text alignment support</li>
          </ul>
        </div>

        <QuickTaskCreateModal
          :is-open="isOpen"
          :loading="false"
          @cancel="handleCancel"
          @create="handleCreate"
        />
      </div>
    `,
  }),
}

export const Loading: Story = {
  render: () => ({
    components: { QuickTaskCreateModal },
    setup() {
      const isOpen = ref(true)

      const handleCancel = () => {
        console.log('Modal cancelled')
      }

      const handleCreate = (title: string, description: string) => {
        console.log('Task created:', { title, description })
      }

      return {
        isOpen,
        handleCancel,
        handleCreate,
      }
    },
    template: `
      <div style="padding: 40px; min-height: 500px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Quick Task Create Modal - Loading State</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Shows the modal in loading state (e.g., while task is being saved)</p>

        <div style="padding: 16px; background: var(--glass-bg-soft); border-radius: 8px; border: 1px solid var(--glass-border);">
          <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">
            The Create Task button shows a loading spinner and is disabled during the loading state.
          </p>
        </div>

        <QuickTaskCreateModal
          :is-open="isOpen"
          :loading="true"
          @cancel="handleCancel"
          @create="handleCreate"
        />
      </div>
    `,
  }),
}
