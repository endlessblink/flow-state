import type { Meta, StoryObj } from '@storybook/vue3'
import CanvasEmptyState from '@/components/canvas/CanvasEmptyState.vue'

const meta: Meta<typeof CanvasEmptyState> = {
  title: '🎨 Canvas/CanvasEmptyState',
  component: CanvasEmptyState,
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark'
    }
  }
}

export default meta
type Story = StoryObj<typeof CanvasEmptyState>

export const Default: Story = {}

export const Interactive: Story = {
  render: (args) => ({
    components: { CanvasEmptyState },
    setup() {
      const handleAddTask = () => console.log('Add task clicked')
      const handleCreateGroup = () => console.log('Create group clicked')
      return { args, handleAddTask, handleCreateGroup }
    },
    template: `
      <div style="width: 600px; height: 400px; position: relative; background: var(--surface-primary); border-radius: var(--radius-lg);">
        <CanvasEmptyState v-bind="args" @add-task="handleAddTask" @create-group="handleCreateGroup" />
      </div>
    `
  })
}
