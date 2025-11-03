import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import BaseButton from '@/components/base/BaseButton.vue'

const meta = {
  component: BaseButton,
  title: '🧩 Components/🔘 Base/BaseButton',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof BaseButton>

export default meta
type Story = StoryObj<typeof meta>

// Primary Variants
export const PrimaryDefault: Story = {
  args: {
    variant: 'primary',
    size: 'md',
  },
  render: (args) => ({
    components: { BaseButton },
    setup() {
      return { args }
    },
    template: '<BaseButton v-bind="args">Primary Button</BaseButton>',
  })
}

export const PrimarySmall: Story = {
  args: {
    variant: 'primary',
    size: 'sm',
  },
  render: (args) => ({
    components: { BaseButton },
    setup() {
      return { args }
    },
    template: '<BaseButton v-bind="args">Small Primary</BaseButton>',
  })
}

export const PrimaryLarge: Story = {
  args: {
    variant: 'primary',
    size: 'lg',
  },
  render: (args) => ({
    components: { BaseButton },
    setup() {
      return { args }
    },
    template: '<BaseButton v-bind="args">Large Primary</BaseButton>',
  })
}

// Secondary Variants
export const SecondaryDefault: Story = {
  args: {
    variant: 'secondary',
    size: 'md',
  },
  render: (args) => ({
    components: { BaseButton },
    setup() {
      return { args }
    },
    template: '<BaseButton v-bind="args">Secondary Button</BaseButton>',
  })
}

export const SecondaryHover: Story = {
  args: {
    variant: 'secondary',
    size: 'md',
  },
  render: (args) => ({
    components: { BaseButton },
    setup() {
      return { args }
    },
    template: '<BaseButton v-bind="args" @mouseover="$event.target.classList.add(\'hover-state\')" @mouseleave="$event.target.classList.remove(\'hover-state\')">Secondary Hover</BaseButton>',
  })
}

// Ghost Variants
export const GhostDefault: Story = {
  args: {
    variant: 'ghost',
    size: 'md',
  },
  render: (args) => ({
    components: { BaseButton },
    setup() {
      return { args }
    },
    template: '<BaseButton v-bind="args">Ghost Button</BaseButton>',
  })
}

// Danger Variants
export const DangerDefault: Story = {
  args: {
    variant: 'danger',
    size: 'md',
  },
  render: (args) => ({
    components: { BaseButton },
    setup() {
      return { args }
    },
    template: '<BaseButton v-bind="args">Delete Item</BaseButton>',
  })
}

// State Variants
export const Loading: Story = {
  args: {
    variant: 'primary',
    size: 'md',
    loading: true,
  },
  render: (args) => ({
    components: { BaseButton },
    setup() {
      return { args }
    },
    template: '<BaseButton v-bind="args">Loading...</BaseButton>',
  })
}

export const Disabled: Story = {
  args: {
    variant: 'primary',
    size: 'md',
    disabled: true,
  },
  render: (args) => ({
    components: { BaseButton },
    setup() {
      return { args }
    },
    template: '<BaseButton v-bind="args">Disabled Button</BaseButton>',
  })
}

// Icon Buttons
export const IconButtonDefault: Story = {
  args: {
    variant: 'secondary',
    size: 'md',
    iconOnly: true,
    ariaLabel: 'Settings',
  },
  render: (args) => ({
    components: { BaseButton },
    setup() {
      return { args }
    },
    template: '<BaseButton v-bind="args">⚙️</BaseButton>',
  })
}

export const IconButtonLarge: Story = {
  args: {
    variant: 'primary',
    size: 'lg',
    iconOnly: true,
    ariaLabel: 'Add New Item',
  },
  render: (args) => ({
    components: { BaseButton },
    setup() {
      return { args }
    },
    template: '<BaseButton v-bind="args">➕</BaseButton>',
  })
}

// Interactive Demo
export const InteractiveDemo: Story = {
  render: () => ({
    components: { BaseButton },
    setup() {
      const counter = ref(0)
      const isLoading = ref(false)

      const handleClick = () => {
        isLoading.value = true
        setTimeout(() => {
          counter.value++
          isLoading.value = false
        }, 1000)
      }

      return { counter, isLoading, handleClick }
    },
    template: `
      <div style="display: flex; flex-direction: column; gap: 12px; align-items: center;">
        <BaseButton
          variant="primary"
          :loading="isLoading"
          @click="handleClick"
        >
          {{ isLoading ? 'Processing...' : 'Click me (' + counter + ')' }}
        </BaseButton>
        <BaseButton
          variant="ghost"
          @click="counter = 0"
        >
          Reset Counter
        </BaseButton>
      </div>
    `,
  })
}

// All Variants Showcase
export const AllVariants: Story = {
  render: () => ({
    components: { BaseButton },
    template: `
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; align-items: start;">
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <h4 style="margin: 0; color: var(--text-secondary); font-size: 12px; font-weight: 600;">PRIMARY</h4>
          <BaseButton variant="primary" size="sm">Small</BaseButton>
          <BaseButton variant="primary" size="md">Medium</BaseButton>
          <BaseButton variant="primary" size="lg">Large</BaseButton>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          <h4 style="margin: 0; color: var(--text-secondary); font-size: 12px; font-weight: 600;">SECONDARY</h4>
          <BaseButton variant="secondary" size="sm">Small</BaseButton>
          <BaseButton variant="secondary" size="md">Medium</BaseButton>
          <BaseButton variant="secondary" size="lg">Large</BaseButton>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          <h4 style="margin: 0; color: var(--text-secondary); font-size: 12px; font-weight: 600;">GHOST</h4>
          <BaseButton variant="ghost" size="sm">Small</BaseButton>
          <BaseButton variant="ghost" size="md">Medium</BaseButton>
          <BaseButton variant="ghost" size="lg">Large</BaseButton>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          <h4 style="margin: 0; color: var(--text-secondary); font-size: 12px; font-weight: 600;">DANGER</h4>
          <BaseButton variant="danger" size="sm">Delete</BaseButton>
          <BaseButton variant="danger" size="md">Remove</BaseButton>
          <BaseButton variant="danger" size="lg">Clear All</BaseButton>
        </div>
      </div>
    `,
  })
}