import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import CustomSelect from '@/components/CustomSelect.vue'

const meta = {
  title: '🧩 Components/📝 Form Controls/CustomSelect',
  component: CustomSelect,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Accessible select dropdown component with keyboard navigation and click-outside handling.'
      }
    }
  }
} satisfies Meta<typeof CustomSelect>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { CustomSelect },
    setup() {
      const selected = ref('option1')
      return { selected, args }
    },
    template: `
      <div style="width: 300px;">
        <CustomSelect 
          v-model="selected"
          :options="args.options"
          :placeholder="args.placeholder"
        />
        <p style="margin-top: 16px; color: var(--text-secondary);">Selected: {{ selected }}</p>
      </div>
    `
  }),
  args: {
    options: [
      { label: 'Option 1', value: 'option1' },
      { label: 'Option 2', value: 'option2' },
      { label: 'Option 3', value: 'option3' }
    ],
    placeholder: 'Select an option...'
  }
}

export const AllStates: Story = {
  render: (args) => ({
    components: { CustomSelect },
    setup() {
      const selected1 = ref('blue')
      const selected2 = ref('')
      return { selected1, selected2, args }
    },
    template: `
      <div style="display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 400px;">
        <div>
          <h4 style="margin: 0 0 8px 0; color: var(--text-secondary); font-size: 12px;">With Selection</h4>
          <CustomSelect 
            v-model="selected1"
            :options="args.options"
            placeholder="Choose color..."
          />
        </div>
        
        <div>
          <h4 style="margin: 0 0 8px 0; color: var(--text-secondary); font-size: 12px;">Empty State</h4>
          <CustomSelect 
            v-model="selected2"
            :options="args.options"
            :placeholder="args.placeholder"
          />
        </div>
      </div>
    `
  }),
  args: {
    options: [
      { label: 'Red', value: 'red' },
      { label: 'Green', value: 'green' },
      { label: 'Blue', value: 'blue' }
    ],
    placeholder: 'Select a color...'
  }
}

export const Interactive: Story = {
  render: (args) => ({
    components: { CustomSelect },
    setup() {
      const selected = ref('')
      return { selected, args }
    },
    template: `
      <div style="display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 400px;">
        <CustomSelect 
          v-model="selected"
          :options="args.options"
          :placeholder="args.placeholder"
        />
        
        <div style="padding: 12px; background: var(--surface-tertiary); border-radius: 8px;">
          <p style="margin: 0; font-size: 13px;">
            <strong>Selected:</strong> {{ selected || 'None' }}
          </p>
        </div>
      </div>
    `
  }),
  args: {
    options: [
      { label: 'Priority High', value: 'high' },
      { label: 'Priority Medium', value: 'medium' },
      { label: 'Priority Low', value: 'low' }
    ],
    placeholder: 'Select priority...'
  }
}
