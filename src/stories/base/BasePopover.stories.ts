import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import BasePopover from '@/components/base/BasePopover.vue'
import { Settings, User, LogOut, HelpCircle } from 'lucide-vue-next'

const meta = {
  component: BasePopover,
  title: '🧩 Components/🔘 Base/BasePopover',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A unified popover component for menus, tooltips, and dropdowns with glass morphism styling and smart positioning.'
      }
    }
  },
} satisfies Meta<typeof BasePopover>

export default meta
type Story = StoryObj<typeof meta>

// Interactive Menu Example
export const MenuVariant: Story = {
  render: () => ({
    components: { BasePopover, Settings, User, LogOut },
    setup() {
      const isVisible = ref(true)
      const x = ref(400)
      const y = ref(300)

      return { isVisible, x, y }
    },
    template: `
      <div style="width: 800px; height: 600px; display: flex; align-items: center; justify-content: center; background: var(--surface-primary); border-radius: var(--radius-xl);">
        <button
          @click="isVisible = !isVisible"
          style="padding: 12px 24px; background: var(--brand-primary); color: white; border: none; border-radius: 8px; cursor: pointer;"
        >
          {{ isVisible ? 'Hide Menu' : 'Show Menu' }}
        </button>

        <BasePopover
          :is-visible="isVisible"
          :x="x"
          :y="y"
          position="auto"
          variant="menu"
          @close="isVisible = false"
        >
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <button style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: transparent; border: 1px solid transparent; border-radius: 8px; color: var(--text-primary); cursor: pointer; transition: all 0.2s; text-align: left; width: 100%;">
              <Settings :size="16" />
              <span>Settings</span>
            </button>
            <button style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: transparent; border: 1px solid transparent; border-radius: 8px; color: var(--text-primary); cursor: pointer; transition: all 0.2s; text-align: left; width: 100%;">
              <User :size="16" />
              <span>Profile</span>
            </button>
            <div style="height: 1px; background: var(--glass-border); margin: 4px 0;"></div>
            <button style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: transparent; border: 1px solid transparent; border-radius: 8px; color: var(--red-500); cursor: pointer; transition: all 0.2s; text-align: left; width: 100%;">
              <LogOut :size="16" />
              <span>Logout</span>
            </button>
          </div>
        </BasePopover>
      </div>
    `,
  })
}

// Tooltip Variant
export const TooltipVariant: Story = {
  render: () => ({
    components: { BasePopover, HelpCircle },
    setup() {
      const isVisible = ref(true)
      const x = ref(400)
      const y = ref(300)

      return { isVisible, x, y }
    },
    template: `
      <div style="width: 800px; height: 600px; display: flex; align-items: center; justify-content: center; background: var(--surface-primary); border-radius: var(--radius-xl);">
        <div
          @mouseenter="isVisible = true"
          @mouseleave="isVisible = false"
          style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: 8px; cursor: help;"
        >
          <HelpCircle :size="16" style="color: var(--brand-primary);" />
          <span>Hover for tooltip</span>
        </div>

        <BasePopover
          :is-visible="isVisible"
          :x="x"
          :y="y + 20"
          position="bottom"
          variant="tooltip"
          :close-on-click-outside="false"
        >
          <div style="color: var(--text-secondary); font-size: 14px; line-height: 1.5;">
            This is a helpful tooltip with additional information.
          </div>
        </BasePopover>
      </div>
    `,
  })
}

// Auto-positioning Demo
export const AutoPositioning: Story = {
  render: () => ({
    components: { BasePopover },
    setup() {
      const isVisible = ref(false)
      const x = ref(400)
      const y = ref(300)
      const position = ref('auto')

      const showAt = (newX: number, newY: number) => {
        x.value = newX
        y.value = newY
        isVisible.value = true
      }

      return { isVisible, x, y, position, showAt }
    },
    template: `
      <div style="width: 800px; height: 600px; position: relative; background: var(--surface-primary); border-radius: var(--radius-xl); padding: 40px;">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; height: 100%;">
          <button
            @click="showAt(100, 100)"
            style="padding: 12px; background: var(--brand-primary); color: white; border: none; border-radius: 8px; cursor: pointer; height: fit-content;"
          >
            Top-Left
          </button>
          <button
            @click="showAt(400, 100)"
            style="padding: 12px; background: var(--brand-primary); color: white; border: none; border-radius: 8px; cursor: pointer; height: fit-content;"
          >
            Top-Center
          </button>
          <button
            @click="showAt(700, 100)"
            style="padding: 12px; background: var(--brand-primary); color: white; border: none; border-radius: 8px; cursor: pointer; height: fit-content;"
          >
            Top-Right
          </button>
          <button
            @click="showAt(100, 300)"
            style="padding: 12px; background: var(--brand-primary); color: white; border: none; border-radius: 8px; cursor: pointer; align-self: center;"
          >
            Middle-Left
          </button>
          <button
            @click="showAt(400, 300)"
            style="padding: 12px; background: var(--brand-primary); color: white; border: none; border-radius: 8px; cursor: pointer; align-self: center;"
          >
            Center
          </button>
          <button
            @click="showAt(700, 300)"
            style="padding: 12px; background: var(--brand-primary); color: white; border: none; border-radius: 8px; cursor: pointer; align-self: center;"
          >
            Middle-Right
          </button>
          <button
            @click="showAt(100, 500)"
            style="padding: 12px; background: var(--brand-primary); color: white; border: none; border-radius: 8px; cursor: pointer; align-self: end;"
          >
            Bottom-Left
          </button>
          <button
            @click="showAt(400, 500)"
            style="padding: 12px; background: var(--brand-primary); color: white; border: none; border-radius: 8px; cursor: pointer; align-self: end;"
          >
            Bottom-Center
          </button>
          <button
            @click="showAt(700, 500)"
            style="padding: 12px; background: var(--brand-primary); color: white; border: none; border-radius: 8px; cursor: pointer; align-self: end;"
          >
            Bottom-Right
          </button>
        </div>

        <BasePopover
          :is-visible="isVisible"
          :x="x"
          :y="y"
          position="auto"
          variant="menu"
          @close="isVisible = false"
        >
          <div style="padding: 12px 16px; color: var(--text-primary); font-size: 14px;">
            Auto-positioned popover!<br/>
            Click outside to close.
          </div>
        </BasePopover>
      </div>
    `,
  })
}

// Glass Morphism Showcase
export const GlassMorphism: Story = {
  render: () => ({
    components: { BasePopover, Settings },
    setup() {
      const isVisible = ref(true)
      const x = ref(400)
      const y = ref(300)

      return { isVisible, x, y }
    },
    template: `
      <div style="width: 800px; height: 600px; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; border-radius: var(--radius-xl);">
        <!-- Colorful background -->
        <div style="position: absolute; inset: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);"></div>
        <div style="position: absolute; top: 20%; left: 20%; width: 200px; height: 200px; background: var(--brand-primary); border-radius: 50%; filter: blur(60px); opacity: 0.5;"></div>
        <div style="position: absolute; bottom: 20%; right: 20%; width: 250px; height: 250px; background: #ff6b9d; border-radius: 50%; filter: blur(80px); opacity: 0.4;"></div>

        <button
          @click="isVisible = !isVisible"
          style="padding: 16px 32px; background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(10px); color: white; border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 12px; cursor: pointer; font-weight: 600; position: relative; z-index: 1;"
        >
          {{ isVisible ? 'Hide Glass Menu' : 'Show Glass Menu' }}
        </button>

        <BasePopover
          :is-visible="isVisible"
          :x="x"
          :y="y"
          position="auto"
          variant="menu"
          @close="isVisible = false"
        >
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <button style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: transparent; border: 1px solid transparent; border-radius: 8px; color: var(--text-primary); cursor: pointer; text-align: left; width: 100%;">
              <Settings :size="16" />
              <span>Glass morphism in action</span>
            </button>
            <button style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: transparent; border: 1px solid transparent; border-radius: 8px; color: var(--text-primary); cursor: pointer; text-align: left; width: 100%;">
              <Settings :size="16" />
              <span>Backdrop blur + saturation</span>
            </button>
            <button style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: transparent; border: 1px solid transparent; border-radius: 8px; color: var(--text-primary); cursor: pointer; text-align: left; width: 100%;">
              <Settings :size="16" />
              <span>Design token powered</span>
            </button>
          </div>
        </BasePopover>
      </div>
    `,
  })
}
