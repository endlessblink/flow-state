import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import TaskRowDueDate from '@/components/tasks/row/TaskRowDueDate.vue'

const meta = {
  title: '📝 Task Management/Row/TaskRowDueDate',
  component: TaskRowDueDate,
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    dueDate: {
      control: 'text',
      description: 'ISO date string (YYYY-MM-DD)'
    }
  }
} satisfies Meta<typeof TaskRowDueDate>

export default meta
type Story = StoryObj<typeof meta>

const getTodayString = () => {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

const getTomorrowString = () => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return tomorrow.toISOString().split('T')[0]
}

const getOverdueString = () => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return yesterday.toISOString().split('T')[0]
}

export const NoDueDate: Story = {
  args: {
    dueDate: null
  },
  render: (args) => ({
    components: { TaskRowDueDate },
    setup() {
      const dueDate = ref(args.dueDate)
      return { dueDate }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
      ">
        <TaskRowDueDate
          :due-date="dueDate"
          @update:due-date="dueDate = $event"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Click to set a due date
        </div>
      </div>
    `
  })
}

export const DueToday: Story = {
  args: {
    dueDate: getTodayString()
  },
  render: (args) => ({
    components: { TaskRowDueDate },
    setup() {
      const dueDate = ref(args.dueDate)
      return { dueDate }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
      ">
        <TaskRowDueDate
          :due-date="dueDate"
          @update:due-date="dueDate = $event"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Shows yellow styling for today's date
        </div>
      </div>
    `
  })
}

export const DueTomorrow: Story = {
  args: {
    dueDate: getTomorrowString()
  },
  render: (args) => ({
    components: { TaskRowDueDate },
    setup() {
      const dueDate = ref(args.dueDate)
      return { dueDate }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
      ">
        <TaskRowDueDate
          :due-date="dueDate"
          @update:due-date="dueDate = $event"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Shows blue styling for upcoming date
        </div>
      </div>
    `
  })
}

export const Overdue: Story = {
  args: {
    dueDate: getOverdueString()
  },
  render: (args) => ({
    components: { TaskRowDueDate },
    setup() {
      const dueDate = ref(args.dueDate)
      return { dueDate }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
      ">
        <TaskRowDueDate
          :due-date="dueDate"
          @update:due-date="dueDate = $event"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Shows red styling for overdue date
        </div>
      </div>
    `
  })
}

export const Interactive: Story = {
  args: {
    dueDate: null
  },
  render: (args) => ({
    components: { TaskRowDueDate },
    setup() {
      const dueDate = ref(args.dueDate)
      return { dueDate }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        min-height: 300px;
      ">
        <TaskRowDueDate
          :due-date="dueDate"
          @update:due-date="dueDate = $event"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Selected: {{ dueDate || 'None' }}
        </div>
        <div style="
          margin-top: var(--space-2);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Click to open dropdown and select a date
        </div>
      </div>
    `
  })
}
