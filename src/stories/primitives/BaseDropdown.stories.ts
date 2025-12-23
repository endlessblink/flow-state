import { ref } from 'vue'
import BaseDropdown from '@/components/base/BaseDropdown.vue'

const meta = {
  title: '🧩 Primitives/BaseDropdown',
  component: BaseDropdown,
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
    placeholder: 'Select an option'
  }
}
