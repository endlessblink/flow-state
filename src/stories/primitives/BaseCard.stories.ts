import type { Meta, StoryObj } from '@storybook/vue3'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseButton from '@/components/base/BaseButton.vue'

const meta: Meta<typeof BaseCard> = {
  title: '🧩 Primitives/BaseCard',
  component: BaseCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'A versatile card component with glass morphism styling, support for header/footer slots, and interactive states.'
      },
      story: {
        inline: true,
      }
    }
  },
  decorators: [
    (story) => {
      // Inject styles to remove card background fill
      if (typeof document !== 'undefined') {
        const styleId = 'basecard-story-styles'
        if (!document.getElementById(styleId)) {
          const style = document.createElement('style')
          style.id = styleId
          style.textContent = `
            .basecard-story-container .base-card {
              background: transparent !important;
              backdrop-filter: none !important;
              -webkit-backdrop-filter: none !important;
            }
          `
          document.head.appendChild(style)
        }
      }
      return {
        components: { story },
        template: `
          <div class="basecard-story-container" style="
            background: var(--glass-bg-solid);
            min-height: 400px;
            height: 100%;
            width: 100%;
            position: relative;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            padding: 2rem;
          ">
            <story />
          </div>
        `
      }
    }
  ],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'outlined', 'filled'],
      description: 'The visual variant of the card'
    },
    hoverable: {
      control: 'boolean',
      description: 'Whether the card should have hover effects'
    },
    glass: {
      control: 'boolean',
      description: 'Whether to use intense glass morphism highlights'
    },
    elevated: {
      control: 'boolean',
      description: 'Whether the card should have deeper shadows for hierarchy'
    }
  },
  args: {
    variant: 'default',
    hoverable: false,
    glass: false,
    elevated: false
  }
}

export default meta
type Story = StoryObj<typeof BaseCard>

export const Default: Story = {
  render: (args) => ({
    components: { BaseCard },
    setup() {
      return { args }
    },
    template: `
      <BaseCard v-bind="args" style="width: 400px;">
        <p style="color: var(--text-primary);">This is the default card content. It uses the Dark Glass aesthetic by default.</p>
      </BaseCard>
    `
  })
}

export const WithHeaderAndFooter: Story = {
  render: (args) => ({
    components: { BaseCard, BaseButton },
    setup() {
      return { args }
    },
    template: `
      <BaseCard v-bind="args" style="width: 400px;">
        <template #header>
          <h3 style="color: var(--text-primary); margin: 0;">Card Header</h3>
        </template>

        <p style="color: var(--text-primary);">Detailed information goes here in the main content section of the card.</p>

        <template #footer>
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <BaseButton variant="ghost" size="sm">Cancel</BaseButton>
            <BaseButton variant="primary" size="sm">Action</BaseButton>
          </div>
        </template>
      </BaseCard>
    `
  })
}

export const Interactive: Story = {
  args: {
    hoverable: true
  },
  render: (args) => ({
    components: { BaseCard },
    setup() {
      return { args }
    },
    template: `
      <BaseCard v-bind="args" style="width: 400px;">
        <h3 style="color: var(--text-primary); margin-bottom: 8px;">Interactive Card</h3>
        <p style="color: var(--text-secondary);">Hover over this card to see the glass highlight and elevation effect.</p>
      </BaseCard>
    `
  })
}

export const GlassVariant: Story = {
  args: {
    glass: true,
    variant: 'default'
  },
  render: (args) => ({
    components: { BaseCard },
    setup() {
      return { args }
    },
    template: `
      <BaseCard v-bind="args" style="width: 400px;">
        <h3 style="color: var(--text-primary); margin-bottom: 8px;">Glass Highlight</h3>
        <p style="color: var(--text-secondary);">The glass variant adds an inset highlight that works best on colorful backgrounds.</p>
      </BaseCard>
    `
  })
}

export const Elevated: Story = {
  args: {
    elevated: true
  },
  render: (args) => ({
    components: { BaseCard },
    setup() {
      return { args }
    },
    template: `
      <BaseCard v-bind="args" style="width: 400px;">
        <h3 style="color: var(--text-primary); margin-bottom: 8px;">Elevated Hierarchy</h3>
        <p style="color: var(--text-secondary);">Deeper shadows help this card stand out as a primary UI element.</p>
      </BaseCard>
    `
  })
}

export const Outlined: Story = {
  args: {
    variant: 'outlined'
  },
  render: (args) => ({
    components: { BaseCard },
    setup() {
      return { args }
    },
    template: `
      <BaseCard v-bind="args" style="width: 400px;">
        <p style="color: var(--text-primary);">Outlined variant with border emphasis.</p>
      </BaseCard>
    `
  })
}

export const Filled: Story = {
  args: {
    variant: 'filled'
  },
  render: (args) => ({
    components: { BaseCard },
    setup() {
      return { args }
    },
    template: `
      <BaseCard v-bind="args" style="width: 400px;">
        <p style="color: var(--text-primary);">Filled variant with solid background.</p>
      </BaseCard>
    `
  })
}
