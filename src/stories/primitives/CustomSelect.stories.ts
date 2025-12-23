import CustomSelect from '@/components/CustomSelect.vue'

const meta = {
  title: '🧩 Primitives/CustomSelect',
  component: CustomSelect,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  }
}

export default meta

export const Default = {
  args: {
    options: [
      { label: 'Option 1', value: '1' },
      { label: 'Option 2', value: '2' }
    ],
    modelValue: '1'
  }
}
