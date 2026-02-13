import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import CanvasToolbar from '@/components/canvas/CanvasToolbar.vue'

const meta: Meta<typeof CanvasToolbar> = {
  title: '🎨 Canvas/CanvasToolbar',
  component: CanvasToolbar,
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'fullscreen'
  }
}

export default meta
type Story = StoryObj<typeof CanvasToolbar>

export const Default: Story = {
  render: () => ({
    components: { CanvasToolbar },
    setup() {
      const handleAddTask = () => console.log('Add task clicked')
      const handleCreateGroup = (event: MouseEvent) => console.log('Create group clicked', event)
      return { handleAddTask, handleCreateGroup }
    },
    template: `
      <div style="min-height: 100vh; background: var(--surface-primary);">
        <CanvasToolbar @add-task="handleAddTask" @create-group="handleCreateGroup" />
      </div>
    `
  })
}

export const Interactive: Story = {
  render: () => ({
    components: { CanvasToolbar },
    setup() {
      const logs = ref<string[]>([])
      const handleAddTask = () => {
        logs.value.push('Add task clicked')
      }
      const handleCreateGroup = (event: MouseEvent) => {
        logs.value.push(`Create group clicked at (${event.clientX}, ${event.clientY})`)
      }
      return { logs, handleAddTask, handleCreateGroup }
    },
    template: `
      <div style="min-height: 100vh; background: var(--surface-primary); padding: var(--space-4);">
        <CanvasToolbar @add-task="handleAddTask" @create-group="handleCreateGroup" />
        <div style="margin-top: var(--space-20); padding: var(--space-4); background: var(--surface-secondary); border-radius: var(--radius-lg);">
          <h3 style="color: var(--text-primary); margin: 0 0 var(--space-2) 0;">Event Log</h3>
          <div v-for="(log, i) in logs" :key="i" style="color: var(--text-secondary); font-size: var(--text-sm); padding: var(--space-1) 0;">
            {{ log }}
          </div>
        </div>
      </div>
    `
  })
}
