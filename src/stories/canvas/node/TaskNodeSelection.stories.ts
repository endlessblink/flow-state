import type { Meta, StoryObj } from '@storybook/vue3'
import TaskNodeSelection from '@/components/canvas/node/TaskNodeSelection.vue'

const meta: Meta<typeof TaskNodeSelection> = {
  title: '🎨 Canvas/Node/TaskNodeSelection',
  component: TaskNodeSelection,
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered'
  },
  decorators: [
    () => ({
      template: `
        <div style="padding: var(--space-8);">
          <p style="color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-4);">
            Note: This component is a visual placeholder. Selection is now handled via CSS border/glow on the .selected class (TASK-296).
          </p>
          <story />
        </div>
      `
    })
  ]
}

export default meta
type Story = StoryObj<typeof TaskNodeSelection>

export const Default: Story = {
  render: () => ({
    components: { TaskNodeSelection },
    template: `
      <div style="width: 300px; height: 150px; position: relative; background: var(--surface-secondary); border-radius: var(--radius-lg); padding: var(--space-4);">
        <TaskNodeSelection />
        <div>
          <h4 style="color: var(--text-primary); margin: 0;">Task Card</h4>
          <p style="color: var(--text-secondary); font-size: var(--text-sm); margin-top: var(--space-2);">
            Selection is shown via CSS border/glow
          </p>
        </div>
      </div>
    `
  })
}

export const ComponentInfo: Story = {
  render: () => ({
    components: { TaskNodeSelection },
    template: `
      <div style="max-width: 500px;">
        <h3 style="color: var(--text-primary); margin-bottom: var(--space-3);">TaskNodeSelection Component</h3>
        <TaskNodeSelection />
        <div style="background: var(--surface-tertiary); padding: var(--space-4); border-radius: var(--radius-lg); margin-top: var(--space-4);">
          <p style="color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.6; margin: 0;">
            This component was simplified in TASK-296. Selection corners were removed and selection is now indicated purely through CSS styling (border and glow effects) applied to the .selected class on the task node.
          </p>
          <p style="color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.6; margin-top: var(--space-2);">
            The component itself renders nothing visible - it exists as a placeholder in the component tree but has display: none in its styles.
          </p>
        </div>
      </div>
    `
  })
}
