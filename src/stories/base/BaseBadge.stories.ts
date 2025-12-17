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

// All Sizes
export const Sizes: Story = {
  render: () => ({
    components: { BaseBadge },
    template: `
      <div style="padding: 40px; min-height: 200px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Badge Sizes</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Small, medium, and large badge sizes</p>

        <div style="display: flex; gap: 24px; align-items: center;">
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
    `,
  })
}

// All Variant Colors
export const Variants: Story = {
  render: () => ({
    components: { BaseBadge },
    template: `
      <div style="padding: 40px; min-height: 200px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Badge Variants</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Color variants for different contexts</p>

        <div style="display: flex; gap: 16px; flex-wrap: wrap;">
          <BaseBadge variant="default" size="md">Default</BaseBadge>
          <BaseBadge variant="success" size="md">Success</BaseBadge>
          <BaseBadge variant="warning" size="md">Warning</BaseBadge>
          <BaseBadge variant="danger" size="md">Danger</BaseBadge>
          <BaseBadge variant="info" size="md">Info</BaseBadge>
          <BaseBadge variant="count" size="md" rounded>42</BaseBadge>
        </div>
      </div>
    `,
  })
}

// Shapes
export const Shapes: Story = {
  render: () => ({
    components: { BaseBadge },
    template: `
      <div style="padding: 40px; min-height: 200px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Badge Shapes</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Square vs rounded badge shapes</p>

        <div style="display: flex; gap: 32px;">
          <div>
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">Square (default)</div>
            <div style="display: flex; gap: 12px; align-items: center;">
              <BaseBadge variant="success" size="sm">Done</BaseBadge>
              <BaseBadge variant="warning" size="md">Review</BaseBadge>
              <BaseBadge variant="danger" size="lg">Critical</BaseBadge>
            </div>
          </div>
          <div>
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">Rounded (pill)</div>
            <div style="display: flex; gap: 12px; align-items: center;">
              <BaseBadge variant="success" size="sm" rounded>Done</BaseBadge>
              <BaseBadge variant="warning" size="md" rounded>Review</BaseBadge>
              <BaseBadge variant="danger" size="lg" rounded>Critical</BaseBadge>
            </div>
          </div>
        </div>
      </div>
    `,
  })
}

// Status Indicators
export const StatusBadges: Story = {
  render: () => ({
    components: { BaseBadge },
    template: `
      <div style="padding: 40px; min-height: 300px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Status Indicators</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Real-world usage examples</p>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 80px; font-size: 14px; color: var(--text-secondary);">Task Status:</div>
            <BaseBadge variant="success" size="sm" rounded>Complete</BaseBadge>
            <BaseBadge variant="warning" size="sm" rounded>In Progress</BaseBadge>
            <BaseBadge variant="danger" size="sm" rounded>Overdue</BaseBadge>
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
      </div>
    `,
  })
}

// Task Priority Examples
export const TaskPriorities: Story = {
  render: () => ({
    components: { BaseBadge },
    template: `
      <div style="padding: 40px; min-height: 300px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Task Priority Badges</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Badges in task card context</p>

        <div style="display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: transparent; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px;">
          <BaseBadge variant="danger" size="sm" rounded>High</BaseBadge>
          <span style="font-size: 14px; color: var(--text-primary);">Fix critical bug in production</span>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: transparent; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px;">
          <BaseBadge variant="warning" size="sm" rounded>Medium</BaseBadge>
          <span style="font-size: 14px; color: var(--text-primary);">Update project documentation</span>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: transparent; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px;">
          <BaseBadge variant="info" size="sm" rounded>Low</BaseBadge>
          <span style="font-size: 14px; color: var(--text-primary);">Review code formatting</span>
        </div>
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
      <div style="padding: 40px; min-height: 250px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Interactive Counter</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Click buttons to change count</p>

        <div style="display: flex; flex-direction: column; gap: 16px; align-items: center;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <button @click="decrement" style="padding: 4px 12px; background: transparent; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; cursor: pointer; color: var(--text-primary);">−</button>
          <BaseBadge variant="count" size="lg" rounded>{{ count }}</BaseBadge>
          <button @click="increment" style="padding: 4px 12px; background: transparent; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; cursor: pointer; color: var(--text-primary);">+</button>
        </div>
        </div>
      </div>
    `,
  })
}

// All Variants Showcase
export const AllVariants: Story = {
  render: () => ({
    components: { BaseBadge },
    template: `
      <div style="padding: 40px; min-height: 400px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">All Badge Variants</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Complete overview of badge styles</p>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
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