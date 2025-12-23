import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import BasePopover from '@/components/base/BasePopover.vue'
import BaseButton from '@/components/base/BaseButton.vue'

const meta = {
  title: '🧩 Primitives/BasePopover',
  component: BasePopover,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Low-level popover component with glass morphism styling, used as a foundation for dropdowns, menus, and tooltips.'
      }
    }
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="padding: 100px; background: var(--app-background-gradient); border-radius: 12px; display: flex; align-items: center; justify-content: center; min-width: 400px; min-height: 200px;">
          <story />
        </div>
      `
    })
  ],
  argTypes: {
    isVisible: {
      control: 'boolean',
      description: 'Whether the popover is visible'
    },
    variant: {
      control: 'select',
      options: ['menu', 'tooltip', 'dropdown'],
      description: 'Visual variant of the popover'
    },
    position: {
      control: 'select',
      options: ['auto', 'top', 'bottom', 'left', 'right'],
      description: 'Preferred position relative to anchor'
    }
  },
  args: {
    isVisible: false,
    variant: 'menu',
    position: 'auto',
    x: 0,
    y: 0
  }
} satisfies Meta<typeof BasePopover>

export default meta
type Story = StoryObj<typeof meta>

export const Interactive: Story = {
  render: (args) => ({
    components: { BasePopover, BaseButton },
    setup() {
      const isVisible = ref(false)
      const buttonRef = ref<HTMLElement | null>(null)
      const popoverX = ref(0)
      const popoverY = ref(0)

      const togglePopover = () => {
        if (buttonRef.value) {
          const rect = buttonRef.value.getBoundingClientRect()
          popoverX.value = rect.left + rect.width / 2
          popoverY.value = rect.bottom
        }
        isVisible.value = !isVisible.value
      }

      return { args, isVisible, togglePopover, buttonRef, popoverX, popoverY }
    },
    template: `
      <div>
        <BaseButton ref="buttonRef" @click="togglePopover">
          Toggle Popover
        </BaseButton>

        <BasePopover
          v-bind="args"
          :is-visible="isVisible"
          :x="popoverX"
          :y="popoverY"
          @close="isVisible = false"
        >
          <div style="color: white; padding: 12px;">
            <h4 style="margin: 0 0 8px 0;">Popover Content</h4>
            <p style="margin: 0; font-size: 14px; color: #9ca3af;">
              This content is rendered inside the glass popover.
            </p>
          </div>
        </BasePopover>
      </div>
    `
  })
}

export const TooltipVariant: Story = {
  args: {
    variant: 'tooltip',
    isVisible: true,
    x: 100,
    y: 100
  },
  render: (args) => ({
    components: { BasePopover },
    setup() {
      return { args }
    },
    template: `
      <BasePopover v-bind="args">
        Tooltip content
      </BasePopover>
    `
  })
}
