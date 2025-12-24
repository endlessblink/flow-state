import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import BaseDropdown from '@/components/base/BaseDropdown.vue'

const meta: Meta<typeof BaseDropdown> = {
  title: '🧩 Primitives/BaseDropdown',
  component: BaseDropdown,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      story: {
        inline: true,
        iframeHeight: 400,
      }
    }
  },
  decorators: [
    (story) => {
      // Inject styles to remove dropdown background fill
      if (typeof document !== 'undefined') {
        const styleId = 'basedropdown-story-styles'
        if (!document.getElementById(styleId)) {
          const style = document.createElement('style')
          style.id = styleId
          style.textContent = `
            .basedropdown-story-container .base-dropdown-trigger {
              background: transparent !important;
            }
          `
          document.head.appendChild(style)
        }
      }
      return {
        components: { story },
        template: `
          <div class="basedropdown-story-container" style="
            background: var(--glass-bg-solid);
            min-height: 400px;
            height: 100%;
            width: 100%;
            position: relative;
            overflow: visible;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            border-radius: 8px;
            padding: 2rem;
            padding-top: 4rem;
          ">
            <story />
          </div>
        `
      }
    }
  ],
}

export default meta
type Story = StoryObj<typeof BaseDropdown>

export const Default: Story = {
  args: {
    options: [
      { label: 'Option 1', value: '1' },
      { label: 'Option 2', value: '2' },
      { label: 'Option 3', value: '3' }
    ],
    placeholder: 'Select an option'
  }
}

export const WithSelection: Story = {
  render: () => ({
    components: { BaseDropdown },
    setup() {
      const selected = ref('2')
      const options = [
        { label: 'Option 1', value: '1' },
        { label: 'Option 2', value: '2' },
        { label: 'Option 3', value: '3' }
      ]
      return { selected, options }
    },
    template: `
      <BaseDropdown
        v-model="selected"
        :options="options"
        placeholder="Select an option"
      />
    `
  })
}

export const Disabled: Story = {
  args: {
    options: [
      { label: 'Option 1', value: '1' },
      { label: 'Option 2', value: '2' }
    ],
    placeholder: 'Disabled dropdown',
    disabled: true
  }
}
