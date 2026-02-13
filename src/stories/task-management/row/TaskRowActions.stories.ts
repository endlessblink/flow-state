import type { Meta, StoryObj } from '@storybook/vue3'
import TaskRowActions from '@/components/tasks/row/TaskRowActions.vue'

const meta = {
  title: '📝 Task Management/Row/TaskRowActions',
  component: TaskRowActions,
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    onStartTimer: { action: 'startTimer' },
    onEdit: { action: 'edit' },
    onDuplicate: { action: 'duplicate' }
  }
} satisfies Meta<typeof TaskRowActions>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { TaskRowActions },
    setup() {
      return { args }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        width: 200px;
      ">
        <TaskRowActions
          v-bind="args"
          @start-timer="args.onStartTimer"
          @edit="args.onEdit"
          @duplicate="args.onDuplicate"
        />
      </div>
    `
  })
}

export const WithHoverState: Story = {
  render: (args) => ({
    components: { TaskRowActions },
    setup() {
      return { args }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        width: 200px;
      ">
        <div class="task-row">
          <TaskRowActions
            v-bind="args"
            @start-timer="args.onStartTimer"
            @edit="args.onEdit"
            @duplicate="args.onDuplicate"
          />
        </div>
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Hover over this area to see actions
        </div>
      </div>
    `,
    styles: [`
      .task-row {
        padding: var(--space-4);
        background: var(--glass-bg-medium);
        border-radius: var(--radius-md);
      }
      .task-row:hover .task-row__actions {
        opacity: 1;
      }
    `]
  })
}

export const InTaskRow: Story = {
  render: (args) => ({
    components: { TaskRowActions },
    setup() {
      return { args }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        width: 600px;
      ">
        <div class="task-row" style="
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: var(--space-3);
          align-items: center;
          padding: var(--space-3);
          background: var(--glass-bg-medium);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-md);
        ">
          <div style="
            width: var(--space-5);
            height: var(--space-5);
            background: var(--glass-border);
            border-radius: var(--radius-sm);
          "></div>
          <div style="
            color: var(--text-primary);
            font-size: var(--text-sm);
          ">
            Sample task with action buttons
          </div>
          <TaskRowActions
            v-bind="args"
            @start-timer="args.onStartTimer"
            @edit="args.onEdit"
            @duplicate="args.onDuplicate"
          />
        </div>
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Hover over the task row to see action buttons
        </div>
      </div>
    `,
    styles: [`
      .task-row:hover .task-row__actions {
        opacity: 1;
      }
    `]
  })
}
