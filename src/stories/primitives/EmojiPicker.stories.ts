import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import EmojiPicker from '@/components/EmojiPicker.vue'

const meta = {
  component: EmojiPicker,
  title: '🧩 Primitives/EmojiPicker',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Whether the emoji picker is open',
    },
    currentEmoji: {
      control: 'text',
      description: 'Currently selected emoji',
    },
    currentColor: {
      control: 'text',
      description: 'Currently selected color (hex code)',
    },
  },
} satisfies Meta<typeof EmojiPicker>

export default meta
type Story = StoryObj<typeof meta>

export const DefaultOpen: Story = {
  args: {
    isOpen: true,
  },
  render: (args: any) => ({
    components: { EmojiPicker },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: rgba(0, 0, 0, 0.95);">
        <h3 style="color: var(--text-primary); margin: 0 0 12px 0;">EmojiPicker (Default State)</h3>
        <p style="color: var(--text-secondary);">Default state with emoji tab active</p>
        <EmojiPicker v-bind="args" @close="() => {}" @select="(data: any) => console.log('Selected:', data)" />
      </div>
    `,
  })
}

export const InteractiveDemo: Story = {
  render: () => ({
    components: { EmojiPicker },
    setup() {
      const isOpen = ref(false)
      const currentEmoji = ref('')
      const currentColor = ref('')

      const handleSelect = (data: { type: 'emoji' | 'color'; value: string }) => {
        if (data.type === 'emoji') {
          currentEmoji.value = data.value
          currentColor.value = ''
        } else {
          currentColor.value = data.value
          currentEmoji.value = ''
        }
      }

      return {
        isOpen,
        currentEmoji,
        currentColor,
        handleSelect
      }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: rgba(0, 0, 0, 0.95);">
        <h1 style="color: var(--text-primary); margin: 0 0 24px 0;">EmojiPicker Interactive Demo</h1>
        <div style="margin-bottom: 30px; padding: 20px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
          <div style="display: flex; gap: 20px; align-items: center;">
            <div style="font-size: 32px; min-height: 40px; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 10px; color: var(--text-primary);">
              {{ currentEmoji || '📁' }}
            </div>
            <div style="width: 40px; height: 40px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);" :style="{ backgroundColor: currentColor || 'transparent' }"></div>
          </div>
        </div>
        <button
          @click="isOpen = true"
          style="padding: 12px 24px; background: transparent; border: 1px solid rgba(78, 205, 196, 0.5); color: rgba(78, 205, 196, 1); border-radius: 8px; cursor: pointer;"
        >
          😊 Choose Emoji/Color
        </button>
        <EmojiPicker
          :is-open="isOpen"
          :current-emoji="currentEmoji"
          :current-color="currentColor"
          @close="isOpen = false"
          @select="handleSelect"
        />
      </div>
    `,
  })
}
