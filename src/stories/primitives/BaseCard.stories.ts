import type { Meta, StoryObj } from '@storybook/vue3'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseButton from '@/components/base/BaseButton.vue'

const meta = {
    title: '🧩 Primitives/BaseCard',
    component: BaseCard,
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component: 'A versatile card component with glass morphism styling, support for header/footer slots, and interactive states.'
            }
        }
    },
    decorators: [
        (story: any) => ({
            components: { story },
            template: `
        <div style="padding: 100px; background: var(--app-background-gradient); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
          <story />
        </div>
      `
        })
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
} satisfies Meta<typeof BaseCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
    render: (args) => ({
        components: { BaseCard },
        setup() {
            return { args }
        },
        template: `
      <BaseCard v-bind="args" style="width: 400px;">
        <p style="color: white;">This is the default card content. It uses the Dark Glass aesthetic by default.</p>
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
          <h3 style="color: white; margin: 0;">Card Header</h3>
        </template>
        
        <p style="color: white;">Detailed information goes here in the main content section of the card.</p>
        
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
        <h3 style="color: white; margin-bottom: 8px;">Interactive Card</h3>
        <p style="color: #9ca3af;">Hover over this card to see the glass highlight and elevation effect.</p>
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
      <div style="padding: 40px; background: var(--app-background-gradient); border-radius: 12px;">
        <BaseCard v-bind="args" style="width: 400px;">
          <h3 style="color: white; margin-bottom: 8px;">Glass Highlight</h3>
          <p style="color: white; opacity: 0.8;">The glass variant adds an inset highlight that works best on colorful backgrounds.</p>
        </BaseCard>
      </div>
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
        <h3 style="color: white; margin-bottom: 8px;">Elevated Hierarchy</h3>
        <p style="color: #9ca3af;">Deeper shadows help this card stand out as a primary UI element.</p>
      </BaseCard>
    `
    })
}

export const Outlined: Story = {
    args: {
        variant: 'outlined'
    }
}

export const Filled: Story = {
    args: {
        variant: 'filled'
    }
}
