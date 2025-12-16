import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import EmojiPicker from '@/components/EmojiPicker.vue'

const meta = {
  component: EmojiPicker,
  title: '🧩 Components/📝 Form Controls/EmojiPicker',
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

// Basic States
export const Closed: Story = {
  args: {
    isOpen: false,
  },
  render: (args) => ({
    components: { EmojiPicker },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: rgba(0, 0, 0, 0.95);">
        <h3 style="color: var(--text-primary); margin: 0 0 12px 0;">EmojiPicker (Closed)</h3>
        <p style="color: var(--text-secondary);">Click the button below to open the emoji picker</p>
        <button @click="() => console.log('Open picker')" style="margin-top: 20px; padding: 12px 24px; background: transparent; border: 1px solid rgba(78, 205, 196, 0.5); color: rgba(78, 205, 196, 1); border-radius: 8px; cursor: pointer; transition: all 0.2s ease;">
          Open Emoji Picker
        </button>
        <EmojiPicker v-bind="args" @close="() => console.log('Closed')" @select="(data) => console.log('Selected:', data)" />
      </div>
    `,
  })
}

export const DefaultOpen: Story = {
  args: {
    isOpen: true,
  },
  render: (args) => ({
    components: { EmojiPicker },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: rgba(0, 0, 0, 0.95);">
        <h3 style="color: var(--text-primary); margin: 0 0 12px 0;">EmojiPicker (Default State)</h3>
        <p style="color: var(--text-secondary);">Default state with emoji tab active</p>
        <EmojiPicker v-bind="args" @close="() => console.log('Closed')" @select="(data) => console.log('Selected:', data)" />
      </div>
    `,
  })
}

// With Preselected Values
export const WithEmoji: Story = {
  args: {
    isOpen: true,
    currentEmoji: '🚀',
  },
  render: (args) => ({
    components: { EmojiPicker },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: rgba(0, 0, 0, 0.95);">
        <h3 style="color: var(--text-primary); margin: 0 0 12px 0;">EmojiPicker with Preselected Emoji</h3>
        <p style="color: var(--text-secondary);">Opens with rocket emoji preselected</p>
        <EmojiPicker v-bind="args" @close="() => console.log('Closed')" @select="(data) => console.log('Selected:', data)" />
      </div>
    `,
  })
}

export const WithColor: Story = {
  args: {
    isOpen: true,
    currentColor: '#4ECDC4',
  },
  render: (args) => ({
    components: { EmojiPicker },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: rgba(0, 0, 0, 0.95);">
        <h3 style="color: var(--text-primary); margin: 0 0 12px 0;">EmojiPicker with Preselected Color</h3>
        <p style="color: var(--text-secondary);">Opens with color tab active and teal preselected</p>
        <EmojiPicker v-bind="args" @close="() => console.log('Closed')" @select="(data) => console.log('Selected:', data)" />
      </div>
    `,
  })
}

// Tab Variants
export const EmojiTab: Story = {
  args: {
    isOpen: true,
  },
  render: (args) => ({
    components: { EmojiPicker },
    setup() {
      const selectedTab = ref('emoji')
      return { args, selectedTab }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: rgba(0, 0, 0, 0.95);">
        <h3 style="color: var(--text-primary); margin: 0 0 12px 0;">Emoji Tab</h3>
        <p style="color: var(--text-secondary);">Browse all available emojis with search functionality</p>
        <EmojiPicker v-bind="args" @close="() => console.log('Closed')" @select="(data) => console.log('Selected:', data)" />
      </div>
    `,
  })
}

export const ColorTab: Story = {
  args: {
    isOpen: true,
    currentColor: '#FF6B6B',
  },
  render: (args) => ({
    components: { EmojiPicker },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: rgba(0, 0, 0, 0.95);">
        <h3 style="color: var(--text-primary); margin: 0 0 12px 0;">Color Tab</h3>
        <p style="color: var(--text-secondary);">Choose from predefined color options for project colors</p>
        <EmojiPicker v-bind="args" @close="() => console.log('Closed')" @select="(data) => console.log('Selected:', data)" />
      </div>
    `,
  })
}

export const RecentTab: Story = {
  args: {
    isOpen: true,
  },
  render: (args) => ({
    components: { EmojiPicker },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: rgba(0, 0, 0, 0.95);">
        <h3 style="color: var(--text-primary); margin: 0 0 12px 0;">Recent Tab</h3>
        <p style="color: var(--text-secondary);">Shows recently used emojis (empty state initially)</p>
        <EmojiPicker v-bind="args" @close="() => console.log('Closed')" @select="(data) => console.log('Selected:', data)" />
      </div>
    `,
  })
}

// Interactive Demo
export const InteractiveDemo: Story = {
  render: () => ({
    components: { EmojiPicker },
    setup() {
      const isOpen = ref(false)
      const currentEmoji = ref('')
      const currentColor = ref('')
      const lastSelection = ref<any>(null)

      const openPicker = () => {
        isOpen.value = true
      }

      const handleSelect = (data: { type: 'emoji' | 'color'; value: string }) => {
        lastSelection.value = data
        if (data.type === 'emoji') {
          currentEmoji.value = data.value
          currentColor.value = ''
        } else {
          currentColor.value = data.value
          currentEmoji.value = ''
        }
      }

      const handleClose = () => {
        isOpen.value = false
      }

      const clearSelection = () => {
        currentEmoji.value = ''
        currentColor.value = ''
        lastSelection.value = null
      }

      return {
        isOpen,
        currentEmoji,
        currentColor,
        lastSelection,
        openPicker,
        handleSelect,
        handleClose,
        clearSelection
      }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: rgba(0, 0, 0, 0.95);">
        <h1 style="color: var(--text-primary); margin: 0 0 24px 0;">EmojiPicker Interactive Demo</h1>

        <!-- Current Selection Display -->
        <div style="margin-bottom: 30px; padding: 20px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
          <h2 style="margin: 0 0 16px 0; color: var(--text-primary);">Current Selection</h2>

          <div style="display: flex; gap: 20px; align-items: center;">
            <div style="flex: 1;">
              <h4 style="margin: 0 0 8px 0; font-size: 14px; color: var(--text-secondary);">Emoji</h4>
              <div style="font-size: 32px; min-height: 40px; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 10px; color: var(--text-primary);">
                {{ currentEmoji || 'None' }}
              </div>
            </div>

            <div style="flex: 1;">
              <h4 style="margin: 0 0 8px 0; font-size: 14px; color: var(--text-secondary);">Color</h4>
              <div style="width: 40px; height: 40px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);" :style="{ backgroundColor: currentColor }"></div>
            </div>
          </div>

          <div v-if="lastSelection" style="margin-top: 16px; padding: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; font-size: 14px; color: var(--text-secondary);">
            <strong style="color: var(--text-primary);">Last Selection:</strong> {{ lastSelection.type }} - {{ lastSelection.value }}
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 12px; margin-bottom: 30px;">
          <button
            @click="openPicker"
            style="padding: 12px 24px; background: transparent; border: 1px solid rgba(78, 205, 196, 0.5); color: rgba(78, 205, 196, 1); border-radius: 8px; cursor: pointer; font-size: 16px; transition: all 0.2s ease;"
          >
            😊 Choose Emoji/Color
          </button>
          <button
            @click="clearSelection"
            style="padding: 12px 24px; background: transparent; border: 1px solid rgba(255, 255, 255, 0.15); color: var(--text-secondary); border-radius: 8px; cursor: pointer; transition: all 0.2s ease;"
          >
            Clear Selection
          </button>
        </div>

        <!-- Usage Examples -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
          <div style="padding: 20px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
            <h3 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Project Example</h3>
            <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
              <span style="font-size: 24px;">{{ currentEmoji || '📁' }}</span>
              <span style="font-weight: 500; color: var(--text-primary);">My Project</span>
            </div>
          </div>

          <div style="padding: 20px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
            <h3 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Task Example</h3>
            <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
              <div style="width: 16px; height: 16px; border-radius: 4px;" :style="{ backgroundColor: currentColor || '#3b82f6' }"></div>
              <span style="color: var(--text-primary);">Complete task</span>
            </div>
          </div>
        </div>

        <!-- EmojiPicker Component -->
        <EmojiPicker
          :is-open="isOpen"
          :current-emoji="currentEmoji"
          :current-color="currentColor"
          @close="handleClose"
          @select="handleSelect"
        />
      </div>
    `,
  })
}

// Productivity Emojis Showcase
export const ProductivityEmojis: Story = {
  args: {
    isOpen: true,
  },
  render: (args) => ({
    components: { EmojiPicker },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: rgba(0, 0, 0, 0.95);">
        <h3 style="color: var(--text-primary); margin: 0 0 12px 0;">Productivity-Focused Emojis</h3>
        <p style="color: var(--text-secondary);">Pre-categorized emojis optimized for task management workflows</p>
        <EmojiPicker v-bind="args" @close="() => console.log('Closed')" @select="(data) => console.log('Selected:', data)" />
      </div>
    `,
  })
}

// All Variants Showcase
export const AllVariants: Story = {
  render: () => ({
    components: { EmojiPicker },
    setup() {
      const showEmojiPicker = ref(false)
      const showColorPicker = ref(false)
      const showRecentPicker = ref(false)

      return { showEmojiPicker, showColorPicker, showRecentPicker }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: rgba(0, 0, 0, 0.95);">
        <h1 style="color: var(--text-primary); margin: 0 0 24px 0;">EmojiPicker Component Showcase</h1>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; margin-top: 40px;">
          <!-- Emoji Picker -->
          <div style="padding: 24px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
            <h3 style="margin: 0 0 16px 0; color: var(--text-primary);">Emoji Selection</h3>
            <p style="margin: 0 0 20px 0; color: var(--text-secondary);">Browse productivity-focused emojis with search</p>
            <button
              @click="showEmojiPicker = true"
              style="width: 100%; padding: 12px; background: transparent; border: 1px solid rgba(78, 205, 196, 0.5); color: rgba(78, 205, 196, 1); border-radius: 8px; cursor: pointer; transition: all 0.2s ease;"
            >
              📝 Open Emoji Picker
            </button>
          </div>

          <!-- Color Picker -->
          <div style="padding: 24px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
            <h3 style="margin: 0 0 16px 0; color: var(--text-primary);">Color Selection</h3>
            <p style="margin: 0 0 20px 0; color: var(--text-secondary);">Choose from predefined project colors</p>
            <button
              @click="showColorPicker = true"
              style="width: 100%; padding: 12px; background: transparent; border: 1px solid rgba(78, 205, 196, 0.5); color: rgba(78, 205, 196, 1); border-radius: 8px; cursor: pointer; transition: all 0.2s ease;"
            >
              🎨 Open Color Picker
            </button>
          </div>

          <!-- Recent Items -->
          <div style="padding: 24px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
            <h3 style="margin: 0 0 16px 0; color: var(--text-primary);">Recent Items</h3>
            <p style="margin: 0 0 20px 0; color: var(--text-secondary);">View and reuse recent selections</p>
            <button
              @click="showRecentPicker = true"
              style="width: 100%; padding: 12px; background: transparent; border: 1px solid rgba(255, 255, 255, 0.15); color: var(--text-secondary); border-radius: 8px; cursor: pointer; transition: all 0.2s ease;"
            >
              🕐 Open Recent Items
            </button>
          </div>
        </div>

        <!-- Features List -->
        <div style="margin-top: 40px; padding: 24px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
          <h3 style="margin: 0 0 16px 0; color: var(--text-primary);">Key Features</h3>
          <ul style="margin: 0; padding-left: 20px; line-height: 1.8; color: var(--text-secondary);">
            <li>📝 Productivity-focused emoji categories</li>
            <li>🎨 Predefined color palette</li>
            <li>🔍 Real-time emoji search</li>
            <li>🕐 Recent items with localStorage persistence</li>
            <li>💫 Smooth animations and transitions</li>
            <li>📱 Responsive design</li>
            <li>♿ Accessibility support</li>
          </ul>
        </div>

        <!-- Multiple Pickers Demo -->
        <EmojiPicker
          :is-open="showEmojiPicker"
          @close="showEmojiPicker = false"
          @select="(data) => console.log('Emoji selected:', data)"
        />

        <EmojiPicker
          :is-open="showColorPicker"
          current-color="#FF6B6B"
          @close="showColorPicker = false"
          @select="(data) => console.log('Color selected:', data)"
        />

        <EmojiPicker
          :is-open="showRecentPicker"
          @close="showRecentPicker = false"
          @select="(data) => console.log('Recent selected:', data)"
        />
      </div>
    `,
  })
}