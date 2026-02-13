import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import StatusSubmenu from '@/components/tasks/context-menu/StatusSubmenu.vue'

const meta = {
  title: '📝 Task Management/Context Menu/StatusSubmenu',
  component: StatusSubmenu,
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    isVisible: { control: 'boolean' },
    parentVisible: { control: 'boolean' },
    currentStatus: {
      control: 'select',
      options: ['planned', 'in_progress', 'done', 'backlog', 'on_hold']
    }
  }
} satisfies Meta<typeof StatusSubmenu>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    isVisible: true,
    parentVisible: true,
    currentStatus: undefined
  },
  render: (args) => ({
    components: { StatusSubmenu },
    setup() {
      const status = ref(args.currentStatus)
      const style = ref({
        top: '250px',
        left: '300px'
      })

      const handleSelect = (value: string) => {
        status.value = value
        console.log('Status selected:', value)
      }

      return { args, style, status, handleSelect }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        min-height: 500px;
        min-width: 400px;
        position: relative;
      ">
        <StatusSubmenu
          :is-visible="args.isVisible"
          :parent-visible="args.parentVisible"
          :style="style"
          :current-status="status"
          @select="handleSelect"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Selected status: {{ status || 'None' }}
        </div>
        <div style="
          margin-top: var(--space-2);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Click an option to change status
        </div>
      </div>
    `
  })
}

export const Planned: Story = {
  args: {
    isVisible: true,
    parentVisible: true,
    currentStatus: 'planned'
  },
  render: (args) => ({
    components: { StatusSubmenu },
    setup() {
      const status = ref(args.currentStatus)
      const style = ref({
        top: '250px',
        left: '300px'
      })

      const handleSelect = (value: string) => {
        status.value = value
      }

      return { args, style, status, handleSelect }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        min-height: 500px;
        min-width: 400px;
        position: relative;
      ">
        <StatusSubmenu
          :is-visible="args.isVisible"
          :parent-visible="args.parentVisible"
          :style="style"
          :current-status="status"
          @select="handleSelect"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Current status: Planned (blue)
        </div>
      </div>
    `
  })
}

export const InProgress: Story = {
  args: {
    isVisible: true,
    parentVisible: true,
    currentStatus: 'in_progress'
  },
  render: (args) => ({
    components: { StatusSubmenu },
    setup() {
      const status = ref(args.currentStatus)
      const style = ref({
        top: '250px',
        left: '300px'
      })

      const handleSelect = (value: string) => {
        status.value = value
      }

      return { args, style, status, handleSelect }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        min-height: 500px;
        min-width: 400px;
        position: relative;
      ">
        <StatusSubmenu
          :is-visible="args.isVisible"
          :parent-visible="args.parentVisible"
          :style="style"
          :current-status="status"
          @select="handleSelect"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Current status: In Progress (yellow/break color)
        </div>
      </div>
    `
  })
}

export const Done: Story = {
  args: {
    isVisible: true,
    parentVisible: true,
    currentStatus: 'done'
  },
  render: (args) => ({
    components: { StatusSubmenu },
    setup() {
      const status = ref(args.currentStatus)
      const style = ref({
        top: '250px',
        left: '300px'
      })

      const handleSelect = (value: string) => {
        status.value = value
      }

      return { args, style, status, handleSelect }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        min-height: 500px;
        min-width: 400px;
        position: relative;
      ">
        <StatusSubmenu
          :is-visible="args.isVisible"
          :parent-visible="args.parentVisible"
          :style="style"
          :current-status="status"
          @select="handleSelect"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Current status: Done (green/work color)
        </div>
      </div>
    `
  })
}

export const AllStatuses: Story = {
  args: {
    isVisible: true,
    parentVisible: true,
    currentStatus: undefined
  },
  render: (args) => ({
    components: { StatusSubmenu },
    setup() {
      const status = ref(args.currentStatus)
      const style = ref({
        top: '250px',
        left: '300px'
      })

      const handleSelect = (value: string) => {
        status.value = value
      }

      return { args, style, status, handleSelect }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        min-height: 500px;
        min-width: 600px;
        position: relative;
      ">
        <StatusSubmenu
          :is-visible="args.isVisible"
          :parent-visible="args.parentVisible"
          :style="style"
          :current-status="status"
          @select="handleSelect"
        />
        <div style="
          position: absolute;
          top: var(--space-4);
          right: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Available statuses:
          <ul style="margin-top: var(--space-2); padding-left: var(--space-4);">
            <li>Planned - Blue (info color)</li>
            <li>In Progress - Yellow (break color)</li>
            <li>Done - Green (work color)</li>
            <li>Backlog - Muted gray</li>
            <li>On Hold - Red (danger color)</li>
          </ul>
        </div>
        <div style="
          position: absolute;
          bottom: var(--space-4);
          left: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Selected: {{ status || 'None' }}
        </div>
      </div>
    `
  })
}
