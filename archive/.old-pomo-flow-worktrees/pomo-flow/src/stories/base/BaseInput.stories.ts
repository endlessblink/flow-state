import type { Meta, StoryObj } from '@storybook/vue3'
import { reactive } from 'vue'
import BaseInput from '@/components/base/BaseInput.vue'

const meta = {
  component: BaseInput,
  title: '🧩 Components/🔘 Base/BaseInput',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof BaseInput>

export default meta
type Story = StoryObj<typeof meta>

// Basic Variants
export const Default: Story = {
  args: {
    placeholder: 'Enter text here...',
  },
}

export const WithLabel: Story = {
  args: {
    label: 'Task Title',
    placeholder: 'Enter task title...',
  },
}

export const WithHelperText: Story = {
  args: {
    label: 'Task Description',
    placeholder: 'Describe your task...',
    helperText: 'Be specific about what needs to be done',
  },
}

export const Required: Story = {
  args: {
    label: 'Due Date',
    type: 'date',
    required: true,
    helperText: 'Required field - select a due date',
  },
}

// Input Types
export const TextInput: Story = {
  args: {
    label: 'Task Name',
    type: 'text',
    placeholder: 'Enter task name...',
    modelValue: 'Complete project documentation',
  },
}

export const EmailInput: Story = {
  args: {
    label: 'Email Address',
    type: 'email',
    placeholder: 'you@example.com',
    modelValue: 'user@example.com',
  },
}

export const NumberInput: Story = {
  args: {
    label: 'Estimated Hours',
    type: 'number',
    placeholder: '0',
    modelValue: 4,
    helperText: 'How many pomodoro sessions do you estimate?',
  },
}

export const PasswordInput: Story = {
  args: {
    label: 'Password',
    type: 'password',
    placeholder: 'Enter password...',
    helperText: 'Use a strong password with at least 8 characters',
  },
}

export const DateInput: Story = {
  args: {
    label: 'Start Date',
    type: 'date',
    modelValue: '2024-10-25',
  },
}

export const TimeInput: Story = {
  args: {
    label: 'Start Time',
    type: 'time',
    modelValue: '09:00',
  },
}

// State Variants
export const Disabled: Story = {
  args: {
    label: 'Disabled Input',
    placeholder: 'This input is disabled',
    disabled: true,
    modelValue: 'Pre-filled value',
  },
}

export const WithDefaultValue: Story = {
  args: {
    label: 'Project Name',
    placeholder: 'Enter project name...',
    modelValue: 'My Awesome Project',
  },
}

// Interactive Examples
export const InteractiveForm: Story = {
  render: () => ({
    components: { BaseInput },
    setup() {
      const formData = reactive({
        title: '',
        description: '',
        priority: '',
        dueDate: '',
      })

      return { formData }
    },
    template: `
      <div style="display: flex; flex-direction: column; gap: 20px; min-width: 400px;">
        <BaseInput
          v-model="formData.title"
          label="Task Title"
          placeholder="What needs to be done?"
          required
          helper-text="Enter a clear, actionable title"
        />

        <BaseInput
          v-model="formData.description"
          label="Description"
          placeholder="Add more details..."
          helper-text="Optional: provide context and requirements"
        />

        <BaseInput
          v-model="formData.priority"
          label="Priority Level"
          placeholder="High, Medium, or Low"
        />

        <BaseInput
          v-model="formData.dueDate"
          label="Due Date"
          type="date"
          required
        />

        <div style="padding: 16px; background: var(--surface-tertiary); border-radius: 8px;">
          <strong>Form Data:</strong>
          <pre style="margin: 8px 0 0 0; font-size: 12px; color: var(--text-secondary);">{{ JSON.stringify(formData, null, 2) }}</pre>
        </div>
      </div>
    `,
  })
}

// With Slots Example
export const WithPrefixAndSuffix: Story = {
  render: () => ({
    components: { BaseInput },
    template: `
      <div style="display: flex; flex-direction: column; gap: 20px; min-width: 400px;">
        <BaseInput
          label="Search Tasks"
          placeholder="Search..."
          model-value="project"
        >
          <template #prefix>
            <span style="padding: 0 12px; color: var(--text-muted);">🔍</span>
          </template>
        </BaseInput>

        <BaseInput
          label="Time Estimate"
          placeholder="0"
          type="number"
          model-value="25"
        >
          <template #suffix>
            <span style="padding: 0 12px; color: var(--text-muted);">min</span>
          </template>
        </BaseInput>

        <BaseInput
          label="Website URL"
          placeholder="https://example.com"
          type="url"
          model-value="https://github.com"
        >
          <template #prefix>
            <span style="padding: 0 12px; color: var(--text-muted);">🌐</span>
          </template>
          <template #suffix>
            <span style="padding: 0 12px; color: var(--brand-primary);">↗</span>
          </template>
        </BaseInput>
      </div>
    `,
  })
}

// Validation States Demo
export const ValidationStates: Story = {
  render: () => ({
    components: { BaseInput },
    template: `
      <div style="display: flex; flex-direction: column; gap: 20px; min-width: 400px;">
        <BaseInput
          label="Valid Input"
          model-value="This looks good"
          helper-text="✓ Input is valid"
          style="--input-border: #22c55e; --input-border-focus: #22c55e;"
        />

        <BaseInput
          label="Warning Input"
          model-value="This might need attention"
          helper-text="⚠ Consider reviewing this value"
          style="--input-border: #f59e0b; --input-border-focus: #f59e0b;"
        />

        <BaseInput
          label="Error Input"
          model-value="This is invalid"
          helper-text="✗ Please correct this field"
          style="--input-border: #ef4444; --input-border-focus: #ef4444; --helper-text: #ef4444;"
        />
      </div>
    `,
  })
}

// All Variants Showcase
export const AllVariants: Story = {
  render: () => ({
    components: { BaseInput },
    template: `
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; min-width: 600px;">
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <h4 style="margin: 0; color: var(--text-secondary); font-size: 14px; font-weight: 600;">BASIC VARIANTS</h4>

          <BaseInput placeholder="Simple input" />

          <BaseInput
            label="With Label"
            placeholder="Has a label"
          />

          <BaseInput
            label="With Helper"
            placeholder="With helper text"
            helper-text="This is helper text"
          />

          <BaseInput
            label="Required Field"
            placeholder="Must be filled"
            required
          />
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          <h4 style="margin: 0; color: var(--text-secondary); font-size: 14px; font-weight: 600;">STATES</h4>

          <BaseInput
            label="With Value"
            model-value="Pre-filled content"
          />

          <BaseInput
            label="Disabled"
            model-value="Cannot edit this"
            disabled
          />

          <BaseInput
            label="Email Type"
            type="email"
            model-value="user@example.com"
          />

          <BaseInput
            label="Number Type"
            type="number"
            model-value="42"
          />
        </div>
      </div>
    `,
  })
}