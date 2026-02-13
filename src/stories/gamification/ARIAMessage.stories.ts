import type { Meta, StoryObj } from '@storybook/vue3'
import ARIAMessage from '@/components/gamification/ARIAMessage.vue'

const meta = {
  component: ARIAMessage,
  title: '🎮 Gamification/ARIAMessage',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    type: {
      control: 'select',
      options: ['info', 'success', 'warning', 'error', 'loading'],
      description: 'Message type/severity',
    },
    showAvatar: {
      control: 'boolean',
      description: 'Show ARIA avatar icon',
    },
  },
} satisfies Meta<typeof ARIAMessage>

export default meta
type Story = StoryObj<typeof meta>

// Default - Info
export const Info: Story = {
  args: {
    message: 'Greetings, netrunner. Your daily missions are ready for deployment.',
    type: 'info',
    showAvatar: true,
  },
  render: (args) => ({
    components: { ARIAMessage },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 400px;">
        <ARIAMessage v-bind="args" />
      </div>
    `,
  }),
}

// Success
export const Success: Story = {
  args: {
    message: 'Mission accomplished! Grid stability has been restored. Excellent work.',
    type: 'success',
    showAvatar: true,
  },
  render: (args) => ({
    components: { ARIAMessage },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 400px;">
        <ARIAMessage v-bind="args" />
      </div>
    `,
  }),
}

// Warning
export const Warning: Story = {
  args: {
    message: 'Critical damage detected. The boss is weakened but still dangerous. Proceed with caution.',
    type: 'warning',
    showAvatar: true,
  },
  render: (args) => ({
    components: { ARIAMessage },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 400px;">
        <ARIAMessage v-bind="args" />
      </div>
    `,
  }),
}

// Error
export const Error: Story = {
  args: {
    message: 'Connection to the Grid lost. Unable to sync mission data. Please check your network.',
    type: 'error',
    showAvatar: true,
  },
  render: (args) => ({
    components: { ARIAMessage },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 400px;">
        <ARIAMessage v-bind="args" />
      </div>
    `,
  }),
}

// Loading
export const Loading: Story = {
  args: {
    message: 'ARIA is analyzing the Grid and generating missions based on your patterns...',
    type: 'loading',
    showAvatar: true,
  },
  render: (args) => ({
    components: { ARIAMessage },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 400px;">
        <ARIAMessage v-bind="args" />
      </div>
    `,
  }),
}

// Without Avatar
export const WithoutAvatar: Story = {
  args: {
    message: 'This message appears without the ARIA avatar icon.',
    type: 'info',
    showAvatar: false,
  },
  render: (args) => ({
    components: { ARIAMessage },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 400px;">
        <ARIAMessage v-bind="args" />
      </div>
    `,
  }),
}

// All Types
export const AllTypes: Story = {
  render: () => ({
    components: { ARIAMessage },
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 500px;">
        <h3 style="margin: 0 0 var(--space-4) 0; color: var(--text-primary); font-size: var(--text-base);">ARIA Message Types</h3>
        <div style="display: flex; flex-direction: column; gap: var(--space-4);">
          <ARIAMessage message="This is an informational message from ARIA." type="info" :show-avatar="true" />
          <ARIAMessage message="Mission accomplished! Grid stability restored." type="success" :show-avatar="true" />
          <ARIAMessage message="Warning: Boss fight time running out." type="warning" :show-avatar="true" />
          <ARIAMessage message="Error: Failed to sync mission data." type="error" :show-avatar="true" />
          <ARIAMessage message="Analyzing your patterns and generating missions..." type="loading" :show-avatar="true" />
        </div>
      </div>
    `,
  }),
}
