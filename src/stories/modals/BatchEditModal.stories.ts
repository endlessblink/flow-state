import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import BatchEditModal from '@/components/BatchEditModal.vue'

const meta = {
  component: BatchEditModal,
  title: '🪟 Modals & Dialogs/BatchEditModal',
  tags: ['autodocs'],

  parameters: {
    layout: 'fullscreen',
    docs: {
      story: {
        height: '700px',
      },
    },
  },

  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Whether the modal is open',
    },
  },

  decorators: [
    () => ({
      template: '<div style="min-height: 100vh; background: #0a0a0f;"><story /></div>',
    }),
  ],
} satisfies Meta<typeof BatchEditModal>

export default meta
type Story = StoryObj<typeof meta>

// Basic batch edit modal
export const Default: Story = {
  render: () => ({
    components: { BatchEditModal },
    setup() {
      const isOpen = ref(true)
      const taskIds = ref(['1', '2', '3'])
      const handleClose = () => { isOpen.value = false }
      const handleApplied = () => { isOpen.value = false }
      return { isOpen, taskIds, handleClose, handleApplied }
    },
    template: `
      <BatchEditModal
        :is-open="isOpen"
        :task-ids="taskIds"
        @close="handleClose"
        @applied="handleApplied"
      />
    `,
  }),
}

// With many tasks selected
export const ManyTasks: Story = {
  render: () => ({
    components: { BatchEditModal },
    setup() {
      const isOpen = ref(true)
      const taskIds = ref(Array.from({ length: 10 }, (_, i) => String(i + 1)))
      const handleClose = () => { isOpen.value = false }
      const handleApplied = () => { isOpen.value = false }
      return { isOpen, taskIds, handleClose, handleApplied }
    },
    template: `
      <BatchEditModal
        :is-open="isOpen"
        :task-ids="taskIds"
        @close="handleClose"
        @applied="handleApplied"
      />
    `,
  }),
}
