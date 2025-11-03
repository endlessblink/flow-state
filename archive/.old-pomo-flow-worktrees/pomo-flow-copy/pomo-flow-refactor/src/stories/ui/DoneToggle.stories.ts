import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import DoneToggle from '@/components/DoneToggle.vue'

const meta = {
  component: DoneToggle,
  title: '🧩 Components/🔧 UI/DoneToggle',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Premium task completion toggle with glass morphism styling, celebration effects, and accessibility features.'
      }
    }
  },

  argTypes: {
    completed: {
      control: 'boolean',
      description: 'Whether the task is completed',
    },
    disabled: {
      control: 'boolean',
      description: 'Disable the toggle interaction',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Size variant of the toggle',
    },
    variant: {
      control: 'select',
      options: ['default', 'subtle', 'prominent', 'minimal'],
      description: 'Visual style variant',
    },
    showHints: {
      control: 'boolean',
      description: 'Show hover hints',
    },
    showProgress: {
      control: 'boolean',
      description: 'Show progress indicator',
    },
    progressPercentage: {
      control: 'number',
      description: 'Progress percentage (0-100)',
    },
    celebrationParticles: {
      control: 'number',
      description: 'Number of celebration particles',
    },
  },
} satisfies Meta<typeof DoneToggle>

export default meta
type Story = StoryObj<typeof meta>

// Default toggle
export const Default: Story = {
  args: {
    completed: false,
    disabled: false,
    size: 'md',
    variant: 'default',
    showHints: true,
    showProgress: false,
    progressPercentage: 0,
    celebrationParticles: 8,
  },
  render: (args) => ({
    components: { DoneToggle },
    setup() {
      const completed = ref(args.completed)

      const handleToggle = (newCompleted: boolean) => {
        completed.value = newCompleted
      }

      const handleClick = (event: MouseEvent | KeyboardEvent) => {
        console.log('DoneToggle clicked:', event)
      }

      return {
        completed,
        handleToggle,
        handleClick,
        ...args,
      }
    },
    template: `
      <div style="padding: 40px; background: var(--surface-secondary);">
        <DoneToggle
          :completed="completed"
          :disabled="disabled"
          :size="size"
          :variant="variant"
          :show-hints="showHints"
          :show-progress="showProgress"
          :progress-percentage="progressPercentage"
          :celebration-particles="celebrationParticles"
          @toggle="handleToggle"
          @click="handleClick"
        />
      </div>
    `,
  }),
}

// Completed state
export const Completed: Story = {
  args: {
    completed: true,
    disabled: false,
    size: 'md',
    variant: 'default',
    showHints: true,
    showProgress: false,
    progressPercentage: 100,
    celebrationParticles: 8,
  },
  render: (args) => ({
    components: { DoneToggle },
    setup() {
      const completed = ref(args.completed)

      const handleToggle = (newCompleted: boolean) => {
        completed.value = newCompleted
      }

      return {
        completed,
        handleToggle,
        ...args,
      }
    },
    template: `
      <div style="padding: 40px; background: var(--surface-secondary);">
        <DoneToggle
          :completed="completed"
          :disabled="disabled"
          :size="size"
          :variant="variant"
          :show-hints="showHints"
          :show-progress="showProgress"
          :progress-percentage="progressPercentage"
          :celebration-particles="celebrationParticles"
          @toggle="handleToggle"
        />
      </div>
    `,
  }),
}

// Size variants
export const SizeVariants: Story = {
  render: () => ({
    components: { DoneToggle },
    setup() {
      const toggles = ref([
        { size: 'sm', completed: false, label: 'Small' },
        { size: 'md', completed: false, label: 'Medium' },
        { size: 'lg', completed: false, label: 'Large' },
      ])

      const handleToggle = (index: number) => {
        toggles.value[index].completed = !toggles.value[index].completed
      }

      return {
        toggles,
        handleToggle,
      }
    },
    template: `
      <div style="padding: 40px; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 24px 0; font-size: 18px; color: var(--text-primary);">Size Variants</h3>

        <div style="display: flex; gap: 32px; align-items: center;">
          <div
            v-for="(toggle, index) in toggles"
            :key="toggle.size"
            style="text-align: center;"
          >
            <DoneToggle
              :completed="toggle.completed"
              :size="toggle.size"
              @toggle="() => handleToggle(index)"
            />
            <div style="margin-top: 12px; font-size: 14px; color: var(--text-secondary);">
              {{ toggle.label }}
            </div>
          </div>
        </div>

        <div style="margin-top: 32px; padding: 20px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Size Specifications</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            <li><strong>Small (24px)</strong> - Compact for tight layouts</li>
            <li><strong>Medium (32px)</strong> - Default size for most use cases</li>
            <li><strong>Large (40px)</strong> - Enhanced visibility for accessibility</li>
          </ul>
        </div>
      </div>
    `,
  }),
}

// Style variants
export const StyleVariants: Story = {
  render: () => ({
    components: { DoneToggle },
    setup() {
      const variants = ref([
        { variant: 'default', completed: false, label: 'Default', description: 'Premium glass morphism' },
        { variant: 'subtle', completed: false, label: 'Subtle', description: 'Reduced visual weight' },
        { variant: 'prominent', completed: false, label: 'Prominent', description: 'Enhanced visibility' },
        { variant: 'minimal', completed: false, label: 'Minimal', description: 'Simple checkbox style' },
      ])

      const handleToggle = (index: number) => {
        variants.value[index].completed = !variants.value[index].completed
      }

      return {
        variants,
        handleToggle,
      }
    },
    template: `
      <div style="padding: 40px; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 24px 0; font-size: 18px; color: var(--text-primary);">Style Variants</h3>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px;">
          <div
            v-for="(variant, index) in variants"
            :key="variant.variant"
            style="padding: 20px; background: var(--surface-primary); border-radius: 12px; border: 1px solid var(--border-subtle);"
          >
            <div style="text-align: center; margin-bottom: 16px;">
              <DoneToggle
                :completed="variant.completed"
                :variant="variant.variant"
                @toggle="() => handleToggle(index)"
              />
            </div>

            <div style="text-align: center;">
              <h4 style="margin: 0 0 4px 0; font-size: 16px; color: var(--text-primary);">{{ variant.label }}</h4>
              <p style="margin: 0; font-size: 13px; color: var(--text-muted);">{{ variant.description }}</p>
            </div>
          </div>
        </div>
      </div>
    `,
  }),
}

// Interactive demo
export const InteractiveDemo: Story = {
  render: () => ({
    components: { DoneToggle },
    setup() {
      const tasks = ref([
        { id: 1, title: 'Complete project documentation', completed: false },
        { id: 2, title: 'Review pull request', completed: true },
        { id: 3, title: 'Fix navigation bug', completed: false },
        { id: 4, title: 'Write unit tests', completed: false },
        { id: 5, title: 'Deploy to production', completed: true },
      ])

      const completedCount = computed(() => tasks.value.filter(t => t.completed).length)

      const handleToggle = (taskId: number) => {
        const task = tasks.value.find(t => t.id === taskId)
        if (task) {
          task.completed = !task.completed
        }
      }

      const progressPercentage = computed(() => {
        return Math.round((completedCount.value / tasks.value.length) * 100)
      })

      return {
        tasks,
        completedCount,
        progressPercentage,
        handleToggle,
      }
    },
    template: `
      <div style="padding: 40px; background: var(--surface-secondary); min-width: 400px;">
        <h3 style="margin: 0 0 24px 0; font-size: 20px; color: var(--text-primary);">Interactive Task List</h3>

        <div style="margin-bottom: 24px; padding: 20px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="margin: 0; font-size: 16px; color: var(--text-primary);">Progress Overview</h4>
            <span style="font-size: 18px; font-weight: bold; color: var(--brand-primary);">
              {{ completedCount }}/{{ tasks.length }} completed
            </span>
          </div>

          <div style="height: 8px; background: var(--border-subtle); border-radius: 4px; overflow: hidden;">
            <div
              style="height: 100%; background: linear-gradient(90deg, var(--brand-primary), var(--brand-success)); transition: width 0.3s ease; border-radius: 4px;"
              :style="{ width: progressPercentage + '%' }"
            ></div>
          </div>

          <div style="margin-top: 8px; text-align: center; font-size: 14px; color: var(--text-secondary);">
            {{ progressPercentage }}% complete
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div
            v-for="task in tasks"
            :key="task.id"
            style="display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--surface-primary); border-radius: 12px; border: 1px solid var(--border-subtle); transition: all 0.2s ease;"
            :style="{ opacity: task.completed ? 0.7 : 1 }"
          >
            <DoneToggle
              :completed="task.completed"
              :show-hints="true"
              @toggle="() => handleToggle(task.id)"
            />

            <div style="flex: 1;">
              <div style="font-size: 15px; color: var(--text-primary);">{{ task.title }}</div>
              <div style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">
                {{ task.completed ? 'Completed' : 'Pending' }}
              </div>
            </div>
          </div>
        </div>

        <div style="margin-top: 32px; padding: 16px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Interactive Features</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            <li><strong>Click to toggle</strong> - Mark tasks as complete/incomplete</li>
            <li><strong>Celebration effects</strong> - Visual feedback on completion</li>
            <li><strong>Hover hints</strong> - Contextual help messages</li>
            <li><strong>Progress tracking</strong> - Live completion percentage</li>
            <li><strong>Accessibility</strong> - Full keyboard and screen reader support</li>
          </ul>
        </div>
      </div>
    `,
  }),
}

// Disabled states
export const DisabledStates: Story = {
  render: () => ({
    components: { DoneToggle },
    setup() {
      const states = ref([
        { completed: false, disabled: true, label: 'Disabled (Incomplete)' },
        { completed: true, disabled: true, label: 'Disabled (Completed)' },
        { completed: false, disabled: false, label: 'Enabled (Incomplete)' },
        { completed: true, disabled: false, label: 'Enabled (Completed)' },
      ])

      const handleToggle = (index: number) => {
        if (!states.value[index].disabled) {
          states.value[index].completed = !states.value[index].completed
        }
      }

      return {
        states,
        handleToggle,
      }
    },
    template: `
      <div style="padding: 40px; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 24px 0; font-size: 18px; color: var(--text-primary);">Disabled States</h3>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
          <div
            v-for="(state, index) in states"
            :key="index"
            style="padding: 20px; background: var(--surface-primary); border-radius: 12px; border: 1px solid var(--border-subtle); text-align: center;"
          >
            <DoneToggle
              :completed="state.completed"
              :disabled="state.disabled"
              @toggle="() => handleToggle(index)"
              style="margin: 0 auto 16px;"
            />

            <div style="font-size: 14px; color: var(--text-secondary);">
              {{ state.label }}
            </div>
          </div>
        </div>

        <div style="margin-top: 24px; padding: 16px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 8px 0; font-size: 16px; color: var(--text-primary);">Disabled Behavior</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            <li>No interaction events</li>
            <li>Reduced visual opacity</li>
            <li>Cursor indicates not clickable</li>
            <li>No hover effects or animations</li>
          </ul>
        </div>
      </div>
    `,
  }),
}

// Progress indicator demo
export const ProgressIndicator: Story = {
  render: () => ({
    components: { DoneToggle },
    setup() {
      const progressSteps = ref([
        { percentage: 0, completed: false, label: 'Not Started' },
        { percentage: 25, completed: false, label: 'In Progress (25%)' },
        { percentage: 50, completed: false, label: 'Halfway (50%)' },
        { percentage: 75, completed: false, label: 'Nearly Done (75%)' },
        { percentage: 100, completed: true, label: 'Complete (100%)' },
      ])

      const handleToggle = (index: number) => {
        progressSteps.value[index].completed = !progressSteps.value[index].completed
      }

      return {
        progressSteps,
        handleToggle,
      }
    },
    template: `
      <div style="padding: 40px; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 24px 0; font-size: 18px; color: var(--text-primary);">Progress Indicators</h3>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
          <div
            v-for="(step, index) in progressSteps"
            :key="index"
            style="padding: 24px; background: var(--surface-primary); border-radius: 12px; border: 1px solid var(--border-subtle); text-align: center;"
          >
            <div style="position: relative; margin-bottom: 20px;">
              <DoneToggle
                :completed="step.completed"
                :show-progress="true"
                :progress-percentage="step.percentage"
                @toggle="() => handleToggle(index)"
              />
            </div>

            <div>
              <h4 style="margin: 0 0 4px 0; font-size: 16px; color: var(--text-primary);">{{ step.label }}</h4>
              <p style="margin: 0; font-size: 13px; color: var(--text-muted);">
                Progress: {{ step.percentage }}%
              </p>
            </div>
          </div>
        </div>

        <div style="margin-top: 24px; padding: 16px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 8px 0; font-size: 16px; color: var(--text-primary);">Progress Features</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            <li><strong>Visual progress bar</strong> - Shows completion percentage</li>
            <li><strong>Gradient fill</strong> - Smooth color transitions</li>
            <li><strong>Auto-sizing</strong> - Adapts to toggle size</li>
            <li><strong>Synchronized state</strong> - Progress matches completion</li>
          </ul>
        </div>
      </div>
    `,
  }),
}