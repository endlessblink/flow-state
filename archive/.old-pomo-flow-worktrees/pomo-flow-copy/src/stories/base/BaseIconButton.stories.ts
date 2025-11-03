import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import BaseIconButton from '@/components/base/BaseIconButton.vue'

const meta = {
  component: BaseIconButton,
  title: '🧩 Components/🔘 Base/BaseIconButton',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
  },

  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'primary', 'success', 'warning', 'danger'],
      description: 'Visual style variant of the button',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Size of the icon button',
    },
    active: {
      control: 'boolean',
      description: 'Whether the button is in active state',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the button is disabled',
    },
    type: {
      control: 'select',
      options: ['button', 'submit', 'reset'],
      description: 'HTML button type',
    },
    title: {
      control: 'text',
      description: 'Tooltip text on hover',
    },
  },
} satisfies Meta<typeof BaseIconButton>

export default meta
type Story = StoryObj<typeof meta>

// Default State
export const Default: Story = {
  args: {
    title: 'Default icon button',
  },
  render: (args) => ({
    components: { BaseIconButton },
    setup() {
      const handleClick = (event: MouseEvent) => {
        console.log('Icon button clicked:', event)
      }

      return { args, handleClick }
    },
    template: `
      <BaseIconButton v-bind="args" @click="handleClick">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
      </BaseIconButton>
    `,
  })
}

// Size Variants
export const Sizes: Story = {
  render: () => ({
    components: { BaseIconButton },
    setup() {
      const handleClick = () => console.log('Size variant clicked')
      return { handleClick }
    },
    template: `
      <div style="display: flex; align-items: center; gap: 16px; padding: 24px; background: var(--surface-secondary); border-radius: 12px;">
        <div style="text-align: center;">
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Small (28px)</div>
          <BaseIconButton size="sm" title="Small icon button" @click="handleClick">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </BaseIconButton>
        </div>

        <div style="text-align: center;">
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Medium (32px)</div>
          <BaseIconButton size="md" title="Medium icon button" @click="handleClick">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </BaseIconButton>
        </div>

        <div style="text-align: center;">
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Large (40px)</div>
          <BaseIconButton size="lg" title="Large icon button" @click="handleClick">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </BaseIconButton>
        </div>
      </div>
    `,
  })
}

// Variant Showcase
export const Variants: Story = {
  render: () => ({
    components: { BaseIconButton },
    setup() {
      const handleClick = (variant: string) => {
        console.log(`${variant} variant clicked`)
      }

      const icons = {
        default: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
        primary: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
        success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
        warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
        danger: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>'
      }

      return { handleClick, icons }
    },
    template: `
      <div style="display: flex; align-items: center; gap: 20px; padding: 24px; background: var(--surface-secondary); border-radius: 12px; flex-wrap: wrap;">
        <div style="text-align: center;">
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Default</div>
          <BaseIconButton variant="default" title="Default variant" @click="handleClick('default')">
            <span v-html="icons.default"></span>
          </BaseIconButton>
        </div>

        <div style="text-align: center;">
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Primary</div>
          <BaseIconButton variant="primary" title="Primary variant" @click="handleClick('primary')">
            <span v-html="icons.primary"></span>
          </BaseIconButton>
        </div>

        <div style="text-align: center;">
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Success</div>
          <BaseIconButton variant="success" title="Success variant" @click="handleClick('success')">
            <span v-html="icons.success"></span>
          </BaseIconButton>
        </div>

        <div style="text-align: center;">
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Warning</div>
          <BaseIconButton variant="warning" title="Warning variant" @click="handleClick('warning')">
            <span v-html="icons.warning"></span>
          </BaseIconButton>
        </div>

        <div style="text-align: center;">
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Danger</div>
          <BaseIconButton variant="danger" title="Danger variant" @click="handleClick('danger')">
            <span v-html="icons.danger"></span>
          </BaseIconButton>
        </div>
      </div>
    `,
  })
}

// Active States
export const ActiveStates: Story = {
  render: () => ({
    components: { BaseIconButton },
    setup() {
      const activeStates = ref({
        primary: true,
        secondary: false,
        tertiary: false
      })

      const toggleActive = (state: keyof typeof activeStates.value) => {
        activeStates.value[state] = !activeStates.value[state]
      }

      return { activeStates, toggleActive }
    },
    template: `
      <div style="display: flex; align-items: center; gap: 20px; padding: 24px; background: var(--surface-secondary); border-radius: 12px;">
        <div style="text-align: center;">
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Active</div>
          <BaseIconButton
            :active="activeStates.primary"
            title="Toggle active state"
            @click="toggleActive('primary')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </BaseIconButton>
        </div>

        <div style="text-align: center;">
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Normal</div>
          <BaseIconButton
            :active="activeStates.secondary"
            title="Toggle active state"
            @click="toggleActive('secondary')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </BaseIconButton>
        </div>

        <div style="text-align: center;">
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Toggle</div>
          <BaseIconButton
            :active="activeStates.tertiary"
            title="Toggle active state"
            @click="toggleActive('tertiary')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </BaseIconButton>
        </div>
      </div>
    `,
  })
}

// Disabled States
export const DisabledStates: Story = {
  render: () => ({
    components: { BaseIconButton },
    setup() {
      const handleClick = () => console.log('This should not fire')

      return { handleClick }
    },
    template: `
      <div style="display: flex; align-items: center; gap: 20px; padding: 24px; background: var(--surface-secondary); border-radius: 12px;">
        <div style="text-align: center;">
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Disabled</div>
          <BaseIconButton disabled title="Disabled button" @click="handleClick">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </BaseIconButton>
        </div>

        <div style="text-align: center;">
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Disabled Primary</div>
          <BaseIconButton disabled variant="primary" title="Disabled primary button" @click="handleClick">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </BaseIconButton>
        </div>

        <div style="text-align: center;">
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Disabled Active</div>
          <BaseIconButton disabled active title="Disabled active button" @click="handleClick">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </BaseIconButton>
        </div>
      </div>
    `,
  })
}

// Common Icons
export const CommonIcons: Story = {
  render: () => ({
    components: { BaseIconButton },
    setup() {
      const handleIconClick = (iconName: string) => {
        console.log(`${iconName} icon clicked`)
      }

      const commonIcons = {
        add: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
        edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
        delete: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>',
        search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
        settings: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m4.22-13.22l4.24 4.24M1.54 9.96l4.24 4.24M1.54 14.04l4.24-4.24M18.46 14.04l4.24-4.24"/></svg>',
        close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>',
        menu: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>',
        more: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>'
      }

      return { handleIconClick, commonIcons }
    },
    template: `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 16px; padding: 24px; background: var(--surface-secondary); border-radius: 12px;">
        <div v-for="(icon, name) in commonIcons" :key="name" style="text-align: center;">
          <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px; text-transform: capitalize;">{{ name }}</div>
          <BaseIconButton
            :title="name + ' icon'"
            @click="handleIconClick(name)"
          >
            <span v-html="icon"></span>
          </BaseIconButton>
        </div>
      </div>
    `,
  })
}

// Interactive Demo
export const InteractiveDemo: Story = {
  render: () => ({
    components: { BaseIconButton },
    setup() {
      const clickCount = ref(0)
      const isToggled = ref(false)
      const selectedVariant = ref('default')
      const selectedSize = ref('md')

      const variants = ['default', 'primary', 'success', 'warning', 'danger']
      const sizes = ['sm', 'md', 'lg']

      const handleClick = () => {
        clickCount.value++
        console.log(`Button clicked ${clickCount.value} times`)
      }

      const handleToggle = () => {
        isToggled.value = !isToggled.value
        console.log(`Toggle state: ${isToggled.value ? 'active' : 'inactive'}`)
      }

      return {
        clickCount,
        isToggled,
        selectedVariant,
        selectedSize,
        variants,
        sizes,
        handleClick,
        handleToggle
      }
    },
    template: `
      <div style="padding: 32px; background: var(--surface-secondary); border-radius: 12px; min-width: 400px;">
        <h3 style="margin: 0 0 24px 0; font-size: 18px; color: var(--text-primary);">Interactive Icon Button Demo</h3>

        <!-- Controls -->
        <div style="margin-bottom: 24px;">
          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Variant:</label>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button
                v-for="variant in variants"
                :key="variant"
                @click="selectedVariant = variant"
                :style="{
                  padding: '6px 12px',
                  background: selectedVariant === variant ? 'transparent' : 'var(--glass-bg-medium)',
                  color: selectedVariant === variant ? 'var(--brand-primary)' : 'var(--text-primary)',
                  border: selectedVariant === variant ? '1px solid var(--brand-primary)' : '1px solid var(--glass-border)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  boxShadow: selectedVariant === variant ? '0 0 0 1px var(--brand-primary) inset' : 'none'
                }"
              >
                {{ variant }}
              </button>
            </div>
          </div>

          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Size:</label>
            <div style="display: flex; gap: 8px;">
              <button
                v-for="size in sizes"
                :key="size"
                @click="selectedSize = size"
                :style="{
                  padding: '6px 12px',
                  background: selectedSize === size ? 'transparent' : 'var(--glass-bg-medium)',
                  color: selectedSize === size ? 'var(--brand-primary)' : 'var(--text-primary)',
                  border: selectedSize === size ? '1px solid var(--brand-primary)' : '1px solid var(--glass-border)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  boxShadow: selectedSize === size ? '0 0 0 1px var(--brand-primary) inset' : 'none'
                }"
              >
                {{ size }}
              </button>
            </div>
          </div>
        </div>

        <!-- Demo Area -->
        <div style="display: flex; align-items: center; gap: 24px; padding: 24px; background: var(--surface-primary); border-radius: 8px; border: 1px solid var(--border-subtle);">
          <div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Click Counter</div>
            <BaseIconButton
              :variant="selectedVariant"
              :size="selectedSize"
              :title="\`Click me! (\${clickCount} clicks)\`"
              @click="handleClick"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </BaseIconButton>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 8px;">Clicked: {{ clickCount }} times</div>
          </div>

          <div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Toggle Button</div>
            <BaseIconButton
              :variant="selectedVariant"
              :size="selectedSize"
              :active="isToggled"
              :title="\`Toggle state: \${isToggled ? 'active' : 'inactive'}\`"
              @click="handleToggle"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </BaseIconButton>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 8px;">State: {{ isToggled ? 'Active' : 'Inactive' }}</div>
          </div>
        </div>

        <!-- Instructions -->
        <div style="margin-top: 24px; padding: 16px; background: var(--glass-bg-soft); border-radius: 8px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 8px 0; font-size: 14px; color: var(--text-primary);">Features</h4>
          <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
            <li><strong>Click counter</strong> - Tracks total clicks</li>
            <li><strong>Toggle state</strong> - Switches between active/inactive</li>
            <li><strong>Variant controls</strong> - Change visual style</li>
            <li><strong>Size controls</strong> - Adjust button dimensions</li>
            <li><strong>Tooltips</strong> - Hover for information</li>
          </ul>
        </div>
      </div>
    `,
  })
}