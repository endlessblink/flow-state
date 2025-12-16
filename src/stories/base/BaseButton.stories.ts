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

  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger', 'active'],
      description: 'Button style variant',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Button size',
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled state',
    },
    loading: {
      control: 'boolean',
      description: 'Loading state with spinner',
    },
    iconOnly: {
      control: 'boolean',
      description: 'Square button for icon-only content',
    },
  },
} satisfies Meta<typeof BaseButton>

export default meta
type Story = StoryObj<typeof meta>

// Default
export const Default: Story = {
  args: {
    variant: 'secondary',
    size: 'md',
  },
  render: (args) => ({
    components: { BaseButton },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: 40px; background: rgba(0, 0, 0, 0.95); border-radius: 12px;">
        <BaseButton v-bind="args">Button</BaseButton>
      </div>
    `,
  })
}

// All Variants Showcase
export const AllVariants: Story = {
  render: () => ({
    components: { BaseButton },
    template: `
      <div style="padding: 40px; min-height: 400px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">BaseButton Variants</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">All button variants with stroke-only design (no fills)</p>

        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 24px; align-items: start;">
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <h4 style="margin: 0; color: var(--text-muted); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Primary</h4>
            <BaseButton variant="primary" size="sm">Small</BaseButton>
            <BaseButton variant="primary" size="md">Medium</BaseButton>
            <BaseButton variant="primary" size="lg">Large</BaseButton>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            <h4 style="margin: 0; color: var(--text-muted); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Secondary</h4>
            <BaseButton variant="secondary" size="sm">Small</BaseButton>
            <BaseButton variant="secondary" size="md">Medium</BaseButton>
            <BaseButton variant="secondary" size="lg">Large</BaseButton>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            <h4 style="margin: 0; color: var(--text-muted); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Ghost</h4>
            <BaseButton variant="ghost" size="sm">Small</BaseButton>
            <BaseButton variant="ghost" size="md">Medium</BaseButton>
            <BaseButton variant="ghost" size="lg">Large</BaseButton>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            <h4 style="margin: 0; color: var(--text-muted); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Danger</h4>
            <BaseButton variant="danger" size="sm">Delete</BaseButton>
            <BaseButton variant="danger" size="md">Remove</BaseButton>
            <BaseButton variant="danger" size="lg">Clear All</BaseButton>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            <h4 style="margin: 0; color: var(--text-muted); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Active</h4>
            <BaseButton variant="active" size="sm">Selected</BaseButton>
            <BaseButton variant="active" size="md">Active</BaseButton>
            <BaseButton variant="active" size="lg">Pressed</BaseButton>
          </div>
        </div>

        <!-- Feature info -->
        <div style="margin-top: 32px; padding: 20px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px;">
          <h4 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-primary);">Design Pattern</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 13px; line-height: 1.8;">
            <li><strong>Stroke-only design</strong> - No solid fill backgrounds</li>
            <li><strong>Glass morphism on hover</strong> - Subtle backdrop blur effect</li>
            <li><strong>Consistent transitions</strong> - Smooth spring animations</li>
            <li><strong>Accessible focus states</strong> - Clear keyboard focus indicators</li>
          </ul>
        </div>
      </div>
    `,
  })
}

// States
export const States: Story = {
  render: () => ({
    components: { BaseButton },
    template: `
      <div style="padding: 40px; min-height: 300px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Button States</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Different interaction states</p>

        <div style="display: flex; gap: 24px; flex-wrap: wrap;">
          <div style="display: flex; flex-direction: column; gap: 8px; align-items: center;">
            <BaseButton variant="primary">Normal</BaseButton>
            <span style="color: var(--text-muted); font-size: 11px;">Default</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px; align-items: center;">
            <BaseButton variant="primary" disabled>Disabled</BaseButton>
            <span style="color: var(--text-muted); font-size: 11px;">Disabled</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px; align-items: center;">
            <BaseButton variant="primary" loading>Loading</BaseButton>
            <span style="color: var(--text-muted); font-size: 11px;">Loading</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px; align-items: center;">
            <BaseButton variant="active">Active</BaseButton>
            <span style="color: var(--text-muted); font-size: 11px;">Pressed</span>
          </div>
        </div>
      </div>
    `,
  })
}

// Icon Buttons
export const IconButtons: Story = {
  render: () => ({
    components: { BaseButton },
    template: `
      <div style="padding: 40px; min-height: 300px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Icon Buttons</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Square buttons for icons</p>

        <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: center;">
          <BaseButton variant="secondary" size="sm" icon-only aria-label="Settings">⚙️</BaseButton>
          <BaseButton variant="secondary" size="md" icon-only aria-label="Add">➕</BaseButton>
          <BaseButton variant="secondary" size="lg" icon-only aria-label="Menu">☰</BaseButton>

          <div style="width: 1px; height: 32px; background: rgba(255, 255, 255, 0.1);"></div>

          <BaseButton variant="primary" size="sm" icon-only aria-label="Play">▶️</BaseButton>
          <BaseButton variant="primary" size="md" icon-only aria-label="Edit">✏️</BaseButton>
          <BaseButton variant="primary" size="lg" icon-only aria-label="Save">💾</BaseButton>

          <div style="width: 1px; height: 32px; background: rgba(255, 255, 255, 0.1);"></div>

          <BaseButton variant="danger" size="sm" icon-only aria-label="Delete">🗑️</BaseButton>
          <BaseButton variant="danger" size="md" icon-only aria-label="Close">✕</BaseButton>
          <BaseButton variant="ghost" size="md" icon-only aria-label="More">⋯</BaseButton>
        </div>
      </div>
    `,
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
      <div style="padding: 40px; min-height: 300px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Interactive Demo</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Click the button to see loading state</p>

        <!-- Counter display -->
        <div style="margin-bottom: 24px; padding: 20px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; text-align: center;">
          <div style="font-size: 48px; font-weight: bold; color: rgba(78, 205, 196, 1);">{{ counter }}</div>
          <div style="font-size: 14px; color: var(--text-secondary);">Click Count</div>
        </div>

        <div style="display: flex; gap: 12px; justify-content: center;">
          <BaseButton
            variant="primary"
            size="lg"
            :loading="isLoading"
            @click="handleClick"
          >
            {{ isLoading ? 'Processing...' : 'Click Me' }}
          </BaseButton>

          <BaseButton
            variant="ghost"
            size="lg"
            @click="counter = 0"
          >
            Reset
          </BaseButton>
        </div>
      </div>
    `,
  })
}
