import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import DoneToggleVisuals from '@/components/tasks/done-toggle/DoneToggleVisuals.vue'

const meta = {
  title: '📝 Task Management/DoneToggleVisuals',
  component: DoneToggleVisuals,
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    isCompleted: { control: 'boolean' },
    disabled: { control: 'boolean' },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg']
    },
    variant: {
      control: 'select',
      options: ['default', 'subtle', 'prominent', 'minimal', 'simple']
    },
    showHints: { control: 'boolean' },
    showProgress: { control: 'boolean' },
    progressPercentage: {
      control: { type: 'range', min: 0, max: 100, step: 5 }
    }
  }
} satisfies Meta<typeof DoneToggleVisuals>

export default meta
type Story = StoryObj<typeof meta>

export const SimpleVariant: Story = {
  args: {
    isCompleted: false,
    disabled: false,
    size: 'md',
    variant: 'simple',
    showHints: false,
    showProgress: false,
    progressPercentage: 0,
    ripples: [],
    showCelebration: false,
    showTouchFeedback: false,
    title: 'Mark task as done',
    ariaLabel: 'Mark task as complete',
    celebrationParticles: 6,
    isHovered: false,
    isFocused: false
  },
  render: (args) => ({
    components: { DoneToggleVisuals },
    setup() {
      const isCompleted = ref(args.isCompleted)
      const isHovered = ref(false)
      const isFocused = ref(false)

      const handleClick = () => {
        isCompleted.value = !isCompleted.value
      }

      return { args, isCompleted, isHovered, isFocused, handleClick }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
      ">
        <DoneToggleVisuals
          :is-completed="isCompleted"
          :disabled="args.disabled"
          :size="args.size"
          :variant="args.variant"
          :ripples="args.ripples"
          :show-celebration="args.showCelebration"
          :show-touch-feedback="args.showTouchFeedback"
          :title="args.title"
          :aria-label="args.ariaLabel"
          :show-hints="args.showHints"
          :show-progress="args.showProgress"
          :progress-percentage="args.progressPercentage"
          :celebration-particles="args.celebrationParticles"
          :is-hovered="isHovered"
          :is-focused="isFocused"
          @click="handleClick"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Simple variant - minimal rounded square checkbox
        </div>
      </div>
    `
  })
}

export const SimpleCompleted: Story = {
  args: {
    isCompleted: true,
    disabled: false,
    size: 'md',
    variant: 'simple',
    showHints: false,
    showProgress: false,
    progressPercentage: 0,
    ripples: [],
    showCelebration: false,
    showTouchFeedback: false,
    title: 'Mark task as incomplete',
    ariaLabel: 'Mark task as incomplete',
    celebrationParticles: 6,
    isHovered: false,
    isFocused: false
  },
  render: (args) => ({
    components: { DoneToggleVisuals },
    setup() {
      const isCompleted = ref(args.isCompleted)
      const isHovered = ref(false)
      const isFocused = ref(false)

      const handleClick = () => {
        isCompleted.value = !isCompleted.value
      }

      return { args, isCompleted, isHovered, isFocused, handleClick }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
      ">
        <DoneToggleVisuals
          :is-completed="isCompleted"
          :disabled="args.disabled"
          :size="args.size"
          :variant="args.variant"
          :ripples="args.ripples"
          :show-celebration="args.showCelebration"
          :show-touch-feedback="args.showTouchFeedback"
          :title="args.title"
          :aria-label="args.ariaLabel"
          :show-hints="args.showHints"
          :show-progress="args.showProgress"
          :progress-percentage="args.progressPercentage"
          :celebration-particles="args.celebrationParticles"
          :is-hovered="isHovered"
          :is-focused="isFocused"
          @click="handleClick"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Simple variant - completed state with checkmark
        </div>
      </div>
    `
  })
}

export const DefaultVariant: Story = {
  args: {
    isCompleted: false,
    disabled: false,
    size: 'md',
    variant: 'default',
    showHints: false,
    showProgress: false,
    progressPercentage: 0,
    ripples: [],
    showCelebration: false,
    showTouchFeedback: false,
    title: 'Mark task as done',
    ariaLabel: 'Mark task as complete',
    celebrationParticles: 6,
    isHovered: false,
    isFocused: false
  },
  render: (args) => ({
    components: { DoneToggleVisuals },
    setup() {
      const isCompleted = ref(args.isCompleted)
      const isHovered = ref(false)
      const isFocused = ref(false)

      const handleClick = () => {
        isCompleted.value = !isCompleted.value
      }

      return { args, isCompleted, isHovered, isFocused, handleClick }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
      ">
        <DoneToggleVisuals
          :is-completed="isCompleted"
          :disabled="args.disabled"
          :size="args.size"
          :variant="args.variant"
          :ripples="args.ripples"
          :show-celebration="args.showCelebration"
          :show-touch-feedback="args.showTouchFeedback"
          :title="args.title"
          :aria-label="args.ariaLabel"
          :show-hints="args.showHints"
          :show-progress="args.showProgress"
          :progress-percentage="args.progressPercentage"
          :celebration-particles="args.celebrationParticles"
          :is-hovered="isHovered"
          :is-focused="isFocused"
          @click="handleClick"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Default variant with glass morphism
        </div>
      </div>
    `
  })
}

export const Completed: Story = {
  args: {
    isCompleted: true,
    disabled: false,
    size: 'md',
    variant: 'default',
    showHints: false,
    showProgress: false,
    progressPercentage: 0,
    ripples: [],
    showCelebration: false,
    showTouchFeedback: false,
    title: 'Mark task as incomplete',
    ariaLabel: 'Mark task as incomplete',
    celebrationParticles: 6,
    isHovered: false,
    isFocused: false
  },
  render: (args) => ({
    components: { DoneToggleVisuals },
    setup() {
      const isCompleted = ref(args.isCompleted)
      const isHovered = ref(false)
      const isFocused = ref(false)

      const handleClick = () => {
        isCompleted.value = !isCompleted.value
      }

      return { args, isCompleted, isHovered, isFocused, handleClick }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
      ">
        <DoneToggleVisuals
          :is-completed="isCompleted"
          :disabled="args.disabled"
          :size="args.size"
          :variant="args.variant"
          :ripples="args.ripples"
          :show-celebration="args.showCelebration"
          :show-touch-feedback="args.showTouchFeedback"
          :title="args.title"
          :aria-label="args.ariaLabel"
          :show-hints="args.showHints"
          :show-progress="args.showProgress"
          :progress-percentage="args.progressPercentage"
          :celebration-particles="args.celebrationParticles"
          :is-hovered="isHovered"
          :is-focused="isFocused"
          @click="handleClick"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Completed state with green gradient
        </div>
      </div>
    `
  })
}

export const AllSizes: Story = {
  render: () => ({
    components: { DoneToggleVisuals },
    setup() {
      const sizes = ref(['sm', 'md', 'lg'])
      const completed = ref([false, false, false])
      const isHovered = ref([false, false, false])
      const isFocused = ref([false, false, false])

      const handleClick = (index: number) => {
        completed.value[index] = !completed.value[index]
      }

      return { sizes, completed, isHovered, isFocused, handleClick }
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
          v-for="(size, index) in sizes"
          :key="size"
          style="
            display: flex;
            flex-direction: column;
            gap: var(--space-2);
            align-items: center;
          "
        >
          <DoneToggleVisuals
            :is-completed="completed[index]"
            :disabled="false"
            :size="size"
            variant="simple"
            :ripples="[]"
            :show-celebration="false"
            :show-touch-feedback="false"
            title="Mark task as done"
            aria-label="Mark task as complete"
            :show-hints="false"
            :show-progress="false"
            :progress-percentage="0"
            :celebration-particles="6"
            :is-hovered="isHovered[index]"
            :is-focused="isFocused[index]"
            @click="handleClick(index)"
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

export const AllVariants: Story = {
  render: () => ({
    components: { DoneToggleVisuals },
    setup() {
      const variants = ref(['simple', 'default', 'subtle', 'prominent', 'minimal'])
      const completed = ref([false, false, false, false, false])
      const isHovered = ref([false, false, false, false, false])
      const isFocused = ref([false, false, false, false, false])

      const handleClick = (index: number) => {
        completed.value[index] = !completed.value[index]
      }

      return { variants, completed, isHovered, isFocused, handleClick }
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
        flex-wrap: wrap;
      ">
        <div
          v-for="(variant, index) in variants"
          :key="variant"
          style="
            display: flex;
            flex-direction: column;
            gap: var(--space-2);
            align-items: center;
          "
        >
          <DoneToggleVisuals
            :is-completed="completed[index]"
            :disabled="false"
            size="md"
            :variant="variant"
            :ripples="[]"
            :show-celebration="false"
            :show-touch-feedback="false"
            title="Mark task as done"
            aria-label="Mark task as complete"
            :show-hints="false"
            :show-progress="false"
            :progress-percentage="0"
            :celebration-particles="6"
            :is-hovered="isHovered[index]"
            :is-focused="isFocused[index]"
            @click="handleClick(index)"
          />
          <span style="
            font-size: var(--text-xs);
            color: var(--text-tertiary);
            text-transform: capitalize;
          ">
            {{ variant }}
          </span>
        </div>
      </div>
    `
  })
}

export const WithProgress: Story = {
  args: {
    isCompleted: false,
    disabled: false,
    size: 'md',
    variant: 'default',
    showHints: false,
    showProgress: true,
    progressPercentage: 60,
    ripples: [],
    showCelebration: false,
    showTouchFeedback: false,
    title: 'Mark task as done',
    ariaLabel: 'Mark task as complete',
    celebrationParticles: 6,
    isHovered: false,
    isFocused: false
  },
  render: (args) => ({
    components: { DoneToggleVisuals },
    setup() {
      const isCompleted = ref(args.isCompleted)
      const isHovered = ref(false)
      const isFocused = ref(false)

      const handleClick = () => {
        isCompleted.value = !isCompleted.value
      }

      return { args, isCompleted, isHovered, isFocused, handleClick }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
      ">
        <DoneToggleVisuals
          :is-completed="isCompleted"
          :disabled="args.disabled"
          :size="args.size"
          :variant="args.variant"
          :ripples="args.ripples"
          :show-celebration="args.showCelebration"
          :show-touch-feedback="args.showTouchFeedback"
          :title="args.title"
          :aria-label="args.ariaLabel"
          :show-hints="args.showHints"
          :show-progress="args.showProgress"
          :progress-percentage="args.progressPercentage"
          :celebration-particles="args.celebrationParticles"
          :is-hovered="isHovered"
          :is-focused="isFocused"
          @click="handleClick"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          With progress indicator (60%)
        </div>
      </div>
    `
  })
}

export const Disabled: Story = {
  args: {
    isCompleted: false,
    disabled: true,
    size: 'md',
    variant: 'simple',
    showHints: false,
    showProgress: false,
    progressPercentage: 0,
    ripples: [],
    showCelebration: false,
    showTouchFeedback: false,
    title: 'Task is disabled',
    ariaLabel: 'Task is disabled',
    celebrationParticles: 6,
    isHovered: false,
    isFocused: false
  },
  render: (args) => ({
    components: { DoneToggleVisuals },
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
        <DoneToggleVisuals
          v-bind="args"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Disabled state - not interactive
        </div>
      </div>
    `
  })
}
