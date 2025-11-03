import type { Meta, StoryObj } from '@storybook/vue3'
import ProjectModal from '@/components/ProjectModal.vue'
import type { Project } from '@/stores/tasks'

const meta = {
  component: ProjectModal,
  title: '🎭 Overlays/🪟 Modals/ProjectModal',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ProjectModal>

export default meta
type Story = StoryObj<typeof meta>

// Real production project example - matches the default project from the store
const realProject: Project = {
  id: '1',
  name: 'My Tasks',
  color: '#3b82f6',
  colorType: 'hex',
  viewType: 'status',
  parentId: null,
  createdAt: new Date(),
}

export const Create: Story = {
  args: {
    isOpen: true,
    project: null,
  },
}

export const Edit: Story = {
  args: {
    isOpen: true,
    project: realProject,
  },
}

export const EditWithEmoji: Story = {
  args: {
    isOpen: true,
    project: {
      ...realProject,
      name: 'Personal Goals',
      colorType: 'emoji',
      emoji: '🎯',
      color: '🎯',
    },
  },
}
