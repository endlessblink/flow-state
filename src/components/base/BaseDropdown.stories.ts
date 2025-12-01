import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import { User, Settings, LogOut, Bell, Shield, Palette } from 'lucide-vue-next'
import BaseDropdown from './BaseDropdown.vue'

const meta = {
  title: 'Overlays/Dropdowns/BaseDropdown',
  component: BaseDropdown,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Base dropdown component with glass morphism styling, keyboard navigation, and customizable options.'
      }
    }
  },
  argTypes: {
    modelValue: {
      control: 'text',
      description: 'Current selected value'
    },
    options: {
      control: 'object',
      description: 'Array of dropdown options'
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text when no option is selected'
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the dropdown is disabled'
    },
    multiple: {
      control: 'boolean',
      description: 'Whether multiple selection is allowed'
    },
    searchable: {
      control: 'boolean',
      description: 'Whether the dropdown is searchable'
    }
  },
  args: {
    placeholder: 'Select an option',
    disabled: false,
    multiple: false,
    searchable: false
  }
} satisfies Meta<typeof BaseDropdown>

export default meta
type Story = StoryObj<typeof meta>

const basicOptions = [
  { label: 'Profile', value: 'profile', icon: User },
  { label: 'Settings', value: 'settings', icon: Settings },
  { label: 'Notifications', value: 'notifications', icon: Bell },
  { label: 'Security', value: 'security', icon: Shield },
  { label: 'Appearance', value: 'appearance', icon: Palette },
  { label: 'Sign Out', value: 'signout', icon: LogOut }
]

const statusOptions = [
  { label: 'Not Started', value: 'not_started' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'On Hold', value: 'on_hold' },
  { label: 'Cancelled', value: 'cancelled' }
]

const priorityOptions = [
  { label: 'Low Priority', value: 'low' },
  { label: 'Medium Priority', value: 'medium' },
  { label: 'High Priority', value: 'high' },
  { label: 'Critical Priority', value: 'critical' }
]

export const Default: Story = {
  args: {
    modelValue: '',
    options: basicOptions,
    placeholder: 'Choose an option'
  },
  render: (args) => ({
    components: { BaseDropdown },
    setup() {
      const value = ref((args as Record<string, unknown>).modelValue ?? '')
      return { args, value }
    },
    template: `
      <div style="width: 300px; padding: 20px;">
        <h3 style="color: white; margin-bottom: 16px;">Basic Dropdown</h3>
        <BaseDropdown
          v-model="value"
          v-bind="args"
          @update:modelValue="newValue => { value = newValue; action('change')(newValue) }"
        />
        <p style="color: #9ca3af; margin-top: 12px; font-size: 14px;">
          Selected: {{ value || 'None' }}
        </p>
      </div>
    `
  })
}

export const WithPreselection: Story = {
  args: {
    modelValue: 'settings',
    options: basicOptions,
    placeholder: 'Choose an option'
  }
}

export const StatusSelector: Story = {
  args: {
    modelValue: 'in_progress',
    options: statusOptions,
    placeholder: 'Select status'
  }
}

export const PrioritySelector: Story = {
  args: {
    modelValue: 'high',
    options: priorityOptions,
    placeholder: 'Select priority'
  }
}

export const MultipleSelection: Story = {
  args: {
    modelValue: ['in_progress', 'on_hold'],
    options: statusOptions,
    placeholder: 'Select statuses',
    multiple: true
  },
  render: (args) => ({
    components: { BaseDropdown },
    setup() {
      const value = ref((args as Record<string, unknown>).modelValue ?? [])
      return { args, value }
    },
    template: `
      <div style="width: 300px; padding: 20px;">
        <h3 style="color: white; margin-bottom: 16px;">Multiple Selection</h3>
        <BaseDropdown
          v-model="value"
          v-bind="args"
          @update:modelValue="newValue => { value = newValue; action('change')(newValue) }"
        />
        <p style="color: #9ca3af; margin-top: 12px; font-size: 14px;">
          Selected: {{ Array.isArray(value) ? value.join(', ') : value }}
        </p>
      </div>
    `
  })
}

export const Disabled: Story = {
  args: {
    modelValue: 'settings',
    options: basicOptions,
    placeholder: 'Choose an option',
    disabled: true
  }
}

export const WithDisabledOptions: Story = {
  args: {
    modelValue: '',
    options: [
      { label: 'Available Option', value: 'available' },
      { label: 'Disabled Option', value: 'disabled', disabled: true },
      { label: 'Another Available', value: 'another' },
      { label: 'Also Disabled', value: 'also_disabled', disabled: true }
    ],
    placeholder: 'Select an option'
  }
}

export const LongOptions: Story = {
  args: {
    modelValue: '',
    options: [
      { label: 'This is a very long option name that might wrap', value: 'long1' },
      { label: 'Another extremely long option name for testing', value: 'long2' },
      { label: 'Short', value: 'short' },
      { label: 'Medium length option', value: 'medium' }
    ],
    placeholder: 'Select an option'
  }
}

export const CustomStyling: Story = {
  args: {
    modelValue: 'critical',
    options: [
      { label: '🟢 Low Priority', value: 'low' },
      { label: '🟡 Medium Priority', value: 'medium' },
      { label: '🟠 High Priority', value: 'high' },
      { label: '🔴 Critical Priority', value: 'critical' }
    ],
    placeholder: 'Select task priority'
  }
}