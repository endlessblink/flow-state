import type { Meta, StoryObj } from '@storybook/vue3'
import EmojiPicker from '@/components/common/EmojiPicker.vue'

const meta: Meta<typeof EmojiPicker> = {
  title: '🧩 Primitives/EmojiPicker',
  component: EmojiPicker,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: '#0f172a' }],
    },
    docs: {
      description: {
        component: 'EmojiPicker allows users to select emojis or colors for projects and tasks. Features tabbed navigation between emoji grid, recent selections, and color palette.',
      },
    },
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="padding: var(--space-10); background: var(--app-background-gradient); min-height: 500px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-xl);">
          <story />
        </div>
      `,
    }),
  ],
  argTypes: {
    isOpen: {
      description: 'Controls visibility of the picker',
      control: { type: 'boolean' },
    },
    currentEmoji: {
      description: 'Currently selected emoji',
      control: { type: 'text' },
    },
    currentColor: {
      description: 'Currently selected color (hex value)',
      control: { type: 'color' },
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
    components: { EmojiPicker },
    setup() {
      const handleClose = () => console.log('Picker closed')
      const handleSelect = (data: { type: string; value: string }) => {
        console.log('Selected:', data)
      }
      return { args, handleClose, handleSelect }
    },
    template: `
      <EmojiPicker
        :is-open="args.isOpen"
        :current-emoji="args.currentEmoji"
        :current-color="args.currentColor"
        @close="handleClose"
        @select="handleSelect"
      />
    `,
  }),
}

export const WithCurrentEmoji: Story = {
  name: 'With Pre-selected Emoji',
  args: {
    isOpen: true,
    currentEmoji: '🎯',
  },
  render: (args) => ({
    components: { EmojiPicker },
    setup() {
      const handleClose = () => console.log('Picker closed')
      const handleSelect = (data: { type: string; value: string }) => {
        console.log('Selected:', data)
      }
      return { args, handleClose, handleSelect }
    },
    template: `
      <EmojiPicker
        :is-open="args.isOpen"
        :current-emoji="args.currentEmoji"
        :current-color="args.currentColor"
        @close="handleClose"
        @select="handleSelect"
      />
    `,
  }),
}

export const WithCurrentColor: Story = {
  name: 'With Pre-selected Color',
  args: {
    isOpen: true,
    currentColor: '#3b82f6',
  },
  render: (args) => ({
    components: { EmojiPicker },
    setup() {
      const handleClose = () => console.log('Picker closed')
      const handleSelect = (data: { type: string; value: string }) => {
        console.log('Selected:', data)
      }
      return { args, handleClose, handleSelect }
    },
    template: `
      <EmojiPicker
        :is-open="args.isOpen"
        :current-emoji="args.currentEmoji"
        :current-color="args.currentColor"
        @close="handleClose"
        @select="handleSelect"
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
    components: { EmojiPicker },
    setup() {
      const handleClose = () => console.log('Picker closed')
      const handleSelect = (data: { type: string; value: string }) => {
        console.log('Selected:', data)
      }
      return { args, handleClose, handleSelect }
    },
    template: `
      <div style="color: var(--text-secondary); text-align: center;">
        <p style="margin-bottom: var(--space-4);">Picker is closed. Toggle isOpen control to open.</p>
        <EmojiPicker
          :is-open="args.isOpen"
          :current-emoji="args.currentEmoji"
          :current-color="args.currentColor"
          @close="handleClose"
          @select="handleSelect"
        />
      </div>
    `,
  }),
}
