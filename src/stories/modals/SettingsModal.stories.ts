import type { Meta, StoryObj } from '@storybook/vue3'
import { createPinia, setActivePinia } from 'pinia'
import SettingsModal from '@/components/layout/SettingsModal.vue'

// Initialize Pinia to prevent store errors
const pinia = createPinia()
setActivePinia(pinia)

const meta: Meta<typeof SettingsModal> = {
  title: '🪟 Modals & Dialogs/SettingsModal',
  component: SettingsModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#0f172a' }],
    },
    docs: {
      description: {
        component: 'SettingsModal provides access to application settings including timer configuration, display options, backup settings, and data management.',
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
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Default (Open)',
  args: {
    isOpen: true,
  },
  render: (args) => ({
    components: { SettingsModal },
    setup() {
      const handleClose = () => console.log('Settings closed')
      return { args, handleClose }
    },
    template: `
      <SettingsModal
        :is-open="args.isOpen"
        @close="handleClose"
      />
    `,
  }),
}

export const Closed: Story = {
  name: 'Closed State',
  args: {
    isOpen: false,
  },
  render: (args) => ({
    components: { SettingsModal },
    setup() {
      const handleClose = () => console.log('Settings closed')
      return { args, handleClose }
    },
    template: `
      <div style="color: var(--text-secondary); text-align: center;">
        <p>Modal is closed. Toggle isOpen to open settings.</p>
        <SettingsModal
          :is-open="args.isOpen"
          @close="handleClose"
        />
      </div>
    `,
  }),
}
