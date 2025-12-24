import type { Meta, StoryObj } from '@storybook/vue3'
import ProjectModal from '@/components/projects/ProjectModal.vue'
import type { Project } from '@/stores/tasks'

const meta = {
  component: ProjectModal,
  title: '🪟 Modals & Dialogs/ProjectModal',
  tags: ['autodocs'],

  parameters: {
    layout: 'fullscreen',
    docs: {
      story: {
        height: '600px',
      },
    },
  },

  decorators: [
    (story: any) => ({
      components: { story },
      template: '<div style="min-height: 100vh; background: var(--app-background-gradient);"><story /></div>',
    }),
  ],
} satisfies Meta<typeof ProjectModal>

export default meta
type Story = StoryObj<typeof meta>

// Example project for stories
const exampleProject: Project = {
  id: 'example-project-1',
  name: 'Work Tasks',
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
    project: exampleProject,
  },
}

export const EditWithEmoji: Story = {
  args: {
    isOpen: true,
    project: {
      ...exampleProject,
      name: 'Personal Goals',
      colorType: 'emoji',
      emoji: '🎯',
      color: '🎯',
    },
  },
}
