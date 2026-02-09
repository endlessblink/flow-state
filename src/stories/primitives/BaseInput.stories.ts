import type { Meta, StoryObj } from '@storybook/vue3'
import { ref, onMounted } from 'vue'
import { Search, Mail, Lock, User } from 'lucide-vue-next'
import BaseInput from '@/components/base/BaseInput.vue'

const meta = {
  title: '🧩 Primitives/BaseInput',
  component: BaseInput,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Glass morphism input field with validation, icons, and RTL support.'
      }
    }
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="padding: 60px; background: var(--app-background-gradient); border-radius: 12px; display: flex; align-items: center; justify-content: center; min-width: 400px;">
          <story />
        </div>
      `
    })
  ],
  argTypes: {
    type: {
      control: 'text',
      description: 'The type of input (text, email, password, etc.)'
    },
    label: {
      control: 'text',
      description: 'Label text'
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text'
    },
    helperText: {
      control: 'text',
      description: 'Small helper text below the input'
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the input is disabled'
    },
    required: {
      control: 'boolean',
      description: 'Whether the input is required'
    }
  },
  args: {
    type: 'text',
    label: 'Email Address',
    placeholder: 'Enter your email...',
    helperText: 'We will never share your email.',
    disabled: false,
    required: false
  }
} satisfies Meta<typeof BaseInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { BaseInput },
    setup() {
      const value = ref('')
      return { args, value }
    },
    template: `
      <div style="width: 320px;">
        <BaseInput v-bind="args" v-model="value" />
      </div>
    `
  })
}

export const AccessibilityVerification: Story = {
  render: (args) => ({
    components: { BaseInput },
    setup() {
      onMounted(() => {
        // Find the input within our specific test container
        const container = document.getElementById('a11y-check')
        if (!container) return // Should not happen

        const input = container.querySelector('input')
        if (!input) throw new Error('Input element not found')

        const ariaDescribedBy = input.getAttribute('aria-describedby')
        if (!ariaDescribedBy) throw new Error('aria-describedby attribute is missing')

        const helper = document.getElementById(ariaDescribedBy)
        if (!helper) throw new Error(`Helper element with id "${ariaDescribedBy}" not found`)

        if (helper.textContent?.trim() !== args.helperText) {
          throw new Error(`Helper text mismatch. Expected: "${args.helperText}", Found: "${helper.textContent?.trim()}"`)
        }

        console.log('✅ Accessibility check passed: aria-describedby links to helper text correctly.')
      })
      return { args }
    },
    template: `
      <div id="a11y-check" style="width: 320px;">
        <BaseInput v-bind="args" />
      </div>
    `
  }),
  args: {
    label: 'Accessible Input',
    helperText: 'This helper text should be linked via aria-describedby'
  }
}

export const WithIcons: Story = {
  render: (args) => ({
    components: { BaseInput, Search, Mail, Lock },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 320px; display: flex; flex-direction: column; gap: 20px;">
        <BaseInput label="Search" placeholder="Search tasks...">
          <template #prefix>
            <Search :size="16" style="color: #9ca3af; margin-left: 8px;" />
          </template>
        </BaseInput>

        <BaseInput label="Email" placeholder="user@example.com" type="email">
          <template #prefix>
            <Mail :size="16" style="color: #9ca3af; margin-left: 8px;" />
          </template>
        </BaseInput>

        <BaseInput label="Password" type="password" placeholder="••••••••">
          <template #prefix>
            <Lock :size="16" style="color: #9ca3af; margin-left: 8px;" />
          </template>
        </BaseInput>
      </div>
    `
  })
}

export const States: Story = {
  render: (args) => ({
    components: { BaseInput },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 320px; display: flex; flex-direction: column; gap: 20px;">
        <BaseInput label="Disabled Input" disabled placeholder="Cannot type here..." />
        <BaseInput label="Required Input" required placeholder="Must fill this..." />
        <BaseInput label="With Helper Text" helperText="This is some extra context for the user." />
      </div>
    `
  })
}

export const RTLSupport: Story = {
  args: {
    label: 'חיפוש',
    placeholder: 'חפש משימות...',
  },
  render: (args) => ({
    components: { BaseInput, Search },
    setup() {
      const value = ref('שלום עולם')
      return { args, value }
    },
    template: `
      <div style="width: 320px;" dir="rtl">
        <BaseInput v-bind="args" v-model="value">
          <template #prefix>
            <Search :size="16" style="color: #9ca3af; margin-right: 8px;" />
          </template>
        </BaseInput>
        <p style="color: #9ca3af; margin-top: 12px; font-size: 14px; text-align: right;">
          Hebrew text automatically aligns to the right.
        </p>
      </div>
    `
  })
}
