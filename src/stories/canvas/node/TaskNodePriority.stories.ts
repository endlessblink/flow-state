import type { Meta, StoryObj } from '@storybook/vue3'
import TaskNodePriority from '@/components/canvas/node/TaskNodePriority.vue'

const meta: Meta<typeof TaskNodePriority> = {
  title: '🎨 Canvas/Node/TaskNodePriority',
  component: TaskNodePriority,
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered'
  }
}

export default meta
type Story = StoryObj<typeof TaskNodePriority>

export const High: Story = {
  render: () => ({
    components: { TaskNodePriority },
    template: `
      <div class="priority-high" style="width: 300px; height: 150px; position: relative; background: var(--surface-secondary); border-radius: var(--radius-xl); overflow: hidden;">
        <TaskNodePriority />
        <div style="padding: var(--space-4); padding-top: var(--space-6);">
          <h4 style="color: var(--text-primary); margin: 0;">High Priority Task</h4>
          <p style="color: var(--text-secondary); font-size: var(--text-sm); margin-top: var(--space-2);">
            Urgent task with high priority indicator
          </p>
        </div>
      </div>
    `
  })
}

export const Medium: Story = {
  render: () => ({
    components: { TaskNodePriority },
    template: `
      <div class="priority-medium" style="width: 300px; height: 150px; position: relative; background: var(--surface-secondary); border-radius: var(--radius-xl); overflow: hidden;">
        <TaskNodePriority />
        <div style="padding: var(--space-4); padding-top: var(--space-6);">
          <h4 style="color: var(--text-primary); margin: 0;">Medium Priority Task</h4>
          <p style="color: var(--text-secondary); font-size: var(--text-sm); margin-top: var(--space-2);">
            Standard task with medium priority indicator
          </p>
        </div>
      </div>
    `
  })
}

export const Low: Story = {
  render: () => ({
    components: { TaskNodePriority },
    template: `
      <div class="priority-low" style="width: 300px; height: 150px; position: relative; background: var(--surface-secondary); border-radius: var(--radius-xl); overflow: hidden;">
        <TaskNodePriority />
        <div style="padding: var(--space-4); padding-top: var(--space-6);">
          <h4 style="color: var(--text-primary); margin: 0;">Low Priority Task</h4>
          <p style="color: var(--text-secondary); font-size: var(--text-sm); margin-top: var(--space-2);">
            Task with low priority indicator
          </p>
        </div>
      </div>
    `
  })
}

export const TimerActive: Story = {
  render: () => ({
    components: { TaskNodePriority },
    template: `
      <div class="timer-active" style="width: 300px; height: 150px; position: relative; background: var(--surface-secondary); border-radius: var(--radius-xl); overflow: hidden;">
        <TaskNodePriority />
        <div style="padding: var(--space-4); padding-top: var(--space-6);">
          <h4 style="color: var(--text-primary); margin: 0;">Task with Active Timer</h4>
          <p style="color: var(--text-secondary); font-size: var(--text-sm); margin-top: var(--space-2);">
            Timer is running - priority indicator shows pulsing animation
          </p>
        </div>
      </div>
    `
  })
}

export const Comparison: Story = {
  render: () => ({
    components: { TaskNodePriority },
    template: `
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-4); padding: var(--space-4);">
        <div class="priority-high" style="position: relative; background: var(--surface-secondary); border-radius: var(--radius-xl); overflow: hidden; padding: var(--space-4); padding-top: var(--space-6);">
          <TaskNodePriority />
          <h4 style="color: var(--text-primary); margin: 0; font-size: var(--text-sm);">High</h4>
        </div>
        <div class="priority-medium" style="position: relative; background: var(--surface-secondary); border-radius: var(--radius-xl); overflow: hidden; padding: var(--space-4); padding-top: var(--space-6);">
          <TaskNodePriority />
          <h4 style="color: var(--text-primary); margin: 0; font-size: var(--text-sm);">Medium</h4>
        </div>
        <div class="priority-low" style="position: relative; background: var(--surface-secondary); border-radius: var(--radius-xl); overflow: hidden; padding: var(--space-4); padding-top: var(--space-6);">
          <TaskNodePriority />
          <h4 style="color: var(--text-primary); margin: 0; font-size: var(--text-sm);">Low</h4>
        </div>
        <div class="timer-active" style="position: relative; background: var(--surface-secondary); border-radius: var(--radius-xl); overflow: hidden; padding: var(--space-4); padding-top: var(--space-6);">
          <TaskNodePriority />
          <h4 style="color: var(--text-primary); margin: 0; font-size: var(--text-sm);">Timer Active</h4>
        </div>
      </div>
    `
  })
}
