import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import BaseCard from '@/components/base/BaseCard.vue'

const meta = {
  component: BaseCard,
  title: '🧩 Components/🔘 Base/BaseCard',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof BaseCard>

export default meta
type Story = StoryObj<typeof meta>

// Basic Variants
export const Default: Story = {
  render: () => ({
    components: { BaseCard },
    template: `
      <BaseCard style="width: 300px;">
        <p style="margin: 0;">This is a basic card with default styling and some content.</p>
      </BaseCard>
    `,
  })
}

export const Outlined: Story = {
  render: () => ({
    components: { BaseCard },
    template: `
      <BaseCard variant="outlined" style="width: 300px;">
        <p style="margin: 0;">This card uses the outlined variant with transparent background and visible border.</p>
      </BaseCard>
    `,
  })
}

export const Filled: Story = {
  render: () => ({
    components: { BaseCard },
    template: `
      <BaseCard variant="filled" style="width: 300px;">
        <p style="margin: 0;">This card uses the filled variant with solid background color.</p>
      </BaseCard>
    `,
  })
}

// Effect Variants
export const Hoverable: Story = {
  render: () => ({
    components: { BaseCard },
    template: `
      <BaseCard hoverable style="width: 300px; cursor: pointer;">
        <p style="margin: 0;">Hover over this card to see the interactive effects.</p>
      </BaseCard>
    `,
  })
}

export const Glass: Story = {
  render: () => ({
    components: { BaseCard },
    template: `
      <div style="padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px;">
        <BaseCard glass style="width: 300px;">
          <p style="margin: 0;">This glass effect looks best on colorful backgrounds.</p>
        </BaseCard>
      </div>
    `,
  })
}

export const Elevated: Story = {
  render: () => ({
    components: { BaseCard },
    template: `
      <BaseCard elevated style="width: 300px;">
        <p style="margin: 0;">This card has extra elevation with a larger shadow.</p>
      </BaseCard>
    `,
  })
}

// With Slots
export const WithHeader: Story = {
  render: () => ({
    components: { BaseCard },
    template: `
      <BaseCard style="width: 350px;">
        <template #header>
          <h3 style="margin: 0; color: var(--text-primary); font-size: 16px; font-weight: 600;">
            Task Summary
          </h3>
        </template>
        <p style="margin: 0;">This card has a custom header section.</p>
      </BaseCard>
    `,
  })
}

export const WithFooter: Story = {
  render: () => ({
    components: { BaseCard },
    template: `
      <BaseCard style="width: 350px;">
        <p style="margin: 0;">This card has a custom footer section.</p>
        <template #footer>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 14px; color: var(--text-muted);">Last updated 2h ago</span>
            <button style="padding: 4px 12px; background: var(--brand-primary); color: white; border: none; border-radius: 4px; font-size: 12px;">
              View Details
            </button>
          </div>
        </template>
      </BaseCard>
    `,
  })
}

export const WithHeaderAndFooter: Story = {
  render: () => ({
    components: { BaseCard },
    template: `
      <BaseCard style="width: 350px;">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; color: var(--text-primary); font-size: 16px; font-weight: 600;">
              Project Overview
            </h3>
            <span style="padding: 2px 8px; background: var(--color-work); color: white; border-radius: 12px; font-size: 12px; font-weight: 500;">
              Active
            </span>
          </div>
        </template>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <p style="margin: 0;">This is the main content area with important information.</p>
          <div style="display: flex; gap: 8px;">
            <span style="padding: 4px 8px; background: var(--surface-tertiary); border-radius: 4px; font-size: 12px;">React</span>
            <span style="padding: 4px 8px; background: var(--surface-tertiary); border-radius: 4px; font-size: 12px;">TypeScript</span>
            <span style="padding: 4px 8px; background: var(--surface-tertiary); border-radius: 4px; font-size: 12px;">Vue</span>
          </div>
        </div>

        <template #footer>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 14px; color: var(--text-muted);">3 tasks remaining</span>
            <div style="display: flex; gap: 8px;">
              <button style="padding: 4px 12px; background: transparent; border: 1px solid var(--border-medium); border-radius: 4px; font-size: 12px;">
                Edit
              </button>
              <button style="padding: 4px 12px; background: var(--brand-primary); color: white; border: none; border-radius: 4px; font-size: 12px;">
                Complete
              </button>
            </div>
          </div>
        </template>
      </BaseCard>
    `,
  })
}

// Interactive Examples
export const InteractiveCard: Story = {
  render: () => ({
    components: { BaseCard },
    setup() {
      const clickCount = ref(0)
      const isLiked = ref(false)

      const handleClick = () => {
        clickCount.value++
      }

      const toggleLike = () => {
        isLiked.value = !isLiked.value
      }

      return { clickCount, isLiked, handleClick, toggleLike }
    },
    template: `
      <BaseCard hoverable style="width: 300px;" @click="handleClick">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0;">Interactive Card</h3>
            <button
              @click.stop="toggleLike"
              style="background: none; border: none; font-size: 18px; cursor: pointer;"
            >
              {{ isLiked ? '❤️' : '🤍' }}
            </button>
          </div>
        </template>

        <p style="margin: 0;">Click anywhere on this card to increment the counter!</p>

        <template #footer>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 14px; color: var(--text-muted);">Clicked {{ clickCount }} times</span>
            <span style="font-size: 14px; color: var(--text-muted);">{{ isLiked ? 'Liked' : 'Not liked' }}</span>
          </div>
        </template>
      </BaseCard>
    `,
  })
}

// Task Card Example
export const TaskCard: Story = {
  render: () => ({
    components: { BaseCard },
    template: `
      <BaseCard hoverable elevated style="width: 350px;">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600;">
              Complete Project Documentation
            </h3>
            <div style="display: flex; gap: 4px;">
              <span style="padding: 2px 6px; background: var(--color-work); color: white; border-radius: 8px; font-size: 11px;">
                Work
              </span>
              <span style="padding: 2px 6px; background: var(--color-danger); color: white; border-radius: 8px; font-size: 11px;">
                High
              </span>
            </div>
          </div>
        </template>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <p style="margin: 0; font-size: 14px; color: var(--text-secondary);">
            Write comprehensive documentation for the new task management system including API endpoints and user guide.
          </p>

          <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-muted);">
            <span>📁 Projects</span>
            <span>•</span>
            <span>⏱️ 2 hours</span>
            <span>•</span>
            <span>📅 Due today</span>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 4px;">
              <div style="width: 32px; height: 32px; background: var(--color-work); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; color: white; font-weight: 600;">
                JD
              </div>
              <span style="font-size: 13px; color: var(--text-secondary);">John Doe</span>
            </div>
            <div style="margin-left: auto; display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--text-muted);">
              <div style="width: 12px; height: 12px; border: 2px solid var(--border-medium); border-radius: 50%; border-top-color: var(--color-work); border-right-color: var(--color-work);"></div>
              75%
            </div>
          </div>
        </div>

        <template #footer>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; color: var(--text-muted);">Updated 1 hour ago</span>
            <div style="display: flex; gap: 8px;">
              <button style="padding: 4px 8px; background: transparent; border: 1px solid var(--border-medium); border-radius: 4px; font-size: 12px;">
                Edit
              </button>
              <button style="padding: 4px 8px; background: var(--color-work); color: white; border: none; border-radius: 4px; font-size: 12px;">
                Start Timer
              </button>
            </div>
          </div>
        </template>
      </BaseCard>
    `,
  })
}

// All Variants Showcase
export const AllVariants: Story = {
  render: () => ({
    components: { BaseCard },
    template: `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 20px; min-width: 800px;">
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <h4 style="margin: 0; color: var(--text-secondary); font-size: 14px; font-weight: 600; text-align: center;">BASIC VARIANTS</h4>

          <BaseCard style="width: 100%;">
            <p style="margin: 0; text-align: center;">Default Card</p>
          </BaseCard>

          <BaseCard variant="outlined" style="width: 100%;">
            <p style="margin: 0; text-align: center;">Outlined Card</p>
          </BaseCard>

          <BaseCard variant="filled" style="width: 100%;">
            <p style="margin: 0; text-align: center;">Filled Card</p>
          </BaseCard>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          <h4 style="margin: 0; color: var(--text-secondary); font-size: 14px; font-weight: 600; text-align: center;">EFFECT VARIANTS</h4>

          <BaseCard hoverable style="width: 100%;">
            <p style="margin: 0; text-align: center;">Hoverable Card</p>
          </BaseCard>

          <BaseCard glass style="width: 100%;">
            <p style="margin: 0; text-align: center;">Glass Card</p>
          </BaseCard>

          <BaseCard elevated style="width: 100%;">
            <p style="margin: 0; text-align: center;">Elevated Card</p>
          </BaseCard>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          <h4 style="margin: 0; color: var(--text-secondary); font-size: 14px; font-weight: 600; text-align: center;">WITH SLOTS</h4>

          <BaseCard style="width: 100%;">
            <template #header>
              <h4 style="margin: 0; text-align: center; font-size: 14px;">Header Only</h4>
            </template>
            <p style="margin: 0; text-align: center;">Content here</p>
          </BaseCard>

          <BaseCard style="width: 100%;">
            <p style="margin: 0; text-align: center;">Content here</p>
            <template #footer>
              <p style="margin: 0; text-align: center; font-size: 12px; color: var(--text-muted);">Footer Only</p>
            </template>
          </BaseCard>

          <BaseCard style="width: 100%;">
            <template #header>
              <h4 style="margin: 0; text-align: center; font-size: 14px;">Both</h4>
            </template>
            <p style="margin: 0; text-align: center;">Content</p>
            <template #footer>
              <p style="margin: 0; text-align: center; font-size: 12px; color: var(--text-muted);">Footer</p>
            </template>
          </BaseCard>
        </div>
      </div>
    `,
  })
}