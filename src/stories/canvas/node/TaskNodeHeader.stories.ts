import type { Meta, StoryObj } from '@storybook/vue3'
import TaskNodeHeader from '@/components/canvas/node/TaskNodeHeader.vue'

const meta: Meta<typeof TaskNodeHeader> = {
  title: '🎨 Canvas/Node/TaskNodeHeader',
  component: TaskNodeHeader,
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered'
  }
}

export default meta
type Story = StoryObj<typeof TaskNodeHeader>

export const Default: Story = {
  args: {
    title: 'Design homepage mockups',
    isTimerActive: false,
    alignmentClasses: 'text-left'
  },
  render: (args) => ({
    components: { TaskNodeHeader },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 400px; padding: var(--space-4); background: var(--surface-secondary); border-radius: var(--radius-lg); position: relative;">
        <TaskNodeHeader v-bind="args" />
      </div>
    `
  })
}

export const WithTimerActive: Story = {
  args: {
    title: 'Review pull requests',
    isTimerActive: true,
    alignmentClasses: 'text-left'
  },
  render: (args) => ({
    components: { TaskNodeHeader },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 400px; padding: var(--space-4); background: var(--surface-secondary); border-radius: var(--radius-lg); position: relative;">
        <TaskNodeHeader v-bind="args" />
      </div>
    `
  })
}

export const UntitledTask: Story = {
  args: {
    title: '',
    isTimerActive: false,
    alignmentClasses: 'text-left'
  },
  render: (args) => ({
    components: { TaskNodeHeader },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 400px; padding: var(--space-4); background: var(--surface-secondary); border-radius: var(--radius-lg); position: relative;">
        <TaskNodeHeader v-bind="args" />
      </div>
    `
  })
}

export const LongTitle: Story = {
  args: {
    title: 'This is a very long task title that should wrap to multiple lines and demonstrate how the component handles extended text content properly',
    isTimerActive: false,
    alignmentClasses: 'text-left'
  },
  render: (args) => ({
    components: { TaskNodeHeader },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 400px; padding: var(--space-4); background: var(--surface-secondary); border-radius: var(--radius-lg); position: relative;">
        <TaskNodeHeader v-bind="args" />
      </div>
    `
  })
}

export const RTLAlignment: Story = {
  args: {
    title: 'مهمة تصميم الواجهة الرئيسية',
    isTimerActive: false,
    alignmentClasses: 'text-right'
  },
  render: (args) => ({
    components: { TaskNodeHeader },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 400px; padding: var(--space-4); background: var(--surface-secondary); border-radius: var(--radius-lg); position: relative;">
        <TaskNodeHeader v-bind="args" />
      </div>
    `
  })
}
