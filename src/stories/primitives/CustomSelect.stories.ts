import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import CustomSelect from '@/components/common/CustomSelect.vue'

const meta: Meta<typeof CustomSelect> = {
  title: '🧩 Primitives/CustomSelect',
  component: CustomSelect,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Custom dropdown select component that replaces native <select> elements for consistent cross-platform styling. Designed to match BaseDropdown styling.',
      },
    },
  },
  argTypes: {
    modelValue: {
      control: 'text',
      description: 'Currently selected value',
    },
    options: {
      control: 'object',
      description: 'Array of options with label and value',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text when no value selected',
    },
  },
  decorators: [
    () => ({
      template: `
        <div style="
          background: var(--surface-primary);
          padding: 3rem;
          min-width: 400px;
          min-height: 400px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          gap: 2rem;
        ">
          <story />
        </div>
      `,
    }),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

// Basic example with simple options
export const Default: Story = {
  args: {
    options: [
      { label: 'Option 1', value: '1' },
      { label: 'Option 2', value: '2' },
      { label: 'Option 3', value: '3' },
    ],
    modelValue: '1',
    placeholder: 'Select an option...',
  },
}

// Projects filter example (matching FilterControls)
export const ProjectsFilter: Story = {
  args: {
    options: [
      { label: 'All Projects', value: '' },
      { label: 'Work', value: 'project-1' },
      { label: 'Personal', value: 'project-2' },
      { label: 'Side Projects', value: 'project-3' },
    ],
    modelValue: '',
    placeholder: 'All Projects',
  },
}

// Status filter example
export const StatusFilter: Story = {
  args: {
    options: [
      { label: 'All Status', value: '' },
      { label: 'Planned', value: 'planned' },
      { label: 'In Progress', value: 'in_progress' },
      { label: 'Done', value: 'done' },
      { label: 'Backlog', value: 'backlog' },
      { label: 'On Hold', value: 'on_hold' },
    ],
    modelValue: 'in_progress',
    placeholder: 'All Status',
  },
}

// Priority select example
export const PrioritySelect: Story = {
  args: {
    options: [
      { label: "Don't change", value: '' },
      { label: 'High', value: 'high' },
      { label: 'Medium', value: 'medium' },
      { label: 'Low', value: 'low' },
    ],
    modelValue: 'high',
    placeholder: 'Select priority...',
  },
}

// Interactive example with state management
export const Interactive: Story = {
  render: () => ({
    components: { CustomSelect },
    setup() {
      const selectedValue = ref('option-2')
      const options = [
        { label: 'First Option', value: 'option-1' },
        { label: 'Second Option', value: 'option-2' },
        { label: 'Third Option', value: 'option-3' },
        { label: 'Fourth Option', value: 'option-4' },
        { label: 'Fifth Option', value: 'option-5' },
      ]
      return { selectedValue, options }
    },
    template: `
      <div style="width: 280px;">
        <CustomSelect
          v-model="selectedValue"
          :options="options"
          placeholder="Choose an option..."
        />
        <p style="margin-top: 1rem; font-size: 0.875rem; color: var(--text-secondary);">
          Selected: <strong style="color: var(--brand-primary);">{{ selectedValue }}</strong>
        </p>
      </div>
    `,
  }),
}

// Multiple selects in a row (like FilterControls)
export const FilterRow: Story = {
  render: () => ({
    components: { CustomSelect },
    setup() {
      const projectValue = ref('')
      const taskValue = ref('')
      const statusValue = ref('')

      const projectOptions = [
        { label: 'All Projects', value: '' },
        { label: 'Work', value: 'work' },
        { label: 'Personal', value: 'personal' },
      ]

      const taskOptions = [
        { label: 'All Tasks', value: '' },
        { label: 'Today', value: 'today' },
        { label: 'This Week', value: 'week' },
      ]

      const statusOptions = [
        { label: 'All Status', value: '' },
        { label: 'Planned', value: 'planned' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Done', value: 'done' },
      ]

      return {
        projectValue, taskValue, statusValue,
        projectOptions, taskOptions, statusOptions
      }
    },
    template: `
      <div style="display: flex; gap: var(--space-3); flex-wrap: wrap;">
        <div style="min-width: 140px;">
          <CustomSelect
            v-model="projectValue"
            :options="projectOptions"
            placeholder="All Projects"
          />
        </div>
        <div style="min-width: 120px;">
          <CustomSelect
            v-model="taskValue"
            :options="taskOptions"
            placeholder="All Tasks"
          />
        </div>
        <div style="min-width: 120px;">
          <CustomSelect
            v-model="statusValue"
            :options="statusOptions"
            placeholder="All Status"
          />
        </div>
      </div>
    `,
  }),
}

// With many options (scrollable)
export const ManyOptions: Story = {
  args: {
    options: Array.from({ length: 20 }, (_, i) => ({
      label: `Option ${i + 1}`,
      value: `option-${i + 1}`,
    })),
    modelValue: 'option-5',
    placeholder: 'Select from many...',
  },
}
