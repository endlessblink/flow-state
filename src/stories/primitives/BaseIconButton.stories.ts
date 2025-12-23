import type { Meta, StoryObj } from '@storybook/vue3'
import { Search, Settings, Plus, Trash2, Check, X, Bell } from 'lucide-vue-next'
import BaseIconButton from '@/components/base/BaseIconButton.vue'

const meta = {
    title: '🧩 Primitives/BaseIconButton',
    component: BaseIconButton,
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component: 'Square icon-only button with glass morphism styling and status variants.'
            }
        }
    },
    argTypes: {
        variant: {
            control: 'select',
            options: ['default', 'primary', 'success', 'warning', 'danger'],
            description: 'The visual variant of the button'
        },
        size: {
            control: 'select',
            options: ['sm', 'md', 'lg'],
            description: 'The size of the button'
        },
        active: {
            control: 'boolean',
            description: 'Whether the button is in an active/toggled state'
        },
        disabled: {
            control: 'boolean',
            description: 'Whether the button is disabled'
        }
    },
    args: {
        variant: 'default',
        size: 'md',
        active: false,
        disabled: false
    }
} satisfies Meta<typeof BaseIconButton>

export default meta
type Story = StoryObj<typeof meta>

export const Variants: Story = {
    render: (args) => ({
        components: { BaseIconButton, Search, Settings, Plus, Trash2, Check, Bell },
        setup() {
            return { args }
        },
        template: `
      <div style="display: flex; gap: 16px; align-items: center;">
        <BaseIconButton variant="default"><Settings :size="18" /></BaseIconButton>
        <BaseIconButton variant="primary" title="Search"><Search :size="18" /></BaseIconButton>
        <BaseIconButton variant="success"><Check :size="18" /></BaseIconButton>
        <BaseIconButton variant="warning"><Bell :size="18" /></BaseIconButton>
        <BaseIconButton variant="danger"><Trash2 :size="18" /></BaseIconButton>
      </div>
    `
    })
}

export const Sizes: Story = {
    render: (args) => ({
        components: { BaseIconButton, Plus },
        setup() {
            return { args }
        },
        template: `
      <div style="display: flex; gap: 16px; align-items: center;">
        <BaseIconButton size="sm"><Plus :size="14" /></BaseIconButton>
        <BaseIconButton size="md"><Plus :size="18" /></BaseIconButton>
        <BaseIconButton size="lg"><Plus :size="22" /></BaseIconButton>
      </div>
    `
    })
}

export const States: Story = {
    render: (args) => ({
        components: { BaseIconButton, Bell, X },
        setup() {
            return { args }
        },
        template: `
      <div style="display: flex; gap: 16px; align-items: center;">
        <BaseIconButton active variant="primary" title="Active State"><Bell :size="18" /></BaseIconButton>
        <BaseIconButton disabled title="Disabled State"><X :size="18" /></BaseIconButton>
      </div>
    `
    })
}
