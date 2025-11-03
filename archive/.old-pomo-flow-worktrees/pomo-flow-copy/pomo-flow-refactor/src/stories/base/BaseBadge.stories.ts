import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import BaseBadge from '@/components/base/BaseBadge.vue'

const meta = {
  component: BaseBadge,
  title: '🧩 Components/🔘 Base/BaseBadge',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof BaseBadge>

export default meta
type Story = StoryObj<typeof meta>

// Size Variants
export const Small: Story = {
  args: {
    variant: 'default',
    size: 'sm',
  },
  render: (args) => ({
    components: { BaseBadge },
    setup() {
      return { args }
    },
    template: '<BaseBadge v-bind="args">5</BaseBadge>',
  })
}

export const Medium: Story = {
  args: {
    variant: 'default',
    size: 'md',
  },
  render: (args) => ({
    components: { BaseBadge },
    setup() {
      return { args }
    },
    template: '<BaseBadge v-bind="args">12</BaseBadge>',
  })
}

export const Large: Story = {
  args: {
    variant: 'default',
    size: 'lg',
  },
  render: (args) => ({
    components: { BaseBadge },
    setup() {
      return { args }
    },
    template: '<BaseBadge v-bind="args">24</BaseBadge>',
  })
}

// Variant Examples
export const DefaultVariant: Story = {
  args: {
    variant: 'default',
    size: 'md',
  },
  render: (args) => ({
    components: { BaseBadge },
    setup() {
      return { args }
    },
    template: '<BaseBadge v-bind="args">Default</BaseBadge>',
  })
}

export const SuccessVariant: Story = {
  args: {
    variant: 'success',
    size: 'md',
  },
  render: (args) => ({
    components: { BaseBadge },
    setup() {
      return { args }
    },
    template: '<BaseBadge v-bind="args">Complete</BaseBadge>',
  })
}

export const WarningVariant: Story = {
  args: {
    variant: 'warning',
    size: 'md',
  },
  render: (args) => ({
    components: { BaseBadge },
    setup() {
      return { args }
    },
    template: '<BaseBadge v-bind="args">Pending</BaseBadge>',
  })
}

export const DangerVariant: Story = {
  args: {
    variant: 'danger',
    size: 'md',
  },
  render: (args) => ({
    components: { BaseBadge },
    setup() {
      return { args }
    },
    template: '<BaseBadge v-bind="args">Urgent</BaseBadge>',
  })
}

export const InfoVariant: Story = {
  args: {
    variant: 'info',
    size: 'md',
  },
  render: (args) => ({
    components: { BaseBadge },
    setup() {
      return { args }
    },
    template: '<BaseBadge v-bind="args">Info</BaseBadge>',
  })
}

export const CountVariant: Story = {
  args: {
    variant: 'count',
    size: 'sm',
    rounded: true,
  },
  render: (args) => ({
    components: { BaseBadge },
    setup() {
      return { args }
    },
    template: '<BaseBadge v-bind="args">42</BaseBadge>',
  })
}

// Rounded vs Square
export const SquareBadges: Story = {
  render: () => ({
    components: { BaseBadge },
    template: `
      <div style="display: flex; gap: 12px; align-items: center;">
        <BaseBadge variant="success" size="sm">Done</BaseBadge>
        <BaseBadge variant="warning" size="md">Review</BaseBadge>
        <BaseBadge variant="danger" size="lg">Critical</BaseBadge>
      </div>
    `,
  })
}

export const RoundedBadges: Story = {
  render: () => ({
    components: { BaseBadge },
    template: `
      <div style="display: flex; gap: 12px; align-items: center;">
        <BaseBadge variant="success" size="sm" rounded>Done</BaseBadge>
        <BaseBadge variant="warning" size="md" rounded>Review</BaseBadge>
        <BaseBadge variant="danger" size="lg" rounded>Critical</BaseBadge>
      </div>
    `,
  })
}

// Status Indicators
export const StatusBadges: Story = {
  render: () => ({
    components: { BaseBadge },
    template: `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 80px; font-size: 14px; color: var(--text-secondary);">Task Status:</div>
          <BaseBadge variant="success" size="sm" rounded>✓ Complete</BaseBadge>
          <BaseBadge variant="warning" size="sm" rounded>⏳ In Progress</BaseBadge>
          <BaseBadge variant="danger" size="sm" rounded>⚠️ Overdue</BaseBadge>
        </div>

        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 80px; font-size: 14px; color: var(--text-secondary);">Priority:</div>
          <BaseBadge variant="danger" size="sm" rounded>High</BaseBadge>
          <BaseBadge variant="warning" size="sm" rounded>Medium</BaseBadge>
          <BaseBadge variant="info" size="sm" rounded>Low</BaseBadge>
        </div>

        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 80px; font-size: 14px; color: var(--text-secondary);">Count:</div>
          <BaseBadge variant="count" size="sm" rounded>5</BaseBadge>
          <BaseBadge variant="count" size="sm" rounded>12</BaseBadge>
          <BaseBadge variant="count" size="sm" rounded>99+</BaseBadge>
        </div>
      </div>
    `,
  })
}

// Task Priority Examples
export const TaskPriorities: Story = {
  render: () => ({
    components: { BaseBadge },
    template: `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: var(--surface-hover); border-radius: 8px;">
          <BaseBadge variant="danger" size="sm" rounded>High</BaseBadge>
          <span style="font-size: 14px;">Fix critical bug in production</span>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: var(--surface-hover); border-radius: 8px;">
          <BaseBadge variant="warning" size="sm" rounded>Medium</BaseBadge>
          <span style="font-size: 14px;">Update project documentation</span>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: var(--surface-hover); border-radius: 8px;">
          <BaseBadge variant="info" size="sm" rounded>Low</BaseBadge>
          <span style="font-size: 14px;">Review code formatting</span>
        </div>
      </div>
    `,
  })
}

// Interactive Counter Demo
export const InteractiveCounter: Story = {
  render: () => ({
    components: { BaseBadge },
    setup() {
      const count = ref(0)
      const increment = () => count.value++
      const decrement = () => count.value > 0 && count.value--

      return { count, increment, decrement }
    },
    template: `
      <div style="display: flex; flex-direction: column; gap: 16px; align-items: center;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <button @click="decrement" style="padding: 4px 12px; background: var(--surface-hover); border: 1px solid var(--border-medium); border-radius: 4px; cursor: pointer;">−</button>
          <BaseBadge variant="count" size="lg" rounded>{{ count }}</BaseBadge>
          <button @click="increment" style="padding: 4px 12px; background: var(--surface-hover); border: 1px solid var(--border-medium); border-radius: 4px; cursor: pointer;">+</button>
        </div>
        <p style="margin: 0; font-size: 14px; color: var(--text-muted);">Click buttons to change count</p>
      </div>
    `,
  })
}

// All Variants Showcase
export const AllVariants: Story = {
  render: () => ({
    components: { BaseBadge },
    template: `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 20px; min-width: 600px;">
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <h4 style="margin: 0; color: var(--text-secondary); font-size: 14px; font-weight: 600; text-align: center;">SIZE VARIANTS</h4>

          <div style="display: flex; justify-content: space-around; align-items: center;">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
              <BaseBadge size="sm">5</BaseBadge>
              <span style="font-size: 12px; color: var(--text-muted);">Small</span>
            </div>
            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
              <BaseBadge size="md">12</BaseBadge>
              <span style="font-size: 12px; color: var(--text-muted);">Medium</span>
            </div>
            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
              <BaseBadge size="lg">24</BaseBadge>
              <span style="font-size: 12px; color: var(--text-muted);">Large</span>
            </div>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          <h4 style="margin: 0; color: var(--text-secondary); font-size: 14px; font-weight: 600; text-align: center;">COLOR VARIANTS</h4>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-around; align-items: center;">
              <BaseBadge variant="default" size="md">Default</BaseBadge>
              <BaseBadge variant="success" size="md">Success</BaseBadge>
              <BaseBadge variant="warning" size="md">Warning</BaseBadge>
            </div>
            <div style="display: flex; justify-content: space-around; align-items: center;">
              <BaseBadge variant="danger" size="md">Danger</BaseBadge>
              <BaseBadge variant="info" size="md">Info</BaseBadge>
              <BaseBadge variant="count" size="md" rounded>42</BaseBadge>
            </div>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          <h4 style="margin: 0; color: var(--text-secondary); font-size: 14px; font-weight: 600; text-align: center;">SHAPES</h4>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-around; align-items: center;">
              <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                <BaseBadge variant="success" size="md">Square</BaseBadge>
                <span style="font-size: 12px; color: var(--text-muted);">Default</span>
              </div>
              <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                <BaseBadge variant="success" size="md" rounded>Rounded</BaseBadge>
                <span style="font-size: 12px; color: var(--text-muted);">Pill</span>
              </div>
            </div>
            <div style="display: flex; justify-content: space-around; align-items: center;">
              <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                <BaseBadge variant="count" size="sm" rounded>5</BaseBadge>
                <span style="font-size: 12px; color: var(--text-muted);">Count</span>
              </div>
              <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                <BaseBadge variant="count" size="lg" rounded>99+</BaseBadge>
                <span style="font-size: 12px; color: var(--text-muted);">Large</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
  })
}