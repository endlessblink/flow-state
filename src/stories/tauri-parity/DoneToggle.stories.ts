import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import DoneToggleVisuals from '@/components/tasks/done-toggle/DoneToggleVisuals.vue'

const meta = {
  title: '🖥️ Tauri Parity/DoneToggle',
  component: DoneToggleVisuals,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'DoneToggle visual component — demonstrates the backdrop-filter + transition easing that was fixed for Tauri parity. Toggle Tauri Mode in the toolbar to compare Browser vs WebKitGTK rendering. The checked state uses a success gradient and the transition uses `var(--spring-swift)` easing.',
      },
    },
  },
} satisfies Meta<typeof DoneToggleVisuals>

export default meta
type Story = StoryObj<typeof meta>

// Shared base args so every story only overrides what it needs
const baseArgs = {
  disabled: false,
  ripples: [] as [],
  showCelebration: false,
  showTouchFeedback: false,
  showHints: false,
  showProgress: false,
  progressPercentage: 0,
  celebrationParticles: 6,
  isHovered: false,
  isFocused: false,
  title: 'Mark task as done',
  ariaLabel: 'Mark task as complete',
  size: 'md' as const,
  variant: 'default' as const,
}

export const Unchecked: Story = {
  args: {
    ...baseArgs,
    isCompleted: false,
  },
  render: (args) => ({
    components: { DoneToggleVisuals },
    setup() {
      const isHovered = ref(false)
      const isFocused = ref(false)
      return { args, isHovered, isFocused }
    },
    template: `
      <div style="
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--app-background-gradient, var(--color-base-950));
        padding: var(--space-10);
      ">
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-6);
          padding: var(--space-10);
          background: var(--glass-bg-soft);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-xl);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          min-width: 240px;
        ">
          <p style="
            margin: 0;
            font-size: var(--text-sm);
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-weight: var(--font-semibold);
          ">Unchecked State</p>

          <DoneToggleVisuals
            :is-completed="args.isCompleted"
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
          />

          <p style="
            margin: 0;
            font-size: var(--text-xs);
            color: var(--text-tertiary);
            text-align: center;
          ">
            Glass morphism border + backdrop-filter background.<br>
            In Tauri mode: opaque purple background.
          </p>
        </div>
      </div>
    `,
  }),
}

export const Checked: Story = {
  args: {
    ...baseArgs,
    isCompleted: true,
    title: 'Mark task as incomplete',
    ariaLabel: 'Mark task as incomplete',
  },
  render: (args) => ({
    components: { DoneToggleVisuals },
    setup() {
      const isHovered = ref(false)
      const isFocused = ref(false)
      return { args, isHovered, isFocused }
    },
    template: `
      <div style="
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--app-background-gradient, var(--color-base-950));
        padding: var(--space-10);
      ">
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-6);
          padding: var(--space-10);
          background: var(--glass-bg-soft);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-xl);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          min-width: 240px;
        ">
          <p style="
            margin: 0;
            font-size: var(--text-sm);
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-weight: var(--font-semibold);
          ">Checked State</p>

          <DoneToggleVisuals
            :is-completed="args.isCompleted"
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
          />

          <p style="
            margin: 0;
            font-size: var(--text-xs);
            color: var(--text-tertiary);
            text-align: center;
          ">
            Success gradient + glow shadow. The check icon uses<br>
            <code style="font-family: var(--font-mono, monospace);">scaleIn</code>
            animation with spring easing.
          </p>
        </div>
      </div>
    `,
  }),
}

export const Interactive: Story = {
  args: {
    ...baseArgs,
    isCompleted: false,
  },
  render: (args) => ({
    components: { DoneToggleVisuals },
    setup() {
      const isCompleted = ref(false)
      const isHovered = ref(false)
      const isFocused = ref(false)

      const handleClick = () => {
        isCompleted.value = !isCompleted.value
      }

      return { args, isCompleted, isHovered, isFocused, handleClick }
    },
    template: `
      <div style="
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: var(--app-background-gradient, var(--color-base-950));
        padding: var(--space-10);
        gap: var(--space-8);
      ">
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-6);
          padding: var(--space-10);
          background: var(--glass-bg-soft);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-xl);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          min-width: 300px;
        ">
          <p style="
            margin: 0;
            font-size: var(--text-sm);
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-weight: var(--font-semibold);
          ">Interactive — click to toggle</p>

          <!-- All 5 variants side by side, all reactive -->
          <div style="display: flex; gap: var(--space-5); align-items: center;">
            <div
              v-for="variant in ['simple', 'default', 'subtle', 'prominent', 'minimal']"
              :key="variant"
              style="display: flex; flex-direction: column; align-items: center; gap: var(--space-2);"
            >
              <DoneToggleVisuals
                :is-completed="isCompleted"
                :disabled="false"
                size="md"
                :variant="variant"
                :ripples="[]"
                :show-celebration="false"
                :show-touch-feedback="false"
                title="Toggle"
                aria-label="Toggle task"
                :show-hints="false"
                :show-progress="false"
                :progress-percentage="0"
                :celebration-particles="6"
                :is-hovered="isHovered"
                :is-focused="isFocused"
                @click="handleClick"
                @mouseenter="isHovered = true"
                @mouseleave="isHovered = false"
              />
              <span style="
                font-size: var(--text-xs);
                color: var(--text-tertiary);
                text-transform: capitalize;
              ">{{ variant }}</span>
            </div>
          </div>

          <div style="
            padding: var(--space-2) var(--space-4);
            background: var(--glass-bg-medium);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
          ">
            <span style="font-size: var(--text-xs); color: var(--text-tertiary);">
              State: <strong style="color: var(--text-primary);">{{ isCompleted ? 'Completed' : 'Pending' }}</strong>
            </span>
          </div>

          <p style="
            margin: 0;
            font-size: var(--text-xs);
            color: var(--text-tertiary);
            text-align: center;
          ">
            The transition uses <code style="font-family: var(--font-mono, monospace);">var(--spring-swift)</code>
            easing — smooth in both Browser and Tauri.
          </p>
        </div>
      </div>
    `,
  }),
}

export const AllVariants: Story = {
  render: () => ({
    components: { DoneToggleVisuals },
    setup() {
      const variants = ['simple', 'default', 'subtle', 'prominent', 'minimal'] as const
      const completed = ref<boolean[]>([false, false, false, false, false])
      const isHovered = ref<boolean[]>([false, false, false, false, false])
      const isFocused = ref<boolean[]>([false, false, false, false, false])

      const handleClick = (index: number) => {
        completed.value = completed.value.map((v, i) => (i === index ? !v : v))
      }

      return { variants, completed, isHovered, isFocused, handleClick }
    },
    template: `
      <div style="
        min-height: 100vh;
        padding: var(--space-10);
        background: var(--app-background-gradient, var(--color-base-950));
      ">
        <h2 style="
          font-size: var(--text-xl);
          color: var(--text-primary);
          margin: 0 0 var(--space-8) 0;
          font-weight: var(--font-semibold);
        ">All Variants — Both States</h2>

        <div style="
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: var(--space-6);
        ">
          <div
            v-for="(variant, index) in variants"
            :key="variant"
          >
            <!-- Unchecked -->
            <div style="
              padding: var(--space-5);
              background: var(--glass-bg-soft);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-lg);
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: var(--space-4);
              margin-bottom: var(--space-4);
            ">
              <span style="font-size: var(--text-xs); color: var(--text-muted); text-transform: capitalize;">
                {{ variant }} — unchecked
              </span>
              <DoneToggleVisuals
                :is-completed="false"
                :disabled="false"
                size="md"
                :variant="variant"
                :ripples="[]"
                :show-celebration="false"
                :show-touch-feedback="false"
                title="Mark done"
                aria-label="Mark as complete"
                :show-hints="false"
                :show-progress="false"
                :progress-percentage="0"
                :celebration-particles="6"
                :is-hovered="false"
                :is-focused="false"
              />
            </div>

            <!-- Checked -->
            <div style="
              padding: var(--space-5);
              background: var(--glass-bg-soft);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-lg);
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: var(--space-4);
            ">
              <span style="font-size: var(--text-xs); color: var(--text-muted); text-transform: capitalize;">
                {{ variant }} — checked
              </span>
              <DoneToggleVisuals
                :is-completed="true"
                :disabled="false"
                size="md"
                :variant="variant"
                :ripples="[]"
                :show-celebration="false"
                :show-touch-feedback="false"
                title="Mark incomplete"
                aria-label="Mark as incomplete"
                :show-hints="false"
                :show-progress="false"
                :progress-percentage="0"
                :celebration-particles="6"
                :is-hovered="false"
                :is-focused="false"
              />
            </div>
          </div>
        </div>
      </div>
    `,
  }),
}
