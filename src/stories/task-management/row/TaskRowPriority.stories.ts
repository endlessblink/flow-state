import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import TaskRowPriority from '@/components/tasks/row/TaskRowPriority.vue'

const meta = {
  title: '📝 Task Management/Row/TaskRowPriority',
  component: TaskRowPriority,
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    priority: {
      control: 'select',
      options: ['low', 'medium', 'high', null]
    }
  }
} satisfies Meta<typeof TaskRowPriority>

export default meta
type Story = StoryObj<typeof meta>

export const Low: Story = {
  args: {
    priority: 'low'
  },
  render: (args) => ({
    components: { TaskRowPriority },
    setup() {
      const priority = ref(args.priority)
      return { priority }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
      ">
        <TaskRowPriority
          :priority="priority"
          @update:priority="priority = $event"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Shows green styling for low priority
        </div>
      </div>
    `
  })
}

export const Medium: Story = {
  args: {
    priority: 'medium'
  },
  render: (args) => ({
    components: { TaskRowPriority },
    setup() {
      const priority = ref(args.priority)
      return { priority }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
      ">
        <TaskRowPriority
          :priority="priority"
          @update:priority="priority = $event"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Shows muted styling for medium priority (ADHD-friendly)
        </div>
      </div>
    `
  })
}

export const High: Story = {
  args: {
    priority: 'high'
  },
  render: (args) => ({
    components: { TaskRowPriority },
    setup() {
      const priority = ref(args.priority)
      return { priority }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
      ">
        <TaskRowPriority
          :priority="priority"
          @update:priority="priority = $event"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Shows red/orange styling for high priority
        </div>
      </div>
    `
  })
}

export const NoPriority: Story = {
  args: {
    priority: null
  },
  render: (args) => ({
    components: { TaskRowPriority },
    setup() {
      const priority = ref(args.priority)
      return { priority }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
      ">
        <TaskRowPriority
          :priority="priority"
          @update:priority="priority = $event"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          No priority badge shown - click to select
        </div>
      </div>
    `
  })
}

export const Interactive: Story = {
  args: {
    priority: 'medium'
  },
  render: (args) => ({
    components: { TaskRowPriority },
    setup() {
      const priority = ref(args.priority)
      return { priority }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        min-height: 250px;
      ">
        <TaskRowPriority
          :priority="priority"
          @update:priority="priority = $event"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Selected: {{ priority || 'None' }}
        </div>
        <div style="
          margin-top: var(--space-2);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Click the badge to open dropdown and change priority
        </div>
      </div>
    `
  })
}

export const AllPriorities: Story = {
  render: () => ({
    components: { TaskRowPriority },
    setup() {
      const lowPriority = ref('low')
      const mediumPriority = ref('medium')
      const highPriority = ref('high')
      return { lowPriority, mediumPriority, highPriority }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        display: flex;
        gap: var(--space-4);
        align-items: center;
      ">
        <div style="display: flex; flex-direction: column; gap: var(--space-2); align-items: center;">
          <TaskRowPriority
            :priority="lowPriority"
            @update:priority="lowPriority = $event"
          />
          <span style="font-size: var(--text-xs); color: var(--text-tertiary);">Low</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: var(--space-2); align-items: center;">
          <TaskRowPriority
            :priority="mediumPriority"
            @update:priority="mediumPriority = $event"
          />
          <span style="font-size: var(--text-xs); color: var(--text-tertiary);">Medium</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: var(--space-2); align-items: center;">
          <TaskRowPriority
            :priority="highPriority"
            @update:priority="highPriority = $event"
          />
          <span style="font-size: var(--text-xs); color: var(--text-tertiary);">High</span>
        </div>
      </div>
    `
  })
}
