import { ref } from 'vue'
import BaseDropdown from '@/components/base/BaseDropdown.vue'

const meta = {
  title: '🧩 Primitives/BaseDropdown',
  component: BaseDropdown,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0f172a' },
      ],
    },
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="padding: 100px; background: var(--app-background-gradient); min-height: 300px; display: flex; align-items: center; justify-content: center; border-radius: 12px;">
          <story />
        </div>
      `
    })
  ],
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
