import type { Meta, StoryObj } from '@storybook/vue3'
import QuickTaskCreateModal from '@/components/QuickTaskCreateModal.vue'

const meta = {
  component: QuickTaskCreateModal,
  title: '🧩 Components/🔧 UI/QuickTaskCreateModal',
  tags: ['autodocs'],

  args: {
    isOpen: true,
    loading: false,
  },

  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof QuickTaskCreateModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    isOpen: true,
    loading: false,
  },
}

export const Loading: Story = {
  args: {
    isOpen: true,
    loading: true,
  },
}
