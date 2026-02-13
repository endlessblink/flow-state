import type { Meta, StoryObj } from '@storybook/vue3'
import MoreSubmenu from '@/components/tasks/context-menu/MoreSubmenu.vue'

const meta = {
  title: '📝 Task Management/Context Menu/MoreSubmenu',
  component: MoreSubmenu,
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    isVisible: { control: 'boolean' },
    parentVisible: { control: 'boolean' },
    isBatchOperation: { control: 'boolean' },
    taskId: { control: 'text' }
  }
} satisfies Meta<typeof MoreSubmenu>

export default meta
type Story = StoryObj<typeof meta>

export const SingleTask: Story = {
  args: {
    isVisible: true,
    parentVisible: true,
    isBatchOperation: false,
    taskId: 'task-123'
  },
  render: (args) => ({
    components: { MoreSubmenu },
    setup() {
      const style = {
        top: '250px',
        left: '300px'
      }

      return { args, style }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        min-height: 400px;
        min-width: 400px;
        position: relative;
      ">
        <MoreSubmenu
          v-bind="args"
          :style="style"
          @done-for-now="() => console.log('Done for now')"
          @duplicate="() => console.log('Duplicate')"
          @pin-quick-task="() => console.log('Pin as Quick Task')"
          @move-to-section="(id) => console.log('Move to section:', id)"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Single task mode - shows "Move to Section" option
        </div>
      </div>
    `
  })
}

export const BatchOperation: Story = {
  args: {
    isVisible: true,
    parentVisible: true,
    isBatchOperation: true,
    taskId: undefined
  },
  render: (args) => ({
    components: { MoreSubmenu },
    setup() {
      const style = {
        top: '250px',
        left: '300px'
      }

      return { args, style }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        min-height: 400px;
        min-width: 400px;
        position: relative;
      ">
        <MoreSubmenu
          v-bind="args"
          :style="style"
          @done-for-now="() => console.log('Done for now')"
          @duplicate="() => console.log('Duplicate')"
          @pin-quick-task="() => console.log('Pin as Quick Task')"
          @clear-selection="() => console.log('Clear selection')"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Batch operation mode - shows "Clear Selection" instead
        </div>
      </div>
    `
  })
}

export const Interactive: Story = {
  args: {
    isVisible: true,
    parentVisible: true,
    isBatchOperation: false,
    taskId: 'task-456'
  },
  render: (args) => ({
    components: { MoreSubmenu },
    setup() {
      const style = {
        top: '250px',
        left: '300px'
      }

      const handleDoneForNow = () => {
        console.log('Done for now clicked')
        alert('Task rescheduled to tomorrow')
      }

      const handleDuplicate = () => {
        console.log('Duplicate clicked')
        alert('Task duplicated')
      }

      const handlePinQuickTask = () => {
        console.log('Pin as Quick Task clicked')
        alert('Task pinned as Quick Task')
      }

      const handleMoveToSection = (taskId: string) => {
        console.log('Move to section:', taskId)
        alert(`Moving task ${taskId} to section`)
      }

      return {
        args,
        style,
        handleDoneForNow,
        handleDuplicate,
        handlePinQuickTask,
        handleMoveToSection
      }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        min-height: 400px;
        min-width: 400px;
        position: relative;
      ">
        <MoreSubmenu
          v-bind="args"
          :style="style"
          @done-for-now="handleDoneForNow"
          @duplicate="handleDuplicate"
          @pin-quick-task="handlePinQuickTask"
          @move-to-section="handleMoveToSection"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Click any option to see alert
        </div>
      </div>
    `
  })
}

export const AllOptions: Story = {
  args: {
    isVisible: true,
    parentVisible: true,
    isBatchOperation: false,
    taskId: 'task-789'
  },
  render: (args) => ({
    components: { MoreSubmenu },
    setup() {
      const style = {
        top: '250px',
        left: '300px'
      }

      return { args, style }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        min-height: 400px;
        min-width: 600px;
        position: relative;
      ">
        <MoreSubmenu
          v-bind="args"
          :style="style"
          @done-for-now="() => {}"
          @duplicate="() => {}"
          @pin-quick-task="() => {}"
          @move-to-section="() => {}"
        />
        <div style="
          position: absolute;
          top: var(--space-4);
          right: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Available options:
          <ul style="margin-top: var(--space-2); padding-left: var(--space-4);">
            <li>Done for now - Reschedule to tomorrow</li>
            <li>Duplicate - Create a copy</li>
            <li>Pin as Quick Task - Pin to quick access</li>
            <li>Move to Section - Move to canvas section</li>
          </ul>
        </div>
      </div>
    `
  })
}
