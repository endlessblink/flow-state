import type { Meta, StoryObj } from '@storybook/vue3'
import { createPinia, setActivePinia } from 'pinia'
import GroupModal from '@/components/common/GroupModal.vue'

// Initialize Pinia to prevent store errors
const pinia = createPinia()
setActivePinia(pinia)

const meta: Meta<typeof GroupModal> = {
  title: '🎯 Modals/GroupModal',
  component: GroupModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#0f172a' }],
    },
    docs: {
      description: {
        component: 'GroupModal allows creating and editing canvas groups/sections. Users can set the group name, color, and configure automatic task collection settings.',
      },
    },
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="min-height: 700px; width: 100%; display: flex; align-items: center; justify-content: center; background: var(--app-background-gradient); border-radius: 12px;">
          <story />
        </div>
      `,
    }),
  ],
  argTypes: {
    isOpen: {
      description: 'Controls modal visibility',
      control: { type: 'boolean' },
    },
    group: {
      description: 'Existing group to edit (null for create mode)',
      control: { type: 'object' },
    },
    position: {
      description: 'Initial position for new group',
      control: { type: 'object' },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const CreateNew: Story = {
  name: 'Create New Group',
  args: {
    isOpen: true,
    group: null,
    position: { x: 100, y: 100 },
  },
  render: (args) => ({
    components: { GroupModal },
    setup() {
      const handleClose = () => console.log('Modal closed')
      const handleCreated = (group: any) => console.log('Group created:', group)
      const handleUpdated = (group: any) => console.log('Group updated:', group)
      return { args, handleClose, handleCreated, handleUpdated }
    },
    template: `
      <GroupModal
        :is-open="args.isOpen"
        :group="args.group"
        :position="args.position"
        @close="handleClose"
        @created="handleCreated"
        @updated="handleUpdated"
      />
    `,
  }),
}

export const EditExisting: Story = {
  name: 'Edit Existing Group',
  args: {
    isOpen: true,
    group: {
      id: 'group-1',
      name: 'High Priority Tasks',
      color: '#ef4444',
      type: 'custom',
      position: { x: 100, y: 100 },
      size: { width: 400, height: 300 },
      isCollapsed: false,
    },
    position: { x: 100, y: 100 },
  },
  render: (args) => ({
    components: { GroupModal },
    setup() {
      const handleClose = () => console.log('Modal closed')
      const handleCreated = (group: any) => console.log('Group created:', group)
      const handleUpdated = (group: any) => console.log('Group updated:', group)
      return { args, handleClose, handleCreated, handleUpdated }
    },
    template: `
      <GroupModal
        :is-open="args.isOpen"
        :group="args.group"
        :position="args.position"
        @close="handleClose"
        @created="handleCreated"
        @updated="handleUpdated"
      />
    `,
  }),
}

export const Closed: Story = {
  name: 'Closed State',
  args: {
    isOpen: false,
    group: null,
  },
  render: (args) => ({
    components: { GroupModal },
    setup() {
      const handleClose = () => console.log('Modal closed')
      const handleCreated = (group: any) => console.log('Group created:', group)
      const handleUpdated = (group: any) => console.log('Group updated:', group)
      return { args, handleClose, handleCreated, handleUpdated }
    },
    template: `
      <div style="color: var(--text-secondary); text-align: center;">
        <p>Modal is closed. Toggle isOpen to open.</p>
        <GroupModal
          :is-open="args.isOpen"
          :group="args.group"
          @close="handleClose"
          @created="handleCreated"
          @updated="handleUpdated"
        />
      </div>
    `,
  }),
}
