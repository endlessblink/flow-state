import type { Meta, StoryObj } from '@storybook/vue3'
import BaseBadge from './BaseBadge.vue'

const meta = {
    title: 'Base/BaseBadge',
    component: BaseBadge,
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component: 'Status badges and counts with refined glass stroke styling.'
            }
        }
    },
    argTypes: {
        variant: {
            control: 'select',
            options: ['default', 'success', 'warning', 'danger', 'info', 'count'],
            description: 'The status variant of the badge'
        },
        size: {
            control: 'select',
            options: ['sm', 'md', 'lg'],
            description: 'The size of the badge'
        },
        rounded: {
            control: 'boolean',
            description: 'Whether the badge should be fully rounded (pill)'
        }
    },
    args: {
        variant: 'default',
        size: 'md',
        rounded: false
    }
} satisfies Meta<typeof BaseBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Variants: Story = {
    render: (args) => ({
        components: { BaseBadge },
        setup() {
            return { args }
        },
        template: `
      <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
        <BaseBadge variant="default">Default</BaseBadge>
        <BaseBadge variant="success">Success</BaseBadge>
        <BaseBadge variant="warning">Warning</BaseBadge>
        <BaseBadge variant="danger">Danger</BaseBadge>
        <BaseBadge variant="info">Info</BaseBadge>
        <BaseBadge variant="count">42</BaseBadge>
      </div>
    `
    })
}

export const Sizes: Story = {
    render: (args) => ({
        components: { BaseBadge },
        setup() {
            return { args }
        },
        template: `
      <div style="display: flex; gap: 12px; align-items: center;">
        <BaseBadge size="sm">Small</BaseBadge>
        <BaseBadge size="md">Medium</BaseBadge>
        <BaseBadge size="lg">Large</BaseBadge>
      </div>
    `
    })
}

export const Rounded: Story = {
    args: {
        rounded: true
    },
    render: (args) => ({
        components: { BaseBadge },
        setup() {
            return { args }
        },
        template: `
      <div style="display: flex; gap: 12px; align-items: center;">
        <BaseBadge rounded variant="success">Pill Success</BaseBadge>
        <BaseBadge rounded variant="count">8</BaseBadge>
      </div>
    `
    })
}
