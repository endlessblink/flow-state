import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import BaseDropdown from '@/components/base/BaseDropdown.vue'

const meta: Meta<typeof BaseDropdown> = {
  title: '🧩 Primitives/BaseDropdown',
  component: BaseDropdown,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    placeholder: {
      control: 'text',
      description: 'Placeholder text when no option selected',
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled state',
    },
    multiple: {
      control: 'boolean',
      description: 'Allow multiple selections',
    },
    searchable: {
      control: 'boolean',
      description: 'Enable search/filter functionality',
    },
  },
}

export default meta
type Story = StoryObj<typeof BaseDropdown>

// Glass morphism container style
const glassContainer = `
  padding: 40px;
  background: rgba(28, 25, 45, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
`

// Default
export const Default: Story = {
  args: {
    options: [
      { label: 'Option 1', value: '1' },
      { label: 'Option 2', value: '2' },
      { label: 'Option 3', value: '3' }
    ],
    placeholder: 'Select an option'
  },
  render: (args) => ({
    components: { BaseDropdown },
    setup() {
      const selected = ref('')
      return { args, selected, glassContainer }
    },
    template: `
      <div :style="glassContainer + 'min-width: 300px;'">
        <BaseDropdown v-model="selected" v-bind="args" />
      </div>
    `,
  })
}

// All Variants Showcase
export const AllVariants: Story = {
  render: () => ({
    components: { BaseDropdown },
    setup() {
      const selected1 = ref('')
      const selected2 = ref('2')
      const selected3 = ref('')
      const options = [
        { label: 'Option 1', value: '1' },
        { label: 'Option 2', value: '2' },
        { label: 'Option 3', value: '3' }
      ]
      return { selected1, selected2, selected3, options, glassContainer }
    },
    template: `
      <div :style="glassContainer + 'min-height: 400px;'">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">BaseDropdown Variants</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Dropdown component with various states</p>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; align-items: start;">
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <h4 style="margin: 0; color: var(--text-muted); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Default</h4>
            <BaseDropdown v-model="selected1" :options="options" placeholder="Select an option" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            <h4 style="margin: 0; color: var(--text-muted); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">With Selection</h4>
            <BaseDropdown v-model="selected2" :options="options" placeholder="Select an option" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            <h4 style="margin: 0; color: var(--text-muted); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Disabled</h4>
            <BaseDropdown v-model="selected3" :options="options" placeholder="Disabled dropdown" disabled />
          </div>
        </div>

        <!-- Feature info -->
        <div style="margin-top: 32px; padding: 20px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px;">
          <h4 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-primary);">Design Pattern</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 13px; line-height: 1.8;">
            <li><strong>Stroke-only trigger</strong> - No solid fill backgrounds</li>
            <li><strong>Glass morphism dropdown</strong> - Subtle backdrop blur effect on menu</li>
            <li><strong>Keyboard navigation</strong> - Arrow keys and Enter to select</li>
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
    components: { BaseDropdown },
    setup() {
      const selected1 = ref('')
      const selected2 = ref('2')
      const selected3 = ref('')
      const options = [
        { label: 'Option 1', value: '1' },
        { label: 'Option 2', value: '2' },
        { label: 'Option 3', value: '3' }
      ]
      return { selected1, selected2, selected3, options, glassContainer }
    },
    template: `
      <div :style="glassContainer + 'min-height: 300px;'">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Dropdown States</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Different interaction states</p>

        <div style="display: flex; gap: 24px; flex-wrap: wrap;">
          <div style="display: flex; flex-direction: column; gap: 8px; align-items: center; min-width: 200px;">
            <BaseDropdown v-model="selected1" :options="options" placeholder="Select..." />
            <span style="color: var(--text-muted); font-size: 11px;">Empty</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px; align-items: center; min-width: 200px;">
            <BaseDropdown v-model="selected2" :options="options" placeholder="Select..." />
            <span style="color: var(--text-muted); font-size: 11px;">Selected</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px; align-items: center; min-width: 200px;">
            <BaseDropdown v-model="selected3" :options="options" placeholder="Disabled" disabled />
            <span style="color: var(--text-muted); font-size: 11px;">Disabled</span>
          </div>
        </div>
      </div>
    `,
  })
}

// Interactive Demo
export const InteractiveDemo: Story = {
  render: () => ({
    components: { BaseDropdown },
    setup() {
      const selected = ref('')
      const options = [
        { label: '🍎 Apple', value: 'apple' },
        { label: '🍌 Banana', value: 'banana' },
        { label: '🍊 Orange', value: 'orange' },
        { label: '🍇 Grape', value: 'grape' },
        { label: '🍓 Strawberry', value: 'strawberry' }
      ]
      return { selected, options, glassContainer }
    },
    template: `
      <div :style="glassContainer + 'min-height: 350px;'">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Interactive Demo</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Select your favorite fruit</p>

        <!-- Selection display -->
        <div style="margin-bottom: 24px; padding: 20px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; text-align: center;">
          <div style="font-size: 32px; margin-bottom: 8px;">{{ selected ? options.find(o => o.value === selected)?.label.split(' ')[0] : '🤔' }}</div>
          <div style="font-size: 14px; color: var(--text-secondary);">
            {{ selected ? 'You selected: ' + options.find(o => o.value === selected)?.label : 'Make a selection' }}
          </div>
        </div>

        <div style="display: flex; justify-content: center;">
          <div style="min-width: 250px;">
            <BaseDropdown v-model="selected" :options="options" placeholder="Choose a fruit..." />
          </div>
        </div>
      </div>
    `,
  })
}
