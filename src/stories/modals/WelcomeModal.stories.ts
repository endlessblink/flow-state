import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import WelcomeModal from '@/components/ui/WelcomeModal.vue'

/**
 * WelcomeModal - First-time user onboarding modal
 *
 * A streamlined welcome experience with glass morphism styling.
 * Shows user status, optional name setup, and key features.
 *
 * **When to use:**
 * - First-time app launch
 * - After profile creation
 * - Returning user welcome
 */
const meta: Meta<typeof WelcomeModal> = {
  title: '🎯 Modals/WelcomeModal',
  component: WelcomeModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `Streamlined onboarding modal with glass morphism design.

**Features:**
- Clean, minimal layout
- Lucide icons
- Status banner (new user / returning user)
- Optional display name
- Quick feature highlights
- Export and Settings shortcuts`
      }
    }
  },
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Controls modal visibility',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' }
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof WelcomeModal>

/**
 * Default - Interactive playground
 *
 * Use the Controls panel to toggle visibility.
 * Click "Get Started" or X to close, then use Controls to reopen.
 */
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Interactive demo - use Controls panel to toggle `isOpen`. Click close/Get Started to dismiss.'
      }
    }
  },
  render: () => ({
    components: { WelcomeModal },
    setup() {
      const isOpen = ref(true)

      const handleClose = () => {
        console.log('[WelcomeModal] Closed')
        isOpen.value = false
      }

      const handleShowSettings = () => {
        console.log('[WelcomeModal] Settings requested')
      }

      const reopenModal = () => {
        isOpen.value = true
      }

      return { isOpen, handleClose, handleShowSettings, reopenModal }
    },
    template: `
      <div style="
        min-height: 100vh;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
      ">
        <WelcomeModal
          :is-open="isOpen"
          @close="handleClose"
          @show-settings="handleShowSettings"
        />
        <button
          v-if="!isOpen"
          @click="reopenModal"
          style="
            padding: 0.75rem 1.5rem;
            background: transparent;
            color: var(--color-work, #3b82f6);
            border: 1px solid var(--color-work, #3b82f6);
            border-radius: 8px;
            cursor: pointer;
            font-weight: 500;
            font-size: 0.875rem;
          "
        >
          Reopen Welcome Modal
        </button>
      </div>
    `
  })
}

/**
 * States - New vs Returning User
 *
 * Shows how the modal adapts to user context.
 * Status banner changes based on session state.
 */
export const States: Story = {
  parameters: {
    docs: {
      description: {
        story: `**User States:**

- **New User**: Shows "Profile created" banner
- **Returning User**: Shows "Day X" with usage count

The modal adapts messaging based on \`authStore.isNewSession\`.`
      }
    }
  },
  render: () => ({
    components: { WelcomeModal },
    setup() {
      const isOpen = ref(true)
      return {
        isOpen,
        handleClose: () => { isOpen.value = false },
        handleShowSettings: () => console.log('Settings')
      }
    },
    template: `
      <div style="
        min-height: 100vh;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
      ">
        <WelcomeModal
          :is-open="isOpen"
          @close="handleClose"
          @show-settings="handleShowSettings"
        />
      </div>
    `
  })
}

/**
 * Integration Example - Typical App Usage
 *
 * Shows how WelcomeModal integrates with app flow.
 * Modal appears on first launch, user can dismiss and continue.
 */
export const IntegrationExample: Story = {
  parameters: {
    docs: {
      description: {
        story: `**Typical integration:**

\`\`\`vue
<script setup>
const showWelcome = ref(true)

const handleWelcomeClose = () => {
  showWelcome.value = false
  localStorage.setItem('welcomed', 'true')
}
</script>

<template>
  <WelcomeModal
    :is-open="showWelcome"
    @close="handleWelcomeClose"
    @show-settings="openSettings"
  />
</template>
\`\`\``
      }
    }
  },
  render: () => ({
    components: { WelcomeModal },
    setup() {
      const isOpen = ref(true)
      const welcomed = ref(false)

      const handleClose = () => {
        isOpen.value = false
        welcomed.value = true
      }

      const showAgain = () => {
        isOpen.value = true
      }

      return { isOpen, welcomed, handleClose, showAgain }
    },
    template: `
      <div style="
        min-height: 100vh;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
        color: var(--text-primary, #fff);
      ">
        <WelcomeModal
          :is-open="isOpen"
          @close="handleClose"
        />

        <div v-if="welcomed" style="text-align: center;">
          <p style="color: var(--color-success, #22c55e); margin-bottom: 1rem;">
            Welcome complete! User can now use the app.
          </p>
          <button
            @click="showAgain"
            style="
              padding: 0.5rem 1rem;
              background: transparent;
              border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
              color: var(--text-secondary, rgba(255,255,255,0.7));
              border-radius: 6px;
              cursor: pointer;
              font-size: 0.8125rem;
            "
          >
            Show Welcome Again
          </button>
        </div>
      </div>
    `
  })
}
