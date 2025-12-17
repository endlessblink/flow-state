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
  render: (args) => ({
    components: { BaseInput },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: 40px; background: rgba(0, 0, 0, 0.95); border-radius: 12px;">
        <BaseInput v-bind="args" style="width: 300px;" />
      </div>
    `,
  })
}

export const WithLabel: Story = {
  args: {
    label: 'Task Title',
    placeholder: 'Enter task title...',
  },
  render: (args) => ({
    components: { BaseInput },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: 40px; background: rgba(0, 0, 0, 0.95); border-radius: 12px;">
        <BaseInput v-bind="args" style="width: 300px;" />
      </div>
    `,
  })
}

export const WithHelperText: Story = {
  args: {
    label: 'Task Description',
    placeholder: 'Describe your task...',
    helperText: 'Be specific about what needs to be done',
  },
  render: (args) => ({
    components: { BaseInput },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: 40px; background: rgba(0, 0, 0, 0.95); border-radius: 12px;">
        <BaseInput v-bind="args" style="width: 300px;" />
      </div>
    `,
  })
}

export const Required: Story = {
  args: {
    label: 'Due Date',
    type: 'date',
    required: true,
    helperText: 'Required field - select a due date',
  },
  render: (args) => ({
    components: { BaseInput },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: 40px; background: rgba(0, 0, 0, 0.95); border-radius: 12px;">
        <BaseInput v-bind="args" style="width: 300px;" />
      </div>
    `,
  })
}

// Input Types
export const InputTypes: Story = {
  render: () => ({
    components: { BaseInput },
    template: `
      <div style="padding: 40px; min-height: 500px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Input Types</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Different input types for various data</p>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; max-width: 700px;">
          <BaseInput
            label="Task Name"
            type="text"
            placeholder="Enter task name..."
            model-value="Complete project documentation"
          />
          <BaseInput
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            model-value="user@example.com"
          />
          <BaseInput
            label="Estimated Hours"
            type="number"
            placeholder="0"
            model-value="4"
            helper-text="How many pomodoro sessions do you estimate?"
          />
          <BaseInput
            label="Password"
            type="password"
            placeholder="Enter password..."
            helper-text="Use a strong password with at least 8 characters"
          />
          <BaseInput
            label="Start Date"
            type="date"
            model-value="2024-10-25"
          />
          <BaseInput
            label="Start Time"
            type="time"
            model-value="09:00"
          />
        </div>
      </div>
    `,
  })
}

// State Variants
export const States: Story = {
  render: () => ({
    components: { BaseInput },
    template: `
      <div style="padding: 40px; min-height: 300px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Input States</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Different interaction states</p>

        <div style="display: flex; gap: 24px; flex-wrap: wrap;">
          <div style="display: flex; flex-direction: column; gap: 8px; width: 250px;">
            <BaseInput
              label="Disabled Input"
              placeholder="This input is disabled"
              disabled
              model-value="Pre-filled value"
            />
            <span style="color: var(--text-muted); font-size: 11px;">Disabled</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px; width: 250px;">
            <BaseInput
              label="Project Name"
              placeholder="Enter project name..."
              model-value="My Awesome Project"
            />
            <span style="color: var(--text-muted); font-size: 11px;">With Value</span>
          </div>
        </div>
      </div>
    `,
  })
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
      <div style="padding: 40px; min-height: 500px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Interactive Form</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Form inputs with live data binding</p>

        <div style="display: flex; flex-direction: column; gap: 20px; max-width: 400px;">
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

          <div style="padding: 16px; background: transparent; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px;">
            <strong style="color: var(--text-primary);">Form Data:</strong>
            <pre style="margin: 8px 0 0 0; font-size: 12px; color: var(--text-secondary);">{{ JSON.stringify(formData, null, 2) }}</pre>
          </div>
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
      <div style="padding: 40px; min-height: 400px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Input with Slots</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Prefix and suffix slot usage</p>

        <div style="display: flex; flex-direction: column; gap: 20px; max-width: 400px;">
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
      </div>
    `,
  })
}

// Validation States Demo
export const ValidationStates: Story = {
  render: () => ({
    components: { BaseInput },
    template: `
      <div style="padding: 40px; min-height: 400px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Validation States</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Visual feedback for validation</p>

        <div style="display: flex; flex-direction: column; gap: 20px; max-width: 400px;">
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
      </div>
    `,
  })
}

// All Variants Showcase
export const AllVariants: Story = {
  render: () => ({
    components: { BaseInput },
    template: `
      <div style="padding: 40px; min-height: 500px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">All Input Variants</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Complete overview of input styles and states</p>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; max-width: 700px;">
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <h4 style="margin: 0; color: var(--text-muted); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Basic Variants</h4>

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
            <h4 style="margin: 0; color: var(--text-muted); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">States</h4>

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
      </div>
    `,
  })
}