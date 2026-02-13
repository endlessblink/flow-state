import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import DragHandleVisuals from '@/components/tasks/drag-handle/DragHandleVisuals.vue'

const meta = {
  title: '📝 Task Management/DragHandleVisuals',
  component: DragHandleVisuals,
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg']
    },
    disabled: { control: 'boolean' },
    isDragging: { control: 'boolean' },
    isHovered: { control: 'boolean' },
    isFocused: { control: 'boolean' },
    showTouchFeedback: { control: 'boolean' },
    showKeyboardNavigation: { control: 'boolean' }
  }
} satisfies Meta<typeof DragHandleVisuals>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    size: 'md',
    disabled: false,
    isDragging: false,
    isHovered: false,
    isFocused: false,
    showTouchFeedback: false,
    showKeyboardNavigation: false
  },
  render: (args) => ({
    components: { DragHandleVisuals },
    setup() {
      return { args }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
      ">
        <DragHandleVisuals v-bind="args" />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Default drag handle with glass morphism
        </div>
      </div>
    `
  })
}

export const Hovered: Story = {
  args: {
    size: 'md',
    disabled: false,
    isDragging: false,
    isHovered: true,
    isFocused: false,
    showTouchFeedback: false,
    showKeyboardNavigation: false
  },
  render: (args) => ({
    components: { DragHandleVisuals },
    setup() {
      return { args }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
      ">
        <DragHandleVisuals v-bind="args" />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Hover state with enhanced glow
        </div>
      </div>
    `
  })
}

export const Dragging: Story = {
  args: {
    size: 'md',
    disabled: false,
    isDragging: true,
    isHovered: false,
    isFocused: false,
    showTouchFeedback: false,
    showKeyboardNavigation: false
  },
  render: (args) => ({
    components: { DragHandleVisuals },
    setup() {
      return { args }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
      ">
        <DragHandleVisuals v-bind="args" />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Active dragging state with blue glow
        </div>
      </div>
    `
  })
}

export const Focused: Story = {
  args: {
    size: 'md',
    disabled: false,
    isDragging: false,
    isHovered: false,
    isFocused: true,
    showTouchFeedback: false,
    showKeyboardNavigation: true
  },
  render: (args) => ({
    components: { DragHandleVisuals },
    setup() {
      return { args }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
      ">
        <DragHandleVisuals v-bind="args" />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Keyboard focus state
        </div>
      </div>
    `
  })
}

export const Disabled: Story = {
  args: {
    size: 'md',
    disabled: true,
    isDragging: false,
    isHovered: false,
    isFocused: false,
    showTouchFeedback: false,
    showKeyboardNavigation: false
  },
  render: (args) => ({
    components: { DragHandleVisuals },
    setup() {
      return { args }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
      ">
        <DragHandleVisuals v-bind="args" />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Disabled state - grayscale and not interactive
        </div>
      </div>
    `
  })
}

export const AllSizes: Story = {
  render: () => ({
    components: { DragHandleVisuals },
    setup() {
      const sizes = ['sm', 'md', 'lg']
      return { sizes }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        display: flex;
        gap: var(--space-6);
        align-items: center;
      ">
        <div
          v-for="size in sizes"
          :key="size"
          style="
            display: flex;
            flex-direction: column;
            gap: var(--space-2);
            align-items: center;
          "
        >
          <DragHandleVisuals
            :size="size"
            :disabled="false"
            :is-dragging="false"
            :is-hovered="false"
            :is-focused="false"
            :show-touch-feedback="false"
            :show-keyboard-navigation="false"
          />
          <span style="
            font-size: var(--text-xs);
            color: var(--text-tertiary);
          ">
            {{ size.toUpperCase() }}
          </span>
        </div>
      </div>
    `
  })
}

export const Interactive: Story = {
  args: {
    size: 'md',
    disabled: false,
    isDragging: false,
    isHovered: false,
    isFocused: false,
    showTouchFeedback: false,
    showKeyboardNavigation: false
  },
  render: (args) => ({
    components: { DragHandleVisuals },
    setup() {
      const isHovered = ref(false)
      const isDragging = ref(false)
      const isFocused = ref(false)

      const handleMouseDown = () => {
        isDragging.value = true
      }

      const handleMouseUp = () => {
        isDragging.value = false
      }

      return {
        args,
        isHovered,
        isDragging,
        isFocused,
        handleMouseDown,
        handleMouseUp
      }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
      ">
        <DragHandleVisuals
          :size="args.size"
          :disabled="args.disabled"
          :is-dragging="isDragging"
          :is-hovered="isHovered"
          :is-focused="isFocused"
          :show-touch-feedback="args.showTouchFeedback"
          :show-keyboard-navigation="args.showKeyboardNavigation"
          @mouse-down="handleMouseDown"
          @hover-start="isHovered = true"
          @hover-end="isHovered = false"
          @focus="isFocused = true"
          @blur="isFocused = false"
        />
        <div
          v-if="isDragging"
          @mouseup="handleMouseUp"
          style="
            position: fixed;
            inset: 0;
            z-index: 1;
          "
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          State: {{ isDragging ? 'Dragging' : isHovered ? 'Hovered' : isFocused ? 'Focused' : 'Default' }}
        </div>
        <div style="
          margin-top: var(--space-2);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Hover, click, or focus to see different states
        </div>
      </div>
    `
  })
}

export const AllStates: Story = {
  render: () => ({
    components: { DragHandleVisuals },
    setup() {
      const states = [
        { label: 'Default', props: { isHovered: false, isDragging: false, isFocused: false } },
        { label: 'Hovered', props: { isHovered: true, isDragging: false, isFocused: false } },
        { label: 'Dragging', props: { isHovered: false, isDragging: true, isFocused: false } },
        { label: 'Focused', props: { isHovered: false, isDragging: false, isFocused: true } },
        { label: 'Disabled', props: { isHovered: false, isDragging: false, isFocused: false }, disabled: true }
      ]
      return { states }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        display: flex;
        gap: var(--space-6);
        align-items: flex-start;
        flex-wrap: wrap;
      ">
        <div
          v-for="state in states"
          :key="state.label"
          style="
            display: flex;
            flex-direction: column;
            gap: var(--space-2);
            align-items: center;
          "
        >
          <DragHandleVisuals
            size="md"
            :disabled="state.disabled || false"
            :is-dragging="state.props.isDragging"
            :is-hovered="state.props.isHovered"
            :is-focused="state.props.isFocused"
            :show-touch-feedback="false"
            :show-keyboard-navigation="false"
          />
          <span style="
            font-size: var(--text-xs);
            color: var(--text-tertiary);
          ">
            {{ state.label }}
          </span>
        </div>
      </div>
    `
  })
}
