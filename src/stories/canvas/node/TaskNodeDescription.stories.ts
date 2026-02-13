import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import TaskNodeDescription from '@/components/canvas/node/TaskNodeDescription.vue'

const meta: Meta<typeof TaskNodeDescription> = {
  title: '🎨 Canvas/Node/TaskNodeDescription',
  component: TaskNodeDescription,
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered'
  }
}

export default meta
type Story = StoryObj<typeof TaskNodeDescription>

export const ShortDescription: Story = {
  args: {
    description: 'This is a short task description.',
    isExpanded: false,
    isLong: false,
    alignmentClasses: 'text-left'
  },
  render: (args) => ({
    components: { TaskNodeDescription },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 400px; padding: var(--space-4); background: var(--surface-secondary); border-radius: var(--radius-lg);">
        <TaskNodeDescription v-bind="args" />
      </div>
    `
  })
}

export const LongDescriptionCollapsed: Story = {
  args: {
    description: 'This is a very long task description that contains multiple sentences and paragraphs. It should show a "Show more" button when collapsed. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    isExpanded: false,
    isLong: true,
    alignmentClasses: 'text-left'
  },
  render: (args) => ({
    components: { TaskNodeDescription },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 400px; padding: var(--space-4); background: var(--surface-secondary); border-radius: var(--radius-lg);">
        <TaskNodeDescription v-bind="args" />
      </div>
    `
  })
}

export const LongDescriptionExpanded: Story = {
  args: {
    description: 'This is a very long task description that contains multiple sentences and paragraphs. It should show a "Show less" button when expanded. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    isExpanded: true,
    isLong: true,
    alignmentClasses: 'text-left'
  },
  render: (args) => ({
    components: { TaskNodeDescription },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 400px; padding: var(--space-4); background: var(--surface-secondary); border-radius: var(--radius-lg);">
        <TaskNodeDescription v-bind="args" />
      </div>
    `
  })
}

export const WithMarkdown: Story = {
  args: {
    description: '# Heading\n\nThis is **bold** and this is *italic*.\n\n- Item 1\n- Item 2\n- Item 3',
    isExpanded: false,
    isLong: false,
    alignmentClasses: 'text-left'
  },
  render: (args) => ({
    components: { TaskNodeDescription },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 400px; padding: var(--space-4); background: var(--surface-secondary); border-radius: var(--radius-lg);">
        <TaskNodeDescription v-bind="args" />
      </div>
    `
  })
}

export const Interactive: Story = {
  render: () => ({
    components: { TaskNodeDescription },
    setup() {
      const isExpanded = ref(false)
      const description = 'This is a very long task description that contains multiple sentences and paragraphs. Click the toggle button to expand or collapse. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.'

      const handleToggleExpand = () => {
        isExpanded.value = !isExpanded.value
      }

      return { description, isExpanded, handleToggleExpand }
    },
    template: `
      <div style="width: 400px; padding: var(--space-4); background: var(--surface-secondary); border-radius: var(--radius-lg);">
        <TaskNodeDescription
          :description="description"
          :is-expanded="isExpanded"
          :is-long="true"
          alignment-classes="text-left"
          @toggle-expand="handleToggleExpand"
        />
      </div>
    `
  })
}
