import type { Meta, StoryObj } from '@storybook/vue3'
import CyberCharacterDrawer from '@/components/gamification/cyber/CyberCharacterDrawer.vue'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

const meta = {
  title: '🎮 Gamification/Cyber/CyberCharacterDrawer',
  component: CyberCharacterDrawer,
  tags: ['autodocs', 'new'],
  argTypes: {
    open: {
      control: 'boolean',
      description: 'Drawer open state',
    },
  },
  decorators: [
    () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      return { template: '<story />' }
    },
  ],
} satisfies Meta<typeof CyberCharacterDrawer>

export default meta
type Story = StoryObj<typeof meta>

export const Open: Story = {
  args: {
    open: true,
  },
  render: (args) => ({
    components: { CyberCharacterDrawer },
    setup() {
      const isOpen = ref(args.open)
      const handleClose = () => {
        isOpen.value = false
      }
      return { isOpen, handleClose, args }
    },
    template: `
      <div style="position: relative; width: 100%; height: 600px; background: var(--cf-dark-1, #0a0a0f);">
        <CyberCharacterDrawer :open="isOpen" @close="handleClose" />
        <div style="padding: var(--space-6); color: var(--text-primary);">
          <h2 style="font-family: var(--font-cyber-title); color: var(--cf-cyan);">CYBERFLOW INTERFACE</h2>
          <p style="margin-top: var(--space-3); color: var(--text-secondary);">Click the drawer or press ESC to close</p>
        </div>
      </div>
    `,
  }),
}

export const WithToggle: Story = {
  render: () => ({
    components: { CyberCharacterDrawer },
    setup() {
      const isOpen = ref(false)
      const toggleDrawer = () => {
        isOpen.value = !isOpen.value
      }
      const handleClose = () => {
        isOpen.value = false
      }
      return { isOpen, toggleDrawer, handleClose }
    },
    template: `
      <div style="position: relative; width: 100%; height: 600px; background: var(--cf-dark-1, #0a0a0f);">
        <CyberCharacterDrawer :open="isOpen" @close="handleClose" />
        <div style="padding: var(--space-6);">
          <button
            @click="toggleDrawer"
            style="
              padding: var(--space-2) var(--space-4);
              background: var(--cf-cyan-20, rgba(0, 240, 255, 0.2));
              border: 1px solid var(--cf-cyan-50, rgba(0, 240, 255, 0.5));
              border-radius: var(--radius-sm);
              color: var(--cf-cyan, #00f0ff);
              font-family: var(--font-cyber-title);
              font-size: var(--text-sm);
              cursor: pointer;
              letter-spacing: 0.1em;
            "
          >
            {{ isOpen ? 'CLOSE PROFILE' : 'OPEN PROFILE' }}
          </button>
        </div>
      </div>
    `,
  }),
}
